"""
Channels OS Templates API
CRUD para plantillas de mensajería multicanal.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.channel_template import ChannelTemplate, DEFAULT_TEMPLATES
from models.user import User
from models.tenant import Tenant
from utils.role_helpers import is_multi_center_role, get_license_id_for_user
import logging

logger = logging.getLogger(__name__)

channels_os_templates_bp = Blueprint('channels_os_templates', __name__, url_prefix='/channels-os/templates')


def _get_user_scope():
    """Obtiene scope del usuario actual (license_id, is_super_admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return None, None, False
    
    license_id = None
    try:
        license_id = get_license_id_for_user(user)
    except Exception:
        pass
    
    role_name = user.role.name if hasattr(user.role, 'name') else user.role
    is_super = (role_name == 'super_admin')
    
    return user, license_id, is_super


def _check_template_access(user, template, license_id, is_super):
    """Verifica si el usuario puede acceder a la plantilla."""
    if is_super:
        return True
    if template.license_id and license_id and template.license_id == license_id:
        return True
    if template.org_id and user.tenant_id:
        from models.tenant import Tenant
        tenant = Tenant.query.get(user.tenant_id)
        if tenant and tenant.organization_id == template.org_id:
            return True
    # Plantillas del sistema (is_system) son visibles para todos
    if template.is_system:
        return True
    return False


@channels_os_templates_bp.route('/', methods=['GET'])
@jwt_required()
def list_templates():
    """Lista plantillas con filtros opcionales."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        channel = request.args.get('channel')
        trigger = request.args.get('trigger')
        is_active = request.args.get('is_active', type=lambda x: x.lower() == 'true')
        include_system = request.args.get('include_system', 'true').lower() == 'true'

        query = ChannelTemplate.query

        # Filtro por licencia/organización
        if not is_super and license_id:
            query = query.filter(
                db.or_(
                    ChannelTemplate.license_id == license_id,
                    ChannelTemplate.org_id.in_(
                        db.session.query(Tenant.organization_id).filter(Tenant.license_id == license_id)
                    ) if license_id else db.false()
                )
            )

        if channel and channel != 'all':
            query = query.filter(db.or_(ChannelTemplate.channel == channel, ChannelTemplate.channel == 'all'))
        if trigger:
            query = query.filter(ChannelTemplate.trigger == trigger)
        if is_active is not None:
            query = query.filter(ChannelTemplate.is_active == is_active)
        if not include_system:
            query = query.filter(ChannelTemplate.is_system == False)

        templates = query.order_by(ChannelTemplate.is_system.desc(), ChannelTemplate.name.asc()).all()
        
        # Filtrado fino post-query para org_id via tenant
        if not is_super:
            filtered = []
            for t in templates:
                if _check_template_access(user, t, license_id, is_super):
                    filtered.append(t)
            templates = filtered

        return jsonify({'success': True, 'data': [t.to_dict() for t in templates], 'count': len(templates)})
    except Exception as e:
        logger.error(f'Error listing templates: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/', methods=['POST'])
@jwt_required()
def create_template():
    """Crea una nueva plantilla personalizada."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        
        # Solo license_admin/super_admin pueden crear plantillas
        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos para crear plantillas'}), 403

        data = request.get_json() or {}
        required = ['name', 'content']
        for field in required:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'Campo requerido: {field}'}), 400

        # Resolver license_id/org_id del usuario
        resolved_license_id = data.get('license_id') or license_id
        org_id = data.get('org_id')

        template = ChannelTemplate(
            license_id=resolved_license_id,
            org_id=org_id,
            name=data['name'],
            description=data.get('description'),
            trigger=data.get('trigger'),
            channel=data.get('channel', 'all'),
            content=data['content'],
            variables=data.get('variables', []),
            is_active=data.get('is_active', True),
            is_system=False,
            created_by=user.id,
        )
        db.session.add(template)
        db.session.commit()

        return jsonify({'success': True, 'data': template.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creating template: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/<int:template_id>', methods=['GET'])
@jwt_required()
def get_template(template_id: int):
    """Obtiene detalles de una plantilla."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        template = ChannelTemplate.query.get_or_404(template_id)
        if not _check_template_access(user, template, license_id, is_super):
            return jsonify({'success': False, 'error': 'Sin acceso a esta plantilla'}), 403

        return jsonify({'success': True, 'data': template.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_template(template_id: int):
    """Actualiza una plantilla (no permite editar plantillas del sistema)."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        template = ChannelTemplate.query.get_or_404(template_id)
        
        if template.is_system and not is_super:
            return jsonify({'success': False, 'error': 'Las plantillas del sistema no se pueden modificar'}), 403
        
        if not _check_template_access(user, template, license_id, is_super):
            return jsonify({'success': False, 'error': 'Sin acceso a esta plantilla'}), 403

        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos para editar plantillas'}), 403

        data = request.get_json() or {}

        updatable = ['name', 'description', 'trigger', 'channel', 'content', 'variables', 'is_active']
        for field in updatable:
            if field in data:
                setattr(template, field, data[field])

        db.session.commit()
        return jsonify({'success': True, 'data': template.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id: int):
    """Elimina una plantilla (no permite eliminar plantillas del sistema)."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        template = ChannelTemplate.query.get_or_404(template_id)
        
        if template.is_system:
            return jsonify({'success': False, 'error': 'Las plantillas del sistema no se pueden eliminar'}), 403
        
        if not _check_template_access(user, template, license_id, is_super):
            return jsonify({'success': False, 'error': 'Sin acceso a esta plantilla'}), 403

        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos para eliminar plantillas'}), 403

        db.session.delete(template)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Plantilla eliminada'})
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error deleting template {template_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/<int:template_id>/render', methods=['POST'])
@jwt_required()
def render_template(template_id: int):
    """Renderiza una plantilla con un contexto de variables dado."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        template = ChannelTemplate.query.get_or_404(template_id)
        if not _check_template_access(user, template, license_id, is_super):
            return jsonify({'success': False, 'error': 'Sin acceso a esta plantilla'}), 403

        data = request.get_json() or {}
        context = data.get('context', {})

        rendered = template.render(context)
        
        # Incrementar contador de uso
        template.usage_count = (template.usage_count or 0) + 1
        template.last_used_at = db.func.now()
        db.session.commit()

        return jsonify({'success': True, 'data': {'rendered': rendered, 'template': template.to_dict()}})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_templates_bp.route('/seed-defaults', methods=['POST'])
@jwt_required()
def seed_default_templates():
    """Crea las plantillas por defecto del sistema para la licencia actual."""
    try:
        user, license_id, is_super = _get_user_scope()
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        if not is_super and not is_multi_center_role(user):
            return jsonify({'success': False, 'error': 'No tienes permisos'}), 403

        created = 0
        for tpl_data in DEFAULT_TEMPLATES:
            # Verificar si ya existe por nombre + license_id
            existing = ChannelTemplate.query.filter_by(
                name=tpl_data['name'],
                license_id=license_id,
                is_system=True
            ).first()
            if existing:
                continue

            template = ChannelTemplate(
                license_id=license_id,
                name=tpl_data['name'],
                description=tpl_data['description'],
                trigger=tpl_data['trigger'],
                channel=tpl_data['channel'],
                content=tpl_data['content'],
                variables=tpl_data['variables'],
                is_active=True,
                is_system=True,
                created_by=user.id,
            )
            db.session.add(template)
            created += 1

        db.session.commit()
        return jsonify({'success': True, 'message': f'{created} plantillas del sistema creadas'})
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error seeding default templates: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500