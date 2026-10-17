"""
Nutrition tracking model
"""
from models import db, BaseModel
from datetime import date


class NutritionDaily(db.Model, BaseModel):
    """Daily nutrition tracking model"""
    
    __tablename__ = 'nutrition_daily'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    meal_type = db.Column(db.Enum('desayuno', 'refrigerio_am', 'almuerzo', 'refrigerio_pm', 'lactancia', name='meal_type_enum'), nullable=False)
    meal_time = db.Column(db.Time)
    consumption_level = db.Column(db.Enum('todo', 'la_mayoria', 'la_mitad', 'poco', 'nada', name='consumption_enum'), nullable=False)
    calories_estimated = db.Column(db.Numeric(6, 2))
    menu_description = db.Column(db.Text)
    registered_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    notes = db.Column(db.Text)
    
    # Relationships
    registered_by = db.relationship('User', foreign_keys=[registered_by_id])
    
    __table_args__ = (
        db.Index('idx_nutrition_tenant', 'tenant_id'),
        db.Index('idx_nutrition_child_date', 'child_id', 'date'),
    )
    
    @property
    def consumption_percentage(self):
        """Get consumption as percentage"""
        mapping = {
            'todo': 100,
            'la_mayoria': 75,
            'la_mitad': 50,
            'poco': 25,
            'nada': 0
        }
        return mapping.get(self.consumption_level, 0)
    
    def __repr__(self):
        return f'<NutritionDaily {self.child_id} - {self.date} - {self.meal_type}>'
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'date': self.date.isoformat() if self.date else None,
            'meal_type': self.meal_type,
            'meal_time': self.meal_time.isoformat() if self.meal_time else None,
            'consumption_level': self.consumption_level,
            'consumption_percentage': self.consumption_percentage,
            'calories_estimated': float(self.calories_estimated) if self.calories_estimated else None,
            'menu_description': self.menu_description,
            'registered_by': self.registered_by.full_name if self.registered_by else None,
            'notes': self.notes
        }


class Menu(db.Model, BaseModel):
    """Weekly menu planning"""
    
    __tablename__ = 'menus'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id', ondelete='CASCADE'), nullable=True)
    
    # Date and meal info
    week_start_date = db.Column(db.Date, nullable=False)  # Monday of the week
    day_of_week = db.Column(db.Integer, nullable=False)  # 1=Monday, 5=Friday
    meal_type = db.Column(db.String(50), nullable=False)  # desayuno, almuerzo, etc.
    
    # Meal details
    description = db.Column(db.String(500), nullable=False)
    ingredients = db.Column(db.JSON)  # ["arroz", "pollo", "ensalada"]
    calories = db.Column(db.Integer)
    
    # Created by
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    
    __table_args__ = (
        db.Index('idx_menu_tenant_week', 'tenant_id', 'week_start_date'),
        db.Index('idx_menu_license_week', 'license_id', 'week_start_date'),
    )
    
    def __repr__(self):
        return f'<Menu {self.day_name} {self.meal_type}>'
    
    @property
    def day_name(self):
        days = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes'}
        return days.get(self.day_of_week, 'Día')
    
    @property
    def meal_name(self):
        meals = {
            'desayuno': 'Desayuno',
            'refrigerio_am': 'Media Mañana',
            'almuerzo': 'Almuerzo',
            'refrigerio_pm': 'Media Tarde'
        }
        return meals.get(self.meal_type, self.meal_type.replace('_', ' ').title())
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'license_id': self.license_id,
            'week_start_date': self.week_start_date.isoformat() if self.week_start_date else None,
            'day_of_week': self.day_of_week,
            'day_name': self.day_name,
            'meal_type': self.meal_type,
            'meal_name': self.meal_name,
            'description': self.description,
            'ingredients': self.ingredients or [],
            'calories': self.calories,
            'created_by': self.created_by.full_name if self.created_by else None
        }


class NutritionAlert(db.Model, BaseModel):
    """Nutrition alerts for children with low consumption"""
    
    __tablename__ = 'nutrition_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    
    alert_date = db.Column(db.Date, nullable=False, default=date.today)
    alert_type = db.Column(db.String(50), nullable=False)  # bajo_consumo, rechazo_alimentos
    severity = db.Column(db.String(20), default='media')  # baja, media, alta
    
    description = db.Column(db.Text)
    average_consumption = db.Column(db.Integer)  # Last 7 days avg
    
    # Resolution
    resolved = db.Column(db.Boolean, default=False)
    resolved_date = db.Column(db.Date)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    resolution_notes = db.Column(db.Text)
    
    # Relationships
    child = db.relationship('Child', backref='nutrition_alerts')
    resolved_by = db.relationship('User', foreign_keys=[resolved_by_id])
    
    def __repr__(self):
        return f'<NutritionAlert child={self.child_id} {self.alert_type}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'alert_date': self.alert_date.isoformat() if self.alert_date else None,
            'alert_type': self.alert_type,
            'severity': self.severity,
            'description': self.description,
            'average_consumption': self.average_consumption,
            'resolved': self.resolved,
            'resolved_date': self.resolved_date.isoformat() if self.resolved_date else None,
            'resolved_by': self.resolved_by.full_name if self.resolved_by else None,
            'resolution_notes': self.resolution_notes
        }


