"""
Health records model
"""
from models import db, BaseModel
from datetime import date


class HealthRecord(db.Model, BaseModel):
    """Health monitoring model"""
    
    __tablename__ = 'health_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    record_type = db.Column(db.Enum('crecimiento', 'vacunacion', 'incidente', 'enfermedad', 'brigada_medica', name='health_record_type_enum'), nullable=False)
    
    # Growth measurements
    weight = db.Column(db.Numeric(5, 2))  # kg
    height = db.Column(db.Numeric(5, 2))  # cm
    head_circumference = db.Column(db.Numeric(5, 2))  # cm
    z_score_weight = db.Column(db.Numeric(5, 2))
    z_score_height = db.Column(db.Numeric(5, 2))
    
    # Vaccination
    vaccine_name = db.Column(db.String(255))
    vaccine_dose = db.Column(db.String(50))
    
    # Incidents and illnesses
    incident_description = db.Column(db.Text)
    symptoms = db.Column(db.Text)
    treatment = db.Column(db.Text)
    medical_professional = db.Column(db.String(255))
    
    registered_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    notes = db.Column(db.Text)
    
    # Relationships
    registered_by = db.relationship('User', foreign_keys=[registered_by_id])
    
    __table_args__ = (
        db.Index('idx_health_tenant', 'tenant_id'),
        db.Index('idx_health_child', 'child_id'),
        db.Index('idx_health_type', 'record_type'),
    )
    
    def __repr__(self):
        return f'<HealthRecord {self.child_id} - {self.record_type} - {self.record_date}>'
    
    def calculate_z_score(self, measurement_type='weight'):
        """
        Calculate WHO Z-score for weight or height
        This is a simplified version - production should use WHO tables
        """
        if measurement_type == 'weight':
            return self.z_score_weight
        elif measurement_type == 'height':
            return self.z_score_height
        return None
    
    def to_dict(self):
        """Convert to dictionary"""
        age_at_measurement = None
        if self.child and self.child.birth_date and self.record_date:
            from dateutil.relativedelta import relativedelta
            delta = relativedelta(self.record_date, self.child.birth_date)
            if delta.years > 0:
                age_at_measurement = f"{delta.years} año{'s' if delta.years > 1 else ''}, {delta.months} mes{'es' if delta.months != 1 else ''}"
            else:
                age_at_measurement = f"{delta.months} mes{'es' if delta.months != 1 else ''}"

        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'record_date': self.record_date.isoformat() if self.record_date else None,
            'age_at_measurement': age_at_measurement,
            'record_type': self.record_type,
            'weight': float(self.weight) if self.weight else None,
            'height': float(self.height) if self.height else None,
            'head_circumference': float(self.head_circumference) if self.head_circumference else None,
            'z_score_weight': float(self.z_score_weight) if self.z_score_weight else None,
            'z_score_height': float(self.z_score_height) if self.z_score_height else None,
            'vaccine_name': self.vaccine_name,
            'vaccine_dose': self.vaccine_dose,
            'incident_description': self.incident_description,
            'symptoms': self.symptoms,
            'treatment': self.treatment,
            'medical_professional': self.medical_professional,
            'registered_by': self.registered_by.full_name if self.registered_by else None,
            'notes': self.notes
        }


class MedicalProfile(db.Model, BaseModel):
    """Medical profile for a child - static health information"""
    
    __tablename__ = 'medical_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Basic medical info
    blood_type = db.Column(db.String(10))  # A+, A-, B+, B-, AB+, AB-, O+, O-
    birth_weight = db.Column(db.Numeric(5, 2))  # kg
    birth_height = db.Column(db.Numeric(5, 2))  # cm
    gestational_weeks = db.Column(db.Integer)  # Weeks at birth
    
    # Allergies and conditions
    allergies = db.Column(db.JSON)  # ["polen", "nueces", "mariscos"]
    chronic_conditions = db.Column(db.JSON)  # ["asma", "diabetes"]
    current_medications = db.Column(db.JSON)  # [{"name": "med", "dose": "10mg", "frequency": "diario"}]
    
    # Emergency info
    emergency_medications = db.Column(db.Text)  # Special instructions
    hospital_preference = db.Column(db.String(255))
    insurance_info = db.Column(db.String(255))
    
    # Doctor info
    pediatrician_name = db.Column(db.String(255))
    pediatrician_phone = db.Column(db.String(50))
    
    # Relationships
    child = db.relationship('Child', backref=db.backref('medical_profile', uselist=False))
    
    def __repr__(self):
        return f'<MedicalProfile child_id={self.child_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'child_id': self.child_id,
            'blood_type': self.blood_type,
            'birth_weight': float(self.birth_weight) if self.birth_weight else None,
            'birth_height': float(self.birth_height) if self.birth_height else None,
            'gestational_weeks': self.gestational_weeks,
            'allergies': self.allergies or [],
            'chronic_conditions': self.chronic_conditions or [],
            'current_medications': self.current_medications or [],
            'emergency_medications': self.emergency_medications,
            'hospital_preference': self.hospital_preference,
            'insurance_info': self.insurance_info,
            'pediatrician_name': self.pediatrician_name,
            'pediatrician_phone': self.pediatrician_phone
        }


