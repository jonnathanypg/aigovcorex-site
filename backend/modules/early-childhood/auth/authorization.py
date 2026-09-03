"""
Authorization module - Role-based access control
"""
from functools import wraps
from flask import jsonify
from middleware.tenant_context import TenantContext


def permission_required(permission):
    """
    Decorator to check if user has specific permission
    Usage: @permission_required('manage_center')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = TenantContext.get_current_user()
            
            if not user:
                return jsonify({'error': 'Usuario no autenticado'}), 401
            
            if not user.has_permission(permission):
                return jsonify({'error': 'Permiso denegado'}), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def role_required(*roles):
    """
    Decorator to check if user has one of the specified roles
    Usage: @role_required('coordinador', 'admin_global')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = TenantContext.get_current_user()
            
            if not user:
                return jsonify({'error': 'Usuario no autenticado'}), 401
            
            if user.role.name not in roles:
                return jsonify({'error': 'Rol insuficiente'}), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def is_admin():
    """Check if current user is admin"""
    user = TenantContext.get_current_user()
    return user and user.role.name == 'admin_global'


def is_coordinador():
    """Check if current user is coordinador"""
    user = TenantContext.get_current_user()
    return user and user.role.name in ['coordinador', 'admin_global']


def is_educadora():
    """Check if current user is educadora"""
    user = TenantContext.get_current_user()
    return user and user.role.name in ['educadora', 'coordinador', 'admin_global']