class ChildNutritionalAssessment(db.Model, BaseModel):
    """
    Ficha de Estado Nutricional 12 a 42 meses (patrón OMS 2006).
    Registro periódico (trimestral e inicial) realizado por nutricionista.
    Permite descarga directa a la plantilla Excel oficial sin retrabajo manual.
    """
    __tablename__ = 'child_nutritional_assessments'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'), nullable=False)
    assessor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    assessment_date = db.Column(db.Date, nullable=False, default=date.today)
    period_type = db.Column(db.String(50), default='trimestral')  # 'inicial', 'trimestral_1', 'trimestral_2', 'trimestral_3', 'final'

    # Mediciones antropométricas
    weight_kg = db.Column(db.Numeric(5, 2), nullable=False)
    height_cm = db.Column(db.Numeric(5, 2), nullable=False)
    measurement_position = db.Column(db.String(20), default='De pie')  # 'Acostado' o 'De pie'
    brachial_perimeter_cm = db.Column(db.Numeric(5, 2), nullable=True)  # Perímetro braquial
    hemoglobin_g_dl = db.Column(db.Numeric(4, 2), nullable=True)  # Hemoglobina
    cephalic_perimeter_cm = db.Column(db.Numeric(5, 2), nullable=True)  # Perímetro cefálico
    abdominal_perimeter_cm = db.Column(db.Numeric(5, 2), nullable=True)  # Perímetro abdominal

    # Datos calculados OMS
    age_months_calc = db.Column(db.Integer, nullable=True)
    height_corrected_cm = db.Column(db.Numeric(5, 2), nullable=True)
    z_weight_for_age = db.Column(db.Numeric(5, 2), nullable=True)
    weight_for_age_diag = db.Column(db.String(100), nullable=True)
    z_height_for_age = db.Column(db.Numeric(5, 2), nullable=True)
    height_for_age_diag = db.Column(db.String(100), nullable=True)
    z_weight_for_height = db.Column(db.Numeric(5, 2), nullable=True)
    weight_for_height_diag = db.Column(db.String(100), nullable=True)

    brachial_diag = db.Column(db.String(100), nullable=True)
    hemoglobin_diag = db.Column(db.String(100), nullable=True)

    semaphore = db.Column(db.String(50), nullable=True)  # VERDE, AMARILLO, NARANJA, ROJO
    nutritional_diagnosis = db.Column(db.String(255), nullable=True)
    requires_nutrition_plan = db.Column(db.Boolean, default=False)
    recommended_action = db.Column(db.Text, nullable=True)
    observations = db.Column(db.Text, nullable=True)

    # Relationships
    child = db.relationship('Child', backref=db.backref('nutritional_assessments', cascade='all, delete-orphan', lazy='dynamic'))
    assessor = db.relationship('User', foreign_keys=[assessor_id])

    __table_args__ = (
        db.Index('idx_cna_tenant', 'tenant_id'),
        db.Index('idx_cna_child_date', 'child_id', 'assessment_date'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'child_id': self.child_id,
            'child_name': self.child.full_name if self.child else None,
            'child_cedula': self.child.cedula if self.child else None,
            'child_gender': self.child.gender if self.child else None,
            'child_birth_date': self.child.birth_date.isoformat() if (self.child and self.child.birth_date) else None,
            'assessor_name': self.assessor.full_name if self.assessor else None,
            'assessment_date': self.assessment_date.isoformat() if self.assessment_date else None,
            'period_type': self.period_type,
            'weight_kg': float(self.weight_kg) if self.weight_kg else None,
            'height_cm': float(self.height_cm) if self.height_cm else None,
            'measurement_position': self.measurement_position,
            'brachial_perimeter_cm': float(self.brachial_perimeter_cm) if self.brachial_perimeter_cm else None,
            'hemoglobin_g_dl': float(self.hemoglobin_g_dl) if self.hemoglobin_g_dl else None,
            'cephalic_perimeter_cm': float(self.cephalic_perimeter_cm) if self.cephalic_perimeter_cm else None,
            'abdominal_perimeter_cm': float(self.abdominal_perimeter_cm) if self.abdominal_perimeter_cm else None,
            'age_months_calc': self.age_months_calc,
            'height_corrected_cm': float(self.height_corrected_cm) if self.height_corrected_cm else None,
            'z_weight_for_age': float(self.z_weight_for_age) if self.z_weight_for_age is not None else None,
            'weight_for_age_diag': self.weight_for_age_diag,
            'z_height_for_age': float(self.z_height_for_age) if self.z_height_for_age is not None else None,
            'height_for_age_diag': self.height_for_age_diag,
            'z_weight_for_height': float(self.z_weight_for_height) if self.z_weight_for_height is not None else None,
            'weight_for_height_diag': self.weight_for_height_diag,
            'brachial_diag': self.brachial_diag,
            'hemoglobin_diag': self.hemoglobin_diag,
            'semaphore': self.semaphore,
            'nutritional_diagnosis': self.nutritional_diagnosis,
            'requires_nutrition_plan': self.requires_nutrition_plan,
            'recommended_action': self.recommended_action,
            'observations': self.observations,
        }

