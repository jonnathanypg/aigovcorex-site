"""Users API endpoints"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
from auth.authorization import permission_required
from models import db
from models.user import User

users_bp = Blueprint('users', __name__, url_prefix='/users')

@users_bp.route('/', methods=['GET'])
@tenant_required
def get_users():
    """Get all users for tenant"""
    user = TenantContext.get_current_user()
    # Allow admin roles to view users
    if user.role and user.role.name not in ['admin', 'super_admin', 'coordinator']:
        return jsonify({'error': 'No tiene permisos para ver usuarios'}), 403
    tenant_id = TenantContext.get_current_tenant_id()
    users = User.query.filter_by(tenant_id=tenant_id).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200

@users_bp.route('/', methods=['POST'])
@tenant_required
@permission_required('manage_center')
def create_user():
    """Create new user"""
    tenant_id = TenantContext.get_current_tenant_id()
    data = request.get_json()
    
    user = User(
        tenant_id=tenant_id,
        role_id=data['role_id'],
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone')
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'Usuario creado', 'user': user.to_dict()}), 201


@users_bp.route('/profile', methods=['GET'])
@tenant_required
def get_profile():
    """Get current user's profile"""
    user = TenantContext.get_current_user()
    
    return jsonify({
        'user': user.to_dict(),
        'role': user.role.name if user.role else None,
        'center': user.tenant.name if user.tenant else None
    }), 200


@users_bp.route('/profile', methods=['PUT'])
@tenant_required
def update_profile():
    """Update current user's profile (including password)"""
    db.session.rollback()  # Preventive rollback
    user = TenantContext.get_current_user()
    data = request.get_json()
    
    try:
        # Update basic info
        allowed_fields = ['first_name', 'last_name', 'phone', 'avatar_url']
        for field in allowed_fields:
            if field in data:
                setattr(user, field, data[field])
        
        # Handle password change
        if data.get('new_password'):
            new_password = data['new_password']
            confirm_password = data.get('confirm_password')
            
            # Validate password confirmation
            if new_password != confirm_password:
                return jsonify({'error': 'Las contraseñas no coinciden'}), 400
            
            # Validate password length
            if len(new_password) < 6:
                return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
            
            user.set_password(new_password)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Perfil actualizado exitosamente',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
