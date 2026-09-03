"""
Intervention models
"""
from models import db, BaseModel
from datetime import date

class FamilyIntervention(db.Model, BaseModel):
    """Family Intervention model"""
    
    __tablename__ = 'family_interventions'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey('families.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    type = db.Column(db.String(100), nullable=False) # Visita, Entrevista, Llamada
    reason = db.Column(db.String(255))
    notes = db.Column(db.Text)
    professional_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    status = db.Column(db.Enum('programada', 'realizada', 'cancelada', name='intervention_status_enum'), default='programada')
    
    # Persona entrevistada
    interviewee_name = db.Column(db.String(255))  # Nombre del entrevistado
    interviewee_relationship = db.Column(db.String(100))  # Parentesco con el niño (madre, padre, abuelo, etc.)

    # Relationships
    family = db.relationship('Family', backref=db.backref('interventions', lazy='dynamic'))
    professional = db.relationship('User', foreign_keys=[professional_id])
    
    __table_args__ = (
        db.Index('idx_intervention_tenant', 'tenant_id'),
        db.Index('idx_intervention_family', 'family_id'),
        db.Index('idx_intervention_date', 'date'),
    )
    
    def __repr__(self):
        return f'<FamilyIntervention {self.id} - {self.type}>'
    
    def to_dict(self):
        # Get family name from primary representative's last name
        family_name = "Sin familia"
        if self.family and self.family.representatives:
            reps = list(self.family.representatives)
            primary = next((r for r in reps if r.is_primary), None)
            if primary:
                family_name = primary.last_name
            elif reps:
                family_name = reps[0].last_name
        elif self.family:
            family_name = f"ID-{self.family_id}"
            
        return {
            'id': self.id,
            'family_id': self.family_id,
            'family_name': family_name,
            'date': self.date.isoformat() if self.date else None,
            'type': self.type,
            'reason': self.reason,
            'notes': self.notes,
            'professional': self.professional.full_name if self.professional else "Sin asignar",
            'status': self.status,
            'interviewee_name': self.interviewee_name,
            'interviewee_relationship': self.interviewee_relationship
        }
