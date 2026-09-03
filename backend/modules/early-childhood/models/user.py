"""
User and Role models
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from werkzeug.security import generate_password_hash, check_password_hash


class Role(db.Model):
    """Role model for RBAC"""
    
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    permissions = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # Relationships
    users = db.relationship('User', backref='role', lazy='dynamic')
    
    def __repr__(self):
        return f'<Role {self.name}>'
    
    def has_permission(self, permission):
        """Check if role has specific permission"""
        if not self.permissions:
            return False
        return permission in self.permissions or 'all' in self.permissions


class User(db.Model, BaseModel):
    """User model with multi-tenant support"""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='SET NULL'), nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20))
    whatsapp_phone = db.Column(db.String(20)) # Personal WhatsApp for AI recognition
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    cedula = db.Column(db.String(10), unique=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login = db.Column(db.DateTime)
    
    # Telegram Identity
    telegram_chat_id = db.Column(db.String(50), nullable=True, unique=True)  # Chat ID de Telegram
    telegram_link_code = db.Column(db.String(20), nullable=True, unique=True)  # Código de vinculación
    
    # Unique constraint for email per tenant
    __table_args__ = (
        db.UniqueConstraint('email', 'tenant_id', name='unique_email_tenant'),
        db.Index('idx_user_tenant', 'tenant_id'),
        db.Index('idx_user_active', 'is_active'),
    )
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    @property
    def full_name(self):
        """Get full name"""
        return f"{self.first_name} {self.last_name}"
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def has_permission(self, permission):
        """Check if user has specific permission"""
        return self.role.has_permission(permission)
    
    def to_dict(self, include_sensitive=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'tenant_name': self.tenant.name if self.tenant else None,
            'role': self.role.name,
            'email': self.email,
            'phone': self.phone,
            'whatsapp_phone': self.whatsapp_phone,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'cedula': self.cedula,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        return data
