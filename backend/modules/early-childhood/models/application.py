"""
Application and Vulnerability Models
Gestión de solicitudes de ingreso y fichas de vulnerabilidad
"""
from models import db, BaseModel
from datetime import datetime


class Application(db.Model, BaseModel):
    """
    Solicitud de Ingreso
    Gestiona el proceso de postulación de un niño al centro
    """
    __tablename__ = 'applications'
    
    id = db.Column(db.Integer, primary_key=True)
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    tenant_id = db.Column(db.Integer, nullable=False)  # Legacy column (no FK in DB)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id'), nullable=True)
    
    # Datos de la solicitud
    application_date = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, waitlist
    
    # Priorización
    priority_score = db.Column(db.Float, default=0.0)  # Score de vulnerabilidad
    priority_rank = db.Column(db.Integer)  # Posición en lista de espera
    
    # Decisión
    decision_date = db.Column(db.Date)
    decided_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    decision_notes = db.Column(db.Text)
    
    # Columnas legado (existen en la BD; la app crea registros en `children`)
    child_first_name = db.Column(db.String(100))
    child_last_name = db.Column(db.String(100))
    child_birth_date = db.Column(db.Date)
    child_gender = db.Column(db.String(20))
    child_cedula = db.Column(db.String(20))
    family_id = db.Column(db.Integer)
    submission_date = db.Column(db.Date)
    submitted_by = db.Column(db.Integer)
    
    # Relaciones
    center = db.relationship('Tenant', foreign_keys=[center_id], backref='applications')
    child = db.relationship('Child', backref='applications')
    decider = db.relationship('User', foreign_keys=[decided_by])
    
    def to_dict(self):
        """Convertir a diccionario"""
        data = super().to_dict()
        data['center_name'] = self.center.name if self.center else None
        data['child_name'] = self.child.full_name if self.child else None
        data['child_age_months'] = self.child.age_months if self.child else None
        return data
    
    def approve(self, user_id, notes=None):
        """Aprobar solicitud"""
        self.status = 'approved'
        self.decision_date = datetime.utcnow().date()
        self.decided_by = user_id
        self.decision_notes = notes
        
        # Incrementar inscripción del centro
        if self.center.increment_enrollment():
            # Actualizar estado del niño
            self.child.status = 'activo'
            return True
        return False
    
    def reject(self, user_id, notes=None):
        """Rechazar solicitud"""
        self.status = 'rejected'
        self.decision_date = datetime.utcnow().date()
        self.decided_by = user_id
        self.decision_notes = notes
    
    def move_to_waitlist(self):
        """Mover a lista de espera"""
        self.status = 'waitlist'


