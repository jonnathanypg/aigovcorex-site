from utils.role_helpers import is_multi_center_role
"""
Messaging API
Handles proactive messaging (sending messages to parents/users)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import requests
import os

from models import db
from models.user import User
from models.child import Child, Representative
from models.license import License, LicenseAdmin
from models.tenant import Tenant

messaging_bp = Blueprint('messaging', __name__, url_prefix='/api/messages')

WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def get_user_license(user: User) -> License:
    """Get the license for a user from their tenant or admin profile."""
    if user.role and is_multi_center_role(user):
        admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        return License.query.get(admin.license_id) if admin else None
    
    if user.tenant_id:
        tenant = Tenant.query.get(user.tenant_id)
        return License.query.get(tenant.license_id) if tenant else None
    
    return None


@messaging_bp.route('/send-to-parent', methods=['POST'])
@jwt_required()
def send_message_to_parent():
    """
    Send a proactive message to a child's parent.
    
    Permissions:
    - license_admin: Any child under their license
    - center_coordinator: Only children in their center (tenant)
    - educator/staff: Only children in their center (tenant)
    
    Request body:
    {
        "child_id": 123,           # OR
        "child_name": "Juan Pérez",
        "message": "Hola, su hijo...",
        "channel": "whatsapp"      # Optional: default both
    }
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Get user's license and scope
    license_obj = get_user_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No se encontró licencia activa'}), 400
    
    data = request.get_json() or {}
    child_id = data.get('child_id')
    child_name = data.get('child_name')
    message = data.get('message')
    channel = data.get('channel', 'all')  # 'whatsapp', 'telegram', or 'all'
    
    if not message:
        return jsonify({'error': 'Se requiere un mensaje'}), 400
    
    if not child_id and not child_name:
        return jsonify({'error': 'Se requiere child_id o child_name'}), 400
    
    # Determine scope based on role
    is_license_admin = is_multi_center_role(current_user)
    user_tenant_id = current_user.tenant_id
    
    # Find the child with scope filtering
    child = None
    if child_id:
        child = Child.query.get(child_id)
    elif child_name:
        query = Child.query.filter(
            (Child.first_name.ilike(f'%{child_name}%')) | 
            (Child.last_name.ilike(f'%{child_name}%'))
        )
        # Apply scope for non-license-admins
        if not is_license_admin and user_tenant_id:
            query = query.filter(Child.tenant_id == user_tenant_id)
        
        matches = query.all()
        
        if len(matches) == 0:
            return jsonify({'error': f'No se encontró ningún niño con: {child_name}'}), 404
        elif len(matches) > 1:
            # Multiple matches - return disambiguation info
            options = []
            for m in matches:
                tenant = Tenant.query.get(m.tenant_id)
                center_name = tenant.name if tenant else "Centro desconocido"
                options.append({
                    'id': m.id,
                    'nombre_completo': m.full_name,
                    'grupo': m.assigned_group or "Sin grupo",
                    'centro': center_name
                })
            return jsonify({
                'error': 'Hay varios niños con ese nombre. Por favor especifica:',
                'multiple_matches': True,
                'options': options
            }), 400
        else:
            child = matches[0]
    
    if not child:
        return jsonify({'error': f'No se encontró ningún niño con: {child_id or child_name}'}), 404
    
    # Verify access: non-license-admins can only message children in their tenant
    if not is_license_admin:
        if not user_tenant_id or child.tenant_id != user_tenant_id:
            return jsonify({'error': 'No tienes permiso para enviar mensajes a este niño'}), 403
    else:
        # License admin: Verify the child's tenant belongs to their license
        child_tenant = Tenant.query.get(child.tenant_id)
        if not child_tenant or child_tenant.license_id != license_obj.id:
            return jsonify({'error': 'Este niño no pertenece a un centro bajo tu licencia'}), 403
    
    # Get the primary representative
    representative = Representative.query.filter_by(
        family_id=child.family_id,
        is_primary=True
    ).first()
    
    if not representative:
        # Fall back to any representative
        representative = Representative.query.filter_by(family_id=child.family_id).first()
    
    if not representative:
        return jsonify({'error': f'No se encontró representante para {child.full_name}'}), 404
    
    results = {
        'child': child.full_name,
        'representative': representative.full_name,
        'channels_sent': [],
        'channels_failed': []
    }
    
    # Send via WhatsApp (use representative's phone)
    if channel in ['whatsapp', 'all'] and representative.phone:
        try:
            wa_response = requests.post(
                f"{WHATSAPP_API_URL}/lead",
                json={
                    'companyId': str(license_obj.id),
                    'phone': representative.phone,
                    'message': message
                },
                timeout=30
            )
            if wa_response.status_code == 200:
                results['channels_sent'].append('whatsapp')
            else:
                results['channels_failed'].append({'channel': 'whatsapp', 'error': wa_response.text})
        except Exception as e:
            results['channels_failed'].append({'channel': 'whatsapp', 'error': str(e)})
    
    # Send via Telegram (find user by cedula to get chat_id)
    if channel in ['telegram', 'all'] and representative.cedula:
        user = User.query.filter_by(cedula=representative.cedula).first()
        if user and user.telegram_chat_id and license_obj.telegram_bot_token:
            try:
                tg_response = requests.post(
                    f"https://api.telegram.org/bot{license_obj.telegram_bot_token}/sendMessage",
                    json={
                        'chat_id': user.telegram_chat_id,
                        'text': message
                    },
                    timeout=30
                )
                if tg_response.status_code == 200:
                    results['channels_sent'].append('telegram')
                else:
                    results['channels_failed'].append({'channel': 'telegram', 'error': tg_response.text})
            except Exception as e:
                results['channels_failed'].append({'channel': 'telegram', 'error': str(e)})
    
    if results['channels_sent']:
        return jsonify({
            'success': True,
            'message': f"Mensaje enviado a {representative.full_name}",
            'details': results
        }), 200
    else:
        return jsonify({
            'success': False,
            'message': 'No se pudo enviar por ningún canal',
            'details': results
        }), 400


