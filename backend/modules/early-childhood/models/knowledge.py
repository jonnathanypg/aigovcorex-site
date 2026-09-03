"""
Knowledge Document Model
Tracks documents indexed in the RAG vector store (Pinecone).
Supports hierarchical scoping: License (global) and Tenant (center-specific).
"""
from models import db, BaseModel
from datetime import datetime


class KnowledgeDocument(db.Model, BaseModel):
    """
    Represents a document indexed in the vector knowledge base.
    
    Scope Logic:
    - license_id REQUIRED: All documents belong to a License.
    - tenant_id OPTIONAL: 
        - NULL = Global doc (visible to ALL centers under the license).
        - SET  = Center-specific doc (visible only to that center + admins).
    """
    __tablename__ = 'knowledge_documents'

    id = db.Column(db.Integer, primary_key=True)
    
    # Hierarchical Scope
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id', ondelete='CASCADE'), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    
    # Content  
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)  # Original text backup
    
    # Source metadata
    source_type = db.Column(db.String(20), default='text')  # text, pdf, web
    source_url = db.Column(db.String(500), nullable=True)   # Optional origin URL
    
    # Vector Store Reference
    pinecone_ids = db.Column(db.Text, nullable=True)  # JSON array of vector IDs for cleanup
    chunk_count = db.Column(db.Integer, default=0)
    
    # Status
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    indexed_at = db.Column(db.DateTime, nullable=True)  # When vectors were last upserted
    
    # Audit
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relationships
    license = db.relationship('License', backref=db.backref('knowledge_docs', lazy='dynamic'))
    tenant = db.relationship('Tenant', backref=db.backref('knowledge_docs', lazy='dynamic'))
    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    __table_args__ = (
        db.Index('idx_kd_license', 'license_id'),
        db.Index('idx_kd_tenant', 'tenant_id'),
        db.Index('idx_kd_active', 'is_active'),
    )

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'license_id': self.license_id,
            'tenant_id': self.tenant_id,
            'title': self.title,
            'source_type': self.source_type,
            'source_url': self.source_url,
            'chunk_count': self.chunk_count,
            'is_active': self.is_active,
            'scope': 'center' if self.tenant_id else 'global',
            'indexed_at': self.indexed_at.isoformat() if self.indexed_at else None,
            'uploaded_by': self.uploader.full_name if self.uploader else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        scope = f'tenant_{self.tenant_id}' if self.tenant_id else 'global'
        return f'<KnowledgeDocument "{self.title}" ({scope})>'
