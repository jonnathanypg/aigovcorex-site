from utils.role_helpers import is_multi_center_role
"""
Messaging Channels API
Handles WhatsApp and Telegram channel configuration for License Admins
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import requests
import os

from models import db
from models.user import User
from models.license import License, LicenseAdmin
from services.identity_resolver import IdentityResolver

channels_bp = Blueprint('channels', __name__, url_prefix='/channels')

# WhatsApp API URL (Node.js microservice)
WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def get_license_admin_license(user: User) -> License:
    """Get the license for a license_admin user."""
    if not user.role or not is_multi_center_role(user):
        return None
    
    admin_profile = LicenseAdmin.query.filter_by(user_id=user.id).first()
    if not admin_profile:
        return None
    
    return License.query.get(admin_profile.license_id)


# ========================
# WHATSAPP ENDPOINTS
# ========================

@channels_bp.route('/whatsapp/init', methods=['POST'])
@jwt_required()
def init_whatsapp_session():
    """
    Initialize WhatsApp session for the license.
    This triggers QR code generation in the api-whatsapp microservice.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos para configurar canales'}), 403
    
    try:
        # Call api-whatsapp to initialize session
        response = requests.post(
            f"{WHATSAPP_API_URL}/session/init",
            json={'companyId': str(license_obj.id)},
            timeout=30
        )
        
        if response.status_code == 200:
            # Update license session ID
            license_obj.whatsapp_session_id = str(license_obj.id)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Sesión de WhatsApp iniciada. Por favor escanea el código QR.',
                'session_id': str(license_obj.id)
            }), 200
        else:
            return jsonify({
                'error': 'Error al iniciar sesión de WhatsApp',
                'details': response.text
            }), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'No se pudo conectar con el servicio de WhatsApp',
            'details': str(e)
        }), 503


@channels_bp.route('/whatsapp/qr', methods=['GET'])
@jwt_required()
def get_whatsapp_qr():
    """
    Get the WhatsApp QR code for scanning.
    Returns the QR code image as base64.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    try:
        response = requests.get(
            f"{WHATSAPP_API_URL}/session/qr/{license_obj.id}",
            timeout=30
        )
        
        if response.status_code == 200:
            # The Node service returns raw SVG text
            svg_content = response.text
             # Wrap in JSON for the frontend
            return jsonify({'qr': svg_content, 'success': True}), 200
        else:
            return jsonify({
                'error': 'QR no disponible',
                'details': response.text
            }), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'No se pudo obtener el código QR',
            'details': str(e)
        }), 503


@channels_bp.route('/whatsapp/status', methods=['GET'])
@jwt_required()
def get_whatsapp_status():
    """
    Get WhatsApp connection status.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    try:
        response = requests.get(
            f"{WHATSAPP_API_URL}/session/status/{license_obj.id}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Update local state if connection status changed
            is_connected = data.get('status') == 'open'
            if license_obj.whatsapp_connected != is_connected:
                license_obj.whatsapp_connected = is_connected
                if is_connected and data.get('phone'):
                    license_obj.whatsapp_phone = data.get('phone')
                db.session.commit()
            
            return jsonify({
                'connected': is_connected,
                'phone': license_obj.whatsapp_phone,
                'admin_phone': license_obj.whatsapp_admin_phone,
                'status': data.get('status')
            }), 200
        else:
            return jsonify({
                'connected': False,
                'status': 'disconnected'
            }), 200
            
    except requests.exceptions.RequestException:
        return jsonify({
            'connected': license_obj.whatsapp_connected,
            'phone': license_obj.whatsapp_phone,
            'admin_phone': license_obj.whatsapp_admin_phone,
            'status': 'unknown'
        }), 200


@channels_bp.route('/whatsapp/admin-phone', methods=['POST'])
@jwt_required()
def update_whatsapp_admin_phone():
    """
    Update the administrator's personal WhatsApp number.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    data = request.get_json() or {}
    phone = data.get('phone')
    
    # Allow clearing the phone number if empty string or None
    if phone == "":
        phone = None
        
    license_obj.whatsapp_admin_phone = phone
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Número de administrador actualizado',
        'admin_phone': phone
    }), 200


@channels_bp.route('/whatsapp/disconnect', methods=['POST'])
@jwt_required()
def disconnect_whatsapp():
    """
    Disconnect WhatsApp session.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    try:
        response = requests.post(
            f"{WHATSAPP_API_URL}/session/logout",
            json={'companyId': str(license_obj.id)},
            timeout=30
        )
        
        # Update local state regardless of response
        license_obj.whatsapp_connected = False
        license_obj.whatsapp_phone = None
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'WhatsApp desconectado'
        }), 200
        
    except requests.exceptions.RequestException as e:
        # Still update local state
        license_obj.whatsapp_connected = False
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Estado local actualizado',
            'warning': str(e)
        }), 200


# ========================
# TELEGRAM ENDPOINTS
# ========================