@messaging_bp.route('/broadcast', methods=['POST'])
@jwt_required()
def send_broadcast():
    """
    Send a broadcast message to multiple parents.
    
    Request body:
    {
        "center_id": 5,        # Optional: filter by center
        "group": "Sala Cuna",  # Optional: filter by group
        "message": "Recordatorio..."
    }
    """
    db.session.rollback()
    
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Only license_admin can broadcast
    if not is_multi_center_role(current_user):
        return jsonify({'error': 'Solo los administradores pueden enviar broadcasts'}), 403
    
    data = request.get_json() or {}
    center_id = data.get('center_id')
    group = data.get('group')
    message = data.get('message')
    
    if not message:
        return jsonify({'error': 'Se requiere un mensaje'}), 400
    
    # Get the license
    license_obj = get_user_license(current_user)
    if not license_obj:
        return jsonify({'error': 'No se encontró licencia activa'}), 400
    
    # Build query for children
    query = Child.query.filter_by(status='activo')
    
    if center_id:
        query = query.filter_by(tenant_id=center_id)
    
    if group:
        query = query.filter(Child.assigned_group.ilike(f'%{group}%'))
    
    children = query.all()
    
    if not children:
        return jsonify({'error': 'No se encontraron niños con los filtros especificados'}), 404
    
    # Get unique families
    family_ids = list(set(c.family_id for c in children))
    
    # Get primary representatives for each family
    representatives = Representative.query.filter(
        Representative.family_id.in_(family_ids),
        Representative.is_primary == True
    ).all()
    
    sent_count = 0
    failed_count = 0
    
    for rep in representatives:
        if rep.phone:
            try:
                requests.post(
                    f"{WHATSAPP_API_URL}/lead",
                    json={
                        'companyId': str(license_obj.id),
                        'phone': rep.phone,
                        'message': message
                    },
                    timeout=10
                )
                sent_count += 1
            except Exception:
                failed_count += 1
    
    return jsonify({
        'success': True,
        'message': f'Broadcast enviado a {sent_count} representantes',
        'total_recipients': len(representatives),
        'sent': sent_count,
        'failed': failed_count
    }), 200
