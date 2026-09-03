"""
Multi-tenant middleware for Flask
Automatically filters queries by tenant_id based on authenticated user
"""
from flask import g, request, jsonify
from functools import wraps
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models.user import User


class TenantContext:
    """Tenant context manager"""
    
    @staticmethod
    def get_current_tenant_id():
        """Get current tenant ID from request context"""
        return getattr(g, 'tenant_id', None)
    
    @staticmethod
    def get_current_user():
        """Get current user from request context"""
        return getattr(g, 'current_user', None)
    
    @staticmethod
    def set_tenant_context(user):
        """Set tenant context for current request"""
        g.current_user = user
        g.tenant_id = user.tenant_id if user else None


def tenant_required(f):
    """
    Decorator to ensure tenant context is set
    Must be used after @jwt_required()
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Verify JWT token
            verify_jwt_in_request()
            
            # Get user identity from JWT (comes as string, convert to int)
            user_id = int(get_jwt_identity())
            
            if not user_id:
                return jsonify({'error': 'Usuario no autenticado'}), 401
            
            # Load user from database
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'Usuario no encontrado'}), 404
            
            if not user.is_active:
                return jsonify({'error': 'Usuario inactivo'}), 403
            
            # Set tenant context
            TenantContext.set_tenant_context(user)
            
        except Exception as e:
            return jsonify({'error': f'Error de autenticación: {str(e)}'}), 401
            
        return f(*args, **kwargs)
    
    return decorated_function


def init_tenant_middleware(app):
    """Initialize tenant middleware"""
    
    @app.before_request
    def before_request():
        """Set up tenant context before each request"""
        g.tenant_id = None
        g.current_user = None
    
    @app.after_request
    def after_request(response):
        """Clean up after request"""
        # Add CORS headers if needed
        return response


class TenantQueryMixin:
    """
    Mixin to automatically filter queries by tenant_id
    Add this to models that need tenant filtering
    """
    
    @classmethod
    def tenant_query(cls):
        """Get query filtered by current tenant"""
        tenant_id = TenantContext.get_current_tenant_id()
        if not tenant_id:
            raise ValueError("No tenant context set")
        return cls.query.filter_by(tenant_id=tenant_id)
    
    @classmethod
    def get_by_id(cls, id):
        """Get record by ID within tenant context"""
        tenant_id = TenantContext.get_current_tenant_id()
        if not tenant_id:
            raise ValueError("No tenant context set")
        return cls.query.filter_by(id=id, tenant_id=tenant_id).first()
