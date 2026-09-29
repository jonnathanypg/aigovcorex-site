"""
WhatsApp Webhook API
Handles incoming messages from the api-whatsapp microservice
Supports both legacy License-based channels and OS ChannelConfig-based channels
"""
from flask import Blueprint, request, jsonify
import os

from models import db
from models.license import License
from models.tenant import Tenant
from models.channel_config import ChannelConfig, ChannelConversation, ChannelMessage
from services.identity_resolver import IdentityResolver
import requests

try:
    from agents.langgraph_orchestrator import LangGraphOrchestrator
except Exception as e:
    from agents.simple_orchestrator import SimpleOrchestrator as LangGraphOrchestrator

whatsapp_webhook_bp = Blueprint('whatsapp_webhook', __name__, url_prefix='/webhooks')

# WhatsApp API URL for sending responses
WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def _persist_incoming_message_os(channel, external_id, contact_name, contact_phone, role, content, channel_type, media_url=None, media_type=None):
    """Upsert conversación + guarda mensaje entrante para canales OS."""
    try:
        conv = ChannelConversation.query.filter_by(
            channel_id=channel.id, external_id=external_id
        ).first()
        if not conv:
            conv = ChannelConversation(
                channel_id=channel.id,
                external_id=external_id,
                contact_name=contact_name,
                contact_phone=contact_phone,
                conversation_type='support',
                status='open',
                is_ai_active=True,
                handover_status='bot_active',
            )
            db.session.add(conv)
            db.session.flush()
        # Actualiza última actividad
        conv.last_message_at = db.func.now()
        conv.messages_count = (conv.messages_count or 0) + 1
        conv.contact_name = contact_name or conv.contact_name
        conv.contact_phone = contact_phone or conv.contact_phone

        msg = ChannelMessage(
            conversation_id=conv.id,
            role=role,
            content=content,
            channel=channel_type,
            media_url=media_url,
            media_type=media_type,
        )
        db.session.add(msg)
        db.session.commit()
        return conv.id
    except Exception as e:
        print(f'[WhatsApp Webhook OS] Error persistiendo mensaje entrante: {e}')
        db.session.rollback()
        return None


def _find_channel_for_company_id(company_id: str):
    """Find ChannelConfig by session_id or channel-{id} pattern."""
    # Try exact session_id match first
    channel = ChannelConfig.query.filter(
        ChannelConfig.is_active.is_(True),
        ChannelConfig.channel_type == 'whatsapp',
        ChannelConfig.session_id == company_id
    ).first()
    if channel:
        return channel
    # Try channel-{id} pattern
    if company_id.startswith('channel-'):
        try:
            channel_id = int(company_id.replace('channel-', ''))
            channel = ChannelConfig.query.filter_by(id=channel_id, is_active=True, channel_type='whatsapp').first()
            if channel:
                return channel
        except ValueError:
            pass
    return None


