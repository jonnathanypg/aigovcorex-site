"""
Social AI Module - AI GovCoreX OS
Módulo independiente de Programas Sociales, Fichas Dinámicas y Calificación de Beneficiarios.
"""
from .api.social_programs import social_programs_bp
from .api.documents import documents_bp
from .api.knowledge import knowledge_bp

__all__ = ['social_programs_bp', 'documents_bp', 'knowledge_bp']
