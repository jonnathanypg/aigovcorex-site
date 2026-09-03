"""
Tenant model - Represents CDI centers
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON


class Tenant(db.Model, BaseModel):
    """Tenant model for multi-tenancy (CDI centers)"""
    
    __tablename__ = 'tenants'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Relación con Licencia
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)
    
    # Información básica
    name = db.Column(db.String(255), nullable=False)
    legal_name = db.Column(db.String(255), nullable=True)  # Heredado de License
    ruc = db.Column(db.String(13))  # Heredado de License (sin UNIQUE)
    
    # Ubicación
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    province = db.Column(db.String(100))
    latitude = db.Column(db.Float)  # Georreferenciación
    longitude = db.Column(db.Float)  # Georreferenciación
    
    # Contacto
    phone = db.Column(db.String(20))
    email = db.Column(db.String(255))
    
    # Capacidad
    max_capacity = db.Column(db.Integer, default=50)  # Cupos totales
    current_enrollment = db.Column(db.Integer, default=0)  # Niños inscritos
    max_children_per_educator = db.Column(db.Integer, default=10)  # Límite de niños por educadora
    
    # Configuración
    logo_url = db.Column(db.String(500))
    settings = db.Column(JSON)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Relationships
    users = db.relationship('User', backref='tenant', lazy='dynamic', cascade='all, delete-orphan')
    children = db.relationship('Child', backref='tenant', lazy='dynamic', cascade='all, delete-orphan')
    families = db.relationship('Family', backref='tenant', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Tenant {self.name}>'
    
    def to_dict(self):
        """Convert to dictionary"""
        data = super().to_dict()
        data['users_count'] = self.users.count()
        data['children_count'] = self.children.filter_by(status='activo').count()
        return data
    
    def available_capacity(self):
        """Calcular cupos disponibles"""
        return max(0, self.max_capacity - self.current_enrollment)
    
    def occupancy_rate(self):
        """Calcular tasa de ocupación (%)"""
        if self.max_capacity == 0:
            return 0
        return round((self.current_enrollment / self.max_capacity) * 100, 2)
    
    def can_enroll(self):
        """Verificar si hay cupos disponibles"""
        return self.current_enrollment < self.max_capacity
    
    def increment_enrollment(self):
        """Incrementar contador de inscritos"""
        if self.can_enroll():
            self.current_enrollment += 1
            return True
        return False
    
    def decrement_enrollment(self):
        """Decrementar contador de inscritos"""
        if self.current_enrollment > 0:
            self.current_enrollment -= 1
            return True
        return False
