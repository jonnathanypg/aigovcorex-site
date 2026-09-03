"""
Authentication module - JWT-based authentication
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from models import db
from models.user import User
from datetime import datetime

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _get_user_modules(user) -> list:
    """Obtener módulos habilitados para el usuario según su licencia y rol"""
    ALL_MODULES = ['kindicore', 'social', 'geo', 'channels', 'copilot']
    try:
        if not user or not user.role:
            return ALL_MODULES
        
        # Super Admin siempre tiene acceso a todos los módulos
        if user.role.name == 'super_admin':
            return ALL_MODULES
        
        from models.license import License, LicenseAdmin
        from models.tenant import Tenant
        
        # 1. Si es License Admin / Supervisor global
        la = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
        if la and la.license:
            return la.license.get_enabled_modules()
        
        # 2. Si pertenece a un centro/tenant
        if user.tenant_id:
            tenant = Tenant.query.get(user.tenant_id)
            if tenant and tenant.license:
                return tenant.license.get_enabled_modules()
            elif tenant and tenant.license_id:
                lic = License.query.get(tenant.license_id)
                if lic:
                    return lic.get_enabled_modules()
        
        return ALL_MODULES
    except Exception:
        return ALL_MODULES


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    User login endpoint
    Expects: email, password
    Returns: access_token, refresh_token, user data con módulos habilitados
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Credenciales inválidas'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Usuario inactivo'}), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create tokens (identity must be string)
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        user_dict = user.to_dict()
        user_dict['enabled_modules'] = _get_user_modules(user)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user_dict
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error en login: {str(e)}'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token
    Returns: new access_token
    """
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({'access_token': access_token}), 200
        
    except Exception as e:
        return jsonify({'error': f'Error al refrescar token: {str(e)}'}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current authenticated user with license and enabled modules
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        user_dict = user.to_dict()
        user_dict['enabled_modules'] = _get_user_modules(user)
        
        return jsonify({'user': user_dict}), 200
        
    except Exception as e:
        return jsonify({'error': f'Error al obtener usuario: {str(e)}'}), 500


@auth_bp.route('/license-modules', methods=['GET'])
@jwt_required()
def get_license_modules():
    """
    Obtener lista de módulos habilitados para la licencia del usuario actual
    Usado por el frontend para renderizado dinámico y control de acceso modular
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'enabled_modules': ['kindicore', 'social', 'geo', 'channels', 'copilot']}), 200
        
        modules = _get_user_modules(user)
        return jsonify({
            'enabled_modules': modules,
            'is_super_admin': bool(user.role and user.role.name == 'super_admin')
        }), 200
    except Exception as e:
        return jsonify({'enabled_modules': ['kindicore', 'social', 'geo', 'channels', 'copilot']}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user
    Note: With JWT, actual logout is handled client-side by removing tokens
    This endpoint is for logging purposes
    """
    try:
        current_user_id = int(get_jwt_identity())
        # Could add token to blacklist here if implementing token blacklisting
        
        return jsonify({'message': 'Logout exitoso'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Error en logout: {str(e)}'}), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change user password
    Expects: current_password, new_password
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        data = request.get_json()
        
        if not data or not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Contraseña actual y nueva requeridas'}), 400
        
        # Verify current password
        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Contraseña actual incorrecta'}), 401
        
        # Set new password
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Contraseña actualizada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al cambiar contraseña: {str(e)}'}), 500


@auth_bp.route('/update-profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update user profile data
    Expects: first_name, last_name, email (optional)
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        data = request.get_json()
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        
        if 'last_name' in data:
            user.last_name = data['last_name']
            
        if 'email' in data and data['email'] != user.email:
            # Check if email is already taken
            existing = User.query.filter_by(email=data['email']).first()
            if existing:
                return jsonify({'error': 'El correo electrónico ya está en uso'}), 400
            user.email = data['email']
            
        if 'phone' in data:
            user.phone = data['phone']
            
        db.session.commit()
        
        return jsonify({
            'message': 'Perfil actualizado exitosamente',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al actualizar perfil: {str(e)}'}), 500
