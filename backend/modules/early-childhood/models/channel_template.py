"""
Message Template Models
AI GovCoreX OS — Plantillas de mensajería multicanal para respuestas automáticas,
notificaciones y flujos conversacionales.
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class ChannelTemplate(db.Model, BaseModel):
    """
    Plantilla de mensaje reutilizable para canales de comunicación.
    Soporta variables tipo {{variable}} y filtrado por canal/tipo.
    """
    __tablename__ = 'channel_templates'

    id = db.Column(db.Integer, primary_key=True)
    
    # Propietario (licencia u organización)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)
    org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    
    # Identificación
    name = db.Column(db.String(200), nullable=False)           # Nombre interno
    description = db.Column(db.Text)                           # Descripción/uso
    trigger = db.Column(db.String(200))                        # Disparador: 'first_message', 'eligibility_approved', 'appointment_reminder', etc.
    
    # Canal objetivo
    channel = db.Column(db.String(30), default='all')          # 'all', 'whatsapp', 'telegram', 'email', 'webchat'
    
    # Contenido
    content = db.Column(db.Text, nullable=False)               # Texto con variables {{variable}}
    variables = db.Column(JSON)                                # Lista de variables esperadas: ['nombre', 'programa', 'fecha']
    
    # Configuración
    is_active = db.Column(db.Boolean, default=True)
    is_system = db.Column(db.Boolean, default=False)           # Plantillas del sistema (no eliminables)
    
    # Metadatos
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    usage_count = db.Column(db.Integer, default=0)
    last_used_at = db.Column(db.DateTime)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'license_id': self.license_id,
            'org_id': self.org_id,
            'name': self.name,
            'description': self.description,
            'trigger': self.trigger,
            'channel': self.channel,
            'content': self.content,
            'variables': self.variables or [],
            'is_active': self.is_active,
            'is_system': self.is_system,
            'created_by': self.created_by,
            'usage_count': self.usage_count,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def render(self, context: dict) -> str:
        """Renderiza la plantilla reemplazando variables {{var}} con valores del context."""
        text = self.content
        for key, value in context.items():
            placeholder = f'{{{{{key}}}}}'
            text = text.replace(placeholder, str(value) if value is not None else '')
        return text


# Plantillas del sistema por defecto
DEFAULT_TEMPLATES = [
    {
        'name': 'Bienvenida a Postulante Social',
        'description': 'Primer mensaje cuando un ciudadano contacta por WhatsApp/Telegram',
        'trigger': 'first_message',
        'channel': 'all',
        'content': '¡Hola {{nombre}}! 👋 Bienvenido al portal de atención ciudadana de {{institucion}}. Soy el asistente agéntico inteligente. Para postular al programa {{programa}}, por favor indícame tu número de cédula.',
        'variables': ['nombre', 'institucion', 'programa'],
        'is_system': True,
    },
    {
        'name': 'Confirmación de Postulación Aprobada',
        'description': 'Notificación cuando elegibilidad score >= 70',
        'trigger': 'eligibility_approved',
        'channel': 'whatsapp',
        'content': 'Estimado/a {{nombre}}, su solicitud al {{programa}} ha sido pre-aprobada con éxito (ID: {{solicitud_id}}). Un coordinador social se contactará al {{telefono}}.',
        'variables': ['nombre', 'programa', 'solicitud_id', 'telefono'],
        'is_system': True,
    },
    {
        'name': 'Alerta de Control de Citas y Salud CDI',
        'description': 'Recordatorio programado para controles de niño sano',
        'trigger': 'appointment_reminder',
        'channel': 'all',
        'content': 'Recordatorio de {{institucion}}: Mañana {{fecha}} corresponde el control de peso y talla para el niño/a {{nombre_infante}} en el centro {{centro_nombre}}.',
        'variables': ['institucion', 'fecha', 'nombre_infante', 'centro_nombre'],
        'is_system': True,
    },
    {
        'name': 'Notificación de Documento Listo',
        'description': 'Aviso cuando un certificado/reporte está disponible',
        'trigger': 'document_ready',
        'channel': 'all',
        'content': '{{nombre}}, su {{tipo_documento}} está listo para descargar. Acceda al portal o responda "ENVIAR" para recibirlo por este medio.',
        'variables': ['nombre', 'tipo_documento'],
        'is_system': True,
    },
    {
        'name': 'Alerta Crítica de Salud/Nutrición',
        'description': 'Notificación prioritaria para casos de riesgo detectados por IA',
        'trigger': 'critical_alert',
        'channel': 'all',
        'content': '🚨 ALERTA PRIORITARIA: Se ha detectado {{tipo_alerta}} para {{beneficiario}} en {{centro}}. Requiere atención inmediata. Detalles: {{detalles}}',
        'variables': ['tipo_alerta', 'beneficiario', 'centro', 'detalles'],
        'is_system': True,
    },
]