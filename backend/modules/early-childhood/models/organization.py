"""
Organization & Multi-Actor Hierarchy Models
AI GovCoreX OS — Capa Global de Actores Institucionales

Jerarquía:
  Nivel 1: Organismos Multilaterales (BID, ONU, CAF, UNICEF)
  Nivel 2: Gobiernos Centrales / Ministerios
  Nivel 3: Empresas Públicas / Gobiernos Locales (GADs)
  Nivel 4: ONGs / Fundaciones Ejecutoras
  Nivel 5: Programas y Proyectos Sociales
  Nivel 6: Usuarios Finales / Beneficiarios
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class OrganizationType(db.Model):
    """
    Tipos de Organización en la jerarquía multinivel
    """
    __tablename__ = 'organization_types'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)  # 'multilateral', 'government', 'public_entity', 'ngo', 'program'
    name = db.Column(db.String(100), nullable=False)              # 'Organismo Multilateral'
    level = db.Column(db.Integer, nullable=False)                 # 1-5, hierarchy level
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))                               # Lucide icon name
    color = db.Column(db.String(7))                               # Hex color
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    organizations = db.relationship('Organization', backref='org_type', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'level': self.level,
            'description': self.description,
            'icon': self.icon,
            'color': self.color,
        }


class Organization(db.Model, BaseModel):
    """
    Organización / Ente Institucional
    Puede ser: ONU, Ministerio, GAD, ONG, Empresa Pública, etc.
    """
    __tablename__ = 'organizations'

    id = db.Column(db.Integer, primary_key=True)
    org_type_id = db.Column(db.Integer, db.ForeignKey('organization_types.id'), nullable=False)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)  # Si ya tiene licencia en el sistema

    # Información básica
    name = db.Column(db.String(255), nullable=False)
    short_name = db.Column(db.String(100))                        # Siglas o nombre corto
    legal_id = db.Column(db.String(50))                           # RUC, NIT, Tax ID
    country = db.Column(db.String(100), default='Ecuador')
    region = db.Column(db.String(100))                            # Región/Provincia de operación
    website = db.Column(db.String(500))
    logo_url = db.Column(db.String(500))
    description = db.Column(db.Text)

    # Jerarquía: referencia al padre en la jerarquía (ej. ONG depende de un Ministerio)
    parent_org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)

    # Contacto oficial
    contact_email = db.Column(db.String(255))
    contact_phone = db.Column(db.String(30))

    # Canales de comunicación
    whatsapp_phone = db.Column(db.String(30))
    whatsapp_session_id = db.Column(db.String(100))               # ID de sesión heredable a programas
    telegram_bot_token = db.Column(db.String(200))
    telegram_bot_username = db.Column(db.String(100))

    # Geolocalización de sede principal
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    address = db.Column(db.Text)

    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    verified = db.Column(db.Boolean, default=False)               # Verificado por el super admin del OS
    metadata_ = db.Column('metadata', JSON)

    # Relationships
    parent = db.relationship('Organization', remote_side=[id], backref='children')
    programs = db.relationship(
        'SocialProgram',
        backref='lead_org',
        lazy='dynamic',
        foreign_keys='SocialProgram.lead_org_id',
    )
    memberships = db.relationship('OrgProgramMembership', backref='organization', lazy='dynamic')
    channel_configs = db.relationship('ChannelConfig', backref='organization', lazy='dynamic')

    def to_dict(self, include_stats: bool = False) -> dict:
        """Convert to dictionary, optionally including aggregate stats."""
        data = {
            'id': self.id,
            'org_type_id': self.org_type_id,
            'org_type': self.org_type.to_dict() if self.org_type else None,
            'license_id': self.license_id,
            'name': self.name,
            'short_name': self.short_name,
            'legal_id': self.legal_id,
            'country': self.country,
            'region': self.region,
            'website': self.website,
            'logo_url': self.logo_url,
            'description': self.description,
            'parent_org_id': self.parent_org_id,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'whatsapp_phone': self.whatsapp_phone,
            'telegram_bot_username': self.telegram_bot_username,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'is_active': self.is_active,
            'verified': self.verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_stats:
            data['programs_count'] = self.programs.count()
            data['members_count'] = self.memberships.count()
        return data
