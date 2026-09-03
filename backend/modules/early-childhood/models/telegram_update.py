from models import db
from datetime import datetime

class ProcessedTelegramUpdate(db.Model):
    """
    Tracks processed Telegram update IDs to prevent duplicate processing
    caused by webhook retries (timeouts).
    """
    __tablename__ = 'telegram_processed_updates'

    update_id = db.Column(db.BigInteger, primary_key=True)
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ProcessedTelegramUpdate {self.update_id}>'