class VulnerabilityForm(db.Model, BaseModel):
    """
    Ficha R01 de Vulnerabilidad
    Evaluación socioeconómica del núcleo familiar
    """
    __tablename__ = 'vulnerability_forms'
    
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id'), nullable=True, unique=True)
    application_id = db.Column(db.Integer, db.ForeignKey('applications.id'))
    tenant_id = db.Column(db.Integer)  # Legacy column
    
    # Datos del núcleo familiar
    household_members = db.Column(db.Integer)  # Número de miembros
    monthly_income = db.Column(db.Float)  # Ingreso mensual total
    income_per_capita = db.Column(db.Float)  # Ingreso per cápita
    
    # Vivienda
    housing_type = db.Column(db.String(50))  # propia, arrendada, prestada, invasión
    housing_material = db.Column(db.String(50))  # hormigón, madera, caña, mixto
    rooms_count = db.Column(db.Integer)
    
    # Servicios básicos (JSON)
    basic_services = db.Column(db.JSON)  # {agua: true, luz: true, alcantarillado: false, ...}
    
    # Factores de riesgo
    violence_indicators = db.Column(db.Boolean, default=False)
    disability_in_family = db.Column(db.Boolean, default=False)
    single_parent = db.Column(db.Boolean, default=False)
    teen_parent = db.Column(db.Boolean, default=False)  # Madre/padre adolescente
    chronic_illness = db.Column(db.Boolean, default=False)
    unemployment = db.Column(db.Boolean, default=False)
    
    # Educación de padres
    mother_education = db.Column(db.String(50))  # ninguna, primaria, secundaria, superior
    father_education = db.Column(db.String(50))
    
    # Situación migratoria
    migrant_family = db.Column(db.Boolean, default=False)
    refugee_status = db.Column(db.Boolean, default=False)
    
    # Score calculado
    vulnerability_score = db.Column(db.Float, default=0.0)  # 0-100
    vulnerability_level = db.Column(db.String(20))  # bajo, medio, alto, crítico
    
    # Metadata
    evaluated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    evaluation_date = db.Column(db.Date, default=datetime.utcnow)
    
    # Columnas legado (existen en la BD)
    parent_education_level = db.Column(db.String(50))
    geographic_zone = db.Column(db.String(50))
    distance_to_center = db.Column(db.Float)
    observations = db.Column(db.Text)
    
    # Relaciones
    child = db.relationship('Child', backref='vulnerability_form')
    application = db.relationship('Application', backref='vulnerability_form')
    evaluator = db.relationship('User')
    
    def calculate_score(self):
        """
        Calcular score de vulnerabilidad (0-100)
        Mayor score = Mayor vulnerabilidad = Mayor prioridad
        """
        score = 0.0
        
        # 1. Ingreso per cápita (30 puntos)
        if self.income_per_capita:
            if self.income_per_capita < 100:
                score += 30
            elif self.income_per_capita < 200:
                score += 20
            elif self.income_per_capita < 300:
                score += 10
        
        # 2. Tipo de vivienda (15 puntos)
        housing_scores = {
            'invasión': 15,
            'prestada': 12,
            'arrendada': 8,
            'propia': 0
        }
        score += housing_scores.get(self.housing_type, 0)
        
        # 3. Material de vivienda (10 puntos)
        material_scores = {
            'caña': 10,
            'madera': 7,
            'mixto': 4,
            'hormigón': 0
        }
        score += material_scores.get(self.housing_material, 0)
        
        # 4. Servicios básicos (10 puntos)
        if self.basic_services:
            missing_services = sum(1 for v in self.basic_services.values() if not v)
            score += missing_services * 2.5  # Hasta 10 puntos
        
        # 5. Factores de riesgo (35 puntos total)
        risk_factors = [
            (self.violence_indicators, 10),
            (self.disability_in_family, 7),
            (self.single_parent, 5),
            (self.teen_parent, 5),
            (self.chronic_illness, 4),
            (self.unemployment, 4)
        ]
        score += sum(points for condition, points in risk_factors if condition)
        
        # 6. Educación de padres (bonus negativo - reduce vulnerabilidad)
        education_levels = {'superior': -5, 'secundaria': -3, 'primaria': 0, 'ninguna': 5}
        if self.mother_education:
            score += education_levels.get(self.mother_education, 0)
        if self.father_education:
            score += education_levels.get(self.father_education, 0)
        
        # 7. Situación migratoria (10 puntos)
        if self.migrant_family:
            score += 5
        if self.refugee_status:
            score += 5
        
        # Normalizar score (0-100)
        self.vulnerability_score = min(100, max(0, score))
        
        # Determinar nivel
        if self.vulnerability_score >= 75:
            self.vulnerability_level = 'crítico'
        elif self.vulnerability_score >= 50:
            self.vulnerability_level = 'alto'
        elif self.vulnerability_score >= 25:
            self.vulnerability_level = 'medio'
        else:
            self.vulnerability_level = 'bajo'
        
        return self.vulnerability_score
    
    def to_dict(self):
        """Convertir a diccionario"""
        data = super().to_dict()
        data['child_name'] = self.child.full_name if self.child else None
        data['evaluator_name'] = self.evaluator.full_name if self.evaluator else None
        return data


class WaitingList(db.Model, BaseModel):
    """
    Lista de Espera
    Gestiona el orden de prioridad para ingreso
    """
    __tablename__ = 'waiting_lists'
    
    id = db.Column(db.Integer, primary_key=True)
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    application_id = db.Column(db.Integer, db.ForeignKey('applications.id'), nullable=False)
    
    # Posición y prioridad
    position = db.Column(db.Integer)  # Posición en la lista
    priority_score = db.Column(db.Float)  # Score de priorización
    
    # Fechas
    added_date = db.Column(db.Date, default=datetime.utcnow)
    notified_date = db.Column(db.Date)  # Fecha de notificación de cupo disponible
    
    # Estado
    status = db.Column(db.String(20), default='waiting')  # waiting, notified, accepted, declined
    
    # Relaciones
    center = db.relationship('Tenant')
    application = db.relationship('Application')
    
    def to_dict(self):
        """Convertir a diccionario"""
        data = super().to_dict()
        data['center_name'] = self.center.name if self.center else None
        data['child_name'] = self.application.child.full_name if self.application and self.application.child else None
        return data
