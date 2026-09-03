"""
Operations/Maintenance models
"""
from models import db, BaseModel
from datetime import date

class MaintenanceTask(db.Model, BaseModel):
    """Maintenance Task model"""
    
    __tablename__ = 'maintenance_tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    
    description = db.Column(db.String(255), nullable=False)
    center_area = db.Column(db.String(100)) # e.g. "Area de Juegos", "Cocina"
    notes = db.Column(db.Text) # Additional notes  
    status = db.Column(db.Enum('Pendiente', 'En Progreso', 'Completado', name='task_status_enum'), default='Pendiente')
    priority = db.Column(db.Enum('Baja', 'Media', 'Alta', 'Critica', name='task_priority_enum'), default='Media')
    
    date_created = db.Column(db.Date, default=date.today)
    date_due = db.Column(db.Date)
    
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    
    # Relationships
    assigned_to = db.relationship('User', foreign_keys=[assigned_to_id])
    tenant = db.relationship('Tenant')
    
    __table_args__ = (
        db.Index('idx_task_tenant', 'tenant_id'),
        db.Index('idx_task_status', 'status'),
    )
    
    def __repr__(self):
        return f'<MaintenanceTask {self.id} - {self.description}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'task': self.description,
            'center': self.tenant.name if self.tenant else "Mi Centro",
            'center_id': self.tenant_id,
            'center_area': self.center_area or '',
            'notes': self.notes or '',
            'assignedTo': self.assigned_to.full_name if self.assigned_to else "Sin asignar",
            'assigned_to_id': self.assigned_to_id,
            'status': self.status,
            'priority': self.priority,
            'date_created': self.date_created.isoformat() if self.date_created else None,
            'date_due': self.date_due.isoformat() if self.date_due else None
        }
