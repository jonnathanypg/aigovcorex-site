"""
Social Program Models
AI GovCoreX OS — Motor Dinámico de Programas Sociales

Permite a ONGs, Gobiernos y Organismos Multilaterales crear y gestionar
programas sociales con campos dinámicos y flujos de postulación omnicanal.
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class SocialProgram(db.Model, BaseModel):
    """
    Programa Social o Proyecto
    Entidad central de gestión de intervenciones sociales.
    """
    __tablename__ = 'social_programs'

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)
    lead_org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Identificación del Programa
    name = db.Column(db.String(300), nullable=False)
    short_code = db.Column(db.String(30), unique=True)             # Código único, ej: 'BDH-2026'
    category = db.Column(db.String(100))                           # 'alimentación', 'salud', 'vivienda', 'educación'
    description = db.Column(db.Text)
    objectives = db.Column(db.Text)

    # Estado del programa
    status = db.Column(db.String(30), default='draft')             # draft, active, paused, closed
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    total_budget = db.Column(db.Numeric(15, 2))
    currency = db.Column(db.String(10), default='USD')

    # Cobertura geográfica
    coverage_country = db.Column(db.String(100), default='Ecuador')
    coverage_regions = db.Column(JSON)                             # Lista de provincias/regiones
    coverage_geojson = db.Column(db.Text)                         # GeoJSON de polígonos de cobertura

    # Capacidad y cupos
    max_beneficiaries = db.Column(db.Integer)                     # Cupos máximos
    current_beneficiaries = db.Column(db.Integer, default=0)

    # Fuente de creación del programa
    tdr_document_path = db.Column(db.String(500))                 # Ruta del TDR/Normativa subida
    ai_extracted_fields = db.Column(JSON)                         # Campos extraídos por IA del documento

    # Canales de comunicación (heredados o propios)
    inherit_org_channels = db.Column(db.Boolean, default=True)   # Si hereda canales de la org matriz
    whatsapp_session_id = db.Column(db.String(100))               # Sesión propia de WhatsApp (si es dedicado)
    telegram_bot_token = db.Column(db.String(200))                # Bot propio de Telegram (si es dedicado)
    custom_channel_number = db.Column(db.String(30))              # Número de canal custom

    # RAG Knowledge Base
    pinecone_namespace = db.Column(db.String(200))                # Namespace de Pinecone para este programa

    # Metadata
    logo_url = db.Column(db.String(500))
    banner_url = db.Column(db.String(500))
    tags = db.Column(JSON)                                        # Tags para búsqueda
    extra_data = db.Column(JSON)

    # Relationships
    form_definition = db.relationship(
        'ProgramFormDefinition',
        backref='program',
        uselist=False,
        cascade='all, delete-orphan',
    )
    beneficiaries = db.relationship(
        'ProgramBeneficiary',
        backref='program',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )
    memberships = db.relationship('OrgProgramMembership', backref='program', lazy='dynamic')
    geo_points = db.relationship(
        'GeoPoint',
        backref='program',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )
    created_by = db.relationship('User', foreign_keys=[created_by_user_id])

    def to_dict(self, include_stats: bool = False) -> dict:
        """Convert to dictionary, optionally including aggregate stats."""
        data = {
            'id': self.id,
            'license_id': self.license_id,
            'lead_org_id': self.lead_org_id,
            'name': self.name,
            'short_code': self.short_code,
            'category': self.category,
            'description': self.description,
            'objectives': self.objectives,
            'status': self.status,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'total_budget': float(self.total_budget) if self.total_budget else None,
            'currency': self.currency,
            'coverage_country': self.coverage_country,
            'coverage_regions': self.coverage_regions,
            'max_beneficiaries': self.max_beneficiaries,
            'current_beneficiaries': self.current_beneficiaries,
            'inherit_org_channels': self.inherit_org_channels,
            'logo_url': self.logo_url,
            'tags': self.tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_stats:
            data['orgs_count'] = self.memberships.count()
            data['beneficiaries_count'] = self.beneficiaries.count()
        return data


class ProgramFormDefinition(db.Model, BaseModel):
    """
    Definición Dinámica del Formulario de Postulación para un Programa
    Permite definir campos personalizados: texto, número, cédula, archivo, geolocalización, etc.
    """
    __tablename__ = 'program_form_definitions'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=False, unique=True)
    form_title = db.Column(db.String(300))                        # Título del formulario
    form_description = db.Column(db.Text)                         # Descripción / Instrucciones
    fields = db.Column(JSON, nullable=False)                      # Lista de FieldDefinition JSON objects
    sections = db.Column(JSON)                                    # Secciones del wizard (id/title/field_ids)
    eligibility_rules = db.Column(JSON)                           # Reglas de elegibilidad automáticas
    conversational_instructions = db.Column(db.Text)              # Instrucciones para el bot conversacional
    success_message = db.Column(db.Text)                          # Mensaje de éxito al completar
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.Integer, default=1)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        try:
            _sections = self.sections
        except Exception:
            _sections = None
        return {
            'id': self.id,
            'program_id': self.program_id,
            'form_title': self.form_title,
            'form_description': self.form_description,
            'fields': self.fields,
            'sections': _sections,
            'eligibility_rules': self.eligibility_rules,
            'conversational_instructions': self.conversational_instructions,
            'success_message': self.success_message,
            'is_active': self.is_active,
            'version': self.version,
        }


class ProgramBeneficiary(db.Model, BaseModel):
    """
    Beneficiario de un Programa Social
    Vincula un beneficiario (puede existir en múltiples programas) con un programa específico.
    """
    __tablename__ = 'program_beneficiaries'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)      # Si tiene cuenta
    child_id = db.Column(db.Integer, db.ForeignKey('children.id'), nullable=True)  # Si es un niño

    # Datos del beneficiario (cuando no tiene cuenta)
    full_name = db.Column(db.String(255))
    cedula = db.Column(db.String(20))
    birth_date = db.Column(db.Date)
    phone = db.Column(db.String(30))
    whatsapp_phone = db.Column(db.String(30))
    email = db.Column(db.String(255))
    address = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    # Canal de ingreso al programa
    intake_channel = db.Column(db.String(50))                     # 'whatsapp', 'telegram', 'web_form', 'manual'
    intake_conversation_id = db.Column(db.String(200))            # ID de conversación de postulación

    # Datos dinámicos del formulario
    form_data = db.Column(JSON)                                   # Respuestas al formulario dinámico

    # Estado
    status = db.Column(db.String(30), default='applicant')        # applicant, approved, active, rejected, graduated
    eligibility_score = db.Column(db.Float)                       # Score de elegibilidad 0-100
    eligibility_notes = db.Column(db.Text)
    approved_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime)

    # Atributos socioeconómicos clave
    socioeconomic_level = db.Column(db.String(20))                # 'critical_poverty', 'poverty', 'vulnerable', 'stable'
    household_members = db.Column(db.Integer)
    monthly_income = db.Column(db.Numeric(10, 2))
    has_disabilities = db.Column(db.Boolean, default=False)
    disability_type = db.Column(db.String(100))

    __table_args__ = (
        db.Index('idx_beneficiary_program', 'program_id'),
        db.Index('idx_beneficiary_cedula', 'cedula'),
        db.Index('idx_beneficiary_status', 'status'),
    )

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'user_id': self.user_id,
            'child_id': self.child_id,
            'full_name': self.full_name,
            'cedula': self.cedula,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'phone': self.phone,
            'whatsapp_phone': self.whatsapp_phone,
            'email': self.email,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'intake_channel': self.intake_channel,
            'form_data': self.form_data,
            'status': self.status,
            'eligibility_score': self.eligibility_score,
            'eligibility_notes': self.eligibility_notes,
            'socioeconomic_level': self.socioeconomic_level,
            'household_members': self.household_members,
            'monthly_income': float(self.monthly_income) if self.monthly_income else None,
            'has_disabilities': self.has_disabilities,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