@whatsapp_webhook_bp.route('/whatsapp', methods=['POST'])
def receive_whatsapp_message():
    """
    Receive incoming WhatsApp messages from api-whatsapp microservice.
    Supports both legacy License-based and OS ChannelConfig-based channels.
    """
    db.session.rollback()

    data = request.get_json() or {}

    # Deduplication
    message_id = data.get('messageId')
    if message_id:
        try:
            from sqlalchemy.exc import IntegrityError
            from models.whatsapp_event import ProcessedWhatsAppEvent

            new_event = ProcessedWhatsAppEvent(message_id=message_id)
            db.session.add(new_event)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            print(f"[WhatsApp Webhook] Duplicate messageId {message_id} ignored.")
            return jsonify({'status': 'ignored', 'reason': 'duplicate_message_id'}), 200
        except Exception as e:
            db.session.rollback()
            print(f"[WhatsApp Webhook] Error tracking messageId: {e}")

    company_id = data.get('companyId')
    phone = data.get('from')
    message = data.get('message')
    attachment = data.get('attachment')  # Document or Audio metadata

    if not all([company_id, phone]) or (not message and not attachment):
        return jsonify({'error': 'Datos incompletos'}), 400

    # 0. Handle Audio Messages (Transcription)
    is_voice_input = False
    if attachment and attachment.get('type') == 'audio' and attachment.get('local_path'):
        from services.voice_service import VoiceService
        try:
            transcription = VoiceService.transcribe(attachment.get('local_path'))
            if transcription:
                message = transcription
                is_voice_input = True
                print(f"[WhatsApp Webhook] Voice Transcribed: {message}")
        except Exception as e:
            print(f"[WhatsApp Webhook] Error transcribing voice: {e}")

    # Ensure message is not empty (attachment-only case)
    if not message and attachment:
        message = f"[Archivo enviado: {attachment.get('filename', 'documento')}]"

    # Try to find OS channel first (by session_id or channel-{id})
    os_channel = _find_channel_for_company_id(company_id)
    
    if os_channel:
        # OS ChannelConfig-based flow
        clean_phone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
        
        # Persist incoming message
        conv_id = _persist_incoming_message_os(
            channel=os_channel,
            external_id=phone,
            contact_name=None,
            contact_phone=clean_phone,
            role='user',
            content=message,
            channel_type='whatsapp',
            media_url=attachment.get('url') if attachment else None,
            media_type=attachment.get('type') if attachment else None,
        )

        if not conv_id:
            return jsonify({'error': 'Error guardando mensaje'}), 500

        # TODO: Process through AI orchestrator for OS channels
        # For now, just acknowledge receipt
        return jsonify({'status': 'handled_os_channel', 'conversation_id': conv_id, 'success': True}), 200

    # Legacy License-based flow
    license_obj = License.query.get(company_id)
    if not license_obj or not license_obj.whatsapp_connected:
        return jsonify({'error': 'Canal no configurado'}), 404

    # Resolve user identity from phone number
    identity = IdentityResolver.resolve_from_phone(phone, int(company_id))

    if not identity.get('found'):
        # Citizen / Public User / Parent not yet in DB: Conversational Intake 24/7
        _send_whatsapp_typing(company_id, phone)
        response_text = _process_public_citizen_message(
            message=message,
            license_obj=license_obj,
            phone=phone,
            attachment=attachment
        )
        _send_whatsapp_response(license_id, phone, response_text)
        return jsonify({'status': 'handled_public_citizen', 'user_found': False, 'success': True}), 200
    
    # Process message through the AI orchestrator
    try:
        # Notify user we are thinking
        _send_whatsapp_typing(company_id, phone)

        ai_result = _process_ai_message(
            message=message,
            identity=identity,
            license_obj=license_obj,
            phone=phone,
            attachment=attachment
        )
        response_text = ai_result.get('text', 'No pude procesar tu mensaje.')
        # Send response back via WhatsApp
        import re
        # Find all attachments: pattern [ATTACH_REPORT:url|filename]
        matches = re.finditer(r'\[ATTACH_REPORT:(.*?)\]', response_text)

        attachments = []
        for match in matches:
            parts = match.group(1).split('|')
            media_url = parts[0]
            file_name = parts[1] if len(parts) > 1 else 'reporte.pdf'
            attachments.append((media_url, file_name))

        clean_text = re.sub(r'\[ATTACH_REPORT:.*?\]', '', response_text).strip()

        if is_voice_input and clean_text:
            from services.voice_service import VoiceService
            import uuid

            voice_name = license_obj.agent_voice or "es-EC-LuisNeural"

            from api.voice import ensure_voice_dir, UPLOAD_VOICE_DIR
            ensure_voice_dir()
            output_filename = f"wa_out_{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(UPLOAD_VOICE_DIR, output_filename)

            if VoiceService.synthesize(clean_text, voice_name, output_path):
                backend_url = os.getenv('BACKEND_PUBLIC_URL', 'http://localhost:5010')
                audio_url = f"{backend_url}/api/voice/audio/{output_filename}"
                _send_whatsapp_media(
                    license_id=company_id,
                    to_phone=phone,
                    media_url=audio_url,
                    media_type='audio'
                )
                # Still send text as backup
                _send_whatsapp_response(company_id, phone, f"📝 *Transcripción:* {clean_text}")
            else:
                _send_whatsapp_response(company_id, phone, clean_text)
        elif clean_text:
            _send_whatsapp_response(company_id, phone, clean_text)

        # Send attachments
        for url, name in attachments:
            _send_whatsapp_media(
                license_id=company_id,
                to_phone=phone,
                media_url=url,
                media_type='document',
                file_name=name
            )

        return jsonify({
            'status': 'handled_recursion_limit' if ai_result.get('error') == 'recursion_limit_reached' else 'handled',
            'user_found': True,
            'user_id': identity.get('user_id'),
            'role': identity.get('role'),
            'success': ai_result.get('success', True),
            'error': ai_result.get('error'),
        }), 200

    except Exception as e:
        print(f"[WhatsApp Webhook] Error processing message: {e}")
        error_response = "Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo."
        _send_whatsapp_response(company_id, phone, error_response)
        return jsonify({'error': str(e)}), 500


