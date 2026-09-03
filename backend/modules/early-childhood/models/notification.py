"""
Notification model
"""
from models import db, BaseModel
from datetime import datetime

class Notification(db.Model, BaseModel):
    """Notification model - communal notifications per center"""
    
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(50), default='Info') # Alerta, Reporte, Info, Aviso
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)
    
    # Who this notification targets (null = communal, for all users in tenant)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'))
    
    # Who created this notification
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    
    # Scheduling and Broadcast
    start_at = db.Column(db.DateTime, nullable=True) # When to show (visibility starts)
    end_at = db.Column(db.DateTime, nullable=True)   # When to hide (visibility ends)
    target_tenants = db.Column(db.JSON, nullable=True) # List of tenant IDs for multi-center broadcast
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    tenant = db.relationship('Tenant', foreign_keys=[tenant_id])
    
    __table_args__ = (
        db.Index('idx_notif_tenant', 'tenant_id'),
        db.Index('idx_notif_user', 'user_id'),
    )
    
    def __repr__(self):
        return f'<Notification {self.title}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'time': self.created_at.isoformat() if self.created_at else None,
            'read': self.read,
            'created_by_id': self.created_by_id,
            'created_by_name': self.created_by.full_name if self.created_by else 'Sistema',
            'center_name': self.tenant.name if self.tenant else None,
            'start_at': self.start_at.isoformat() if self.start_at else None,
            'end_at': self.end_at.isoformat() if self.end_at else None,
            'target_tenants': self.target_tenants or []
        }
