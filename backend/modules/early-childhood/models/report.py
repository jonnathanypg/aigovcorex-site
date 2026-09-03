"""
Report models
"""
from models import db, BaseModel
from datetime import datetime
import uuid


class GeneratedReport(db.Model, BaseModel):
    """Generated Report model"""
    
    __tablename__ = 'generated_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    
    title = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(50), nullable=False) # Asistencia, Desarrollo, Salud, General
    generated_date = db.Column(db.DateTime, default=datetime.utcnow)
    file_path = db.Column(db.String(500)) # Path to PDF/Excel
    
    # Date range for the report
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    format = db.Column(db.String(20), default='pdf')  # pdf, csv, excel
    
    # Public download token — allows download without JWT (safe for chat sharing)
    download_token = db.Column(db.String(64), unique=True, nullable=True)
    
    generated_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'))
    
    # Relationships
    generated_by = db.relationship('User', foreign_keys=[generated_by_id])
    
    __table_args__ = (
        db.Index('idx_report_tenant', 'tenant_id'),
    )
    
    def generate_token(self):
        """Generate a unique download token for this report"""
        self.download_token = uuid.uuid4().hex
        return self.download_token
    
    def __repr__(self):
        return f'<GeneratedReport {self.title}>'
    
    def to_dict(self):
        import os
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
        public_url = f"{backend_url}/api/reports/public/{self.download_token}" if self.download_token else None
        return {
            'id': self.id,
            'title': self.title,
            'type': self.type,
            'date': self.generated_date.date().isoformat(),
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'format': self.format or 'pdf',
            'generated_by': self.generated_by.full_name if self.generated_by else None,
            'download_url': f"/api/reports/download/{self.id}",
            'public_download_url': public_url,
        }
