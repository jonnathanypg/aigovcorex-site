"""
Channels OS API Blueprint
AI GovCoreX OS — Gestión de Canales de Comunicación Multi-Tenant (OS Layer)

Note: This blueprint uses the prefix /channels-os to avoid collision with
the existing /channels blueprint (which manages per-license WhatsApp/Telegram).
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.channel_config import ChannelConfig, ChannelConversation, ChannelMessage
from models.user import User
from models.license import License, LicenseAdmin
from models.tenant import Tenant
from utils.role_helpers import is_multi_center_role, get_license_id_for_user
import logging
import os
import requests

logger = logging.getLogger(__name__)

channels_os_bp = Blueprint('channels_os', __name__, url_prefix='/channels-os')

WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def _get_scope(user):
    """Resuelve (is_super, license_id, tenant_id, role_name) para control por tenant + rol."""
    role_name = None
    try:
        role_name = user.role.name if hasattr(user.role, 'name') else user.role
    except Exception:
        role_name = None
    is_super = (role_name == 'super_admin')
    license_id = None
    try:
        license_id = get_license_id_for_user(user)
    except Exception:
        license_id = None
    return is_super, license_id, user.tenant_id, role_name


def _channel_license_id(channel):
    return getattr(channel, 'license_id', None)


def _check_channel_access(user, channel, scope=None):
    """True si el usuario puede ver/editar/borrar el canal (tenant + rol)."""
    is_super, license_id, tenant_id, role_name = scope or _get_scope(user)
    if is_super:
        return True
    ch_license = _channel_license_id(channel)
    if ch_license and license_id and int(ch_license) == int(license_id):
        return True
    if ch_license is None:
        # Canales matriz legacy sin license_id: visibles para roles multi-centro
        return bool(is_multi_center_role(user))
    return False


def _company_id_for_channel(channel):
    """companyId usado contra whatsapp-voice: session_id propio o derivado del canal."""
    sid = getattr(channel, 'session_id', None)
    if sid:
        return str(sid)
    return f"channel-{channel.id}"


@channels_os_bp.route('/', methods=['GET'])
@jwt_required()
def list_channels():
    """Lista todos los canales OS configurados con filtros opcionales (control por tenant + rol)"""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        is_super, license_id, tenant_id, role_name = _get_scope(user) if user else (False, None, None, None)

        org_id = request.args.get('org_id', type=int)
        program_id = request.args.get('program_id', type=int)
        channel_type = request.args.get('channel_type')

        query = ChannelConfig.query.filter_by(is_active=True)
        if org_id:
            query = query.filter_by(org_id=org_id)
        if program_id:
            query = query.filter_by(program_id=program_id)
        if channel_type:
            query = query.filter_by(channel_type=channel_type)

        # Control por tenant + rol: no super_admin queda acotado a su licencia
        if user and not is_super and license_id:
            query = query.filter(
                (ChannelConfig.license_id == license_id) | (ChannelConfig.license_id.is_(None))
            )

        channels = query.all()
        # Filtrado fino post-query (canal legacy sin licencia solo para multi-centro)
        if user and not is_super:
            channels = [c for c in channels if _check_channel_access(user, c, (is_super, license_id, tenant_id, role_name))]
        return jsonify({'success': True, 'data': [c.to_dict() for c in channels], 'count': len(channels)})
    except Exception as e:
        logger.error(f'Error listing channels: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/', methods=['POST'])
@jwt_required()
def create_channel():
    """Crea una nueva configuración de canal OS (dedicada o heredada de un canal matriz)"""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        is_super, license_id, tenant_id, role_name = _get_scope(user)
        # Crear requiere rol multi-centro (o super_admin); el resto solo hereda lectura
        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos para crear conexiones'}), 403

        data = request.get_json() or {}
        if not data.get('channel_type'):
            return jsonify({'success': False, 'error': 'Missing required field: channel_type'}), 400
        if data.get('channel_type') not in ('whatsapp', 'telegram'):
            return jsonify({'success': False, 'error': 'channel_type debe ser whatsapp o telegram'}), 400

        # Vínculo por proyecto: program_id/entidad + modo dedicada vs heredada/compartida
        ownership_type = data.get('ownership_type', 'dedicated')
        if ownership_type not in ('dedicated', 'inherited', 'shared'):
            return jsonify({'success': False, 'error': 'ownership_type inválido'}), 400
        parent_channel_id = data.get('parent_channel_id')
        if ownership_type == 'inherited':
            if not parent_channel_id:
                return jsonify({'success': False, 'error': 'Heredar requiere parent_channel_id'}), 400
            parent = ChannelConfig.query.get(parent_channel_id)
            if not parent or not parent.is_active:
                return jsonify({'success': False, 'error': 'Canal padre no encontrado'}), 404
            if not _check_channel_access(user, parent, (is_super, license_id, tenant_id, role_name)):
                return jsonify({'success': False, 'error': 'Sin acceso al canal padre'}), 403

        # license_id: del payload o heredado del scope del usuario (tenant + rol)
        resolved_license_id = data.get('license_id') or license_id

        channel = ChannelConfig(
            org_id=data.get('org_id'),
            program_id=data.get('program_id'),
            license_id=resolved_license_id,
            channel_type=data['channel_type'],
            channel_name=data.get('channel_name'),
            phone_number=data.get('phone_number'),
            session_id=data.get('session_id'),
            bot_token=data.get('bot_token'),
            bot_username=data.get('bot_username'),
            ownership_type=ownership_type,
            parent_channel_id=parent_channel_id,
            status=data.get('status', 'connected' if ownership_type == 'inherited' else 'disconnected'),
            access_level=data.get('access_level', 'program'),
            data_isolation_level=data.get('data_isolation_level', 'strict'),
            agent_name=data.get('agent_name'),
            agent_personality=data.get('agent_personality'),
            agent_voice=data.get('agent_voice', 'es-EC-LuisNeural'),
            welcome_message=data.get('welcome_message'),
            allowed_programs=data.get('allowed_programs', []),
            config_data=data.get('config_data', {}),
        )
        db.session.add(channel)
        db.session.commit()
        return jsonify({'success': True, 'data': channel.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creating channel: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>', methods=['GET'])
@jwt_required()
def get_channel(channel_id: int):
    """Obtiene detalles de un canal OS (control por tenant + rol)"""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        channel = ChannelConfig.query.get_or_404(channel_id)
        if user and not _check_channel_access(user, channel):
            return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
        return jsonify({'success': True, 'data': channel.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>', methods=['PUT'])
@jwt_required()
def update_channel(channel_id: int):
    """Actualiza configuración de un canal OS (control por tenant + rol)"""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        channel = ChannelConfig.query.get_or_404(channel_id)
        if user and not _check_channel_access(user, channel):
            return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
        if user and not is_multi_center_role(user) and not _get_scope(user)[0]:
            return jsonify({'success': False, 'error': 'No tienes permisos para editar conexiones'}), 403
        data = request.get_json() or {}

        updatable_fields = [
            'channel_name', 'access_level', 'data_isolation_level',
            'agent_name', 'agent_personality', 'agent_voice',
            'welcome_message', 'allowed_programs', 'config_data', 'is_active',
            # Vínculo por proyecto + estado de vinculación (QR/token)
            'program_id', 'org_id', 'ownership_type', 'parent_channel_id',
            'status', 'phone_number', 'session_id', 'bot_username',
        ]
        for field in updatable_fields:
            if field in data:
                setattr(channel, field, data[field])

        db.session.commit()
        return jsonify({'success': True, 'data': channel.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>', methods=['DELETE'])
@jwt_required()
def delete_channel(channel_id: int):
    """Elimina (soft-delete) una conexión de canal OS. Control por tenant + rol."""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        channel = ChannelConfig.query.get(channel_id)
        if not channel or not channel.is_active:
            return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
        is_super, license_id, tenant_id, role_name = _get_scope(user)
        if not _check_channel_access(user, channel, (is_super, license_id, tenant_id, role_name)):
            return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
        # Solo roles multi-centro / super_admin pueden borrar
        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos para eliminar conexiones'}), 403
        # No borrar un canal matriz con herencias activas
        active_children = ChannelConfig.query.filter_by(parent_channel_id=channel.id, is_active=True).count()
        if active_children > 0:
            return jsonify({
                'success': False,
                'error': f'No se puede eliminar: {active_children} programa(s) heredan este canal. Elimina primero las herencias.'
            }), 409
        channel.is_active = False
        channel.status = 'disconnected'
        db.session.commit()
        return jsonify({'success': True, 'message': 'Conexión eliminada'})
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error deleting channel {channel_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>/conversations', methods=['GET'])
@jwt_required()
def list_conversations(channel_id: int):
    """Lista conversaciones de un canal OS"""
    try:
        status = request.args.get('status')
        query = ChannelConversation.query.filter_by(channel_id=channel_id)
        if status:
            query = query.filter_by(status=status)
        convs = query.order_by(ChannelConversation.last_message_at.desc()).limit(50).all()
        return jsonify({'success': True, 'data': [c.to_dict() for c in convs]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>/conversations', methods=['POST'])
@jwt_required()
def create_conversation(channel_id: int):
    """Registra una nueva conversación en un canal OS"""
    try:
        data = request.get_json() or {}

        conv = ChannelConversation(
            channel_id=channel_id,
            program_id=data.get('program_id'),
            beneficiary_id=data.get('beneficiary_id'),
            external_id=data.get('external_id'),
            contact_name=data.get('contact_name'),
            contact_phone=data.get('contact_phone'),
            conversation_type=data.get('conversation_type', 'onboarding'),
            status=data.get('status', 'open'),
            current_step=data.get('current_step'),
            form_data_collected=data.get('form_data_collected', {}),
        )
        db.session.add(conv)
        db.session.commit()
        return jsonify({'success': True, 'data': conv.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ========================
# VINCULACIÓN POR CANAL (QR WhatsApp / Token Telegram)
# Proxy simple hacia whatsapp-voice (GET /session/qr/:companyId, etc.)
# ========================

# Anti-bucle init: companyId -> timestamp del último init disparado.
# Cooldown reducido a 10s para canales en 'pending_qr' (QR generándose),
# 90s para otros estados. Esto permite reintento rápido mientras Baileys negocia el socket.
_QR_INIT_IN_PROGRESS: dict = {}

@channels_os_bp.route('/<int:channel_id>/whatsapp/init', methods=['POST'])
@jwt_required()
def os_whatsapp_init(channel_id: int):
    """Inicializa sesión WhatsApp del canal (proxy a whatsapp-voice POST /session/init)."""
    from flask_jwt_extended import get_jwt_identity as _gji
    user = User.query.get(_gji())
    channel = ChannelConfig.query.get(channel_id)
    if not channel or not channel.is_active:
        return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
    if user and not _check_channel_access(user, channel):
        return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
    if channel.channel_type != 'whatsapp':
        return jsonify({'success': False, 'error': 'El canal no es de WhatsApp'}), 400
    company_id = _company_id_for_channel(channel)
    try:
        resp = requests.post(f"{WHATSAPP_API_URL}/session/init", json={'companyId': company_id}, timeout=30)
        if resp.status_code == 200:
            if not channel.session_id:
                channel.session_id = company_id
            channel.status = 'pending_qr'
            db.session.commit()
            return jsonify({'success': True, 'data': resp.json(), 'company_id': company_id}), 200
        return jsonify({'success': False, 'error': 'Error al iniciar sesión', 'details': resp.text}), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({'success': False, 'error': 'Servicio WhatsApp no disponible', 'details': str(e)}), 503


@channels_os_bp.route('/<int:channel_id>/whatsapp/qr', methods=['GET'])
@jwt_required()
def os_whatsapp_qr(channel_id: int):
    """Devuelve el QR del canal (proxy a whatsapp-voice GET /session/qr/:companyId)."""
    from flask_jwt_extended import get_jwt_identity as _gji
    user = User.query.get(_gji())
    channel = ChannelConfig.query.get(channel_id)
    if not channel or not channel.is_active:
        return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
    if user and not _check_channel_access(user, channel):
        return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
    if channel.channel_type != 'whatsapp':
        return jsonify({'success': False, 'error': 'El canal no es de WhatsApp'}), 400
    company_id = _company_id_for_channel(channel)
    import time as _time

    def _fetch_qr():
        try:
            resp = requests.get(f"{WHATSAPP_API_URL}/session/qr/{company_id}", timeout=15)
        except requests.exceptions.RequestException:
            return None
        if resp.status_code != 200:
            return None
        ctype = resp.headers.get('Content-Type', '')
        if 'image/svg' in ctype or resp.text.lstrip().startswith('<svg'):
            return resp.text
        try:
            payload = resp.json()
            return payload.get('qr') or payload.get('qrSvg') or payload.get('data')
        except Exception:
            return resp.text or None

    qr = _fetch_qr()
    # Control anti-bucle: cooldown dinámico según estado del canal.
    # - 'pending_qr': 10s (permite reintento rápido mientras Baileys genera QR)
    # - otros: 90s (evita bucles en sesiones estables)
    # Con ?no_init=1 el frontend solo sondea (polling); el init se dispara
    # explícitamente al abrir el diálogo, con Reintentar, o auto-retry aquí.
    no_init = (request.args.get('no_init') or '').lower() in ('1', 'true', 'yes')
    now = _time.time()
    last_init = _QR_INIT_IN_PROGRESS.get(company_id, 0)
    cooldown = 10 if channel.status == 'pending_qr' else 90
    if not qr and not no_init and (now - last_init) > cooldown:
        _QR_INIT_IN_PROGRESS[company_id] = now
        try:
            requests.post(f"{WHATSAPP_API_URL}/session/init", json={'companyId': company_id}, timeout=15)
            if not channel.session_id:
                channel.session_id = company_id
            channel.status = 'pending_qr'
            db.session.commit()
        except requests.exceptions.RequestException as e:
            _QR_INIT_IN_PROGRESS.pop(company_id, None)
            return jsonify({'success': False, 'error': 'Servicio WhatsApp no disponible', 'details': str(e)}), 503
        except Exception:
            try:
                db.session.rollback()
            except Exception:
                pass
        _time.sleep(3)
        qr = _fetch_qr()
    if qr:
        # QR disponible: limpiar cooldown para permitir nuevo init futuro si hace falta
        _QR_INIT_IN_PROGRESS.pop(company_id, None)
        return jsonify({'success': True, 'qr': qr, 'company_id': company_id}), 200
    # Aún generándose (Baileys negocia el socket): 202 para que el frontend
    # siga con polling en vez de mostrar error.
    return jsonify({'success': False, 'retry': True,
                    'error': 'QR en generación, reintenta en unos segundos',
                    'company_id': company_id}), 202


@channels_os_bp.route('/<int:channel_id>/whatsapp/status', methods=['GET'])
@jwt_required()
def os_whatsapp_status(channel_id: int):
    """Estado de sesión WhatsApp del canal (proxy + DISCONNECTED/CONNECTED)."""
    from flask_jwt_extended import get_jwt_identity as _gji
    user = User.query.get(_gji())
    channel = ChannelConfig.query.get(channel_id)
    if not channel or not channel.is_active:
        return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
    if user and not _check_channel_access(user, channel):
        return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
    if channel.channel_type != 'whatsapp':
        return jsonify({'success': False, 'error': 'El canal no es de WhatsApp'}), 400
    company_id = _company_id_for_channel(channel)
    try:
        resp = requests.get(f"{WHATSAPP_API_URL}/session/status/{company_id}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            raw = str(data.get('status', '')).lower()
            connected = raw in ('open', 'connected', 'conectado') or data.get('connected') is True
            new_status = 'connected' if connected else 'disconnected'
            if channel.status != new_status:
                channel.status = new_status
                if connected and data.get('phone'):
                    channel.phone_number = data.get('phone')
                db.session.commit()
            return jsonify({'success': True, 'connected': connected, 'status': new_status,
                            'phone': channel.phone_number, 'company_id': company_id}), 200
        return jsonify({'success': True, 'connected': False, 'status': channel.status or 'disconnected',
                        'company_id': company_id}), 200
    except requests.exceptions.RequestException:
        return jsonify({'success': True, 'connected': channel.status == 'connected',
                        'status': channel.status or 'disconnected', 'company_id': company_id}), 200


@channels_os_bp.route('/<int:channel_id>/telegram/connect', methods=['POST'])
@jwt_required()
def os_telegram_connect(channel_id: int):
    """Guarda/valida el bot token de Telegram para el canal (por tenant/programa)."""
    from flask_jwt_extended import get_jwt_identity as _gji
    user = User.query.get(_gji())
    channel = ChannelConfig.query.get(channel_id)
    if not channel or not channel.is_active:
        return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
    if user and not _check_channel_access(user, channel):
        return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
    if channel.channel_type != 'telegram':
        return jsonify({'success': False, 'error': 'El canal no es de Telegram'}), 400
    data = request.get_json() or {}
    bot_token = (data.get('bot_token') or '').strip()
    if not bot_token:
        return jsonify({'success': False, 'error': 'bot_token requerido'}), 400
    try:
        check = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=10)
        if check.status_code != 200 or not check.json().get('ok'):
            return jsonify({'success': False, 'error': 'Token de bot inválido'}), 400
        bot_username = check.json().get('result', {}).get('username')
    except requests.exceptions.RequestException as e:
        return jsonify({'success': False, 'error': 'Error al validar token', 'details': str(e)}), 503
    channel.bot_token = bot_token
    channel.bot_username = bot_username
    channel.status = 'connected'
    db.session.commit()
    return jsonify({'success': True, 'data': channel.to_dict(), 'bot_username': bot_username}), 200


@channels_os_bp.route('/<int:channel_id>/telegram/disconnect', methods=['POST'])
@jwt_required()
def os_telegram_disconnect(channel_id: int):
    """Desvincula el bot de Telegram del canal."""
    from flask_jwt_extended import get_jwt_identity as _gji
    user = User.query.get(_gji())
    channel = ChannelConfig.query.get(channel_id)
    if not channel or not channel.is_active:
        return jsonify({'success': False, 'error': 'Canal no encontrado'}), 404
    if user and not _check_channel_access(user, channel):
        return jsonify({'success': False, 'error': 'Sin acceso a este canal'}), 403
    channel.bot_token = None
    channel.status = 'disconnected'
    db.session.commit()
    return jsonify({'success': True, 'data': channel.to_dict()}), 200


@channels_os_bp.route('/root-channels', methods=['GET'])
@jwt_required()
def get_root_channels():
    """
    Obtiene canales raíz (License + Organization) que pueden ser heredados.
    Estos son los canales principales configurados a nivel de Licencia u Organización.
    """
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        from models.license import License
        from models.organization import Organization
        
        user = User.query.get(_gji())
        is_super, license_id, tenant_id, role_name = _get_scope(user)
        
        root_channels = []
        
        # 1. Canales de Licencia (si el usuario tiene acceso a la licencia)
        # Nota: License.is_active es método, no columna; se filtra por status en Python.
        if is_super:
            licenses = License.query.all()
        elif license_id:
            lic = License.query.get(license_id)
            licenses = [lic] if lic else []
        else:
            licenses = []
        # Solo licencias activas (status active o sin status definido)
        licenses = [l for l in licenses if (getattr(l, 'status', 'active') or 'active') == 'active']
        for lic in licenses:
            # WhatsApp de la licencia
            if lic.whatsapp_connected and lic.whatsapp_phone:
                root_channels.append({
                    'id': f'license-{lic.id}-whatsapp',
                    'type': 'license_whatsapp',
                    'source_id': lic.id,
                    'source_name': lic.name,
                    'source_type': 'license',
                    'channel_type': 'whatsapp',
                    'phone_number': lic.whatsapp_phone,
                    'session_id': lic.whatsapp_session_id,
                    'agent_name': lic.agent_name or 'GovCore AI',
                    'status': 'connected',
                    'can_inherit': True,
                    'description': f"WhatsApp de la licencia: {lic.name}"
                })
            elif lic.whatsapp_session_id or lic.whatsapp_admin_phone:
                # Canal WhatsApp configurado pero no conectado aún
                root_channels.append({
                    'id': f'license-{lic.id}-whatsapp',
                    'type': 'license_whatsapp',
                    'source_id': lic.id,
                    'source_name': lic.name,
                    'source_type': 'license',
                    'channel_type': 'whatsapp',
                    'phone_number': lic.whatsapp_phone,
                    'session_id': lic.whatsapp_session_id,
                    'agent_name': lic.agent_name or 'GovCore AI',
                    'status': 'disconnected',
                    'can_inherit': True,
                    'description': f"WhatsApp de la licencia: {lic.name}"
                })
            
            # Telegram de la licencia
            if lic.telegram_connected and lic.telegram_bot_token:
                root_channels.append({
                    'id': f'license-{lic.id}-telegram',
                    'type': 'license_telegram',
                    'source_id': lic.id,
                    'source_name': lic.name,
                    'source_type': 'license',
                    'channel_type': 'telegram',
                    'bot_username': lic.telegram_bot_username,
                    'agent_name': lic.agent_name or 'GovCore AI',
                    'status': 'connected',
                    'can_inherit': True,
                    'description': f"Telegram de la licencia: {lic.name}"
                })
            elif lic.telegram_bot_token:
                root_channels.append({
                    'id': f'license-{lic.id}-telegram',
                    'type': 'license_telegram',
                    'source_id': lic.id,
                    'source_name': lic.name,
                    'source_type': 'license',
                    'channel_type': 'telegram',
                    'bot_username': lic.telegram_bot_username,
                    'agent_name': lic.agent_name or 'GovCore AI',
                    'status': 'disconnected',
                    'can_inherit': True,
                    'description': f"Telegram de la licencia: {lic.name}"
                })
        
        # 2. Canales de Organización vinculadas a la licencia del usuario
        # (Organization.license_id -> License). Tenant no tiene organization_id.
        try:
            org_query = Organization.query.filter_by(is_active=True)
            if not is_super and license_id:
                org_query = org_query.filter(
                    (Organization.license_id == license_id) | (Organization.license_id.is_(None))
                )
            orgs = org_query.all()
        except Exception:
            orgs = []
        for org in orgs:
            # WhatsApp de la organización
            if org.whatsapp_phone:
                root_channels.append({
                    'id': f'org-{org.id}-whatsapp',
                    'type': 'org_whatsapp',
                    'source_id': org.id,
                    'source_name': org.name,
                    'source_type': 'organization',
                    'channel_type': 'whatsapp',
                    'phone_number': org.whatsapp_phone,
                    'session_id': org.whatsapp_session_id,
                    'agent_name': 'GovCore AI',
                    'status': 'connected' if org.whatsapp_session_id else 'disconnected',
                    'can_inherit': True,
                    'description': f"WhatsApp de la organización: {org.name}"
                })

            # Telegram de la organización
            if org.telegram_bot_token:
                root_channels.append({
                    'id': f'org-{org.id}-telegram',
                    'type': 'org_telegram',
                    'source_id': org.id,
                    'source_name': org.name,
                    'source_type': 'organization',
                    'channel_type': 'telegram',
                    'bot_username': org.telegram_bot_username,
                    'status': 'connected' if org.telegram_bot_username else 'disconnected',
                    'can_inherit': True,
                    'description': f"Telegram de la organización: {org.name}"
                })
        
        return jsonify({'success': True, 'data': root_channels, 'count': len(root_channels)})
    except Exception as e:
        logger.error(f'Error getting root channels: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/stats', methods=['GET'])
@jwt_required()
def channels_stats():
    """Estadísticas globales del módulo canales OS"""
    try:
        stats = {
            'channels': {
                'total': ChannelConfig.query.filter_by(is_active=True).count(),
                'whatsapp': ChannelConfig.query.filter_by(channel_type='whatsapp', is_active=True).count(),
                'telegram': ChannelConfig.query.filter_by(channel_type='telegram', is_active=True).count(),
                'connected': ChannelConfig.query.filter_by(status='connected', is_active=True).count(),
            },
            'conversations': {
                'total': ChannelConversation.query.count(),
                'open': ChannelConversation.query.filter_by(status='open').count(),
                'completed': ChannelConversation.query.filter_by(status='completed').count(),
            }
        }
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================
# BANDEJA DE CONVERSACIONES (Inbox estilo aikrofy)
# ============================================================

@channels_os_bp.route('/conversations', methods=['GET'])
@jwt_required()
def list_all_conversations():
    """Lista unificada de conversaciones con filtros (programa, canal, estado, búsqueda).
    Réplica GET /chat/conversations de aikrofy."""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        is_super, license_id, tenant_id, role_name = _get_scope(user)

        # Filtros query
        program_id = request.args.get('program_id', type=int)
        channel_id = request.args.get('channel_id', type=int)
        channel_type = request.args.get('channel_type')
        status = request.args.get('status')
        handover = request.args.get('handover')
        search = request.args.get('search', '').strip()
        page = max(int(request.args.get('page', 1)), 1)
        per_page = min(max(int(request.args.get('per_page', 25)), 1), 100)

        # Query base con acceso por tenant/rol
        q = ChannelConversation.query.join(ChannelConfig, ChannelConversation.channel_id == ChannelConfig.id)
        q = q.filter(ChannelConfig.is_active.is_(True))

        if not is_super and license_id:
            q = q.filter((ChannelConfig.license_id == license_id) | (ChannelConfig.license_id.is_(None)))
            # Filtro fino post-query
            conv_ids_allowed = [c.id for c in ChannelConversation.query.join(ChannelConfig).filter(
                (ChannelConfig.license_id == license_id) | (ChannelConfig.license_id.is_(None))).all()
            ]
            if conv_ids_allowed:
                q = q.filter(ChannelConversation.id.in_(conv_ids_allowed))
            else:
                q = q.filter(db.false())

        if program_id:
            q = q.filter(ChannelConversation.program_id == program_id)
        if channel_id:
            q = q.filter(ChannelConversation.channel_id == channel_id)
        if channel_type:
            q = q.join(ChannelConfig).filter(ChannelConfig.channel_type == channel_type)
        if status:
            q = q.filter(ChannelConversation.status == status)
        if handover:
            q = q.filter(ChannelConversation.handover_status == handover)
        if search:
            q = q.filter(db.or_(
                ChannelConversation.contact_name.ilike(f'%{search}%'),
                ChannelConversation.contact_phone.ilike(f'%{search}%'),
                ChannelConversation.external_id.ilike(f'%{search}%'),
            ))

        # Orden: últimos mensajes primero
        q = q.order_by(db.desc(ChannelConversation.last_message_at))

        total = q.count()
        convs = q.limit(per_page).offset((page - 1) * per_page).all()

        return jsonify({
            'success': True,
            'data': [c.to_dict() for c in convs],
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': (total + per_page - 1) // per_page
        })
    except Exception as e:
        logger.error(f'Error listing conversations: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/conversations/<int:conv_id>', methods=['GET'])
@jwt_required()
def get_conversation(conv_id: int):
    """Detalle de conversación con hilo de mensajes (últimos 100)."""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        user = User.query.get(_gji())
        conv = ChannelConversation.query.get(conv_id)
        if not conv:
            return jsonify({'success': False, 'error': 'Conversación no encontrada'}), 404
        channel = ChannelConfig.query.get(conv.channel_id)
        if channel and not _check_channel_access(user, channel):
            return jsonify({'success': False, 'error': 'Sin acceso a esta conversación'}), 403
        return jsonify({'success': True, 'data': conv.to_dict(include_messages=True)})
    except Exception as e:
        logger.error(f'Error getting conversation {conv_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/conversations/<int:conv_id>/reply', methods=['POST'])
@jwt_required()
def reply_conversation(conv_id: int):
    """Responder a una conversación (dispatch WhatsApp/Telegram + guarda mensaje).
    Réplica POST /chat/conversations/:id/reply de aikrofy."""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        from flask import request
        user = User.query.get(_gji())
        conv = ChannelConversation.query.get(conv_id)
        if not conv:
            return jsonify({'success': False, 'error': 'Conversación no encontrada'}), 404
        channel = ChannelConfig.query.get(conv.channel_id)
        if not channel or not _check_channel_access(user, channel):
            return jsonify({'success': False, 'error': 'Sin acceso a esta conversación'}), 403

        data = request.get_json(silent=True) or {}
        content = (data.get('content') or '').strip()
        pause_ai = bool(data.get('pause_ai', True))
        if not content:
            return jsonify({'success': False, 'error': 'Contenido requerido'}), 422

        # Guarda mensaje del operador
        msg = ChannelMessage(
            conversation_id=conv.id,
            role='assistant',
            content=content,
            channel=channel.channel_type,
        )
        db.session.add(msg)

        # Dispatch según canal
        dispatched = False
        dispatch_details = None
        if channel.channel_type == 'whatsapp':
            try:
                company_id = _company_id_for_channel(channel)
                resp = requests.post(
                    f"{WHATSAPP_API_URL}/lead",
                    json={'companyId': company_id, 'phone': conv.contact_phone, 'message': content},
                    timeout=20
                )
                dispatched = resp.status_code == 200
                dispatch_details = {'status': resp.status_code}
            except Exception as e:
                logger.warning(f'WhatsApp dispatch failed: {e}')
                dispatch_details = {'error': str(e)}
        elif channel.channel_type == 'telegram':
            try:
                bot_token = getattr(channel, 'bot_token', None)
                if bot_token and conv.external_id:
                    resp = requests.post(
                        f"https://api.telegram.org/bot{bot_token}/sendMessage",
                        json={'chat_id': conv.external_id, 'text': content},
                        timeout=20
                    )
                    dispatched = resp.status_code == 200
                    dispatch_details = {'status': resp.status_code}
            except Exception as e:
                logger.warning(f'Telegram dispatch failed: {e}')
                dispatch_details = {'error': str(e)}

        # Actualiza conversación
        conv.last_message_at = datetime.utcnow()
        conv.messages_count = (conv.messages_count or 0) + 1
        if pause_ai:
            conv.is_ai_active = False
            conv.handover_status = 'human_taken'
            if not conv.assigned_user_id:
                conv.assigned_user_id = user.id
        db.session.commit()

        return jsonify({
            'success': True,
            'message': msg.to_dict(),
            'dispatched': dispatched,
            'dispatch_details': dispatch_details,
            'conversation': conv.to_dict()
        }), 200
    except Exception as e:
        logger.error(f'Error replying to conversation {conv_id}: {e}')
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/conversations/<int:conv_id>/status', methods=['PATCH'])
@jwt_required()
def update_conversation_status(conv_id: int):
    """Actualizar estado de conversación (resolver, reabrir, pausar IA, asignar, tags).
    Réplica PATCH /chat/conversations/:id/status de aikrofy."""
    try:
        from flask_jwt_extended import get_jwt_identity as _gji
        from flask import request
        user = User.query.get(_gji())
        conv = ChannelConversation.query.get(conv_id)
        if not conv:
            return jsonify({'success': False, 'error': 'Conversación no encontrada'}), 404
        channel = ChannelConfig.query.get(conv.channel_id)
        if channel and not _check_channel_access(user, channel):
            return jsonify({'success': False, 'error': 'Sin acceso a esta conversación'}), 403

        data = request.get_json(silent=True) or {}

        if 'is_resolved' in data:
            if data['is_resolved']:
                conv.status = 'completed'
                conv.resolved_at = datetime.utcnow()
            else:
                conv.status = 'open'
                conv.resolved_at = None
        if 'is_ai_active' in data:
            conv.is_ai_active = bool(data['is_ai_active'])
            if conv.is_ai_active:
                conv.handover_status = 'bot_active'
            else:
                conv.handover_status = 'human_taken'
        if 'handover_status' in data:
            hs = data['handover_status']
            if hs in ('bot_active', 'human_taken', 'human_listening', 'resolved'):
                conv.handover_status = hs
        if 'assigned_user_id' in data:
            conv.assigned_user_id = data['assigned_user_id'] if data['assigned_user_id'] else None
        if 'tags' in data and isinstance(data['tags'], list):
            conv.tags = data['tags']
        if 'sentiment_score' in data:
            try:
                conv.sentiment_score = float(data['sentiment_score'])
            except (TypeError, ValueError):
                pass
        if 'lead_score' in data:
            try:
                conv.lead_score = int(data['lead_score'])
            except (TypeError, ValueError):
                pass

        db.session.commit()
        return jsonify({'success': True, 'data': conv.to_dict()})
    except Exception as e:
        logger.error(f'Error updating conversation {conv_id} status: {e}')
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# Helper interno: persistir mensaje entrante desde webhooks
def _persist_incoming_message(channel, external_id, contact_name, contact_phone, role, content, channel_type, media_url=None, media_type=None):
    """Upsert conversación + guarda mensaje entrante. Llamar desde webhooks."""
    try:
        conv = ChannelConversation.query.filter_by(
            channel_id=channel.id, external_id=external_id
        ).first()
        if not conv:
            conv = ChannelConversation(
                channel_id=channel.id,
                external_id=external_id,
                contact_name=contact_name,
                contact_phone=contact_phone,
                conversation_type='support',
                status='open',
                is_ai_active=True,
                handover_status='bot_active',
            )
            db.session.add(conv)
            db.session.flush()
        # Actualiza última actividad
        conv.last_message_at = datetime.utcnow()
        conv.messages_count = (conv.messages_count or 0) + 1
        conv.contact_name = contact_name or conv.contact_name
        conv.contact_phone = contact_phone or conv.contact_phone

        msg = ChannelMessage(
            conversation_id=conv.id,
            role=role,
            content=content,
            channel=channel_type,
            media_url=media_url,
            media_type=media_type,
        )
        db.session.add(msg)
        db.session.commit()
        return conv.id
    except Exception as e:
        logger.error(f'Error persistiendo mensaje entrante: {e}')
        db.session.rollback()
        return None