def _get_unknown_user_response(license_obj: License) -> str:
    """Generate response for unknown users."""
    agent_name = license_obj.agent_name or 'KindiCore AI'
    return f"""¡Hola! Soy {agent_name} 👋

No encontré tu número registrado en nuestro sistema. 

Para usar este servicio, tu número debe estar registrado en tu perfil de usuario. Por favor contacta al administrador del centro para verificar tu registro.

Si eres un nuevo interesado, puedes visitar nuestra plataforma para más información."""


def _process_ai_message(message: str, identity: dict, license_obj: License, phone: str, attachment: dict = None) -> dict:
    """Process the message through the AI orchestrator based on user permissions.

    Retorna dict {'text', 'success', 'error'}: el texto de usuario no cambia,
    pero success/error se propagan al log y a la respuesta HTTP (incluye
    distinción de 'recursion_limit_reached').
    """
    
    user_id = identity.get('user_id')
    tenant_id = identity.get('tenant_id')
    permissions = identity.get('permissions', {})
    role = identity.get('role')
    
    # Build context message with permissions
    context_prefix = _build_context_for_role(identity, license_obj)
    
    # Inject attachment context if present
    if attachment:
        file_name = attachment.get('filename', 'documento')
        file_type = attachment.get('mimetype', 'desconocido')
        file_path = attachment.get('local_path', '')
        context_prefix += f"\n\n[ARCHIVO RECIBIDO] El usuario ha enviado un archivo: '{file_name}' (tipo: {file_type})."
        if file_path:
            context_prefix += f"\nRuta local del archivo: {file_path}"
            if file_name.lower().endswith('.csv'):
                context_prefix += "\nEste es un archivo CSV. Puedes procesarlo usando la herramienta 'manage_ingestion' con action='process_csv'."
    
    # Use LangGraph orchestrator
    orchestrator = LangGraphOrchestrator(
        tenant_id=tenant_id or 1,
        user_id=user_id,
        license_id=license_obj.id,
        role=role,
        license_name=license_obj.name,
        legal_name=license_obj.legal_name,
        ruc=license_obj.ruc,
        centers_list=identity.get('centers_list', [])
    )
    
    # Process with role context
    full_message = f"{context_prefix}\n\nMensaje del usuario: {message}"
    
    response = orchestrator.process_message(
        message=full_message,
        channel='whatsapp',
        sender_identifier=phone
    )

    success = response.get('success', True)
    error = response.get('error')
    if error == 'recursion_limit_reached':
        print(f"[WhatsApp Webhook] recursion_limit_reached user_id={user_id} role={role} phone={phone}")
    elif not success:
        print(f"[WhatsApp Webhook] process_message success=False error={error} user_id={user_id} role={role}")

    return {
        'text': response.get('response', 'No pude procesar tu mensaje.'),
        'success': success,
        'error': error,
    }


def _build_context_for_role(identity: dict, license_obj: License) -> str:
    """Build context prefix based on user role for AI."""
    role = identity.get('role')
    user_name = identity.get('user_name', 'Usuario')
    permissions = identity.get('permissions', {})
    
    if role == 'license_admin':
        return f"""[CONTEXTO DEL SISTEMA]
Usuario: {user_name} (Administrador de Licencia)
Permisos: Acceso completo a todos los centros y datos."""

    elif role in ('center_coordinator', 'coordinator'):
        return f"""[CONTEXTO DEL SISTEMA]
Usuario: {user_name} (Coordinador de Centro)
Permisos: Acceso a datos de su centro únicamente.
Centro ID: {permissions.get('scope_id')}"""

    elif role in ('educadora', 'educator'):
        return f"""[CONTEXTO DEL SISTEMA]
Usuario: {user_name} (Educadora)
Permisos: Consultas limitadas de su centro.
Centro ID: {permissions.get('scope_id')}"""

    elif role in ('padre', 'parent'):
        child_ids = identity.get('child_ids', [])
        return f"""[CONTEXTO DEL SISTEMA]
Usuario: {user_name} (Padre/Madre)
Permisos: SOLO puede consultar información de sus hijos.
IDs de sus hijos: {child_ids}
IMPORTANTE: No revelar información de otros niños bajo ninguna circunstancia."""

    return f"""[CONTEXTO DEL SISTEMA]
Usuario: Desconocido
Permisos: Sin permisos especiales."""


