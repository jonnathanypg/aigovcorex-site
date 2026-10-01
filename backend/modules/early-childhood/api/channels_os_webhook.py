"""
Channels OS Webhooks
Handles incoming messages from WhatsApp (via whatsapp-voice) and Telegram
for multi-tenant ChannelConfig-based channels.
Processes messages through AI orchestrator and sends automated responses.
"""
from flask import Blueprint, request, jsonify
import os
import logging

from models import db
from models.channel_config import ChannelConfig, ChannelConversation, ChannelMessage
from services.identity_resolver import IdentityResolver

logger = logging.getLogger(__name__)

channels_os_webhook_bp = Blueprint('channels_os_webhook', __name__, url_prefix='/webhooks/channels-os')

WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def _persist_incoming_message(channel, external_id, contact_name, contact_phone, role, content, channel_type, media_url=None, media_type=None):
    """Upsert conversación + guarda mensaje entrante. Llamar desde webhooks."""
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
        logger.error(f'Error persistiendo mensaje entrante: {e}')
        db.session.rollback()
        return None


def _send_whatsapp_response(channel, to_phone: str, message: str):
    """Send response back via WhatsApp using api-whatsapp microservice."""
    try:
        company_id = channel.session_id or f"channel-{channel.id}"
        response = requests.post(
            f"{WHATSAPP_API_URL}/lead",
            json={
                'companyId': str(company_id),
                'phone': to_phone,
                'message': message
            },
            timeout=30
        )
        if response.status_code != 200:
            logger.error(f'[Channels-OS WhatsApp] Error sending response: {response.text}')
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        logger.error(f'[Channels-OS WhatsApp] Failed to send response: {e}')
        return False


def _send_whatsapp_media(channel, to_phone: str, media_url: str, media_type: str = 'document', file_name: str = 'archivo.pdf', caption: str = ''):
    """Send media file back via WhatsApp using api-whatsapp microservice."""
    try:
        company_id = channel.session_id or f"channel-{channel.id}"
        response = requests.post(
            f"{WHATSAPP_API_URL}/lead/media",
            json={
                'companyId': str(company_id),
                'phone': to_phone,
                'mediaUrl': media_url,
                'mediaType': media_type,
                'fileName': file_name,
                'caption': caption
            },
            timeout=30
        )
        if response.status_code != 200:
            logger.error(f'[Channels-OS WhatsApp] Error sending media: {response.text}')
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        logger.error(f'[Channels-OS WhatsApp] Failed to send media: {e}')
        return False


def _send_telegram_response(channel, chat_id: str, text: str):
    """Send response via Telegram Bot API."""
    if not channel.bot_token:
        logger.error(f'[Channels-OS Telegram] No bot_token for channel {channel.id}')
        return False
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{channel.bot_token}/sendMessage",
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'Markdown'},
            timeout=30
        )
        if response.status_code != 200:
            logger.error(f'[Channels-OS Telegram] API Error: {response.status_code} - {response.text[:200]}')
        return response.status_code == 200
    except Exception as e:
        logger.error(f'[Channels-OS Telegram] Failed to send message: {e}')
        return False


