"""
Messaging Tools for AI Agent
Enable the agent to find parent contacts and send WhatsApp messages
"""
from langchain.tools import BaseTool
from models import db
from models.child import Child, Representative
from models.tenant import Tenant
from models.license import License
from models.user import User
from sqlalchemy import func, or_
import requests
import os
import re

WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')


def check_messaging_permission(user_id: int) -> bool:
    """Check if user has permission to use messaging tools"""
    if not user_id:
        return False
    try:
        from services.identity_resolver import IdentityResolver
        user = IdentityResolver.get_user_or_virtual(user_id)
        if not user or not user.role:
            return False
        # Only staff roles allowed (incluye aliases ES/EN: educator/educadora, center_coordinator/coordinator)
        allowed_roles = ['license_admin', 'center_coordinator', 'coordinator', 'educator', 'educadora', 'admin', 'worker', 'super_admin']
        return user.role.name in allowed_roles
    except Exception:
        try:
            db.session.rollback()
            user = User.query.get(user_id)
            if not user or not user.role:
                return False
            allowed_roles = ['license_admin', 'center_coordinator', 'coordinator', 'educator', 'educadora', 'admin', 'worker', 'super_admin']
            return user.role.name in allowed_roles
        except Exception:
            return False



def normalize_search_term(term: str) -> list:
    """
    Extract searchable parts from a name query.
    Handles: "Saori Peña", "Peña Centeno, Saori", "Saori", "Peña", etc.
    Returns list of individual words to search.
    """
    # Remove common punctuation and split
    cleaned = re.sub(r'[,;:\-\(\)]', ' ', term)
    parts = [p.strip() for p in cleaned.split() if len(p.strip()) >= 2]
    return parts


class GetParentContactTool(BaseTool):
    """Tool to find parent contact info"""
    name: str = "get_parent_contact"
    description: str = "Find the phone number of a child's parent/representative. Input: {'child_name': 'Juan', 'tenant_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute search"""
        import logging
        logger = logging.getLogger('GetParentContactTool')
        
        logger.info(f"🔍 GetParentContactTool called with kwargs: {kwargs}")
        
        user_id = kwargs.get('user_id')
        logger.info(f"  user_id={user_id}")
        
        if not check_messaging_permission(user_id):
            logger.warning(f"  ❌ Permission denied for user_id={user_id}")
            return {'success': False, 'error': 'No tienes permiso para usar esta herramienta.'}

        child_name = kwargs.get('child_name')
        tenant_id = kwargs.get('tenant_id')
        
        logger.info(f"  child_name='{child_name}', tenant_id={tenant_id}")
        
        if not child_name:
            return {'success': False, 'error': 'El nombre del niño es requerido.'}
            
        # Retry logic for stale connections
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Force fresh connection on retry
                if attempt > 0:
                    logger.info(f"  🔄 Retry attempt {attempt + 1}/{max_retries}")
                    try:
                        db.session.rollback()
                        db.session.remove()
                        logger.info(f"  ✅ Session reset for retry")
                    except Exception as e:
                        logger.warning(f"  ⚠️ Session reset error: {e}")

                # Normalize the search term into individual words
                search_parts = normalize_search_term(child_name)
                logger.info(f"  Normalized search_parts: {search_parts}")
                
                if not search_parts:
                    return {'success': False, 'error': 'Nombre de búsqueda inválido.'}
                
                # Build a flexible query: child must match ALL search parts in either first_name or last_name
                base_query = Child.query.filter(Child.status == 'activo')
                
                if tenant_id:
                    base_query = base_query.filter(Child.tenant_id == tenant_id)
                
                # For each search part, require it to appear in first_name OR last_name
                for part in search_parts:
                    term = f'%{part}%'
                    base_query = base_query.filter(
                        or_(
                            Child.first_name.ilike(term),
                            Child.last_name.ilike(term)
                        )
                    )
                
                logger.info(f"  Executing query...")
                matches = base_query.all()
                logger.info(f"  Found {len(matches)} matches in primary search")
                
                # If no results, try a looser search (any part matches)
                if not matches and len(search_parts) > 1:
                    logger.info(f"  Trying loose search...")
                    or_conditions = []
                    for part in search_parts:
                        term = f'%{part}%'
                        or_conditions.append(Child.first_name.ilike(term))
                        or_conditions.append(Child.last_name.ilike(term))
                    
                    loose_query = Child.query.filter(Child.status == 'activo')
                    if tenant_id:
                        loose_query = loose_query.filter(Child.tenant_id == tenant_id)
                    loose_query = loose_query.filter(or_(*or_conditions))
                    matches = loose_query.all()
                    logger.info(f"  Found {len(matches)} matches in loose search")
                
                if not matches:
                    logger.warning(f"  ❌ No matches found for '{child_name}'")
                    return {'success': False, 'error': f'No se encontró ningún niño con el nombre "{child_name}"'}
                
                if len(matches) > 1:
                    options = [f"{c.full_name} (Grupo: {c.assigned_group})" for c in matches]
                    return {
                        'success': False, 
                        'error': 'Múltiples coincidencias encontradas. Por favor sé más específico.',
                        'options': options
                    }
                    
                child = matches[0]
                
                # Find representative
                representative = Representative.query.filter_by(
                    family_id=child.family_id,
                    is_primary=True
                ).first()
                
                if not representative:
                    representative = Representative.query.filter_by(family_id=child.family_id).first()
                    
                if not representative:
                    return {'success': False, 'error': f'No se encontró representante para {child.full_name}'}
                    
                if not representative.phone:
                    return {'success': False, 'error': f'El representante {representative.full_name} no tiene número de teléfono registrado.'}
                    
                return {
                    'success': True,
                    'child_name': child.full_name,
                    'child_id': child.id,
                    'parent_name': representative.full_name,
                    'phone': representative.phone,
                    'relationship': representative.relationship
                }
                
            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(x in error_msg for x in ['gone away', 'broken pipe', 'lost connection', 'closed', 'packet sequence'])
                
                if is_connection_error and attempt < max_retries - 1:
                    logger.warning(f"  ⚠️ Connection error, will retry: {str(e)[:100]}")
                    continue
                else:
                    return {'success': False, 'error': str(e)}


class SendWhatsAppMessageTool(BaseTool):
    """Tool to send WhatsApp message"""
    name: str = "send_whatsapp_message"
    description: str = "Send a WhatsApp message to a specific phone number. Input: {'phone': '5939...', 'message': 'Hola...', 'tenant_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute send"""
        user_id = kwargs.get('user_id')
        if not check_messaging_permission(user_id):
            return {'success': False, 'error': 'No tienes permiso para usar esta herramienta.'}
        
        phone = kwargs.get('phone')
        message = kwargs.get('message')
        tenant_id = kwargs.get('tenant_id')
        
        if not all([phone, message]):
            return {'success': False, 'error': 'Teléfono y mensaje son requeridos.'}
            
        # Retry logic for stale connections
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Force fresh connection on retry
                if attempt > 0:
                    try:
                        db.session.rollback()
                        db.session.remove()
                    except Exception as e:
                        pass
                
                # Resolve license_id from kwargs, tenant or user (for license_admin)
                license_id = kwargs.get('license_id')
                if not license_id:
                    if tenant_id:
                        tenant = Tenant.query.get(tenant_id)
                        if not tenant:
                            return {'success': False, 'error': 'Centro no encontrado.'}
                        license_id = str(tenant.license_id)
                    elif user_id:
                        # License admin: resolve license directly
                        from models.license import LicenseAdmin
                        lic_admin = LicenseAdmin.query.filter_by(user_id=user_id, is_active=True).first()
                        if lic_admin:
                            license_id = str(lic_admin.license_id)
                
                if not license_id:
                    return {'success': False, 'error': 'No se pudo determinar la licencia para enviar el mensaje.'}
                
                # Send via WhatsApp Microservice
                response = requests.post(
                    f"{WHATSAPP_API_URL}/lead",
                    json={
                        'companyId': license_id,
                        'phone': phone,
                        'message': message
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    return {
                        'success': True,
                        'message': f'Mensaje enviado exitosamente a {phone}',
                        'api_response': response.json() if response.content else 'OK'
                    }
                else:
                    return {
                        'success': False, 
                        'error': f'Error al enviar mensaje: {response.text}'
                    }
                    
            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(x in error_msg for x in ['gone away', 'broken pipe', 'lost connection', 'closed', 'packet sequence'])
                
                if is_connection_error and attempt < max_retries - 1:
                    continue
                else:
                    return {'success': False, 'error': str(e)}


class SendBroadcastToParentsTool(BaseTool):
    """
    Envía mensajes personalizados y protegidos a los padres de familia
    (a nivel de centro específico, todos los centros, o niño en particular).
    Blindado con LEM-Ops Guardrails para evitar envíos duplicados o fallidos.
    """
    name: str = "send_broadcast_to_parents"
    description: str = (
        "Envía mensajes personalizados de WhatsApp a padres/representantes. "
        "Permite enviar a: un centro específico ('tenant_id': X o 'center_name': '...'), "
        "a un niño específico ('child_name': '...'), o a todos los centros ('all_centers': true). "
        "El mensaje puede usar variables dinámicas como {padre}, {nino}, {centro}, {sala}. "
        "Input: {'message_template': 'Estimado/a {padre}, le recordamos...', 'center_name': '...', 'child_name': '...', 'tenant_id': 1, 'all_centers': false}"
    )

    def _run(self, *args, **kwargs) -> dict:
        import logging
        import time
        from agents.tools._guard import graceful_tool
        from services.lem_native_engine import LEMNativeEngine

        logger = logging.getLogger('SendBroadcastToParentsTool')
        user_id = kwargs.get('user_id')
        if not check_messaging_permission(user_id):
            return {'success': False, 'error': 'No tienes permiso para ejecutar difusiones o envíos masivos.'}

        message_template = kwargs.get('message_template') or kwargs.get('message')
        if not message_template or not message_template.strip():
            return {'success': False, 'error': 'El contenido o plantilla del mensaje es requerido.'}

        # Blindaje LEM-Ops: evaluación matemática previa
        try:
            tid = kwargs.get('tenant_id')
            z = [1.0, 1.0 if tid else 0.5, 1.0 if user_id else 0.0] + [0.0] * 13
            accepted, energy = LEMNativeEngine.evaluate_state(z, schema_name="gov_action_guard_v1", engine="ops")
            if not accepted:
                logger.warning(f"⛔ Difusión rechazada por balance de energía LEM ({energy:.4f})")
                return {'success': False, 'error': f'Envío bloqueado por salvaguarda LEM (balance={energy:.2f}).'}
        except Exception as e:
            logger.debug(f"[LEM Native] bypass check on broadcast: {e}")

        # Determinación de centros objetivo
        tenant_id = kwargs.get('tenant_id')
        center_name = kwargs.get('center_name')
        child_name = kwargs.get('child_name')
        all_centers = kwargs.get('all_centers', False)

        target_tenants = []
        if child_name:
            # Búsqueda de infante específico
            parts = normalize_search_term(child_name)
            q = Child.query.filter_by(status='activo')
            if tenant_id:
                q = q.filter_by(tenant_id=tenant_id)
            conds = []
            for p in parts:
                conds.append(Child.first_name.ilike(f'%{p}%'))
                conds.append(Child.last_name.ilike(f'%{p}%'))
            if conds:
                q = q.filter(or_(*conds))
            target_children = q.all()
            if not target_children:
                return {'success': False, 'error': f'No se encontró ningún niño activo con el nombre "{child_name}".'}
        else:
            # Centros
            if all_centers:
                target_tenants = Tenant.query.all()
            elif center_name:
                target_tenants = Tenant.query.filter(Tenant.name.ilike(f'%{center_name}%')).all()
            elif tenant_id:
                t = Tenant.query.get(tenant_id)
                if t:
                    target_tenants = [t]
            else:
                return {'success': False, 'error': 'Debe especificar el centro, el niño o indicar "all_centers": true.'}

            if not target_tenants:
                return {'success': False, 'error': f'No se encontraron centros que coincidan con la búsqueda.'}

            tenant_ids = [t.id for t in target_tenants]
            target_children = Child.query.filter(Child.tenant_id.in_(tenant_ids), Child.status == 'activo').all()

        if not target_children:
            return {'success': False, 'error': 'No se encontraron niños activos para enviar el mensaje.'}

        # Envíos personalizados protegidos contra duplicados
        sent_count = 0
        failed_count = 0
        details = []
        seen_phones = set()

        for child in target_children:
            rep = Representative.query.filter_by(family_id=child.family_id, is_primary=True).first()
            if not rep:
                rep = Representative.query.filter_by(family_id=child.family_id).first()

            if not rep or not rep.phone:
                failed_count += 1
                details.append({'child': child.full_name, 'status': 'sin_telefono'})
                continue

            clean_phone = re.sub(r'[^0-9]', '', rep.phone)
            # Idempotencia: evitar duplicados en la misma corrida
            dedup_key = f"{clean_phone}_{child.id}"
            if dedup_key in seen_phones:
                continue
            seen_phones.add(dedup_key)

            # Resolver centro y licencia
            child_tenant = Tenant.query.get(child.tenant_id)
            license_id = str(child_tenant.license_id) if (child_tenant and child_tenant.license_id) else None
            if not license_id:
                license_id = str(child.tenant_id)

            # Personalización de plantilla
            personalized_msg = message_template
            personalized_msg = personalized_msg.replace('{padre}', rep.full_name)
            personalized_msg = personalized_msg.replace('{nino}', child.full_name)
            personalized_msg = personalized_msg.replace('{niño}', child.full_name)
            personalized_msg = personalized_msg.replace('{centro}', child_tenant.name if child_tenant else 'Centro CMCI')
            personalized_msg = personalized_msg.replace('{sala}', child.assigned_group or 'Atención Directa')

            # Simulación de comportamiento humano antes de enviar (presence / typing emulation)
            try:
                requests.post(
                    f"{WHATSAPP_API_URL}/presence",
                    json={'companyId': license_id, 'phone': clean_phone, 'presence': 'composing'},
                    timeout=3
                )
            except Exception:
                pass  # Fallback silencioso si el microservicio no expone presence

            # Intento de envío con reintentos
            success = False
            last_err = ""
            for attempt in range(2):
                try:
                    res = requests.post(
                        f"{WHATSAPP_API_URL}/lead",
                        json={
                            'companyId': license_id,
                            'phone': clean_phone,
                            'message': personalized_msg
                        },
                        timeout=12
                    )
                    if res.status_code == 200:
                        success = True
                        break
                    else:
                        last_err = res.text
                except Exception as ex:
                    last_err = str(ex)
                    time.sleep(1.0)

            if success:
                sent_count += 1
                details.append({'child': child.full_name, 'rep': rep.full_name, 'phone': clean_phone, 'status': 'enviado'})
            else:
                failed_count += 1
                details.append({'child': child.full_name, 'rep': rep.full_name, 'phone': clean_phone, 'status': 'fallido', 'error': last_err})

            # 🛡️ PROTECCIÓN ANTI-BAN & ANTI-SPAM (Rate Limiting Dinámico + Jitter Humano)
            # 1. Pausa humana aleatoria entre 3.0s y 7.0s entre cada mensaje enviado
            import random
            sleep_seconds = round(random.uniform(3.5, 6.8), 2)
            logger.info(f"⏳ Anti-spam pause: {sleep_seconds}s before next parent...")
            time.sleep(sleep_seconds)

            # 2. Descanso adicional tras lotes de 15 mensajes (pausa de enfriamiento de 15-25 segundos)
            if sent_count > 0 and sent_count % 15 == 0:
                batch_pause = round(random.uniform(15.0, 22.0), 2)
                logger.info(f"⏸️ Batch cooldown pause after {sent_count} messages: {batch_pause}s...")
                time.sleep(batch_pause)

        return {
            'success': True,
            'summary': f"Proceso de mensajería completado con protección anti-bloqueo: {sent_count} enviados exitosamente, {failed_count} fallidos o sin contacto.",
            'sent_count': sent_count,
            'failed_count': failed_count,
            'total_children': len(target_children),
            'details': details[:50]
        }