def _process_public_citizen_message(message: str, license_obj: License, phone: str, attachment: dict = None) -> str:
    """
    Intake conversacional inteligente para ciudadanos / postulantes / familias públicas.
    (1) Identifica necesidades de la familia
    (2) Consulta programas sociales activos de la organización
    (3) Deriva al programa adecuado y ofrece iniciar postulación/ficha
    (4) Si es crítico, genera alerta al equipo de coordinadores
    """
    try:
        from models.tenant import Tenant
        from models.user import User
        from models.social_program import SocialProgram

        primary_tenant = Tenant.query.filter_by(license_id=license_obj.id, is_active=True).first()
        if not primary_tenant:
            primary_tenant = Tenant.query.filter_by(license_id=license_obj.id).first()
        tenant_id = primary_tenant.id if primary_tenant else 1

        system_user = User.query.filter_by(tenant_id=tenant_id, is_active=True).first()
        if not system_user:
            system_user = User.query.first()
        user_id = system_user.id if system_user else 1

        # Obtener programas sociales activos de esta organización
        active_programs = []
        try:
            progs = SocialProgram.query.filter_by(license_id=license_obj.id, status='active').all()
            for p in progs:
                active_programs.append(f"- *{p.name}* (ID: {p.id}): {p.description or 'Sin descripción'}")
        except Exception:
            pass

        programs_context = "\n".join(active_programs) if active_programs else "- Centros de Desarrollo Infantil (KindiCore AI CDI)\n- Atención Nutricional y Salud Integral"

        context_prompt = f"""[CIUDADANO PÚBLICO - WHATSAPP]
Teléfono de contacto: {phone}
Organización: {license_obj.name} ({license_obj.legal_name or ''})
Programas Activos de la Organización:
{programs_context}

INSTRUCCIONES CLAVE:
1. Eres {license_obj.agent_name or 'el Asistente Virtual'} de {license_obj.name}.
2. Saluda cordialmente y atiende las inquietudes de la persona.
3. Descubre su necesidad: si tiene niños de 0 a 3 años (CDI / nutrición), adultos mayores, vulnerabilidad económica o necesidad de apoyo social.
4. Conéctalo y explícale naturalmente el programa que mejor le corresponde.
5. Invítalo a proporcionar su nombre y cédula para pre-inscribirlo o derivarlo a una educadora/trabajadora social.
6. Si detectas un caso urgente de salud, desnutrición severa o riesgo familiar, indícale que has registrado una alerta prioritaria para que el equipo lo contacte de inmediato."""

        orchestrator = LangGraphOrchestrator(
            tenant_id=tenant_id,
            user_id=user_id,
            license_id=license_obj.id,
            role='public_citizen',
            license_name=license_obj.name,
            legal_name=license_obj.legal_name,
            ruc=license_obj.ruc,
        )

        full_message = f"{context_prompt}\n\nMensaje recibido de WhatsApp: {message}"
        response = orchestrator.process_message(
            message=full_message,
            channel='whatsapp_public',
            sender_identifier=phone
        )
        if response.get('error') == 'recursion_limit_reached':
            print(f"[WhatsApp Public Citizen] recursion_limit_reached phone={phone}")
        elif not response.get('success', True):
            print(f"[WhatsApp Public Citizen] process_message error={response.get('error')} phone={phone}")
        return response.get('response', f"¡Hola! Gracias por comunicarte con {license_obj.name}. ¿En qué podemos ayudarte hoy?")

    except Exception as e:
        print(f"[WhatsApp Public Citizen] Error: {e}")
        return f"¡Hola! Bienvenido/a a {license_obj.name}. Soy {license_obj.agent_name or 'su Asistente'}. Cuéntame qué necesitas y con gusto te oriento hacia nuestros programas activos."


def _send_whatsapp_response(license_id: str, to_phone: str, message: str):
    """Send response back via WhatsApp using api-whatsapp microservice."""
    try:
        response = requests.post(
            f"{WHATSAPP_API_URL}/lead",
            json={
                'companyId': str(license_id),
                'phone': to_phone,
                'message': message
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"[WhatsApp Webhook] Error sending response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"[WhatsApp Webhook] Failed to send response: {e}")

def _send_whatsapp_media(license_id: str, to_phone: str, media_url: str, media_type: str = 'document', file_name: str = 'archivo.pdf', caption: str = ''):
    """Send media file back via WhatsApp using api-whatsapp microservice."""
    try:
        response = requests.post(
            f"{WHATSAPP_API_URL}/lead/media",
            json={
                'companyId': str(license_id),
                'phone': to_phone,
                'mediaUrl': media_url,
                'mediaType': media_type,
                'fileName': file_name,
                'caption': caption
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"[WhatsApp Webhook] Error sending media: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"[WhatsApp Webhook] Failed to send media: {e}")

def _send_whatsapp_typing(license_id, phone):
    """Send typing indicator via api-whatsapp microservice."""
    try:
        requests.post(
            f"{WHATSAPP_API_URL}/lead/typing",
            json={
                'companyId': str(license_id),
                'phone': phone
            },
            timeout=5
        )
    except Exception as e:
        # Non-blocking error
        print(f"[WhatsApp Webhook] Failed to send typing indicator: {e}")