class Vaccine(db.Model, BaseModel):
    """Individual vaccine record"""
    
    __tablename__ = 'vaccines'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    
    # Vaccine info
    vaccine_name = db.Column(db.String(100), nullable=False)  # BCG, Rotavirus, etc.
    vaccine_type = db.Column(db.String(100))  # Categoría: básica, refuerzo, estacional
    dose_number = db.Column(db.Integer, default=1)  # 1, 2, 3...
    
    # Application info
    date_applied = db.Column(db.Date)
    next_dose_date = db.Column(db.Date)
    applied_by = db.Column(db.String(255))  # Profesional de salud
    application_site = db.Column(db.String(100))  # brazo izquierdo, muslo derecho
    batch_number = db.Column(db.String(100))
    
    # Status
    status = db.Column(db.Enum('pendiente', 'aplicada', 'omitida', name='vaccine_status_enum'), default='pendiente')
    omission_reason = db.Column(db.Text)  # Si se omite, razón
    
    # Registered by
    registered_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    notes = db.Column(db.Text)
    
    # Relationships
    registered_by = db.relationship('User', foreign_keys=[registered_by_id])
    child = db.relationship('Child', backref='vaccines')
    
    __table_args__ = (
        db.Index('idx_vaccine_child', 'child_id'),
        db.Index('idx_vaccine_status', 'status'),
    )
    
    def __repr__(self):
        return f'<Vaccine {self.vaccine_name} dose {self.dose_number} - child {self.child_id}>'
    
    @property
    def is_overdue(self):
        """Check if vaccine is overdue"""
        if self.status == 'pendiente' and self.next_dose_date:
            return date.today() > self.next_dose_date
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'vaccine_name': self.vaccine_name,
            'vaccine_type': self.vaccine_type,
            'dose_number': self.dose_number,
            'date_applied': self.date_applied.isoformat() if self.date_applied else None,
            'next_dose_date': self.next_dose_date.isoformat() if self.next_dose_date else None,
            'applied_by': self.applied_by,
            'application_site': self.application_site,
            'batch_number': self.batch_number,
            'status': self.status,
            'is_overdue': self.is_overdue,
            'omission_reason': self.omission_reason,
            'registered_by': self.registered_by.full_name if self.registered_by else None,
            'notes': self.notes
        }


# Standard vaccine schedule for Ecuador/MIES
VACCINE_SCHEDULE = {
    '0': [  # At birth
        {'name': 'BCG', 'dose': 1},
        {'name': 'Hepatitis B', 'dose': 1}
    ],
    '2': [  # 2 months
        {'name': 'Pentavalente', 'dose': 1},
        {'name': 'Rotavirus', 'dose': 1},
        {'name': 'Neumococo', 'dose': 1},
        {'name': 'Polio', 'dose': 1}
    ],
    '4': [  # 4 months
        {'name': 'Pentavalente', 'dose': 2},
        {'name': 'Rotavirus', 'dose': 2},
        {'name': 'Neumococo', 'dose': 2},
        {'name': 'Polio', 'dose': 2}
    ],
    '6': [  # 6 months
        {'name': 'Pentavalente', 'dose': 3},
        {'name': 'Rotavirus', 'dose': 3},
        {'name': 'Polio', 'dose': 3}
    ],
    '12': [  # 12 months
        {'name': 'SRP (Sarampión, Rubéola, Paperas)', 'dose': 1},
        {'name': 'Varicela', 'dose': 1},
        {'name': 'Neumococo', 'dose': 3}
    ],
    '15': [  # 15 months
        {'name': 'Fiebre Amarilla', 'dose': 1}
    ],
    '18': [  # 18 months
        {'name': 'DPT (refuerzo)', 'dose': 1},
        {'name': 'Polio (refuerzo)', 'dose': 1}
    ],
    '48': [  # 4 years
        {'name': 'DPT (segundo refuerzo)', 'dose': 2},
        {'name': 'Polio (segundo refuerzo)', 'dose': 2},
        {'name': 'SRP (refuerzo)', 'dose': 2}
    ]
}

