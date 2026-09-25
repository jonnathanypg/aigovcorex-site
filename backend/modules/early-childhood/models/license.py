"""
License Model - Sistema de Licencias Multi-Nivel
AI GovCoreX OS — Gestiona licencias con control de módulos por organización
"""
import json
from models import db
from datetime import datetime

ALL_MODULES = ['kindicore', 'social', 'geo', 'channels', 'copilot']


class License(db.Model):
    """
    Licencia de Organización / Proyecto
    Ejemplo: "Proyecto MIES Guayas" con 50 centros permitidos y módulos seleccionados
    """
    __tablename__ = 'licenses'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)        # "Proyecto MIES Guayas"
    description = db.Column(db.Text)

    # ── Límites operativos ──────────────────────────────────────────
    max_centers = db.Column(db.Integer, nullable=False, default=1)
    active_centers = db.Column(db.Integer, default=0)
    max_users = db.Column(db.Integer, nullable=True, default=50)       # Máx. usuarios totales
    storage_quota_mb = db.Column(db.Integer, nullable=True, default=1024)  # MB de almacenamiento

    # ── Vigencia ────────────────────────────────────────────────────
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)

    # ── Estado ──────────────────────────────────────────────────────
    status = db.Column(db.String(20), default='active')  # active, suspended, expired

    # ── Datos de la Organización ────────────────────────────────────
    legal_name = db.Column(db.String(255), nullable=True)   # Razón Social
    ruc = db.Column(db.String(13), nullable=True)           # RUC / NIT
    annual_cost = db.Column(db.Numeric(10, 2), comment='Costo anual de la licencia')

    # ── Metadata ────────────────────────────────────────────────────
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # ── Relaciones ──────────────────────────────────────────────────
    centers = db.relationship('Tenant', backref='license', lazy='dynamic')
    admins = db.relationship('LicenseAdmin', backref='license', lazy='dynamic')
    sponsor_logos = db.relationship('SponsorLogo', backref='license', lazy='dynamic',
                                    cascade="all, delete-orphan")

    # ── Personalización del Agente IA ────────────────────────────────
    agent_name = db.Column(db.String(200), nullable=True)
    agent_personality = db.Column(db.Text, nullable=True)
    agent_icon_path = db.Column(db.String(500), nullable=True)
    agent_voice = db.Column(db.String(100), nullable=True, default='es-EC-LuisNeural')

    # ── Canales de Mensajería — WhatsApp ─────────────────────────────
    whatsapp_connected = db.Column(db.Boolean, default=False)
    whatsapp_phone = db.Column(db.String(20), nullable=True)
    whatsapp_session_id = db.Column(db.String(100), nullable=True)
    whatsapp_admin_phone = db.Column(db.String(20), nullable=True)

    # ── Canales de Mensajería — Telegram ─────────────────────────────
    telegram_connected = db.Column(db.Boolean, default=False)
    telegram_bot_token = db.Column(db.String(100), nullable=True)
    telegram_bot_username = db.Column(db.String(100), nullable=True)

    # ── Configuración Regional ───────────────────────────────────────
    timezone = db.Column(db.String(50), default='America/Guayaquil')

    # ── SMTP Email ───────────────────────────────────────────────────
    smtp_host = db.Column(db.String(255), nullable=True)
    smtp_port = db.Column(db.Integer, nullable=True, default=587)
    smtp_user = db.Column(db.String(255), nullable=True)
    smtp_password = db.Column(db.String(500), nullable=True)

    # ═══════════════════════════════════════════════════════════════════
    # MÓDULOS HABILITADOS — AI GovCoreX OS Module System
    # ═══════════════════════════════════════════════════════════════════
    # JSON list: ['kindicore', 'social', 'geo', 'channels', 'copilot']
    # El Super Admin controla qué módulos ve y usa cada licencia/organización
    enabled_modules = db.Column(
        db.Text, nullable=True,
        default='["kindicore","social","geo","channels","copilot"]'
    )

    # ── Canales Públicos (Chatbot, Web Widget) ───────────────────────
    allow_public_chatbot = db.Column(db.Boolean, default=True)
    allow_whatsapp_public = db.Column(db.Boolean, default=True)
    allow_telegram_public = db.Column(db.Boolean, default=True)

    # Slug único para el chatbot público web de esta organización
    # Acceso: /api/public/org/{public_org_slug}
    public_org_slug = db.Column(db.String(100), nullable=True)

    # ── Métodos de módulos ───────────────────────────────────────────

    def get_enabled_modules(self) -> list:
        """Obtener lista de IDs de módulos habilitados para esta licencia"""
        try:
            if self.enabled_modules:
                modules = json.loads(self.enabled_modules)
                # Validate — only keep known module IDs
                return [m for m in modules if m in ALL_MODULES]
            return ALL_MODULES[:]
        except (json.JSONDecodeError, TypeError):
            return ALL_MODULES[:]

    def set_enabled_modules(self, modules: list):
        """Establecer lista de módulos habilitados"""
        valid = [m for m in modules if m in ALL_MODULES]
        self.enabled_modules = json.dumps(valid)

    def has_module(self, module_id: str) -> bool:
        """Verificar si un módulo específico está habilitado"""
        return module_id in self.get_enabled_modules()

    # ── Serialización ────────────────────────────────────────────────

    def to_dict(self):
        """Convertir a diccionario para API responses"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'max_centers': self.max_centers,
            'active_centers': self.active_centers,
            'available_centers': max(0, self.max_centers - self.active_centers),
            'max_users': self.max_users,
            'storage_quota_mb': self.storage_quota_mb,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status,
            'annual_cost': float(self.annual_cost) if self.annual_cost else None,
            'legal_name': self.legal_name,
            'ruc': self.ruc,
            'is_active': self.is_active(),
            'is_expired': self.is_expired(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            # IA Agent config
            'agent_name': self.agent_name,
            'agent_personality': self.agent_personality,
            'agent_icon_path': self.agent_icon_path,
            'agent_voice': self.agent_voice,
            # WhatsApp
            'whatsapp_connected': self.whatsapp_connected,
            'whatsapp_phone': self.whatsapp_phone,
            'whatsapp_admin_phone': self.whatsapp_admin_phone,
            # Telegram
            'telegram_connected': self.telegram_connected,
            'telegram_bot_username': self.telegram_bot_username,
            # Config
            'timezone': self.timezone,
            'smtp_host': self.smtp_host,
            'smtp_port': self.smtp_port,
            'smtp_user': self.smtp_user,
            'smtp_configured': bool(self.smtp_host and self.smtp_user and self.smtp_password),
            # ── MODULE SYSTEM ──
            'enabled_modules': self.get_enabled_modules(),
            'allow_public_chatbot': self.allow_public_chatbot,
            'allow_whatsapp_public': self.allow_whatsapp_public,
            'allow_telegram_public': self.allow_telegram_public,
            'public_org_slug': self.public_org_slug,
        }

    # ── Métodos de estado ─────────────────────────────────────────────

    def is_active(self) -> bool:
        """Verificar si la licencia está activa y vigente"""
        if self.status != 'active':
            return False
        today = datetime.utcnow().date()
        return self.start_date <= today <= self.end_date

    def is_expired(self) -> bool:
        """Verificar si la licencia está expirada"""
        today = datetime.utcnow().date()
        return today > self.end_date

    def can_add_center(self) -> bool:
        """Verificar si se puede agregar un centro más"""
        return self.is_active() and self.active_centers < self.max_centers

    def increment_centers(self) -> bool:
        """Incrementar contador de centros activos"""
        if self.can_add_center():
            self.active_centers += 1
            return True
        return False

    def decrement_centers(self) -> bool:
        """Decrementar contador de centros activos"""
        if self.active_centers > 0:
            self.active_centers -= 1
            return True
        return False


class LicenseAdmin(db.Model):
    """
    Administrador de Licencia
    Usuario que gestiona múltiples centros dentro de una licencia/organización
    """
    __tablename__ = 'license_admins'

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Permisos específicos
    can_create_centers = db.Column(db.Boolean, default=True)
    can_delete_centers = db.Column(db.Boolean, default=False)
    can_manage_users = db.Column(db.Boolean, default=True)

    # Metadata
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    is_active = db.Column(db.Boolean, default=True)

    # Relaciones
    user = db.relationship('User', foreign_keys=[user_id], backref='license_admin_profile')
    assigner = db.relationship('User', foreign_keys=[assigned_by])

    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'license_id': self.license_id,
            'license_name': self.license.name if self.license else None,
            'user_id': self.user_id,
            'user_email': self.user.email if self.user else None,
            'user_name': self.user.full_name if self.user else None,
            'can_create_centers': self.can_create_centers,
            'can_delete_centers': self.can_delete_centers,
            'can_manage_users': self.can_manage_users,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'is_active': self.is_active
        }


class SponsorLogo(db.Model):
    """
    Logos de Patrocinadores por Licencia
    """
    __tablename__ = 'sponsor_logos'

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=False)
    logo_path = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'license_id': self.license_id,
            'logo_path': self.logo_path,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }
