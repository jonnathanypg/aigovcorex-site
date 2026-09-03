"""
Attendance model
"""
from models import db, BaseModel


class Attendance(db.Model, BaseModel):
    """Attendance tracking model"""
    
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    arrival_time = db.Column(db.Time)
    departure_time = db.Column(db.Time)
    # picked_up_by removed as it doesn't exist in DB
    status = db.Column(db.Enum('presente', 'ausente', 'justificado', 'tardanza', name='attendance_status_enum'), nullable=False)
    registered_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    notes = db.Column(db.Text)
    
    # Relationships
    registered_by = db.relationship('User', foreign_keys=[registered_by_id])
    
    __table_args__ = (
        db.UniqueConstraint('child_id', 'date', name='unique_attendance'),
        db.Index('idx_attendance_tenant', 'tenant_id'),
        db.Index('idx_attendance_date', 'date'),
    )
    
    def __repr__(self):
        return f'<Attendance {self.child_id} - {self.date}>'
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'date': self.date.isoformat() if self.date else None,
            'arrival_time': self.arrival_time.isoformat() if self.arrival_time else None,
            'departure_time': self.departure_time.isoformat() if self.departure_time else None,
            'status': self.status,
            'registered_by': self.registered_by.full_name if self.registered_by else None,
            'notes': self.notes
        }
