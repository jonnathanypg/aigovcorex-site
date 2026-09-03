from models import db
from datetime import datetime

class ProcessedWhatsAppEvent(db.Model):
    """
    Tracks processed WhatsApp message IDs to prevent duplicate processing
    caused by webhook retries.
    """
    __tablename__ = 'whatsapp_processed_events'

    message_id = db.Column(db.String(255), primary_key=True)
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ProcessedWhatsAppEvent {self.message_id}>'