def _process_program_intake(channel, conversation, program, user_message: str, contact_phone: str = None):
    """Flujo de postulación paso a paso para canales vinculados a un programa social.

    Mismo motor que el widget web (validación determinista + PostulacionAgent),
    con estado persistido en ChannelConversation.form_data_collected. Si el canal
    no tiene programa, se usa el orchestrator genérico.
    """
    import re as _re
    try:
        from agents.postulacion_agent import PostulacionAgent
        try:
            from social.api.social_programs import (
                _validate_field_value, _calculate_eligibility_score)
        except ImportError:
            from api.social_programs import (
                _validate_field_value, _calculate_eligibility_score)
        from models.social_program import ProgramBeneficiary
    except Exception as e:
        logger.error(f'[Intake] imports: {e}')
        return None

    try:
        form_def = program.form_definition
        if not form_def or not form_def.fields:
            return (f"Bienvenido/a al programa {program.name}. "
                    f"Cuénteme su situación para evaluar su postulación.")

        fields = form_def.fields or []
        collected = dict(conversation.form_data_collected or {})
        collected = {k: v for k, v in collected.items() if not str(k).startswith('_meta')}
        history = []
        try:
            recent = ChannelMessage.query.filter_by(conversation_id=conversation.id)\
                .order_by(ChannelMessage.created_at.desc()).limit(8).all()
            for m in reversed(recent):
                history.append({'role': 'user' if m.role == 'user' else 'assistant',
                                'content': m.content or ''})
        except Exception:
            pass

        def _answered(f):
            v = collected.get(f.get('id'))
            return v is not None and v != ''

        # ── Corrección ("me equivoqué / corrige mi cédula") ──
        um = (user_message or '').strip()
        uml = um.lower()
        if um and collected and _re.search(
                r'\b(corrige|corregir|correcci|me equivoqu|est[aá] mal|quiero cambiar|cambiar mi)\b', uml):
            target = None
            for f in fields:
                for key in (f.get('id') or '', f.get('label') or ''):
                    kl = str(key).lower()
                    if kl and len(kl) > 2 and kl in uml and f.get('id') in collected:
                        target = f.get('id')
                        break
                if target:
                    break
            if not target:
                answered = [fid for fid in collected.keys()
                            if any(ff.get('id') == fid for ff in fields)]
                target = answered[-1] if answered else None
            if target:
                dropped = collected.pop(target, None)
                fld = next((f for f in fields if f.get('id') == target), {})
                q = fld.get('conversational_prompt') or f"Sin problema. Indíqueme de nuevo su {fld.get('label', target)}:"
                conversation.form_data_collected = collected
                conversation.current_step = target
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                return f"Entendido, descarté _{dropped}_. {q}"

        remaining = [f for f in fields if f.get('required', True) and not _answered(f)]
        if not um:
            nxt = remaining[0] if remaining else None
            if nxt:
                return nxt.get('conversational_prompt') or f"Por favor indíqueme su {nxt.get('label')}:"
        current = remaining[0] if remaining else None

        # Tenant para el agente (cosmético: el agente solo usa LLM)
        agent_tenant = 1
        try:
            if getattr(program, 'license_id', None):
                from models.tenant import Tenant
                _t = Tenant.query.filter_by(license_id=program.license_id, is_active=True).first()
                if _t:
                    agent_tenant = _t.id
        except Exception:
            pass

        if um and current:
            ok, cleaned, hint = _validate_field_value(current, um)
            agent = PostulacionAgent(tenant_id=agent_tenant, user_id=None)
            res = agent.process_step(
                program_name=program.name, current_field=current,
                user_message=um, collected_data=collected,
                history=history, deterministic_validation=(ok, cleaned, hint))
            if not res.get('valid'):
                conversation.form_data_collected = collected
                conversation.current_step = current.get('id')
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                return res.get('response')

            collected[current.get('id')] = res.get('cleaned_value') or cleaned
            remaining = [f for f in remaining if f.get('id') != current.get('id')]

        if not remaining:
            rules = form_def.eligibility_rules or []
            score, notes = _calculate_eligibility_score(collected, rules, program.id)
            ced = (collected.get('cedula') or '').strip() if collected.get('cedula') else None
            if ced:
                dup = ProgramBeneficiary.query.filter_by(program_id=program.id, cedula=ced).first()
                if dup:
                    conversation.status = 'completed'
                    conversation.beneficiary_id = dup.id
                    conversation.form_data_collected = collected
                    try:
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
                    return (f"Buenas noticias: usted ya tiene una postulación registrada en *{program.name}* "
                            f"con el código #{dup.id} (estado: {dup.status}). No es necesario registrarla de nuevo.")
            ben = ProgramBeneficiary(
                program_id=program.id,
                full_name=collected.get('full_name') or 'Postulante WhatsApp/Telegram',
                cedula=ced, phone=collected.get('phone') or contact_phone,
                intake_channel=channel.channel_type or 'messaging',
                intake_conversation_id=str(conversation.external_id or conversation.id),
                form_data=collected,
                status='applicant' if score < 70 else 'approved',
                eligibility_score=score, eligibility_notes=notes)
            db.session.add(ben)
            db.session.commit()
            conversation.status = 'completed'
            conversation.beneficiary_id = ben.id
            conversation.form_data_collected = collected
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
            return (form_def.success_message or
                    f"✅ ¡Excelente! Su postulación al programa *{program.name}* quedó registrada "
                    f"con el código #{ben.id}.")

        nxt = remaining[0]
        q = nxt.get('conversational_prompt') or f"Por favor indíqueme su {nxt.get('label')}:"
        ack = ''
        if collected:
            last = list(collected.items())[-1]
            ack = f"Perfecto, registré _{last[1]}_. "
        conversation.form_data_collected = collected
        conversation.current_step = nxt.get('id')
        if not conversation.program_id:
            conversation.program_id = program.id
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        return f"{ack}{q}" if ack else q
    except Exception as e:
        logger.error(f'[Intake] error: {e}')
        try:
            db.session.rollback()
        except Exception:
            pass
        return None


