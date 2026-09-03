"""
Document Model
Sistema de gestión de expedientes digitales
"""
from models import db, BaseModel
from datetime import datetime


class Document(db.Model, BaseModel):
    """Documento del expediente digital"""
    
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id', ondelete='CASCADE'))
    application_id = db.Column(db.Integer, db.ForeignKey('applications.id', ondelete='CASCADE'))
    
    # Tipo de documento
    document_type = db.Column(db.Enum(
        'cedula_nino',
        'cedula_representante',
        'certificado_nacimiento',
        'foto_nino',
        'comprobante_domicilio',
        'ficha_medica',
        'carnet_vacunas',
        'informe_psicologico',
        'informe_social',
        'acta_compromiso',
        'otro',
        name='document_type_enum'
    ), nullable=False)
    
    # Información del archivo
    file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer)  # bytes
    file_url = db.Column(db.String(500))  # Google Drive URL
    file_path = db.Column(db.String(500))  # Local path (backup)
    mime_type = db.Column(db.String(100))
    
    # Metadata
    description = db.Column(db.Text)
    version = db.Column(db.Integer, default=1)
    is_current_version = db.Column(db.Boolean, default=True)
    parent_document_id = db.Column(db.Integer, db.ForeignKey('documents.id'))  # Para versionamiento
    
    # Estado y validación
    status = db.Column(db.Enum(
        'pending',
        'approved',
        'rejected',
        'expired',
        name='document_status_enum'
    ), default='pending')
    
    expiration_date = db.Column(db.Date)
    
    # Auditoría
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    
    # Relationships
    uploader = db.relationship('User', foreign_keys=[uploaded_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    versions = db.relationship('Document', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    
    __table_args__ = (
        db.Index('idx_doc_child', 'child_id'),
        db.Index('idx_doc_application', 'application_id'),
        db.Index('idx_doc_type', 'document_type'),
        db.Index('idx_doc_status', 'status'),
    )
    
    def approve(self, user_id):
        """Aprobar documento"""
        self.status = 'approved'
        self.approved_by = user_id
        self.approved_at = datetime.utcnow()
        db.session.commit()
    
    def reject(self, user_id, reason):
        """Rechazar documento"""
        self.status = 'rejected'
        self.approved_by = user_id
        self.approved_at = datetime.utcnow()
        self.rejection_reason = reason
        db.session.commit()
    
    def create_new_version(self, file_name, file_url, uploaded_by):
        """Crear nueva versión del documento"""
        # Marcar versión actual como no vigente
        self.is_current_version = False
        
        # Crear nueva versión
        new_version = Document(
            tenant_id=self.tenant_id,
            child_id=self.child_id,
            application_id=self.application_id,
            document_type=self.document_type,
            file_name=file_name,
            file_url=file_url,
            version=self.version + 1,
            is_current_version=True,
            parent_document_id=self.id,
            uploaded_by=uploaded_by,
            status='pending'
        )
        
        db.session.add(new_version)
        db.session.commit()
        
        return new_version
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'child_id': self.child_id,
            'application_id': self.application_id,
            'document_type': self.document_type,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'file_url': self.file_url,
            'mime_type': self.mime_type,
            'description': self.description,
            'version': self.version,
            'is_current_version': self.is_current_version,
            'status': self.status,
            'expiration_date': self.expiration_date.isoformat() if self.expiration_date else None,
            'uploaded_by': self.uploader.full_name if self.uploader else None,
            'uploaded_at': self.created_at.isoformat() if self.created_at else None,
            'approved_by': self.approver.full_name if self.approver else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejection_reason': self.rejection_reason
        }
    
    def __repr__(self):
        return f'<Document {self.file_name} v{self.version}>'
