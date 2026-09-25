"""
API initialization and blueprint registration
"""
from flask import Blueprint

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Import and register sub-blueprints
from api.children import children_bp
from api.attendance import attendance_bp
from api.nutrition import nutrition_bp
from api.health import health_bp
from api.milestones import milestones_bp
from api.reports import reports_bp
from api.users import users_bp
from api.chat import chat_bp
from api.dashboard import dashboard_bp
from api.monitoring import monitoring_bp
from api.documents import documents_bp
from api.applications import applications_bp

# Register blueprints
from api.interventions import interventions_bp
from api.operations import operations_bp
from api.notifications import notifications_bp

api_bp.register_blueprint(dashboard_bp)
api_bp.register_blueprint(users_bp)
api_bp.register_blueprint(children_bp)
api_bp.register_blueprint(attendance_bp)
api_bp.register_blueprint(health_bp)
api_bp.register_blueprint(nutrition_bp)
api_bp.register_blueprint(milestones_bp)
api_bp.register_blueprint(documents_bp)
api_bp.register_blueprint(applications_bp)
api_bp.register_blueprint(monitoring_bp)
api_bp.register_blueprint(interventions_bp)
api_bp.register_blueprint(operations_bp)
api_bp.register_blueprint(notifications_bp)
api_bp.register_blueprint(chat_bp)
api_bp.register_blueprint(reports_bp)

# Messaging Channels
from api.channels import channels_bp
api_bp.register_blueprint(channels_bp)

# Proactive Messaging
from api.messaging import messaging_bp
api_bp.register_blueprint(messaging_bp)

# Bulk Ingestion
from api.ingestion import ingestion_bp
api_bp.register_blueprint(ingestion_bp)

# Ludic Planning
from api.planning import planning_bp
api_bp.register_blueprint(planning_bp)

# Social Programs OS
from api.social_programs import social_programs_bp
api_bp.register_blueprint(social_programs_bp)

# Geo Intelligence OS ("GeoMap OS")
from api.geo_intelligence import geo_intelligence_bp
api_bp.register_blueprint(geo_intelligence_bp)

# Channels OS (Multi-Tenant & Inheritable Channels)
from api.channels_os import channels_os_bp
api_bp.register_blueprint(channels_os_bp)

__all__ = ['api_bp']


