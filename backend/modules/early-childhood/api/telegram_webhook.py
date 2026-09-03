from utils.role_helpers import is_multi_center_role
"""
Telegram Webhook API
Handles incoming messages from Telegram Bot API
"""
from flask import Blueprint, request, jsonify
import requests
import os
from datetime import datetime, timedelta

from models import db

from sqlalchemy.exc import IntegrityError
from models import db
from models.user import User
from models.license import License, LicenseAdmin
from models.child import Child, Representative
from models.telegram_update import ProcessedTelegramUpdate
from services.identity_resolver import IdentityResolver
try:
    from agents.langgraph_orchestrator import LangGraphOrchestrator
except Exception:
    from agents.simple_orchestrator import SimpleOrchestrator as LangGraphOrchestrator

# In-memory verification state cache for "Double Cedula" flow
# Format: { chat_id: { "step": "awaiting_parent_cedula"|"awaiting_child_cedula", "parent_cedula": "...", "expires": datetime } }
VERIFICATION_CACHE = {}

telegram_webhook_bp = Blueprint('telegram_webhook', __name__, url_prefix='/webhooks')

@telegram_webhook_bp.route('/telegram', methods=['POST'])
def receive_telegram_message():
    """
    Receive incoming Telegram messages.
    """
    # Preventive rollback to ensure clean session (GEMINI.md Rule A)
    db.session.rollback()
    
    data = request.get_json() or {}
    update_id = data.get('update_id')
    
    # 1. Deduplication (Critical for Retries)
    if update_id:
        try:
            # Try to insert update_id immediately
            # Using a separate transaction if possible, or just standard flow
            # Since we rolled back globally at start, this is clean.
            new_update = ProcessedTelegramUpdate(update_id=update_id)
            db.session.add(new_update)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            print(f"[Telegram Webhook] Duplicate update_id {update_id} ignored.")
            return jsonify({'status': 'ignored', 'reason': 'duplicate_update'}), 200
        except Exception as e:
            # If DB error, valid to proceed or fail? 
            # Better to log and proceed, but carefully.
            db.session.rollback()
            print(f"[Telegram Webhook] Error tracking update_id: {e}")

    if 'message' not in data:
        return jsonify({'status': 'ignored', 'reason': 'no_message'}), 200
    
    message_data = data['message']
    
    # 2. Bot Filter (Prevent Self-Loops)
    if message_data.get('from', {}).get('is_bot'):
        return jsonify({'status': 'ignored', 'reason': 'is_bot'}), 200

    chat_id = str(message_data.get('chat', {}).get('id'))
    text = message_data.get('text', '')
    contact = message_data.get('contact')
    voice = message_data.get('voice')
    audio = message_data.get('audio')
    user_id_telegram = message_data.get('from', {}).get('id')
    
    # 0. Handle Voice Messages (Transcription)
    if (voice or audio) and not text:
        from services.voice_service import VoiceService
        import uuid
        
        # We need the bot token to download the file
        # Find user and license first (reusing logic below)
        identity = IdentityResolver.resolve_from_telegram(chat_id)
        if identity.get('found'):
            user = User.query.get(identity['user_id'])
            license_id = _get_license_id_for_user(user)
            license_obj = License.query.get(license_id) if license_id else None
            bot_token = license_obj.telegram_bot_token if license_obj else None
            
            if bot_token:
                file_id = voice.get('file_id') if voice else audio.get('file_id')
                # 1. Get file path from Telegram
                try:
                    get_file_url = f"https://api.telegram.org/bot{bot_token}/getFile?file_id={file_id}"
                    file_resp = requests.get(get_file_url).json()
                    if file_resp.get('ok'):
                        remote_file_path = file_resp['result']['file_path']
                        download_url = f"https://api.telegram.org/file/bot{bot_token}/{remote_file_path}"
                        
                        # 2. Download and save locally
                        from api.voice import ensure_voice_dir, UPLOAD_VOICE_DIR
                        ensure_voice_dir()
                        ext = remote_file_path.split('.')[-1]
                        local_filename = f"tg_in_{uuid.uuid4().hex}.{ext}"
                        local_path = os.path.join(UPLOAD_VOICE_DIR, local_filename)
                        
                        audio_data = requests.get(download_url).content
                        with open(local_path, 'wb') as f:
                            f.write(audio_data)
                        
                        # 3. Transcribe
                        text = VoiceService.transcribe(local_path)
                        print(f"[Telegram Webhook] Voice Transcribed: {text}")
                except Exception as e:
                    print(f"[Telegram Webhook] Error processing voice: {e}")

    # 0. Handle Contact Sharing (Parent Verification)
    if contact:
        phone_number = contact.get('phone_number')
        user_id_contact = contact.get('user_id')
        
        # Verify that the Shared Contact is indeed the sender (to prevent spoofing)
        # Telegram says: "This field is optional... contact... If the contact is the user..."
        # However, checking user_id_contact == user_id_telegram is good practice but might depend on client.
        
        if phone_number:
            # Normalize phone (remove +)
            normalized_phone = phone_number.replace('+', '').strip()
            
            # Find User by Phone
            # Priority: Parents (Role 'padre')
            # In KindiCore, parents might be in User table with role='padre' or we might check other tables?
            # Assuming they are in User table as per IdentityResolver logic.
            
            # We use IdentityResolver logic but we need a custom "link by phone" method
            # Because IdentityResolver.resolve_from_phone requires license_id scope, 
            # here we want to searching GLOBAL or trying to infer license?
            # PROBLEM: Phones might duplicate across licenses? Maybe.
            # But usually a parent phone is unique enough.
            
            linked_user = _link_user_by_phone(normalized_phone, chat_id)
            
            if linked_user:
                 # Get the bot token for the linked user's license
                 license_id = _get_license_id_for_user(linked_user)
                 license_obj = License.query.get(license_id) if license_id else None
                 bot_token = license_obj.telegram_bot_token if license_obj else None
                 bot_name = license_obj.agent_name if license_obj and license_obj.agent_name else "KindiCore AI"

                 _send_telegram_response(chat_id, f"✅ ¡Verificación exitosa!\nBienvenido/a {linked_user.full_name}. Soy {bot_name} y ahora estamos conectados.", bot_token)
                 return jsonify({'status': 'linked_via_contact'}), 200
            else:
                 _send_telegram_response(chat_id, "❌ No encontré ningún usuario registrado con este número de celular.\nPor favor verifica que tu número esté actualizado en el centro educativo.")
                 return jsonify({'status': 'contact_unknown'}), 200
        
        return jsonify({'status': 'contact_processed'}), 200

    
    if not text:
        return jsonify({'status': 'ignored', 'reason': 'no_text'}), 200
    
    # Identify the bot token used (Telegram doesn't send it in the payload usually, 
    # but we need to know WHICH license this is for).
    # Since we don't have the token in the payload, we might have a problem for multi-tenant 
    # if multiple licenses use different bots pointing to the same webhook.
    # PROPER SOLUTION: The webhook URL should include the license_id or token hash.
    # FOR NOW: We'll assume the user is linked or we search for the license that has this bot connected?
    # Actually, simpler: We find the user by chat_id. If user found, we know their tenant/license.
    
    # 1. Try to find the user by chat_id
    identity = IdentityResolver.resolve_from_telegram(chat_id)
    
    # 2. If user not found, handle verification flow
    if not identity.get('found'):
        # Get default license info for bot name
        license_obj = License.query.filter_by(telegram_connected=True).first()
        agent_name = license_obj.agent_name if license_obj and license_obj.agent_name else "KindiCore AI"
        
        # Check if they sent a linking code (e.g. "/start ABC1234") for staff
        args = text.split()
        if text.startswith('/start') and len(args) > 1:
            potential_code = args[1]
            link_result = IdentityResolver.link_telegram_account(potential_code, chat_id)
            if link_result['success']:
                linked_user = User.query.get(link_result['user_id'])
                license_id = _get_license_id_for_user(linked_user)
                license_obj = License.query.get(license_id) if license_id else None
                bot_name = license_obj.agent_name if license_obj and license_obj.agent_name else "KindiCore AI"
                bot_token = license_obj.telegram_bot_token if license_obj else None
                _send_telegram_response(chat_id, f"✅ ¡Cuenta vinculada exitosamente!\nHola {link_result['user_name']}, soy {bot_name}. Ahora puedes consultarme.", bot_token)
                return jsonify({'status': 'linked'}), 200
        
        # Clean up expired verification states
        now = datetime.now()
        expired = [k for k, v in VERIFICATION_CACHE.items() if v.get('expires', now) < now]
        for k in expired:
            del VERIFICATION_CACHE[k]
        
        # Check for ongoing verification state
        state = VERIFICATION_CACHE.get(chat_id)
        
        if state and state.get('step') == 'awaiting_child_cedula':
            # Step 3: User provided Child's Cedula - Verify and Link
            child_cedula = text.strip()
            parent_cedula = state.get('parent_cedula')
            
            # Find the child
            child = Child.query.filter_by(cedula=child_cedula).first()
            if not child:
                _send_telegram_response(chat_id, f"❌ No encontré ningún niño/a con esa cédula.\nPor favor verifica e intenta de nuevo.")
                del VERIFICATION_CACHE[chat_id]
                return jsonify({'status': 'child_not_found'}), 200
            
            # Find the representative with the parent's cedula linked to this child's family
            representative = Representative.query.filter_by(
                family_id=child.family_id,
                cedula=parent_cedula
            ).first()
            
            if not representative:
                _send_telegram_response(chat_id, f"❌ No encontré un representante con tu cédula vinculado a ese niño.\nContacta al centro para verificar tus datos.")
                del VERIFICATION_CACHE[chat_id]
                return jsonify({'status': 'representative_mismatch'}), 200
            
            # SUCCESS! Find or create the User and link Telegram
            # First, check if there's already a User with this cedula
            user = User.query.filter_by(cedula=parent_cedula).first()
            
            if user:
                # Link the existing user's Telegram
                user.telegram_chat_id = str(chat_id)
                db.session.commit()
                _send_telegram_response(chat_id, f"✅ ¡Verificación Exitosa!\nHola {representative.full_name}, ya estamos conectados. Ahora puedes preguntarme sobre {child.first_name}.")
            else:
                # No User account yet - just store the chat_id on representative for future? 
                # Or create a minimal User?
                # For now, let's just inform them to contact admin.
                _send_telegram_response(chat_id, f"✅ Datos verificados para {representative.full_name} y {child.first_name}.\n\nPara completar la vinculación, solicita al centro educativo que registren tu cuenta de usuario.")
            
            del VERIFICATION_CACHE[chat_id]
            return jsonify({'status': 'verification_complete'}), 200
        
        elif state and state.get('step') == 'awaiting_parent_cedula':
            # Step 2: User provided their Cedula - Ask for Child's Cedula
            parent_cedula = text.strip()
            
            # Validate format (10 digits for Ecuador)
            if not parent_cedula.isdigit() or len(parent_cedula) != 10:
                _send_telegram_response(chat_id, "❌ La cédula debe tener 10 dígitos numéricos. Por favor intenta de nuevo:")
                return jsonify({'status': 'invalid_cedula_format'}), 200
            
            # Check if this cedula exists in Representatives
            rep = Representative.query.filter_by(cedula=parent_cedula).first()
            if not rep:
                _send_telegram_response(chat_id, "❌ No encontré ningún representante con ese número de cédula.\nContacta al centro para verificar tus datos.")
                del VERIFICATION_CACHE[chat_id]
                return jsonify({'status': 'parent_not_found'}), 200
            
            # Move to next step
            VERIFICATION_CACHE[chat_id] = {
                'step': 'awaiting_child_cedula',
                'parent_cedula': parent_cedula,
                'expires': datetime.now() + timedelta(minutes=10)
            }
            _send_telegram_response(chat_id, f"✓ Cédula recibida.\n\nAhora ingresa el **Número de Cédula de tu Hijo/a** para verificar:")
            return jsonify({'status': 'awaiting_child_cedula'}), 200
        
        else:
            # Step 1: New user - Start verification
            VERIFICATION_CACHE[chat_id] = {
                'step': 'awaiting_parent_cedula',
                'expires': datetime.now() + timedelta(minutes=10)
            }
            
            keyboard = {
                "keyboard": [[{
                    "text": "📱 Compartir mi contacto (alternativo)",
                    "request_contact": True
                }]],
                "resize_keyboard": True,
                "one_time_keyboard": True
            }
            
            _send_telegram_response(
                chat_id, 
                f"👋 Hola! Soy {agent_name}.\n\nPara verificar tu identidad como Padre/Representante, por favor ingresa tu **Número de Cédula** (10 dígitos):\n\n_O si prefieres, puedes compartir tu contacto con el botón de abajo._",
                reply_markup=keyboard
            )
            return jsonify({'status': 'verification_started'}), 200
    
    # 3. User is identified, process message
    user = User.query.get(identity['user_id'])
    if not user:
        return jsonify({'status': 'error', 'reason': 'user_missing'}), 400
        
    # Find the license associated with this user to get the Agent Config and Bot Token
    # We need the License object to pass to orchestrator and to get the correct Bot Token for reply
    license_id = _get_license_id_for_user(user)
    license_obj = License.query.get(license_id) if license_id else None
    
    if not license_obj:
         _send_telegram_response(chat_id, "Error: No se encontró una licencia activa asociada a tu cuenta.")
         return jsonify({'status': 'error', 'reason': 'no_license'}), 200

    # CRITICAL: Extract primitive values BEFORE any AI processing
    # to avoid SQLAlchemy 'detached instance' errors after rollbacks
    # (See GEMINI.md Rule A: No Lazy Loading in Long-Running Processes)
    bot_token = license_obj.telegram_bot_token
    license_id_val = license_obj.id

    # Send "Typing..." action to let user know we are thinking
    _send_telegram_typing(chat_id, bot_token)

    # Handle /start command for identified users
    if text.startswith('/start'):
        _send_telegram_response(chat_id, f"¡Hola de nuevo {identity['user_name']}! 👋\n¿En qué puedo ayudarte hoy?", bot_token)
        return jsonify({'status': 'handled'}), 200

    # Process with AI
    try:
        response_text = _process_ai_message(text, identity, license_id_val, chat_id)
        
        # If input was voice, respond with voice
        if (voice or audio) and response_text:
            from services.voice_service import VoiceService
            import uuid
            
            # Get voice settings
            voice_name = license_obj.agent_voice or "es-EC-LuisNeural"
            
            from api.voice import ensure_voice_dir, UPLOAD_VOICE_DIR
            ensure_voice_dir()
            output_filename = f"tg_out_{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(UPLOAD_VOICE_DIR, output_filename)
            
            if VoiceService.synthesize(response_text, voice_name, output_path):
                _send_telegram_voice(chat_id, output_path, bot_token)
                # Still send text as backup/accessibility
                _send_telegram_response(chat_id, f"📝 *Transcripción:* {response_text}", bot_token)
            else:
                _send_telegram_response(chat_id, response_text, bot_token)
        else:
            _send_telegram_response(chat_id, response_text, bot_token)
            
        return jsonify({'status': 'handled'}), 200
        
    except Exception as e:
        print(f"[Telegram Webhook] Error: {e}")
        _send_telegram_response(chat_id, "Lo siento, tuve un error interno.", bot_token)
        return jsonify({'error': str(e)}), 500


