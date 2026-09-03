"""
Channel Configuration Models
AI GovCoreX OS — Gestión Flexible y Heredable de Canales de Comunicación

Soporta WhatsApp (Baileys) y Telegram a nivel de organización,
con herencia a programas y control granular de privacidad.
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class ChannelConfig(db.Model, BaseModel):
    """
    Configuración de un Canal de Comunicación
    Puede ser propietario de una organización o de un programa específico.
    """
    __tablename__ = 'channel_configs'

    id = db.Column(db.Integer, primary_key=True)
    # Propietario del canal (org o programa)
    org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)

    channel_type = db.Column(db.String(30), nullable=False)       # 'whatsapp', 'telegram'
    channel_name = db.Column(db.String(200))                      # Nombre identificador
    phone_number = db.Column(db.String(30))                       # Para WhatsApp
    session_id = db.Column(db.String(100))                        # Sesión Baileys
    bot_token = db.Column(db.String(300))                         # Para Telegram
    bot_username = db.Column(db.String(100))                      # Para Telegram

    # Tipo de propiedad del canal
    ownership_type = db.Column(db.String(30), default='dedicated')  # 'dedicated', 'inherited', 'shared'
    parent_channel_id = db.Column(
        db.Integer,
        db.ForeignKey('channel_configs.id'),
        nullable=True,
    )  # Canal padre del que hereda

    # Estado de la conexión
    status = db.Column(db.String(30), default='disconnected')     # 'connected', 'disconnected', 'pending_qr', 'error'
    connected_at = db.Column(db.DateTime)
    last_message_at = db.Column(db.DateTime)
    message_count = db.Column(db.Integer, default=0)

    # Configuración de privacidad y acceso
    access_level = db.Column(db.String(30), default='program')    # 'public', 'program', 'org', 'private'
    allowed_programs = db.Column(JSON)                            # IDs de programas que pueden usar este canal
    data_isolation_level = db.Column(db.String(30), default='strict')  # 'strict', 'partial', 'open'

    # Configuración del agente IA para este canal
    agent_name = db.Column(db.String(200))
    agent_personality = db.Column(db.Text)
    agent_voice = db.Column(db.String(100), default='es-EC-LuisNeural')
    welcome_message = db.Column(db.Text)

    is_active = db.Column(db.Boolean, default=True)
    config_data = db.Column(JSON)                                 # Configuración extra

    # Relationships
    parent = db.relationship('ChannelConfig', remote_side=[id], backref='children')
    conversations = db.relationship('ChannelConversation', backref='channel', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'org_id': self.org_id,
            'program_id': self.program_id,
            'channel_type': self.channel_type,
            'channel_name': self.channel_name,
            'phone_number': self.phone_number,
            'bot_username': self.bot_username,
            'ownership_type': self.ownership_type,
            'parent_channel_id': self.parent_channel_id,
            'status': self.status,
            'connected_at': self.connected_at.isoformat() if self.connected_at else None,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'message_count': self.message_count,
            'access_level': self.access_level,
            'data_isolation_level': self.data_isolation_level,
            'agent_name': self.agent_name,
            'is_active': self.is_active,
        }


class ChannelConversation(db.Model, BaseModel):
    """
    Conversación en un Canal Específico
    Tracking de conversaciones de postulación, atención y seguimiento.
    """
    __tablename__ = 'channel_conversations'

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey('channel_configs.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    beneficiary_id = db.Column(db.Integer, db.ForeignKey('program_beneficiaries.id'), nullable=True)

    # Datos del contacto externo
    external_id = db.Column(db.String(200))                       # JID de WhatsApp o chat_id de Telegram
    contact_name = db.Column(db.String(255))
    contact_phone = db.Column(db.String(30))

    # Estado de la conversación
    conversation_type = db.Column(db.String(50))                  # 'onboarding', 'support', 'follow_up', 'alert'
    status = db.Column(db.String(30), default='open')             # 'open', 'in_progress', 'completed', 'abandoned'
    current_step = db.Column(db.String(100))                      # Paso actual en el flujo conversacional
    form_data_collected = db.Column(JSON)                         # Datos recopilados hasta ahora

    last_message_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    messages_count = db.Column(db.Integer, default=0)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'channel_id': self.channel_id,
            'program_id': self.program_id,
            'beneficiary_id': self.beneficiary_id,
            'external_id': self.external_id,
            'contact_name': self.contact_name,
            'conversation_type': self.conversation_type,
            'status': self.status,
            'current_step': self.current_step,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'messages_count': self.messages_count,
        }
