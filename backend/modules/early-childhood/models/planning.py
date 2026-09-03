"""
Ludic Planning Model
Planificaciones Lúdicas para Educadoras (DASE/CASIBA standard)
"""
from models import db, BaseModel
from datetime import date


class LudicPlanning(db.Model, BaseModel):
    """
    Planificación Lúdica Semanal
    Basada en el formato institucional proporcionado por DASE/CASIBA.
    """
    __tablename__ = 'ludic_plannings'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    educator_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    
    # Encabezado de la planificación
    planning_date = db.Column(db.Date, nullable=False, default=date.today)
    age_group = db.Column(db.String(50), nullable=False)  # "12-18 meses", "18-24 meses", "24-36 meses"
    week_number = db.Column(db.Integer)  # Número de semana
    month = db.Column(db.String(20))  # Mes (Enero, Febrero, etc.)
    year = db.Column(db.Integer)  # Año
    
    # Contenido pedagógico
    tema_integrador = db.Column(db.String(255))  # Tema central de la semana
    nombre_actividad = db.Column(db.String(255), nullable=False)  # Nombre de la experiencia de aprendizaje
    objetivo = db.Column(db.Text)  # Objetivo de desarrollo y aprendizaje
    
    # Momentos de la jornada (almacenados como JSON para flexibilidad)
    # Cada momento contiene: { actividad, recursos, duracion_min }
    momento_bienvenida = db.Column(db.JSON)  # Saludo y bienvenida
    momento_juego_intencionado = db.Column(db.JSON)  # Juego intencionado (núcleo)
    momento_juego_libre = db.Column(db.JSON)  # Juego libre exploración
    momento_higiene = db.Column(db.JSON)  # Aseo y hábitos
    momento_alimentacion = db.Column(db.JSON)  # Alimentación
    momento_descanso = db.Column(db.JSON)  # Descanso / Siesta
    momento_despedida = db.Column(db.JSON)  # Cierre y despedida
    
    # Ámbitos de desarrollo (según currículo)
    ambito_vinculacion = db.Column(db.Text)  # Vinculación emocional y social
    ambito_descubrimiento = db.Column(db.Text)  # Descubrimiento natural y cultural
    ambito_expresion = db.Column(db.Text)  # Manifestación del lenguaje verbal y no verbal
    ambito_exploracion = db.Column(db.Text)  # Exploración del cuerpo y motricidad
    
    # Evaluación / Indicadores
    indicadores_logro = db.Column(db.JSON)  # Lista de indicadores de logro
    observaciones = db.Column(db.Text)  # Observaciones generales
    
    # Estado
    status = db.Column(db.Enum('borrador', 'aprobado', 'revisado', name='planning_status_enum'), default='borrador')
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    review_date = db.Column(db.Date)
    
    # Relationships
    educator = db.relationship('User', foreign_keys=[educator_id], backref='plannings')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    tenant = db.relationship('Tenant')
    
    __table_args__ = (
        db.Index('idx_planning_tenant', 'tenant_id'),
        db.Index('idx_planning_educator', 'educator_id'),
        db.Index('idx_planning_date', 'planning_date'),
    )
    
    def __repr__(self):
        return f'<LudicPlanning {self.id} - {self.nombre_actividad}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'center_name': self.tenant.name if self.tenant else None,
            'educator_id': self.educator_id,
            'educator_name': self.educator.full_name if self.educator else 'Sin asignar',
            'planning_date': self.planning_date.isoformat() if self.planning_date else None,
            'age_group': self.age_group,
            'week_number': self.week_number,
            'month': self.month,
            'year': self.year,
            'tema_integrador': self.tema_integrador,
            'nombre_actividad': self.nombre_actividad,
            'objetivo': self.objetivo,
            'momento_bienvenida': self.momento_bienvenida,
            'momento_juego_intencionado': self.momento_juego_intencionado,
            'momento_juego_libre': self.momento_juego_libre,
            'momento_higiene': self.momento_higiene,
            'momento_alimentacion': self.momento_alimentacion,
            'momento_descanso': self.momento_descanso,
            'momento_despedida': self.momento_despedida,
            'ambito_vinculacion': self.ambito_vinculacion,
            'ambito_descubrimiento': self.ambito_descubrimiento,
            'ambito_expresion': self.ambito_expresion,
            'ambito_exploracion': self.ambito_exploracion,
            'indicadores_logro': self.indicadores_logro,
            'observaciones': self.observaciones,
            'status': self.status,
            'reviewed_by': self.reviewed_by,
            'reviewer_name': self.reviewer.full_name if self.reviewer else None,
            'review_date': self.review_date.isoformat() if self.review_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