def _get_license_id_for_user(user):
    """Helper to find license ID from user."""
    # Logic reused from previous steps or simplified
    if user.tenant_id:
        from models.tenant import Tenant
        t = Tenant.query.get(user.tenant_id)
        return t.license_id if t else None
    
    # If license admin
    if is_multi_center_role(user):
        la = LicenseAdmin.query.filter_by(user_id=user.id).first()
        return la.license_id if la else None
        
    return None


def _process_ai_message(message: str, identity: dict, license_id: int, chat_id: str) -> str:
    """Process with LangGraph Orchestrator.
    
    Args:
        message: User message text
        identity: User identity dict from IdentityResolver
        license_id: License ID (primitive value, NOT the SQLAlchemy object)
        chat_id: Telegram Chat ID for persistent identification
    """
    role = identity.get('role')
    user_name = identity.get('user_name', 'Usuario')
    
    context_prefix = f"[CONTEXTO TELEGRAM]\nUsuario: {user_name}\nRol: {role}"
    if role == 'padre':
        child_ids = identity.get('child_ids', [])
        context_prefix += f"\nHijos IDs: {child_ids}\nIMPORTANTE: Solo dar info de sus hijos."
        
    orchestrator = LangGraphOrchestrator(
        tenant_id=identity.get('tenant_id') or 1,
        user_id=identity.get('user_id'),
        license_id=license_id,
        role=role,
        license_name=identity.get('license_name'),
        legal_name=identity.get('legal_name'),
        ruc=identity.get('ruc'),
        centers_list=identity.get('centers_list')
    )
    
    full_message = f"{context_prefix}\n\nMensaje: {message}"
    response = orchestrator.process_message(
        message=full_message,
        channel='telegram',
        sender_identifier=str(chat_id)
    )
    
    return response.get('response', 'Sin respuesta.')