def _process_with_ai_orchestrator(channel, conversation, user_message: str, contact_name: str = None, contact_phone: str = None):
    """Process message through LangGraph orchestrator and return AI response."""
    try:
        from agents.langgraph_orchestrator import LangGraphOrchestrator
    except Exception as e:
        from agents.simple_orchestrator import SimpleOrchestrator as LangGraphOrchestrator

    # Build context based on channel config
    agent_name = channel.agent_name or 'GovCore AI'
    agent_personality = channel.agent_personality or ''
    
    # Get license/tenant info from channel
    license_id = channel.license_id
    tenant_id = None
    if license_id:
        from models.license import License
        license_obj = License.query.get(license_id)
        if license_obj and license_obj.tenant_id:
            tenant_id = license_obj.tenant_id
    
    # Default tenant if not found
    if not tenant_id:
        from models.tenant import Tenant
        tenant = Tenant.query.first()
        tenant_id = tenant.id if tenant else 1

    # Get program info if channel is linked to a program
    program_name = None
    program = None
    if channel.program_id:
        from models.social_program import SocialProgram
        prog = SocialProgram.query.get(channel.program_id)
        if prog:
            program = prog
            program_name = prog.name

    # ── Canales vinculados a programa: intake conversacional estructurado ──
    if program is not None:
        intake_resp = _process_program_intake(
            channel=channel, conversation=conversation, program=program,
            user_message=user_message, contact_phone=contact_phone)
        if intake_resp:
            return intake_resp
        # Si el intake falla, continuar al orchestrator genérico como respaldo

    # Build system context
    context_parts = [
        f"[CONTEXTO CANAL OS]",
        f"Canal: {channel.channel_name or f'{channel.channel_type} #{channel.id}'}",
        f"Agente: {agent_name}",
    ]
    if agent_personality:
        context_parts.append(f"Personalidad: {agent_personality}")
    if program_name:
        context_parts.append(f"Programa: {program_name}")
    if contact_name:
        context_parts.append(f"Contacto: {contact_name}")
    if contact_phone:
        context_parts.append(f"Teléfono: {contact_phone}")
    
    # Add conversation history (last 10 messages)
    recent_messages = ChannelMessage.query.filter_by(conversation_id=conversation.id)\
        .order_by(ChannelMessage.created_at.desc()).limit(10).all()
    if recent_messages:
        context_parts.append("\n[HISTORIAL RECIENTE]")
        for msg in reversed(recent_messages):
            role_label = "Usuario" if msg.role == 'user' else "Asistente"
            context_parts.append(f"{role_label}: {msg.content}")

    system_context = "\n".join(context_parts)

    orchestrator = LangGraphOrchestrator(
        tenant_id=tenant_id,
        user_id=None,  # Anonymous/citizen user
        license_id=license_id or 1,
        role='public_citizen',
        license_name=channel.channel_name or 'GovCore OS',
    )

    full_message = f"{system_context}\n\nMensaje del usuario: {user_message}"
    
    response = orchestrator.process_message(
        message=full_message,
        channel=channel.channel_type,
        sender_identifier=conversation.external_id
    )

    return response.get('response', 'Lo siento, no pude procesar tu mensaje en este momento.')


