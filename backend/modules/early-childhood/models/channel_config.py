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

    # IA y handover (estilo aikrofy)
    is_ai_active = db.Column(db.Boolean, default=True)            # IA activa (bot_active) o pausada
    handover_status = db.Column(db.String(30), default='bot_active')  # 'bot_active', 'human_taken', 'human_listening', 'resolved'
    assigned_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # operador humano asignado
    tags = db.Column(JSON)                                        # tags CRM
    sentiment_score = db.Column(db.Float)                         # score de sentimiento -1..1
    lead_score = db.Column(db.Integer)                            # score de lead
    resolved_at = db.Column(db.DateTime)

    last_message_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    messages_count = db.Column(db.Integer, default=0)

    # Relaciones
    messages = db.relationship('ChannelMessage', backref='conversation', lazy='dynamic', cascade='all, delete-orphan')
    assigned_user = db.relationship('User', foreign_keys=[assigned_user_id])

    __table_args__ = (
        db.Index('idx_conv_channel', 'channel_id'),
        db.Index('idx_conv_program', 'program_id'),
        db.Index('idx_conv_external', 'external_id'),
        db.Index('idx_conv_status', 'status'),
        db.Index('idx_conv_handover', 'handover_status'),
    )

    def to_dict(self, include_messages=False) -> dict:
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'channel_id': self.channel_id,
            'program_id': self.program_id,
            'beneficiary_id': self.beneficiary_id,
            'external_id': self.external_id,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'conversation_type': self.conversation_type,
            'status': self.status,
            'current_step': self.current_step,
            'form_data_collected': self.form_data_collected,
            'is_ai_active': self.is_ai_active,
            'handover_status': self.handover_status,
            'assigned_user_id': self.assigned_user_id,
            'tags': self.tags,
            'sentiment_score': self.sentiment_score,
            'lead_score': self.lead_score,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'messages_count': self.messages_count,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in self.messages.order_by(ChannelMessage.created_at.asc()).limit(100).all()]
        return data


class ChannelMessage(db.Model, BaseModel):
    """
    Mensaje individual dentro de una conversación de canal.
    Réplica del esquema aikrofy: role=user|assistant|system, contenido, canal, adjuntos.
    """
    __tablename__ = 'channel_messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('channel_conversations.id', ondelete='CASCADE'), nullable=False)

    role = db.Column(db.String(20), nullable=False)              # 'user', 'assistant', 'system'
    content = db.Column(db.Text, nullable=False)
    channel = db.Column(db.String(30))                           # 'whatsapp', 'telegram'
    media_url = db.Column(db.String(512))
    media_type = db.Column(db.String(50))                        # 'image', 'document', 'audio', 'video'
    tool_calls = db.Column(JSON)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('idx_msg_conv', 'conversation_id'),
        db.Index('idx_msg_created', 'created_at'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'channel': self.channel,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'tool_calls': self.tool_calls,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
