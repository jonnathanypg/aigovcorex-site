from utils.role_helpers import is_multi_center_role
"""
Chat API - Multi-Agent Interface for CDI Management
Uses LangGraph for orchestration with tools
Supports SSE (Server-Sent Events) for progressive responses
"""
from flask import Blueprint, request, jsonify, Response
from middleware.tenant_context import tenant_required, TenantContext

try:
    from agents.langgraph_orchestrator import LangGraphOrchestrator as Orchestrator
    USING_LANGGRAPH = True
except Exception as e:
    print(f"Could not import LangGraphOrchestrator, falling back to SimpleOrchestrator: {e}")
    from agents.simple_orchestrator import SimpleOrchestrator as Orchestrator
    USING_LANGGRAPH = False

chat_bp = Blueprint('chat', __name__, url_prefix='/chat')


def _build_license_context(license_id):
    """
    Load license context for orchestrator personalization.
    Returns dict with license_name, legal_name, ruc, centers_list.
    One efficient query set — called once per orchestrator creation.
    """
    context = {
        'license_name': None,
        'legal_name': None,
        'ruc': None,
        'centers_list': [],
    }
    
    if not license_id:
        return context
    
    try:
        from models.license import License
        from models.tenant import Tenant
        
        license_record = License.query.get(license_id)
        if license_record:
            context['license_name'] = license_record.name
            context['legal_name'] = license_record.legal_name
            context['ruc'] = license_record.ruc
            
            # Get center names under this license
            centers = Tenant.query.filter_by(license_id=license_id).all()
            context['centers_list'] = [c.name for c in centers if c.name]
    except Exception as e:
        import logging
        logging.getLogger('chat').warning(f"Could not load license context: {e}")
    
    return context


@chat_bp.route('/message', methods=['POST'])
@tenant_required
def send_message():
    """
    Send message to AI agent system
    Expects: { "message": "text", "channel": "web_chat" }
    
    Available to: All roles (educator, coordinator, license_admin, super_admin)
    """
    try:
        tenant_id = TenantContext.get_current_tenant_id()
        user = TenantContext.get_current_user()
        
        data = request.get_json()
        
        if not data or not data.get('message'):
            return jsonify({'error': 'Mensaje requerido'}), 400
        
        message = data['message']
        channel = data.get('channel', 'web_chat')
        
        # --- Modificación para Personalización del Agente ---
        from models.license import LicenseAdmin
        license_id = None
        
        # Obtener license_id según el tipo de usuario
        # 1. Si es license_admin, obtener de su perfil de admin
        if hasattr(user, 'role') and user.role and is_multi_center_role(user):
            admin_profile = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if admin_profile:
                license_id = admin_profile.license_id
        # 2. Para CUALQUIER otro usuario que pertenezca a un centro (tenant)
        elif user.tenant_id:
            from models.tenant import Tenant
            tenant = Tenant.query.get(user.tenant_id)
            if tenant and tenant.license_id:
                license_id = tenant.license_id
        
        # Override tenant_id for license admins if they switch context in the frontend
        requested_tenant_id = data.get('tenant_id')
        if hasattr(user, 'role') and is_multi_center_role(user):
            if requested_tenant_id:
                tenant_id = int(requested_tenant_id)
        
        # --- Fin Modificación ---

        # Get role name safely
        user_role = user.role.name if hasattr(user, 'role') and user.role else None

        # Load license context for personalization (one-time efficient query)
        lic_ctx = _build_license_context(license_id)

        # Create multi-agent orchestrator with full context
        orchestrator = Orchestrator(
            tenant_id, user.id, license_id=license_id, role=user_role,
            license_name=lic_ctx['license_name'],
            legal_name=lic_ctx['legal_name'],
            ruc=lic_ctx['ruc'],
            centers_list=lic_ctx['centers_list'],
        )
        
        # Process message through the orchestrator
        result = orchestrator.process_message(
            message=message, 
            channel=channel,
            sender_identifier=str(user.id)
        )
        
        # Add metadata
        result['using_langgraph'] = USING_LANGGRAPH
        try:
            # Safely access role name to avoid DetachedInstanceError or serialization issues
            result['user_role'] = user.role.name if hasattr(user, 'role') and user.role else 'unknown'
        except Exception:
            result['user_role'] = 'unknown'
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({
            'error': f'Error al procesar mensaje: {str(e)}',
            'success': False
        }), 500


