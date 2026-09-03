import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from middleware.tenant_context import tenant_required, TenantContext
from services.voice_service import VoiceService
from models.tenant import Tenant
from utils.role_helpers import is_multi_center_role

try:
    from agents.langgraph_orchestrator import LangGraphOrchestrator as Orchestrator
    USING_LANGGRAPH = True
except Exception:
    from agents.simple_orchestrator import SimpleOrchestrator as Orchestrator
    USING_LANGGRAPH = False

logger = logging.getLogger(__name__)

voice_bp = Blueprint('voice', __name__, url_prefix='/voice')

# Configure upload folder for voice (absolute path for reliable file serving)
UPLOAD_VOICE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'voice')

def ensure_voice_dir():
    if not os.path.exists(UPLOAD_VOICE_DIR):
        os.makedirs(UPLOAD_VOICE_DIR, exist_ok=True)

@voice_bp.route('/interact', methods=['POST'])
@tenant_required
def voice_interact():
    """
    Receive audio, transcribe, process with AI, synthesize response, and return both.
    Expects: 'file' (audio blob), 'channel' (optional)
    """
    try:
        ensure_voice_dir()
        tenant_id = TenantContext.get_current_tenant_id()
        user = TenantContext.get_current_user()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No se recibió archivo de audio'}), 400
        
        audio_file = request.files['file']
        channel = request.form.get('channel', 'web_voice')
        
        # 1. Save incoming audio
        filename = f"in_{uuid.uuid4().hex}.webm" # Browser usually sends webm
        input_path = os.path.join(UPLOAD_VOICE_DIR, filename)
        audio_file.save(input_path)
        
        # 2. Transcribe
        transcription = VoiceService.transcribe(input_path)
        if not transcription or not transcription.strip():
            logger.warning(f"Transcription was empty or whitespace for file: {input_path}")
            transcription = "(Nota de voz inaudible)"
        
        # 3. Process with Orchestrator (same logic as chat.py)
        # (Simplified context loading for brevity, ideally reuse _build_license_context)
        from api.chat import _build_license_context
        from models.license import LicenseAdmin
        
        license_id = None
        if hasattr(user, 'role') and user.role and is_multi_center_role(user):
            admin_profile = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if admin_profile:
                license_id = admin_profile.license_id
        elif user.tenant_id:
            tenant = Tenant.query.get(user.tenant_id)
            if tenant and tenant.license_id:
                license_id = tenant.license_id
        
        user_role = user.role.name if hasattr(user, 'role') and user.role else None
        lic_ctx = _build_license_context(license_id)

        orchestrator = Orchestrator(
            tenant_id, user.id, license_id=license_id, role=user_role,
            license_name=lic_ctx['license_name'],
            legal_name=lic_ctx['legal_name'],
            ruc=lic_ctx['ruc'],
            centers_list=lic_ctx['centers_list'],
        )
        
        result = orchestrator.process_message(
            message=transcription, 
            channel=channel,
            sender_identifier=str(user.id)
        )
        
        agent_response_text = result.get('response', '')
        
        # 4. Synthesize response
        # Get voice from license settings or default
        from models.license import License
        tenant = Tenant.query.get(tenant_id) if tenant_id else None
        voice_name = "es-EC-LuisNeural" # Default Ecuadorian voice
        
        if tenant and tenant.license_id:
            license_obj = License.query.get(tenant.license_id)
            if license_obj and license_obj.agent_voice:
                voice_name = license_obj.agent_voice
        elif tenant and tenant.settings and isinstance(tenant.settings, dict):
            voice_name = tenant.settings.get('agent_voice', voice_name)
        
        output_filename = f"out_{uuid.uuid4().hex}.mp3"
        output_path = os.path.join(UPLOAD_VOICE_DIR, output_filename)
        
        success = VoiceService.synthesize(agent_response_text, voice_name, output_path)
        
        # 5. Clean up input file (optional, keeping for debugging for now)
        # os.remove(input_path)
        
        response_data = {
            'transcription': transcription,
            'agent_response': agent_response_text,
            'audio_url': f"/api/voice/audio/{output_filename}" if success else None,
            'success': True
        }
        
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error in voice interaction: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@voice_bp.route('/synthesize', methods=['POST'])
@tenant_required
def voice_synthesize():
    """
    Synthesize text to speech and return audio URL.
    Expects: { "text": "text to synthesize", "voice": "optional voice name" }
    """
    try:
        ensure_voice_dir()
        tenant_id = TenantContext.get_current_tenant_id()
        data = request.get_json()
        
        if not data or not data.get('text'):
            return jsonify({'error': 'Texto requerido'}), 400
        
        text = data['text']
        
        # Get voice from license settings or default
        from models.license import License, LicenseAdmin
        from models.tenant import Tenant
        
        voice_name = data.get('voice')
        if not voice_name:
            voice_name = "es-EC-LuisNeural" # Default
            tenant = Tenant.query.get(tenant_id) if tenant_id else None
            if tenant and tenant.license_id:
                license_obj = License.query.get(tenant.license_id)
                if license_obj and license_obj.agent_voice:
                    voice_name = license_obj.agent_voice
            elif tenant and tenant.settings and isinstance(tenant.settings, dict):
                voice_name = tenant.settings.get('agent_voice', voice_name)

        output_filename = f"out_{uuid.uuid4().hex}.mp3"
        output_path = os.path.join(UPLOAD_VOICE_DIR, output_filename)
        
        success = VoiceService.synthesize(text, voice_name, output_path)
        
        if success:
            return jsonify({
                'audio_url': f"/api/voice/audio/{output_filename}",
                'success': True
            }), 200
        else:
            return jsonify({'error': 'Error en la síntesis de voz', 'success': False}), 500

    except Exception as e:
        logger.error(f"Error in voice synthesis: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@voice_bp.route('/voices', methods=['GET'])
@tenant_required
def list_voices():
    """List available Spanish voices"""
    voices = VoiceService.get_voices()
    return jsonify({'voices': voices}), 200

@voice_bp.route('/audio/<filename>', methods=['GET'])
def get_audio(filename):
    """Serve synthesized audio files"""
    return send_from_directory(UPLOAD_VOICE_DIR, filename)
