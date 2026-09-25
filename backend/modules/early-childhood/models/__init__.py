"""
Database initialization and base model
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class BaseModel:
    """Base model with common fields and methods"""
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def save(self):
        """Save instance to database"""
        db.session.add(self)
        db.session.commit()
        return self
    
    def delete(self):
        """Delete instance from database"""
        db.session.delete(self)
        db.session.commit()
    
    def to_dict(self):
        """Convert model to dictionary"""
        result = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                result[c.name] = value.isoformat()
            else:
                result[c.name] = value
        return result


# Import all models here to avoid circular imports
def init_models():
    """Initialize all models - call this after db.init_app()"""
    from models.license import License, LicenseAdmin
    from models.tenant import Tenant
    from models.user import User, Role
    from models.child import Child, Family, Representative
    from models.attendance import Attendance
    from models.nutrition import NutritionDaily
    from models.health import HealthRecord
    from models.milestone import Milestone
    from models.application import Application, VulnerabilityForm, WaitingList
    from models.document import Document
    from models.knowledge import KnowledgeDocument
    from models.telegram_update import ProcessedTelegramUpdate
    from models.whatsapp_event import ProcessedWhatsAppEvent
    from models.planning import LudicPlanning
    from models.organization import OrganizationType, Organization
    from models.social_program import SocialProgram, ProgramFormDefinition, ProgramBeneficiary
    from models.geo_intelligence import GeoLayer, GeoPoint, GeoFence, OrgNetworkEdge
    from models.channel_config import ChannelConfig, ChannelConversation
    from models.inter_org import OrgProgramMembership, ProgramTeamMember
    from models.intervention import FamilyIntervention
    from models.notification import Notification
    from models.report import GeneratedReport
    from models.operation import MaintenanceTask
    
    return {
        'License': License,
        'LicenseAdmin': LicenseAdmin,
        'Tenant': Tenant,
        'User': User,
        'Role': Role,
        'Child': Child,
        'Family': Family,
        'Representative': Representative,
        'Attendance': Attendance,
        'NutritionDaily': NutritionDaily,
        'HealthRecord': HealthRecord,
        'Milestone': Milestone,
        'Application': Application,
        'VulnerabilityForm': VulnerabilityForm,
        'WaitingList': WaitingList,
        'Document': Document,
        'KnowledgeDocument': KnowledgeDocument,
        'ProcessedTelegramUpdate': ProcessedTelegramUpdate,
        'ProcessedWhatsAppEvent': ProcessedWhatsAppEvent,
        'LudicPlanning': LudicPlanning,
        'OrganizationType': OrganizationType,
        'Organization': Organization,
        'SocialProgram': SocialProgram,
        'ProgramFormDefinition': ProgramFormDefinition,
        'ProgramBeneficiary': ProgramBeneficiary,
        'GeoLayer': GeoLayer,
        'GeoPoint': GeoPoint,
        'GeoFence': GeoFence,
        'OrgNetworkEdge': OrgNetworkEdge,
        'ChannelConfig': ChannelConfig,
        'ChannelConversation': ChannelConversation,
        'OrgProgramMembership': OrgProgramMembership,
        'ProgramTeamMember': ProgramTeamMember,
        'FamilyIntervention': FamilyIntervention,
        'Notification': Notification,
        'GeneratedReport': GeneratedReport,
        'MaintenanceTask': MaintenanceTask
    }