@channels_os_webhook_bp.route('/whatsapp', methods=['POST'])
def receive_whatsapp_message():
    """
    Receive incoming WhatsApp messages from api-whatsapp microservice for OS channels.
    Processes through AI orchestrator and sends automated response.
    """
    db.session.rollback()

    data = request.get_json() or {}

    # Deduplication by messageId
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
            logger.info(f'[Channels-OS WhatsApp] Duplicate messageId {message_id} ignored.')
            return jsonify({'status': 'ignored', 'reason': 'duplicate_message_id'}), 200
        except Exception as e:
            db.session.rollback()
            logger.warning(f'[Channels-OS WhatsApp] Error tracking messageId: {e}')

    company_id = data.get('companyId')
    phone = data.get('from')
    message = data.get('message')
    attachment = data.get('attachment')

    if not all([company_id, phone]) or (not message and not attachment):
        return jsonify({'error': 'Datos incompletos'}), 400

    # Find channel by session_id (companyId) or fallback to channel-{id}
    channel = ChannelConfig.query.filter(
        ChannelConfig.is_active.is_(True),
        ChannelConfig.channel_type == 'whatsapp',
        db.or_(
            ChannelConfig.session_id == company_id,
            db.func.concat('channel-', ChannelConfig.id) == company_id
        )
    ).first()

    if not channel:
        logger.warning(f'[Channels-OS WhatsApp] No channel found for companyId: {company_id}')
        return jsonify({'error': 'Canal no configurado'}), 404

    # Handle Audio Messages (Transcription)
    is_voice_input = False
    if attachment and attachment.get('type') == 'audio' and attachment.get('local_path'):
        from services.voice_service import VoiceService
        try:
            transcription = VoiceService.transcribe(attachment.get('local_path'))
            if transcription:
                message = transcription
                is_voice_input = True
                logger.info(f'[Channels-OS WhatsApp] Voice Transcribed: {message}')
        except Exception as e:
            logger.error(f'[Channels-OS WhatsApp] Error transcribing voice: {e}')

    if not message and attachment:
        message = f"[Archivo enviado: {attachment.get('filename', 'documento')}]"

    # Clean phone number (remove @s.whatsapp.net suffix)
    clean_phone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')

    # Persist incoming message
    conv_id = _persist_incoming_message(
        channel=channel,
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

    # Get conversation for AI processing
    conversation = ChannelConversation.query.get(conv_id)
    if not conversation:
        return jsonify({'error': 'Conversación no encontrada'}), 500

    # Check if AI is active for this conversation
    if not conversation.is_ai_active:
        logger.info(f'[Channels-OS WhatsApp] AI paused for conversation {conv_id}, not responding')
        return jsonify({'status': 'ai_paused', 'conversation_id': conv_id, 'success': True}), 200

    # Process through AI orchestrator
    ai_response = _process_with_ai_orchestrator(
        channel=channel,
        conversation=conversation,
        user_message=message,
        contact_phone=clean_phone
    )

    # Send AI response via WhatsApp
    sent = _send_whatsapp_response(channel, phone, ai_response)

    # Persist AI response
    if sent:
        _persist_incoming_message(
            channel=channel,
            external_id=phone,
            contact_name=None,
            contact_phone=clean_phone,
            role='assistant',
            content=ai_response,
            channel_type='whatsapp',
        )
        # Update conversation
        conversation.last_message_at = db.func.now()
        conversation.messages_count = (conversation.messages_count or 0) + 1
        db.session.commit()

    return jsonify({
        'status': 'processed', 
        'conversation_id': conv_id, 
        'success': True,
        'ai_response_sent': sent,
        'ai_response': ai_response[:100] + '...' if len(ai_response) > 100 else ai_response
    }), 200


@channels_os_webhook_bp.route('/telegram', methods=['POST'])
def receive_telegram_message():
    """
    Receive incoming Telegram messages for OS channels.
    Processes through AI orchestrator and sends automated response.
    """
    db.session.rollback()

    data = request.get_json() or {}

    # Extract message info
    tg_message = data.get('message') or data.get('edited_message')
    if not tg_message:
        return jsonify({'status': 'ignored', 'reason': 'no_message'}), 200

    chat = tg_message.get('chat', {})
    chat_id = str(chat.get('id'))
    from_user = tg_message.get('from', {})
    contact_name = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}".strip() or from_user.get('username')
    message_text = tg_message.get('text') or tg_message.get('caption')

    # Find channel by existing conversation with this chat_id
    channel = None
    channels = ChannelConfig.query.filter_by(
        channel_type='telegram',
        is_active=True
    ).all()

    for ch in channels:
        if ch.bot_token:
            existing = ChannelConversation.query.filter_by(
                channel_id=ch.id, external_id=chat_id
            ).first()
            if existing:
                channel = ch
                break

    # Fallback: first active telegram channel
    if not channel:
        logger.warning(f'[Channels-OS Telegram] Could not match channel for chat_id {chat_id}, using fallback')
        channel = ChannelConfig.query.filter_by(channel_type='telegram', is_active=True).first()

    if not channel:
        return jsonify({'error': 'No hay canal Telegram configurado'}), 404

    if not message_text:
        message_text = '[Mensaje sin texto]'

    # Persist incoming message
    conv_id = _persist_incoming_message(
        channel=channel,
        external_id=chat_id,
        contact_name=contact_name,
        contact_phone=None,
        role='user',
        content=message_text,
        channel_type='telegram',
    )

    if not conv_id:
        return jsonify({'error': 'Error guardando mensaje'}), 500

    # Get conversation for AI processing
    conversation = ChannelConversation.query.get(conv_id)
    if not conversation:
        return jsonify({'error': 'Conversación no encontrada'}), 500

    # Check if AI is active
    if not conversation.is_ai_active:
        logger.info(f'[Channels-OS Telegram] AI paused for conversation {conv_id}, not responding')
        return jsonify({'status': 'ai_paused', 'conversation_id': conv_id, 'success': True}), 200

    # Process through AI orchestrator
    ai_response = _process_with_ai_orchestrator(
        channel=channel,
        conversation=conversation,
        user_message=message_text,
        contact_name=contact_name
    )

    # Send AI response via Telegram
    sent = _send_telegram_response(channel, chat_id, ai_response)

    # Persist AI response
    if sent:
        _persist_incoming_message(
            channel=channel,
            external_id=chat_id,
            contact_name=contact_name,
            contact_phone=None,
            role='assistant',
            content=ai_response,
            channel_type='telegram',
        )
        conversation.last_message_at = db.func.now()
        conversation.messages_count = (conversation.messages_count or 0) + 1
        db.session.commit()

    return jsonify({
        'status': 'processed', 
        'conversation_id': conv_id, 
        'success': True,
        'ai_response_sent': sent,
        'ai_response': ai_response[:100] + '...' if len(ai_response) > 100 else ai_response
    }), 200

# Import requests at module level for use in helper functions
import requests