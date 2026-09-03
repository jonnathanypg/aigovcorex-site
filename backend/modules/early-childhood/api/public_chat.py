"""
Public Chat API — Chatbot público para organizaciones
AI GovCoreX OS — Permite a usuarios externos (ciudadanos) interactuar con
la organización sin autenticación, identificados por teléfono/sesión web.

Rutas:
  POST /api/public/chat/<org_slug>       — Chat público con el agente
  GET  /api/public/org/<org_slug>        — Config pública de la organización
  GET  /api/public/widget/<org_slug>     — Snippet HTML embebible

CORS abierto para permitir embedding en sitios externos.
"""
from flask import Blueprint, request, jsonify, Response
from flask_cors import cross_origin
from models import db
from models.license import License
from models.tenant import Tenant
from models.user import User
from datetime import datetime
import logging

public_chat_bp = Blueprint('public_chat', __name__, url_prefix='/api/public')
logger = logging.getLogger(__name__)


def _get_active_license(slug: str):
    """Obtener licencia activa por slug público"""
    return License.query.filter_by(public_org_slug=slug, status='active').first()


@public_chat_bp.route('/org/<org_slug>', methods=['GET'])
@cross_origin()
def get_org_info(org_slug):
    """
    Información pública de la organización para inicializar el widget de chat.
    Returns agent config, org name, active programs, contact channels.
    """
    try:
        license = _get_active_license(org_slug)
        if not license:
            return jsonify({'error': 'Organización no encontrada o inactiva'}), 404

        # Programas sociales activos visibles al público
        programs = []
        try:
            from models.social_program import SocialProgram
            prog_list = SocialProgram.query.filter_by(
                license_id=license.id,
                status='active'
            ).limit(8).all()
            programs = [{'id': p.id, 'name': p.name,
                         'description': p.description} for p in prog_list]
        except Exception:
            pass

        return jsonify({
            'org_name': license.name,
            'legal_name': license.legal_name,
            'agent_name': license.agent_name or 'Asistente Virtual',
            'agent_icon': license.agent_icon_path,
            'allow_public_chatbot': license.allow_public_chatbot,
            'whatsapp_phone': (license.whatsapp_phone
                               if license.allow_whatsapp_public else None),
            'telegram_bot': (license.telegram_bot_username
                             if license.allow_telegram_public else None),
            'active_programs': programs,
            'enabled_modules': license.get_enabled_modules(),
        }), 200

    except Exception as e:
        logger.error(f"get_org_info error: {e}")
        return jsonify({'error': str(e)}), 500


@public_chat_bp.route('/chat/<org_slug>', methods=['POST', 'OPTIONS'])
@cross_origin(origins='*')
def public_chat(org_slug):
    """
    Endpoint público para el widget de chat embebible de organizaciones.
    No requiere autenticación JWT.
    Identifica la organización por su slug y responde como su agente configurado.
    Soporta identificación de usuarios externos y derivación a programas activos.
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        license = _get_active_license(org_slug)
        if not license:
            return jsonify({'error': 'Organización no encontrada'}), 404

        if not license.allow_public_chatbot:
            return jsonify({'error': 'Chatbot público no habilitado para esta organización'}), 403

        data = request.get_json(force=True, silent=True) or {}
        message = (data.get('message') or '').strip()
        if not message:
            return jsonify({'error': 'Mensaje requerido'}), 400

        session_id = data.get('session_id', f'web_{int(datetime.utcnow().timestamp())}')
        user_name = data.get('user_name', 'Usuario')
        user_phone = data.get('user_phone', '')

        # Obtener tenant primario de esta licencia
        primary_tenant = Tenant.query.filter_by(
            license_id=license.id, is_active=True
        ).first()
        if not primary_tenant:
            # Fallback: any tenant
            primary_tenant = Tenant.query.filter_by(license_id=license.id).first()

        if not primary_tenant:
            return jsonify({
                'success': True,
                'response': f'Hola {user_name}, soy el asistente de {license.name}. '
                            f'En este momento no hay centros configurados. Por favor contáctanos directamente.',
                'agent_name': license.agent_name or 'Asistente',
                'org_name': license.name,
                'session_id': session_id,
            }), 200

        # Usuario del sistema para el orquestador
        system_user = User.query.filter_by(
            tenant_id=primary_tenant.id, is_active=True
        ).first()

        if not system_user:
            system_user = User.query.first()

        if not system_user:
            return jsonify({'error': 'Sin configuración de sistema'}), 500

        # Construir contexto enriquecido para el agente
        context_message = (
            f"[USUARIO PÚBLICO - CHATBOT WEB]\n"
            f"Nombre: {user_name}\n"
            f"Teléfono: {user_phone or 'No proporcionado'}\n"
            f"Sesión: {session_id}\n"
            f"Organización: {license.name} ({license.legal_name or ''})\n\n"
            f"Mensaje del usuario: {message}\n\n"
            f"INSTRUCCIÓN SISTEMA: Eres el asistente virtual público de {license.name}. "
            f"Tu objetivo es: (1) Identificar si el usuario ya es beneficiario de algún programa "
            f"activo; (2) Si no lo es, informar sobre los programas disponibles y guiarlo para "
            f"registrarse; (3) Si necesita atención urgente, indicar los canales de contacto. "
            f"Sé amable, claro y conciso. Si no puedes responder, sugiere contactar directamente."
        )

        try:
            from agents.langgraph_orchestrator import LangGraphOrchestrator
            orchestrator = LangGraphOrchestrator(
                tenant_id=primary_tenant.id,
                user_id=system_user.id,
                license_id=license.id,
                role='public_bot',
                license_name=license.name,
                legal_name=license.legal_name,
                ruc=license.ruc,
            )
            result = orchestrator.process_message(
                context_message,
                channel='web_widget',
                sender_identifier=session_id
            )
            response_text = result.get('response', '')
        except Exception as e:
            logger.error(f"Orchestrator error in public chat: {e}")
            response_text = (
                f"Hola {user_name}, soy el asistente de {license.name}. "
                f"En este momento tengo dificultades técnicas. "
                f"Por favor contáctanos directamente."
            )

        return jsonify({
            'success': True,
            'response': response_text,
            'agent_name': license.agent_name or 'Asistente Virtual',
            'org_name': license.name,
            'session_id': session_id,
        }), 200

    except Exception as e:
        logger.error(f"public_chat error: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


@public_chat_bp.route('/widget/<org_slug>', methods=['GET'])
@cross_origin()
def get_widget_snippet(org_slug):
    """
    Retorna el snippet HTML/JS para embeber el widget de chat en cualquier sitio web.
    Uso: GET /api/public/widget/{org_slug}
    """
    try:
        license = _get_active_license(org_slug)
        if not license:
            return jsonify({'error': 'Organización no encontrada'}), 404

        host = request.host_url.rstrip('/')
        primary_color = '#f97316'  # Default amber — can be per-license in future

        snippet = f"""<!-- AI GovCoreX Widget — {license.name} -->
<script>
  (function() {{
    window.__AIGOVCOREX_CONFIG__ = {{
      orgSlug: '{org_slug}',
      apiBase: '{host}',
      primaryColor: '{primary_color}',
      position: 'bottom-right'
    }};
    var s = document.createElement('script');
    s.src = '{host}/static/widget/aigovcorex-widget.min.js';
    s.async = true;
    document.head.appendChild(s);
  }})();
</script>"""

        return Response(snippet, mimetype='text/javascript',
                        headers={'Access-Control-Allow-Origin': '*'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