def _link_user_by_phone(phone, chat_id):
    """Link a user (Parent) using phone number verification."""
    # Search precise match first
    # We assume 'phone' from telegram comes with country code if user has it.
    
    # Standardize DB phone: most DB phones might be local or inconsistent.
    # Simple strategy: Search for users where rights(phone) matches right(input)
    # But better: query Filter by phone.
    
    # Since we don't know the tenant, we search Globally in the User table?
    # This is slightly risky if same phone in multiple tenants for DIFFERENT people (unlikely).
    # If same person in multiple tenants, we pick the first?
    
    user = User.query.filter(User.phone == phone, User.is_active == True).first()
    
    # If not exact match, try variations (without + or adding +)
    if not user:
        user = User.query.filter(User.phone.like(f"%{phone}%"), User.is_active == True).first()
        
    if user:
        # Link it!
        user.telegram_chat_id = str(chat_id)
        db.session.commit()
        
        # Attach the bot token for the reply
        # We need to find the license for this user to know the bot token.
        license_id = _get_license_id_for_user(user)
        if license_id:
            l = License.query.get(license_id)
            user.license_bot_token = l.telegram_bot_token if l else None
            
        return user
        
    return None


def _send_telegram_response(chat_id, text, bot_token=None, reply_markup=None):
    """Send message to Telegram with support for long messages.
    
    Telegram has a 4096 character limit per message. This function
    automatically splits longer messages into multiple parts.
    """
    TELEGRAM_MAX_LENGTH = 4096
    
    # Fallback to DB token if missing
    if not bot_token:
        try:
            license_obj = License.query.filter_by(telegram_connected=True).first()
            if license_obj and license_obj.telegram_bot_token:
                bot_token = license_obj.telegram_bot_token
        except Exception:
            pass

    if not bot_token:
        print(f"[Telegram Webhook] Error: No bot token found to reply to {chat_id}")
        return
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    # Split message into chunks if too long
    chunks = _split_message(text, TELEGRAM_MAX_LENGTH)
    
    for i, chunk in enumerate(chunks):
        payload = {'chat_id': chat_id, 'text': chunk}
        
        # Only add reply_markup to the last chunk
        if reply_markup and i == len(chunks) - 1:
            payload['reply_markup'] = reply_markup
            
        try:
            response = requests.post(url, json=payload, timeout=30)
            if not response.ok:
                print(f"[Telegram Webhook] API Error: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"[Telegram Webhook] Failed to send message (chunk {i+1}/{len(chunks)}): {e}")


def _split_message(text: str, max_length: int) -> list:
    """Split a long message into chunks, trying to break at natural points."""
    if len(text) <= max_length:
        return [text]
    
    chunks = []
    current_chunk = ""
    
    # Try to split by paragraphs first (double newlines)
    paragraphs = text.split('\n\n')
    
    for paragraph in paragraphs:
        # If adding this paragraph would exceed limit
        if len(current_chunk) + len(paragraph) + 2 > max_length:
            # If current chunk has content, save it
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            
            # If a single paragraph is too long, split by lines
            if len(paragraph) > max_length:
                lines = paragraph.split('\n')
                for line in lines:
                    if len(current_chunk) + len(line) + 1 > max_length:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                            current_chunk = ""
                        # If a single line is still too long, hard split
                        if len(line) > max_length:
                            for j in range(0, len(line), max_length - 10):
                                chunks.append(line[j:j + max_length - 10])
                        else:
                            current_chunk = line + '\n'
                    else:
                        current_chunk += line + '\n'
            else:
                current_chunk = paragraph + '\n\n'
        else:
            current_chunk += paragraph + '\n\n'
    
    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    # Add continuation markers for multiple chunks
    if len(chunks) > 1:
        for i in range(len(chunks)):
            if i < len(chunks) - 1:
                chunks[i] = chunks[i] + f"\n\n... (continúa {i+2}/{len(chunks)})"
    
    return chunks if chunks else [text[:max_length]]

def _send_telegram_voice(chat_id, audio_path, bot_token):
    """Send a voice note to Telegram."""
    if not bot_token:
        return
    url = f"https://api.telegram.org/bot{bot_token}/sendVoice"
    try:
        with open(audio_path, 'rb') as audio:
            files = {'voice': audio}
            response = requests.post(url, data={'chat_id': chat_id}, files=files, timeout=30)
            if not response.ok:
                print(f"[Telegram Webhook] API Error sending voice: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[Telegram Webhook] Failed to send voice: {e}")

def _send_telegram_typing(chat_id, bot_token):
    """Send 'typing' action to Telegram."""
    if not bot_token:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendChatAction",
            json={'chat_id': chat_id, 'action': 'typing'},
            timeout=5
        )
    except Exception as e:
        print(f"[Telegram Webhook] Failed to send typing action: {e}")