@chat_bp.route('/stream', methods=['POST'])
@tenant_required
def stream_message():
    """
    Send message to AI agent system with SSE streaming response.
    Returns progressive updates while the analysis is being performed.
    
    This endpoint keeps the connection alive with engagement messages
    (tips, progress updates) while the actual analysis runs in background.
    
    Response format: text/event-stream with events:
    - thinking: Initial processing indicator
    - progress: Stage updates during processing
    - tip: Engagement tips for the user
    - almost_ready: Final stage notification
    - result: The actual response
    - error: In case of failure
    """
    from services.sse_manager import StreamingOrchestrator, SSEManager
    from flask import current_app
    
    try:
        tenant_id = TenantContext.get_current_tenant_id()
        user = TenantContext.get_current_user()
        
        data = request.get_json()
        
        if not data or not data.get('message'):
            return Response(
                SSEManager.create_error_event('Mensaje requerido'),
                mimetype='text/event-stream'
            )
        
        message = data['message']
        channel = data.get('channel', 'web_chat')
        
        # Get license_id for personalization
        from models.license import LicenseAdmin
        license_id = None
        
        # 1. Si es license_admin, obtener de su perfil
        if hasattr(user, 'role') and user.role and is_multi_center_role(user):
            admin_profile = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if admin_profile:
                license_id = admin_profile.license_id
        # 2. Para CUALQUIER otro usuario que pertenezca a un centro (tenant)
        elif user.tenant_id:
            from models.tenant import Tenant
            tenant = Tenant.query.get(user.tenant_id)
            if tenant and tenant.license_id:
                license_id = tenant.license_id
        
        # Override tenant_id for license admins
        requested_tenant_id = data.get('tenant_id')
        if hasattr(user, 'role') and is_multi_center_role(user):
            if requested_tenant_id:
                tenant_id = int(requested_tenant_id)
        
        # Get role name safely
        user_role = user.role.name if hasattr(user, 'role') and user.role else None

        # Load license context for personalization (one-time efficient query)
        lic_ctx = _build_license_context(license_id)

        # Create orchestrator with full context
        orchestrator = Orchestrator(
            tenant_id, user.id, license_id=license_id, role=user_role,
            license_name=lic_ctx['license_name'],
            legal_name=lic_ctx['legal_name'],
            ruc=lic_ctx['ruc'],
            centers_list=lic_ctx['centers_list'],
        )
        
        # Wrap with streaming - pass Flask app for context in background thread
        flask_app = current_app._get_current_object()
        streaming = StreamingOrchestrator(orchestrator, flask_app=flask_app)

        # CRITICAL: Release the main thread's DB connection BEFORE streaming.
        # The background thread will get its own fresh connection via app_context().
        # Without this, the idle main-thread connection dies during the ~30s LLM call,
        # and Flask's teardown crashes trying to rollback the dead connection.
        from models import db
        db.session.remove()
        
        def generate():
            for event in streaming.stream_response(message, channel):
                yield event
        
        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'  # Disable nginx buffering
            }
        )
        
    except Exception as e:
        return Response(
            SSEManager.create_error_event(f'Error al procesar mensaje: {str(e)}'),
            mimetype='text/event-stream'
        )


@chat_bp.route('/history', methods=['GET'])
@tenant_required
def get_history():
    """Get conversation history for current user"""
    try:
        tenant_id = TenantContext.get_current_tenant_id()
        user = TenantContext.get_current_user()
        
        from models import db
        from sqlalchemy import text
        
        try:
            query = text("""
                SELECT id, channel, message_text, agent_response, agent_used, 
                       confidence_score, database_action, created_at
                FROM conversation_history
                WHERE tenant_id = :tenant_id AND user_id = :user_id
                ORDER BY created_at DESC
                LIMIT 50
            """)
            
            result = db.session.execute(query, {
                'tenant_id': tenant_id,
                'user_id': user.id
            })
            
            history = [dict(row._mapping) for row in result]
        except Exception:
            # Table might not exist yet
            history = []
        
        return jsonify({
            'history': history,
            'total': len(history)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'history': []}), 200


@chat_bp.route('/tools', methods=['GET'])
@tenant_required
def get_available_tools():
    """Get list of available tools for the agent"""
    try:
        try:
            from agents.langchain_tools import get_all_tools
            tools = get_all_tools()
            tool_info = []
            
            for tool in tools:
                tool_info.append({
                    'name': tool.name,
                    'description': tool.description
                })
        except ImportError:
            # LangChain tools not available
            tool_info = [
                {'name': 'search_child', 'description': 'Buscar niños por nombre'},
                {'name': 'record_attendance', 'description': 'Registrar asistencia'},
                {'name': 'log_nutrition', 'description': 'Registrar nutrición'},
                {'name': 'log_health', 'description': 'Registrar salud'},
                {'name': 'get_child_summary', 'description': 'Resumen del niño'}
            ]
        
        return jsonify({
            'tools': tool_info,
            'count': len(tool_info),
            'using_langgraph': USING_LANGGRAPH
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'tools': [], 'count': 0}), 200


@chat_bp.route('/status', methods=['GET'])
@tenant_required
def get_agent_status():
    """Get current agent system status"""
    try:
        import os
        from config import get_config
        
        config = get_config()
        
        return jsonify({
            'status': 'active',
            'using_langgraph': USING_LANGGRAPH,
            'llm_provider': 'openai' if os.getenv('OPENAI_API_KEY') else 'gemini',
            'model': config.OPENAI_MODEL if os.getenv('OPENAI_API_KEY') else config.GEMINI_MODEL,
            'tools_available': True
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