@channels_bp.route('/telegram/connect', methods=['POST'])
@jwt_required()
def connect_telegram():
    """
    Connect Telegram bot to the license.
    Expects: { "bot_token": "123456:ABC..." }
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    data = request.get_json() or {}
    bot_token = data.get('bot_token')
    
    if not bot_token:
        return jsonify({'error': 'Token del bot requerido'}), 400
    
    # Validate the bot token with Telegram API
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10
        )
        
        if response.status_code != 200:
            return jsonify({'error': 'Token de bot inválido'}), 400
        
        bot_info = response.json()
        if not bot_info.get('ok'):
            return jsonify({'error': 'Token de bot inválido'}), 400
        
        bot_username = bot_info.get('result', {}).get('username')
        
        # Save bot configuration
        license_obj.telegram_bot_token = bot_token
        license_obj.telegram_bot_username = bot_username
        license_obj.telegram_connected = True
        db.session.commit()
        
        # --- AUTOMATED WEBHOOK SETUP ---
        from flask import current_app
        app_url = current_app.config.get('APP_URL', 'https://app.kindicoreai.sbs')
        webhook_url = f"{app_url}/webhooks/telegram"
        
        try:
            webhook_response = requests.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={'url': webhook_url},
                timeout=10
            )
            webhook_data = webhook_response.json()
            if not webhook_data.get('ok'):
                print(f"⚠️ [Telegram Auto-Config] Webhook setup failed: {webhook_data}")
            else:
                 print(f"✅ [Telegram Auto-Config] Webhook set to: {webhook_url}")

        except Exception as e:
            print(f"⚠️ [Telegram Auto-Config] Webhook setup error: {e}")
        
        return jsonify({
            'success': True,
            'bot_username': bot_username,
            'message': f'Bot @{bot_username} conectado exitosamente. Webhook configurado.'
        }), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Error al validar token',
            'details': str(e)
        }), 503


@channels_bp.route('/telegram/status', methods=['GET'])
@jwt_required()
def get_telegram_status():
    """
    Get Telegram bot connection status.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    return jsonify({
        'connected': license_obj.telegram_connected,
        'bot_username': license_obj.telegram_bot_username
    }), 200


@channels_bp.route('/telegram/disconnect', methods=['POST'])
@jwt_required()
def disconnect_telegram():
    """
    Disconnect Telegram bot.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No tienes permisos'}), 403
    
    license_obj.telegram_connected = False
    license_obj.telegram_bot_token = None
    license_obj.telegram_bot_username = None
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Bot de Telegram desconectado'
    }), 200


# ========================
# COMBINED STATUS
# ========================

@channels_bp.route('/status', methods=['GET'])
@jwt_required()
def get_all_channels_status():
    """
    Get status of all messaging channels.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    license_obj = get_license_admin_license(current_user)
    
    # If not admin, try to find license through tenant
    if not license_obj:
        if current_user.tenant_id:
            from models.tenant import Tenant
            tenant = Tenant.query.get(current_user.tenant_id)
            if tenant:
                license_obj = License.query.get(tenant.license_id)
    
    if not license_obj:
        return jsonify({'error': 'No tienes permisos o no perteneces a una licencia activa'}), 403
    
    # Return status (safe for all users)
    return jsonify({
        'whatsapp': {
            'connected': license_obj.whatsapp_connected,
            'phone': license_obj.whatsapp_phone,
            # Only show admin_phone to admins, though it's not critical
            'admin_phone': license_obj.whatsapp_admin_phone if is_multi_center_role(current_user) else None
        },
        'telegram': {
            'connected': license_obj.telegram_connected,
            'bot_username': license_obj.telegram_bot_username
        }
    }), 200


# ========================
# USER TELEGRAM LINKING
# ========================

@channels_bp.route('/telegram/link-code', methods=['POST'])
@jwt_required()
def generate_link_code():
    """
    Generate a Telegram linking code for the current user.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    code = IdentityResolver.generate_telegram_link_code(current_user.id)
    if not code:
        return jsonify({'error': 'Error al generar código'}), 500
    
    return jsonify({
        'success': True,
        'link_code': code,
        'instructions': 'Envía este código al bot de Telegram para vincular tu cuenta'
    }), 200


@channels_bp.route('/telegram/verify-link', methods=['POST'])
def verify_telegram_link():
    """
    Verify and complete Telegram account linking.
    Called by Telegram webhook when user sends link code.
    
    Expects: { "link_code": "ABC123", "chat_id": "123456789" }
    """
    db.session.rollback()
    
    data = request.get_json() or {}
    link_code = data.get('link_code')
    chat_id = data.get('chat_id')
    
    if not link_code or not chat_id:
        return jsonify({'error': 'Código y chat_id requeridos'}), 400
    
    result = IdentityResolver.link_telegram_account(link_code, chat_id)
    
    if result.get('success'):
        return jsonify(result), 200
    else:
        return jsonify(result), 400


@channels_bp.route('/my-whatsapp', methods=['GET', 'POST'])
@jwt_required()
def update_my_whatsapp():
    """
    Get or Update the current user's personal WhatsApp number for AI recognition.
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    if request.method == 'GET':
        return jsonify({
            'whatsapp_phone': current_user.whatsapp_phone
        }), 200
    
    data = request.get_json() or {}
    phone = data.get('phone')
    
    # Allow clearing the phone number if empty string or None
    if phone == "":
        phone = None
    
    # If phone is provided, ensure it's unique (optional, but good practice)
    if phone:
        # Check if another user already uses this whatsapp_phone
        existing = User.query.filter(User.whatsapp_phone == phone, User.id != current_user.id).first()
        if existing:
            return jsonify({'error': 'Este número de WhatsApp ya está registrado por otro usuario'}), 400
            
    current_user.whatsapp_phone = phone
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Tu número de WhatsApp ha sido actualizado',
        'whatsapp_phone': phone
    }), 200
