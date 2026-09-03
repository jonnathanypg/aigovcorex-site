"""
Super Admin API - Gestión de Licencias
Solo accesible por usuarios con rol super_admin
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.license import License, LicenseAdmin
from models.user import User
from models.tenant import Tenant
from datetime import datetime

super_admin_bp = Blueprint('super_admin', __name__, url_prefix='/api/super-admin')


def require_super_admin(f):
    """Decorator to require super_admin role"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user or user.role.name != 'super_admin':
            return jsonify({'error': 'Acceso denegado. Se requiere rol de Super Admin'}), 403
        
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@super_admin_bp.route('/licenses', methods=['GET'])
@require_super_admin
def get_licenses():
    """Listar todas las licencias"""
    try:
        licenses = License.query.all()
        
        return jsonify({
            'licenses': [license.to_dict() for license in licenses],
            'total': len(licenses)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses', methods=['POST'])
@require_super_admin
def create_license():
    """Crear nueva licencia"""
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        # Validaciones
        required_fields = ['name', 'max_centers', 'start_date', 'end_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        # Crear licencia
        license = License(
            name=data['name'],
            description=data.get('description'),
            max_centers=data['max_centers'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            status=data.get('status', 'active'),
            annual_cost=data.get('annual_cost'),
            legal_name=data.get('legal_name'),
            ruc=data.get('ruc'),
            created_by=user_id,
            max_users=data.get('max_users', 50),
            storage_quota_mb=data.get('storage_quota_mb', 1024),
            allow_public_chatbot=data.get('allow_public_chatbot', True),
            allow_whatsapp_public=data.get('allow_whatsapp_public', data.get('allow_whatsapp', True)),
            allow_telegram_public=data.get('allow_telegram_public', data.get('allow_telegram', True)),
            public_org_slug=data.get('public_org_slug')
        )
        
        # Asignar módulos si fueron especificados
        if 'enabled_modules' in data and isinstance(data['enabled_modules'], list):
            license.set_enabled_modules(data['enabled_modules'])
        
        db.session.add(license)
        db.session.commit()
        
        return jsonify({
            'message': 'Licencia creada exitosamente',
            'license': license.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>', methods=['GET'])
@require_super_admin
def get_license(license_id):
    """Obtener detalles de una licencia"""
    try:
        license = License.query.get(license_id)
        
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        # Obtener centros asociados
        centers = Tenant.query.filter_by(license_id=license_id).all()
        
        # Obtener admins asociados
        admins = LicenseAdmin.query.filter_by(license_id=license_id).all()
        
        license_data = license.to_dict()
        license_data['centers'] = [center.to_dict() for center in centers]
        license_data['admins'] = [admin.to_dict() for admin in admins]
        
        return jsonify({'license': license_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>', methods=['PUT'])
@require_super_admin
def update_license(license_id):
    """Actualizar licencia"""
    try:
        license = License.query.get(license_id)
        
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        data = request.get_json()
        
        # Actualizar campos permitidos
        if 'name' in data:
            license.name = data['name']
        if 'description' in data:
            license.description = data['description']
        if 'max_centers' in data:
            # Validar que no sea menor que los centros activos
            if data['max_centers'] < license.active_centers:
                return jsonify({
                    'error': f'No se puede reducir max_centers a {data["max_centers"]}. Hay {license.active_centers} centros activos'
                }), 400
            license.max_centers = data['max_centers']
        if 'start_date' in data:
            license.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            license.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'status' in data:
            license.status = data['status']
        if 'annual_cost' in data:
            license.annual_cost = data['annual_cost']
        if 'legal_name' in data:
            license.legal_name = data['legal_name']
        if 'ruc' in data:
            license.ruc = data['ruc']
        if 'max_users' in data:
            license.max_users = data['max_users']
        if 'storage_quota_mb' in data:
            license.storage_quota_mb = data['storage_quota_mb']
        if 'allow_public_chatbot' in data:
            license.allow_public_chatbot = data['allow_public_chatbot']
        if 'allow_whatsapp_public' in data or 'allow_whatsapp' in data:
            license.allow_whatsapp_public = data.get('allow_whatsapp_public', data.get('allow_whatsapp'))
        if 'allow_telegram_public' in data or 'allow_telegram' in data:
            license.allow_telegram_public = data.get('allow_telegram_public', data.get('allow_telegram'))
        if 'public_org_slug' in data:
            slug = data['public_org_slug'].lower().strip().replace(' ', '-') if data['public_org_slug'] else None
            license.public_org_slug = slug
        if 'enabled_modules' in data and isinstance(data['enabled_modules'], list):
            license.set_enabled_modules(data['enabled_modules'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Licencia actualizada exitosamente',
            'license': license.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>', methods=['DELETE'])
@require_super_admin
def delete_license(license_id):
    """Eliminar licencia (solo si no tiene centros activos)"""
    try:
        license = License.query.get(license_id)
        
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        if license.active_centers > 0:
            return jsonify({
                'error': f'No se puede eliminar. La licencia tiene {license.active_centers} centros activos'
            }), 400
        
        db.session.delete(license)
        db.session.commit()
        
        return jsonify({'message': 'Licencia eliminada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>/admins', methods=['POST'])
@require_super_admin
def assign_license_admin(license_id):
    """Asignar administrador a una licencia"""
    try:
        license = License.query.get(license_id)
        
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        data = request.get_json()
        user_id_to_assign = data.get('user_id')
        
        if not user_id_to_assign:
            return jsonify({'error': 'user_id requerido'}), 400
        
        user = User.query.get(user_id_to_assign)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Verificar si ya es admin de esta licencia
        existing = LicenseAdmin.query.filter_by(
            license_id=license_id,
            user_id=user_id_to_assign
        ).first()
        
        if existing:
            return jsonify({'error': 'El usuario ya es administrador de esta licencia'}), 400
        
        # Crear asignación
        current_user_id = int(get_jwt_identity())
        license_admin = LicenseAdmin(
            license_id=license_id,
            user_id=user_id_to_assign,
            can_create_centers=data.get('can_create_centers', True),
            can_delete_centers=data.get('can_delete_centers', False),
            can_manage_users=data.get('can_manage_users', True),
            assigned_by=current_user_id
        )
        
        db.session.add(license_admin)
        db.session.commit()
        
        return jsonify({
            'message': 'Administrador asignado exitosamente',
            'license_admin': license_admin.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>/admins/<int:admin_id>', methods=['DELETE'])
@require_super_admin
def remove_license_admin(license_id, admin_id):
    """Remover administrador de una licencia"""
    try:
        license_admin = LicenseAdmin.query.filter_by(
            id=admin_id,
            license_id=license_id
        ).first()
        
        if not license_admin:
            return jsonify({'error': 'Asignación no encontrada'}), 404
        
        db.session.delete(license_admin)
        db.session.commit()
        
        return jsonify({'message': 'Administrador removido exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/dashboard', methods=['GET'])
@require_super_admin
def super_admin_dashboard():
    """Dashboard con métricas globales"""
    try:
        db.session.rollback()  # Preventive rollback
        
        total_licenses = License.query.count()
        active_licenses = License.query.filter_by(status='active').count()
        total_centers = Tenant.query.count()
        total_users = User.query.count()
        
        # Children count
        from models.child import Child
        total_children = Child.query.filter_by(status='activo').count()
        
        # Expired licenses
        today = datetime.utcnow().date()
        expired_licenses = License.query.filter(
            License.end_date < today
        ).count()
        
        # Total annual revenue from active licenses
        active_license_list = License.query.filter_by(status='active').all()
        total_annual_revenue = sum(
            float(lic.annual_cost) if lic.annual_cost else 0 
            for lic in active_license_list
        )
        
        # All licenses for the list
        all_licenses = License.query.order_by(License.created_at.desc()).all()
        
        return jsonify({
            'total_licenses': total_licenses,
            'active_licenses': active_licenses,
            'expired_licenses': expired_licenses,
            'total_centers': total_centers,
            'total_users': total_users,
            'total_children': total_children,
            'total_annual_revenue': total_annual_revenue,
            'licenses': [lic.to_dict() for lic in all_licenses]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@super_admin_bp.route('/create-license-admin', methods=['POST'])
@require_super_admin
def create_license_admin_user():
    """
    Crear usuario administrador de licencia
    Crea el usuario y lo asigna automáticamente a la licencia
    """
    try:
        data = request.get_json()
        current_user_id = int(get_jwt_identity())
        
        # Validaciones
        required_fields = ['license_id', 'first_name', 'last_name', 'email', 'password']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        license_id = data['license_id']
        
        # Verificar que la licencia existe
        license = License.query.get(license_id)
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        # Verificar que el email no esté en uso
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'error': 'El email ya está registrado'}), 400
        
        # Obtener rol de license_admin
        from models.user import Role
        license_admin_role = Role.query.filter_by(name='license_admin').first()
        if not license_admin_role:
            return jsonify({'error': 'Rol license_admin no encontrado'}), 500
        
        # Necesitamos un tenant para el usuario (usamos el primero de la licencia o el primero del sistema)
        tenant = Tenant.query.filter_by(license_id=license_id).first()
        if not tenant:
            tenant = Tenant.query.first()
        
        if not tenant:
            return jsonify({'error': 'No hay centros disponibles para asignar al usuario'}), 500
        
        # Crear usuario
        user = User(
            tenant_id=tenant.id,
            role_id=license_admin_role.id,
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone'),
            is_active=True
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.flush()  # Get user.id
        
        # Asignar como administrador de la licencia
        license_admin = LicenseAdmin(
            license_id=license_id,
            user_id=user.id,
            can_create_centers=True,
            can_delete_centers=True,
            can_manage_users=True,
            assigned_by=current_user_id
        )
        
        db.session.add(license_admin)
        db.session.commit()
        
        return jsonify({
            'message': 'Administrador de licencia creado exitosamente',
            'user': user.to_dict(),
            'license_admin': license_admin.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>/modules', methods=['PUT'])
@require_super_admin
def update_license_modules(license_id):
    """Actualizar módulos habilitados de una licencia (AI GovCoreX OS)"""
    try:
        license = License.query.get(license_id)
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        data = request.get_json() or {}
        modules = data.get('enabled_modules', [])
        
        VALID_MODULES = ['kindicore', 'social', 'geo', 'channels', 'copilot']
        valid_modules = [m for m in modules if m in VALID_MODULES]
        if not valid_modules:
            valid_modules = ['kindicore']  # Siempre al menos uno
        
        license.set_enabled_modules(valid_modules)
        
        # Opciones adicionales si vienen en el payload
        if 'max_users' in data:
            license.max_users = data['max_users']
        if 'storage_quota_mb' in data:
            license.storage_quota_mb = data['storage_quota_mb']
        if 'allow_public_chatbot' in data:
            license.allow_public_chatbot = data['allow_public_chatbot']
        if 'allow_whatsapp_public' in data or 'allow_whatsapp' in data:
            license.allow_whatsapp_public = data.get('allow_whatsapp_public', data.get('allow_whatsapp'))
        if 'allow_telegram_public' in data or 'allow_telegram' in data:
            license.allow_telegram_public = data.get('allow_telegram_public', data.get('allow_telegram'))
        if 'public_org_slug' in data:
            slug = data['public_org_slug'].lower().strip().replace(' ', '-') if data['public_org_slug'] else None
            if slug:
                existing = License.query.filter(License.public_org_slug == slug, License.id != license_id).first()
                if existing:
                    return jsonify({'error': f'El slug "{slug}" ya está en uso'}), 400
            license.public_org_slug = slug
        
        db.session.commit()
        
        return jsonify({
            'message': 'Módulos actualizados exitosamente',
            'license': license.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/licenses/<int:license_id>/full', methods=['PUT'])
@require_super_admin
def update_license_full(license_id):
    """Actualización integral de licencia incluyendo módulos y capacidades"""
    try:
        license = License.query.get(license_id)
        if not license:
            return jsonify({'error': 'Licencia no encontrada'}), 404
        
        data = request.get_json() or {}
        
        if 'name' in data: license.name = data['name']
        if 'description' in data: license.description = data['description']
        if 'legal_name' in data: license.legal_name = data['legal_name']
        if 'ruc' in data: license.ruc = data['ruc']
        if 'annual_cost' in data: license.annual_cost = data['annual_cost']
        if 'status' in data: license.status = data['status']
        if 'start_date' in data:
            license.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            license.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'max_centers' in data:
            if data['max_centers'] < license.active_centers:
                return jsonify({'error': f'No se puede reducir max_centers. Hay {license.active_centers} centros activos'}), 400
            license.max_centers = data['max_centers']
        
        if 'enabled_modules' in data and isinstance(data['enabled_modules'], list):
            license.set_enabled_modules(data['enabled_modules'])
        if 'max_users' in data: license.max_users = data['max_users']
        if 'storage_quota_mb' in data: license.storage_quota_mb = data['storage_quota_mb']
        if 'allow_public_chatbot' in data: license.allow_public_chatbot = data['allow_public_chatbot']
        if 'allow_whatsapp_public' in data or 'allow_whatsapp' in data:
            license.allow_whatsapp_public = data.get('allow_whatsapp_public', data.get('allow_whatsapp'))
        if 'allow_telegram_public' in data or 'allow_telegram' in data:
            license.allow_telegram_public = data.get('allow_telegram_public', data.get('allow_telegram'))
        if 'public_org_slug' in data:
            slug = data['public_org_slug'].lower().strip().replace(' ', '-') if data['public_org_slug'] else None
            if slug:
                existing = License.query.filter(License.public_org_slug == slug, License.id != license_id).first()
                if existing:
                    return jsonify({'error': f'El slug "{slug}" ya está en uso'}), 400
            license.public_org_slug = slug
        
        db.session.commit()
        return jsonify({'message': 'Licencia actualizada exitosamente', 'license': license.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@super_admin_bp.route('/system/stats', methods=['GET'])
@require_super_admin
def get_system_stats():
    """Estadísticas globales del sistema y distribución modular para Super Admin"""
    try:
        from models.child import Child
        
        total_licenses = License.query.count()
        active_licenses = License.query.filter_by(status='active').count()
        total_centers = Tenant.query.count()
        total_users = User.query.count()
        total_children = Child.query.filter_by(status='activo').count()
        
        today = datetime.utcnow().date()
        expired_licenses = License.query.filter(License.end_date < today).count()
        
        active_license_list = License.query.filter_by(status='active').all()
        total_annual_revenue = sum(
            float(lic.annual_cost) if lic.annual_cost else 0
            for lic in active_license_list
        )
        
        # Distribución de módulos habilitados
        module_distribution = {
            'kindicore': 0,
            'social': 0,
            'geo': 0,
            'channels': 0,
            'copilot': 0,
        }
        for lic in License.query.all():
            for mod in lic.get_enabled_modules():
                if mod in module_distribution:
                    module_distribution[mod] += 1
        
        return jsonify({
            'total_licenses': total_licenses,
            'active_licenses': active_licenses,
            'expired_licenses': expired_licenses,
            'total_centers': total_centers,
            'total_users': total_users,
            'total_children': total_children,
            'total_annual_revenue': total_annual_revenue,
            'module_distribution': module_distribution,
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
