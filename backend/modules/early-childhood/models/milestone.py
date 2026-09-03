"""
Development milestones model - Ficha IDII (Indicadores del Desarrollo Infantil Integral)
"""
from models import db, BaseModel


class Milestone(db.Model, BaseModel):
    """Development milestones tracking model"""
    
    __tablename__ = 'milestones'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    period = db.Column(db.String(50), nullable=True)  # e.g. "Inicial 2026", "Final 2026"
    domain = db.Column(db.Enum(
        'vinculacion_emocional',
        'descubrimiento_natural_cultural',
        'expresion_corporal',
        'lenguaje',
        name='milestone_domain_enum'
    ), nullable=False)
    milestone_description = db.Column(db.Text, nullable=False)
    achievement_level = db.Column(db.Enum(
        'no_iniciado',
        'en_proceso',
        'adquirido',
        'consolidado',
        name='achievement_level_enum'
    ), nullable=False)
    age_months = db.Column(db.Float)
    registered_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    notes = db.Column(db.Text)
    
    # Relationships
    registered_by = db.relationship('User', foreign_keys=[registered_by_id])
    # NOTE: 'child' relationship is provided by backref in Child model (child.py)
    
    __table_args__ = (
        db.Index('idx_milestone_tenant', 'tenant_id'),
        db.Index('idx_milestone_child', 'child_id'),
        db.Index('idx_milestone_domain', 'domain'),
    )
    
    @property
    def achievement_percentage(self):
        """Get achievement level as percentage (IDII 3-level scale)"""
        mapping = {
            'no_iniciado': 0,
            'en_proceso': 50,
            'adquirido': 100,
            'consolidado': 100  # Kept for backward compat, hidden in UI
        }
        return mapping.get(self.achievement_level, 0)
    
    @property
    def color_code(self):
        """Get IDII color code for this achievement level"""
        mapping = {
            'no_iniciado': 'rojo',
            'en_proceso': 'amarillo',
            'adquirido': 'verde',
            'consolidado': 'verde'
        }
        return mapping.get(self.achievement_level, 'rojo')
    
    @property
    def domain_display(self):
        """Get human-readable domain name"""
        mapping = {
            'vinculacion_emocional': 'Vinculación Emocional y Social',
            'descubrimiento_natural_cultural': 'Descubrimiento del Medio Natural y Cultural',
            'expresion_corporal': 'Exploración del Cuerpo y Motricidad',
            'lenguaje': 'Lenguaje Verbal y No Verbal'
        }
        return mapping.get(self.domain, self.domain)
    
    def __repr__(self):
        return f'<Milestone {self.child_id} - {self.domain} - {self.achievement_level}>'
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'record_date': self.record_date.isoformat() if self.record_date else None,
            'period': self.period,
            'domain': self.domain,
            'domain_display': self.domain_display,
            'milestone_description': self.milestone_description,
            'achievement_level': self.achievement_level,
            'achievement_percentage': self.achievement_percentage,
            'color_code': self.color_code,
            'age_months': self.age_months,
            'registered_by': self.registered_by.full_name if self.registered_by else None,
            'notes': self.notes
        }
