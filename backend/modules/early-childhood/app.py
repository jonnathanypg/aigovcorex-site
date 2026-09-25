"""
Main Flask Application
KindiCore AI - CDI Management System
"""
from flask import Flask, render_template, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import get_config
from models import db
from middleware.tenant_context import init_tenant_middleware

import sys
import os

_BACKEND_MODULES_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _BACKEND_MODULES_PATH not in sys.path:
    sys.path.insert(0, _BACKEND_MODULES_PATH)

def create_app(config_name=None):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=config.CORS_ORIGINS)
    jwt = JWTManager(app)
    
    # Initialize middleware
    init_tenant_middleware(app)
    
    # Register blueprints
    from auth.authentication import auth_bp
    from api import api_bp
    from api.super_admin import super_admin_bp
    from api.license_admin import license_admin_bp
    from api.coordinator import coordinator_bp
    from api.educator import educator_bp
    from api.whatsapp_webhook import whatsapp_webhook_bp
    from api.telegram_webhook import telegram_webhook_bp
    from api.knowledge import knowledge_bp
    from api.reports import reports_bp
    from api.voice import voice_bp
    from api.public_chat import public_chat_bp
    from api.chat_upload import chat_upload_bp
    # Canonical Social AI module at backend/modules/social
    from social.api.social_programs import social_programs_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(super_admin_bp)
    app.register_blueprint(license_admin_bp)
    app.register_blueprint(coordinator_bp)
    app.register_blueprint(educator_bp)
    app.register_blueprint(whatsapp_webhook_bp)
    app.register_blueprint(telegram_webhook_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(reports_bp, url_prefix='/api')
    app.register_blueprint(voice_bp, url_prefix='/api/voice')
    app.register_blueprint(public_chat_bp)
    app.register_blueprint(chat_upload_bp)
    app.register_blueprint(social_programs_bp, url_prefix='/api/social')
    @app.route('/')
    def index():
        """Landing page"""
        return render_template('index.html')
    
    @app.route('/dashboard')
    def dashboard():
        """Dashboard page"""
        return render_template('dashboard.html')
    
    @app.route('/super-admin')
    def super_admin_panel():
        """Super Admin panel"""
        return render_template('super-admin.html')
    
    @app.route('/license-admin')
    def license_admin_panel():
        """License Admin panel"""
        return render_template('license-admin.html')
    
    @app.route('/coordinator')
    def coordinator_panel():
        """Coordinator panel"""
        return render_template('coordinator.html')

    @app.route('/educator')
    def educator_panel():
        """Educator panel"""
        return render_template('educator.html')
    
    @app.route('/children')
    def children_page():
        """Children management page"""
        return render_template('children/list.html')
    
    @app.route('/children/<int:child_id>')
    def child_profile(child_id):
        """Child profile page"""
        return render_template('children/profile.html', child_id=child_id)
    
    @app.route('/attendance')
    def attendance_page():
        """Attendance page"""
        return render_template('attendance/daily.html')
    
    @app.route('/nutrition')
    def nutrition_page():
        """Nutrition tracking page"""
        return render_template('nutrition/tracking.html')
    
    @app.route('/reports')
    def reports_page():
        """Reports page"""
        return render_template('reports/index.html')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Recurso no encontrado'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Error interno del servidor'}), 500
    
    # Health check
    @app.route('/health')
    def health():
        """Health check endpoint"""
        return jsonify({'status': 'healthy'}), 200
    
    # Initialize database
    with app.app_context():
        # Import models to ensure they're registered
        from models import init_models
        init_models()
        
        # Create all tables
        db.create_all()
        
        # Safe migrations: Add new columns that create_all won't add to existing tables
        try:
            from sqlalchemy import text
            # Add 'period' column
            try:
                db.session.execute(text("ALTER TABLE milestones ADD COLUMN period VARCHAR(50) NULL"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Add 'notes' column if missing
            try:
                db.session.execute(text("ALTER TABLE milestones ADD COLUMN notes TEXT NULL"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Add 'agent_voice' column if missing
            try:
                db.session.execute(text("ALTER TABLE licenses ADD COLUMN agent_voice VARCHAR(100) NULL DEFAULT 'es-EC-LuisNeural'"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Add AI GovCoreX OS license columns
            for col_sql in [
                "ALTER TABLE licenses ADD COLUMN enabled_modules TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN max_users INT NULL DEFAULT 50",
                "ALTER TABLE licenses ADD COLUMN storage_quota_mb INT NULL DEFAULT 1024",
                "ALTER TABLE licenses ADD COLUMN allow_public_chatbot BOOLEAN DEFAULT 1",
                "ALTER TABLE licenses ADD COLUMN allow_whatsapp_public BOOLEAN DEFAULT 1",
                "ALTER TABLE licenses ADD COLUMN allow_telegram_public BOOLEAN DEFAULT 1",
                "ALTER TABLE licenses ADD COLUMN public_org_slug VARCHAR(100) NULL",
            ]:
                try:
                    db.session.execute(text(col_sql))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Set default modules for existing licenses that have null
            try:
                db.session.execute(text("UPDATE licenses SET enabled_modules = '[\"kindicore\",\"social\",\"geo\",\"channels\",\"copilot\"]' WHERE enabled_modules IS NULL"))
                db.session.commit()
            except Exception:
                db.session.rollback()
                
            app.logger.info("Migration: Verified licenses schema with AI GovCoreX OS columns")
        except Exception as e:
            pass
    
    return app


if __name__ == '__main__':
    app = create_app()
    # PRE-DEPLOYMENT FIX: Debug MUST be False in production
    # Use environment variable to toggle if strictly necessary
    import os
    is_debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    app.run(debug=is_debug, host='0.0.0.0', port=port)
