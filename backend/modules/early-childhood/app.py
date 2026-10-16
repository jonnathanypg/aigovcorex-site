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
    from api.channels_os_webhook import channels_os_webhook_bp
    from api.knowledge import knowledge_bp
    from api.document_templates import document_templates_bp
    from api.reports import reports_bp
    from api.voice import voice_bp
    from api.public_chat import public_chat_bp
    from api.chat_upload import chat_upload_bp
    from api.lem import lem_bp as _lem_bp  # Proxy LEM-V4 (keys privadas solo server-side)
    from api.llm_config import llm_config_bp  # BYOT por empresa + creditos LEM-V4
    # Canonical Social AI module at backend/modules/social
    from social.api.social_programs import social_programs_bp
    from social.api.documents import documents_bp
    from social.api.knowledge import knowledge_bp as social_knowledge_bp

    # CORE-MOTOR: blueprint unico del motor de datos lab-wide (backend/common).
    # No duplicar este registro; otros proyectos consumen via HTTP (core_server :5050).
    try:
        import sys as _sys, os as _os
        _COMMON = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..', 'common'))
        if _COMMON not in _sys.path:
            _sys.path.insert(0, _COMMON)
        from core_api import core_bp as _core_bp
        app.register_blueprint(_core_bp)
    except Exception:
        pass
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(super_admin_bp)
    app.register_blueprint(license_admin_bp)
    app.register_blueprint(coordinator_bp)
    app.register_blueprint(educator_bp)
    app.register_blueprint(whatsapp_webhook_bp)
    app.register_blueprint(telegram_webhook_bp)
    app.register_blueprint(channels_os_webhook_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(document_templates_bp)
    app.register_blueprint(voice_bp, url_prefix='/api/voice')
    app.register_blueprint(public_chat_bp)
    app.register_blueprint(chat_upload_bp)
    app.register_blueprint(_lem_bp)  # /api/lem/verify + /api/lem/health
    app.register_blueprint(llm_config_bp)  # /api/license-admin/llm-* (BYOT)
    app.register_blueprint(social_programs_bp, url_prefix='/api/social')
    app.register_blueprint(documents_bp, url_prefix='/api/social/documents')
    app.register_blueprint(social_knowledge_bp, url_prefix='/api/social/knowledge')
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
                "ALTER TABLE licenses ADD COLUMN lem_credits_balance INT NOT NULL DEFAULT 1000",
                "ALTER TABLE licenses ADD COLUMN lem_enabled BOOLEAN DEFAULT 1",
                "ALTER TABLE licenses ADD COLUMN institutions_header VARCHAR(500) NULL",
                "ALTER TABLE licenses ADD COLUMN project_name TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN convenio_text TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN finalidad_text TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN poblacion_text TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN objetivo_text TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN servicios_text TEXT NULL",
                "ALTER TABLE licenses ADD COLUMN print_footer_note VARCHAR(500) NULL",
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

            # Seed / Migración de datos institucionales para la licencia de prueba (GASIBA / DASE EP / MIES)
            try:
                seed_sql = """
                UPDATE licenses l
                LEFT JOIN license_admins la ON la.license_id = l.id
                LEFT JOIN users u ON u.id = la.user_id
                SET 
                    l.institutions_header = IF(l.institutions_header IS NULL OR l.institutions_header = '', 'DASE EP  ·  FUNDACIÓN GASIBA  ·  M.I. MUNICIPALIDAD DE GUAYAQUIL', l.institutions_header),
                    l.project_name = IF(l.project_name IS NULL OR l.project_name = '', 'PROYECTO INTEGRAL DE GESTIÓN TÉCNICA Y ADMINISTRATIVA DE LOS CENTROS MUNICIPALES DE CUIDADO INFANTIL GUASMO, ORQUÍDEAS Y BAHÍA', l.project_name),
                    l.convenio_text = IF(l.convenio_text IS NULL OR l.convenio_text = '', 'Convenio de cooperación interinstitucional — Centros Municipales de Cuidado Infantil (CMCI)', l.convenio_text),
                    l.finalidad_text = IF(l.finalidad_text IS NULL OR l.finalidad_text = '', 'Atención integral a niñas y niños de 12 a 42 meses en situación de vulnerabilidad', l.finalidad_text),
                    l.poblacion_text = IF(l.poblacion_text IS NULL OR l.poblacion_text = '', 'Niñas y niños de 12 a 42 meses y sus familias (centros BH / GU / OR)', l.poblacion_text),
                    l.objetivo_text = IF(l.objetivo_text IS NULL OR l.objetivo_text = '', 'Garantizar cuidado, nutrición, salud y desarrollo infantil integral con priorización por vulnerabilidad', l.objetivo_text),
                    l.servicios_text = IF(l.servicios_text IS NULL OR l.servicios_text = '', 'Cuidado diario · Alimentación (4 tiempos) · Salud y crecimiento · Desarrollo infantil · Acompañamiento familiar', l.servicios_text),
                    l.print_footer_note = IF(l.print_footer_note IS NULL OR l.print_footer_note = '', 'Se extiende la presente constancia para ser incorporada al expediente del niño/a que se entrega a la DASE EP.', l.print_footer_note)
                WHERE u.email = 'jgastiaburo@gasiba.org' OR l.id = 1
                """
                db.session.execute(text(seed_sql))
                db.session.commit()
            except Exception:
                db.session.rollback()

            # CMCI Fase 0: Tenant.cmci_code + country_iso (idempotente: try/except por columna)
            for col_sql in [
                "ALTER TABLE tenants ADD COLUMN cmci_code VARCHAR(10) NULL",
                "ALTER TABLE tenants ADD COLUMN country_iso VARCHAR(5) NULL DEFAULT 'EC'",
            ]:
                try:
                    db.session.execute(text(col_sql))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            try:
                db.session.execute(text("UPDATE tenants SET country_iso = 'EC' WHERE country_iso IS NULL"))
                db.session.commit()
            except Exception:
                db.session.rollback()
            # Ensure knowledge_documents content and pinecone_ids are LONGTEXT (avoid 1406 Data too long)
            for col_sql in [
                "ALTER TABLE knowledge_documents MODIFY COLUMN content LONGTEXT NOT NULL",
                "ALTER TABLE knowledge_documents MODIFY COLUMN pinecone_ids LONGTEXT NULL",
            ]:
                try:
                    db.session.execute(text(col_sql))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            app.logger.info("Migration: Verified licenses schema with AI GovCoreX OS columns and knowledge LONGTEXT")
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
