"""
Child and Family models
"""
from models import db, BaseModel
from datetime import date
from dateutil.relativedelta import relativedelta


class Family(db.Model, BaseModel):
    """Family model"""
    
    __tablename__ = 'families'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    province = db.Column(db.String(100))
    phone_primary = db.Column(db.String(20))
    phone_secondary = db.Column(db.String(20))
    emergency_contact_name = db.Column(db.String(255))
    emergency_contact_phone = db.Column(db.String(20))
    emergency_contact_relationship = db.Column(db.String(100))
    socioeconomic_level = db.Column(db.Enum('bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto', name='socioeconomic_enum'))
    vulnerability_score = db.Column(db.Integer)
    notes = db.Column(db.Text)
    
    # Datos geográficos expandidos
    sector = db.Column(db.String(100))  # Sector / Parroquia
    neighborhood = db.Column(db.String(100))  # Barrio
    residency_years = db.Column(db.Integer)  # Años en dirección actual
    previous_address = db.Column(db.Text)  # Dirección anterior (últimos 5 años)
    previous_city = db.Column(db.String(100))
    previous_province = db.Column(db.String(100))
    
    # Perfil socioeconómico
    housing_type = db.Column(db.String(50))  # propia_pagada, arrendada, prestada, etc.
    employment_type = db.Column(db.String(50))  # empleo_adecuado, subempleo, informal, etc.
    monthly_income_range = db.Column(db.String(50))  # menos_100, 100_250, etc.
    household_type = db.Column(db.String(50))  # nuclear, monoparental, extendido, etc.
    economic_condition = db.Column(db.String(50))  # pobreza_extrema, pobreza, vulnerable, estable
    geographic_zone = db.Column(db.String(50))  # urbano, urbano_marginal, periurbano, rural
    ethnic_identity = db.Column(db.String(50))  # mestizo, indigena, afroecuatoriano, etc.
    has_disability = db.Column(db.Boolean, default=False)
    disability_detail = db.Column(db.String(255))
    mobility_status = db.Column(db.String(50))  # no_aplica, inmigrante, refugiado, etc.
    migrant_origin = db.Column(db.String(255))  # País/región de origen
    social_risks = db.Column(db.JSON)  # Array de riesgos sociales identificados
    
    # Relationships
    children = db.relationship('Child', backref='family', lazy='dynamic')
    representatives = db.relationship('Representative', backref='family', lazy='dynamic', cascade='all, delete-orphan')
    
    __table_args__ = (
        db.Index('idx_family_tenant', 'tenant_id'),
    )
    
    def __repr__(self):
        return f'<Family {self.id}>'


class Representative(db.Model, BaseModel):
    """Representative/Parent model"""
    
    __tablename__ = 'representatives'
    
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey('families.id', ondelete='CASCADE'), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    cedula = db.Column(db.String(10), unique=True)
    relationship = db.Column(db.Enum('madre', 'padre', 'abuelo', 'abuela', 'tio', 'tia', 'tutor_legal', 'otro', name='relationship_enum'), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(255))
    occupation = db.Column(db.String(100))
    workplace = db.Column(db.String(255))
    is_primary = db.Column(db.Boolean, default=False)
    
    # Datos de origen (mapeo geográfico)
    birth_place = db.Column(db.String(255))  # Lugar de nacimiento
    birth_province = db.Column(db.String(100))  # Provincia de nacimiento
    nationality = db.Column(db.String(100), default='Ecuatoriana')  # Nacionalidad
    
    __table_args__ = (
        db.Index('idx_rep_family', 'family_id'),
    )
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f'<Representative {self.full_name}>'


class Child(db.Model, BaseModel):
    """Child model"""
    
    __tablename__ = 'children'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey('families.id'), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    cedula = db.Column(db.String(10), unique=True)
    birth_date = db.Column(db.Date, nullable=False)
    gender = db.Column(db.Enum('masculino', 'femenino', name='gender_enum'), nullable=False)
    birth_weight = db.Column(db.Numeric(5, 2))
    birth_height = db.Column(db.Numeric(5, 2))
    blood_type = db.Column(db.String(5))
    photo_url = db.Column(db.String(500))
    enrollment_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('activo', 'inactivo', 'egresado', 'lista_espera', name='status_enum'), default='activo')
    assigned_group = db.Column(db.String(100))
    assigned_educator_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    special_needs = db.Column(db.Text)
    allergies = db.Column(db.Text)
    medical_conditions = db.Column(db.Text)
    notes = db.Column(db.Text)
    
    # Relationships
    attendance_records = db.relationship('Attendance', backref='child', lazy='dynamic', cascade='all, delete-orphan')
    nutrition_records = db.relationship('NutritionDaily', backref='child', lazy='dynamic', cascade='all, delete-orphan')
    health_records = db.relationship('HealthRecord', backref='child', lazy='dynamic', cascade='all, delete-orphan')
    milestones = db.relationship('Milestone', backref='child', lazy='dynamic', cascade='all, delete-orphan')
    
    __table_args__ = (
        db.Index('idx_child_tenant', 'tenant_id'),
        db.Index('idx_child_status', 'status'),
        db.Index('idx_child_educator', 'assigned_educator_id'),
    )
    
    @property
    def full_name(self):
        """Formato institucional: APELLIDOS, Nombres"""
        return f"{self.last_name}, {self.first_name}"
    
    @property
    def age_months(self):
        """Calculate age in months (integer, truncated)"""
        if not self.birth_date:
            return None
        today = date.today()
        delta = relativedelta(today, self.birth_date)
        return delta.years * 12 + delta.months
    
    @property
    def age_months_precise(self):
        """Calculate age in months with decimal precision for IDII (16 days = 0.5 months)"""
        if not self.birth_date:
            return None
        today = date.today()
        delta = relativedelta(today, self.birth_date)
        # 16 days is considered the transition point in IDII (12 months and 16 days)
        # We use 0.5 as the threshold for 16 days.
        days_decimal = 0.5 if delta.days >= 16 else 0.0
        return float(delta.years * 12 + delta.months + days_decimal)
    
    @property
    def age_display(self):
        """Get age in human-readable format"""
        if not self.birth_date:
            return "N/A"
        today = date.today()
        delta = relativedelta(today, self.birth_date)
        if delta.years > 0:
            return f"{delta.years} año{'s' if delta.years > 1 else ''}, {delta.months} mes{'es' if delta.months != 1 else ''}"
        return f"{delta.months} mes{'es' if delta.months != 1 else ''}"
    
    def __repr__(self):
        return f'<Child {self.full_name}>'
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'tenant_name': self.tenant.name if self.tenant else None,
            'family_id': self.family_id,
            'full_name': self.full_name,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'cedula': self.cedula,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'age_months': self.age_months,
            'age_months_precise': self.age_months_precise,
            'age_display': self.age_display,
            'gender': self.gender,
            'blood_type': self.blood_type,
            'photo_url': self.photo_url,
            'enrollment_date': self.enrollment_date.isoformat() if hasattr(self.enrollment_date, 'isoformat') else self.enrollment_date,
            'status': self.status,
            'assigned_group': self.assigned_group,
            'assigned_educator_id': self.assigned_educator_id,
            'allergies': self.allergies,
            'medical_conditions': self.medical_conditions,
            'special_needs': self.special_needs
        }
