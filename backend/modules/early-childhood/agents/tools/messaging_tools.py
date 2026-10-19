"""
Messaging Tools for AI Agent
Enable the agent to find parent contacts and send WhatsApp messages
"""
from langchain.tools import BaseTool
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Type
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
    allowed_roles = [
        'license_admin', 'center_coordinator', 'coordinator', 'educator', 'educadora',
        'admin', 'administrative', 'supervisor', 'doctor', 'nutritionist',
        'psychologist', 'social_worker', 'worker', 'super_admin'
    ]
    try:
        from services.identity_resolver import IdentityResolver
        user = IdentityResolver.get_user_or_virtual(user_id)
        if not user or not user.role:
            return False
        return user.role.name in allowed_roles
    except Exception:
        try:
            db.session.rollback()
            user = User.query.get(user_id)
            if not user or not user.role:
                return False
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


def resolve_license_scope(user_id: int, tenant_id: int = None):
    """
    Resuelve de forma estricta el paraguas de la licencia para el usuario actual:
    - Retorna: (license_id, allowed_tenant_ids, allowed_admin_user_ids)
    - Garantiza aislamiento multi-tenant estricto: NUNCA permite buscar ni contactar
      usuarios, padres ni empleados fuera de la licencia de la cuenta.
    - Excluye roles globales (super_admin).
    """
    from models.license import License, LicenseAdmin
    from models.tenant import Tenant
    from models.user import User
    from utils.role_helpers import get_license_id_for_user

    if not user_id:
        return None, [], []

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return None, [], []

    user = User.query.get(uid)
    if not user:
        return None, [], []

    license_id = get_license_id_for_user(user)
    if not license_id:
        return None, [], []

    # Centros activos bajo esta licencia específica
    tenants = Tenant.query.filter_by(license_id=license_id, is_active=True).all()
    license_tenant_ids = [t.id for t in tenants]

    # Administradores activos de esta licencia específica
    admins = LicenseAdmin.query.filter_by(license_id=license_id, is_active=True).all()
    license_admin_user_ids = [a.user_id for a in admins if a.user_id]

    # Si se especificó un tenant_id, verificar que pertenezca a los centros de la licencia
    if tenant_id:
        try:
            tid = int(tenant_id)
            if tid in license_tenant_ids:
                return str(license_id), [tid], license_admin_user_ids
        except (ValueError, TypeError):
            pass

    return str(license_id), license_tenant_ids, license_admin_user_ids


class GetParentContactInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    child_name: Optional[str] = Field(None, description="Nombre o apellido del niño o niña a buscar (ej: 'Juan Pérez')")
    tenant_id: Optional[int | str] = Field(None, description="ID del centro (se inyecta automáticamente)")
    user_id: Optional[int | str] = Field(None, description="ID del usuario actual (se inyecta automáticamente)")
    license_id: Optional[int | str] = Field(None, description="ID de la licencia (se inyecta automáticamente)")


class GetParentContactTool(BaseTool):
    """Tool to find parent contact info"""
    name: str = "get_parent_contact"
    description: str = "Find the phone number of a child's parent/representative. Input: {'child_name': 'Juan', 'tenant_id': 1}"
    args_schema: Type[BaseModel] = GetParentContactInput
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute search"""
        import logging
        from agents.tools._guard import unwrap_tool_kwargs
        kwargs = unwrap_tool_kwargs(kwargs)
        if args and isinstance(args[0], dict):
            for k, v in args[0].items():
                if k not in kwargs or kwargs[k] is None:
                    kwargs[k] = v

        logger = logging.getLogger('GetParentContactTool')
        logger.info(f"🔍 GetParentContactTool called with kwargs: {kwargs}")
        
        user_id = kwargs.get('user_id')
        logger.info(f"  user_id={user_id}")
        
        if not check_messaging_permission(user_id):
            logger.warning(f"  ❌ Permission denied for user_id={user_id}")
            return {'success': False, 'error': 'No tienes permiso para usar esta herramienta.'}

        child_name = kwargs.get('child_name') or kwargs.get('name') or kwargs.get('nino')
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
                
                # Aislamiento multi-tenant estricto: solo buscar en centros de su licencia
                lic_id, allowed_tids, _ = resolve_license_scope(user_id, tenant_id)
                if not allowed_tids:
                    return {'success': False, 'error': 'No se encontraron centros activos asociados a su licencia.'}

                # Build a flexible query: child must match ALL search parts in either first_name or last_name
                base_query = Child.query.filter(Child.status == 'activo', Child.tenant_id.in_(allowed_tids))
                
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
                    
                    loose_query = Child.query.filter(Child.status == 'activo', Child.tenant_id.in_(allowed_tids))
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


class SendWhatsAppMessageInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    phone: Optional[str] = Field(None, description="Número de teléfono numérico explícito provisto por el usuario (ej: '0991234567')")
    message: Optional[str] = Field(None, description="Contenido del mensaje de WhatsApp a enviar")
    tenant_id: Optional[int | str] = Field(None, description="ID del centro (se inyecta automáticamente)")
    user_id: Optional[int | str] = Field(None, description="ID del usuario actual (se inyecta automáticamente)")
    license_id: Optional[int | str] = Field(None, description="ID de la licencia (se inyecta automáticamente)")


class SendWhatsAppMessageTool(BaseTool):
    """Tool to send WhatsApp message"""
    name: str = "send_whatsapp_message"
    description: str = (
        "Envía un mensaje de WhatsApp ÚNICAMENTE cuando el usuario haya provisto directamente un número numérico de teléfono en su petición actual (ej: 'envía un whatsapp al 0991234567'). "
        "PROHIBIDO usar esta herramienta si el usuario menciona a una persona por su nombre (ej: 'envía a Jonnathan Peña' o 'a la educadora'). "
        "Para personas, empleados, colaboradores o administradores por su nombre, USA OBLIGATORIAMENTE 'send_message_to_staff'. "
        "Para padres de familia por el nombre del niño, USA 'send_parent_message' o 'send_broadcast_to_parents'. "
        "PROHIBIDO tomar o inferir números de teléfono de turnos anteriores del historial de chat si corresponden a otras personas."
    )
    args_schema: Type[BaseModel] = SendWhatsAppMessageInput
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute send"""
        from agents.tools._guard import unwrap_tool_kwargs
        kwargs = unwrap_tool_kwargs(kwargs)
        if args and isinstance(args[0], dict):
            for k, v in args[0].items():
                if k not in kwargs or kwargs[k] is None:
                    kwargs[k] = v

        user_id = kwargs.get('user_id')
        if not check_messaging_permission(user_id):
            return {'success': False, 'error': 'No tienes permiso para usar esta herramienta.'}
        
        phone = (
            kwargs.get('phone')
            or kwargs.get('telefono')
            or kwargs.get('phone_number')
            or kwargs.get('numero')
            or kwargs.get('to')
        )
        message = (
            kwargs.get('message')
            or kwargs.get('content')
            or kwargs.get('text')
            or kwargs.get('body')
            or kwargs.get('msg')
            or kwargs.get('mensaje')
        )
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
                
                # Resolver scope de la licencia actual
                license_id, _, _ = resolve_license_scope(user_id, tenant_id)
                if not license_id:
                    license_id = kwargs.get('license_id')
                
                if not license_id:
                    return {'success': False, 'error': 'No se pudo determinar la licencia de su organización para enviar el mensaje.'}
                
                clean_phone = re.sub(r'[^0-9]', '', str(phone))
                
                # Send via WhatsApp Microservice
                response = requests.post(
                    f"{WHATSAPP_API_URL}/lead",
                    json={
                        'companyId': license_id,
                        'phone': clean_phone,
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


class SendBroadcastToParentsInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    message_template: Optional[str] = Field(None, description="Plantilla o texto del mensaje para los padres (puede incluir {padre}, {nino}, {centro}, {sala})")
    center_name: Optional[str] = Field(None, description="Nombre del centro (opcional)")
    child_name: Optional[str] = Field(None, description="Nombre del niño o niña si es para un padre específico (opcional)")
    all_centers: Optional[bool] = Field(False, description="Si es True, envía a todos los centros de la licencia")
    tenant_id: Optional[int | str] = Field(None, description="ID del centro (se inyecta automáticamente)")
    user_id: Optional[int | str] = Field(None, description="ID del usuario actual (se inyecta automáticamente)")
    license_id: Optional[int | str] = Field(None, description="ID de la licencia (se inyecta automáticamente)")


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
    args_schema: Type[BaseModel] = SendBroadcastToParentsInput

    def _run(self, *args, **kwargs) -> dict:
        import logging
        import time
        from agents.tools._guard import graceful_tool, unwrap_tool_kwargs
        from services.lem_native_engine import LEMNativeEngine

        kwargs = unwrap_tool_kwargs(kwargs)
        if args and isinstance(args[0], dict):
            for k, v in args[0].items():
                if k not in kwargs or kwargs[k] is None:
                    kwargs[k] = v

        logger = logging.getLogger('SendBroadcastToParentsTool')
        user_id = kwargs.get('user_id')
        if not check_messaging_permission(user_id):
            return {'success': False, 'error': 'No tienes permiso para ejecutar difusiones o envíos masivos.'}

        message_template = (
            kwargs.get('message_template')
            or kwargs.get('message')
            or kwargs.get('content')
            or kwargs.get('text')
            or kwargs.get('body')
            or kwargs.get('msg')
            or kwargs.get('mensaje')
        )
        if not message_template or not str(message_template).strip():
            return {'success': False, 'error': 'El contenido o plantilla del mensaje es requerido.'}

        child_name = kwargs.get('child_name') or kwargs.get('name') or kwargs.get('nino')
        center_name = kwargs.get('center_name') or kwargs.get('centro')
        tenant_id = kwargs.get('tenant_id')
        all_centers = bool(kwargs.get('all_centers', False))

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

        # Aislamiento multi-tenant estricto: acotar centros a la licencia
        license_id, allowed_tenant_ids, _ = resolve_license_scope(user_id, tenant_id)
        if not license_id or not allowed_tenant_ids:
            return {'success': False, 'error': 'No se encontraron centros activos bajo su licencia.'}

        target_tenants = []
        if child_name:
            # Búsqueda de infante específico dentro de la licencia (coincidencia de todos los términos)
            parts = normalize_search_term(child_name)
            q = Child.query.filter(Child.status == 'activo', Child.tenant_id.in_(allowed_tenant_ids))
            for p in parts:
                term = f'%{p}%'
                q = q.filter(or_(
                    Child.first_name.ilike(term),
                    Child.last_name.ilike(term)
                ))
            target_children = q.all()
            if not target_children and len(parts) > 1:
                # Fallback laxo si no hay coincidencia estricta
                loose_conds = []
                for p in parts:
                    term = f'%{p}%'
                    loose_conds.append(Child.first_name.ilike(term))
                    loose_conds.append(Child.last_name.ilike(term))
                target_children = Child.query.filter(
                    Child.status == 'activo',
                    Child.tenant_id.in_(allowed_tenant_ids),
                    or_(*loose_conds)
                ).all()

            if not target_children:
                return {'success': False, 'error': f'No se encontró ningún niño activo en su organización con el nombre "{child_name}".'}
        else:
            # Centros bajo el paraguas de esta licencia
            if all_centers:
                target_tenants = Tenant.query.filter(Tenant.id.in_(allowed_tenant_ids), Tenant.is_active == True).all()
            elif center_name:
                target_tenants = Tenant.query.filter(Tenant.id.in_(allowed_tenant_ids), Tenant.name.ilike(f'%{center_name}%'), Tenant.is_active == True).all()
            elif tenant_id:
                t = Tenant.query.get(tenant_id)
                if t and t.id in allowed_tenant_ids:
                    target_tenants = [t]
            else:
                target_tenants = Tenant.query.filter(Tenant.id.in_(allowed_tenant_ids), Tenant.is_active == True).all()

            if not target_tenants:
                return {'success': False, 'error': f'No se encontraron centros válidos bajo su licencia que coincidan con la búsqueda.'}

            tenant_ids = [t.id for t in target_tenants]
            target_children = Child.query.filter(Child.tenant_id.in_(tenant_ids), Child.status == 'activo').all()

        if not target_children:
            return {'success': False, 'error': 'No se encontraron niños activos bajo los centros seleccionados para enviar el mensaje.'}

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


class SendMessageToStaffInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    staff_name: Optional[str] = Field(None, description="Nombre o apellido del colaborador, empleado, educadora o administrador destinatario (ej: 'Gabriela Orellana', 'Jonnathan Peña')")
    message: Optional[str] = Field(None, description="Contenido exacto del mensaje de WhatsApp que se enviará al colaborador")
    role_name: Optional[str] = Field(None, description="Rol opcional del colaborador si se envía por cargo (ej: 'educator', 'coordinator', 'nutritionist')")
    center_name: Optional[str] = Field(None, description="Nombre del centro específico para filtrar a los empleados de ese centro (ej: 'Guasmo', 'Bahía', 'Orquídeas')")
    all_staff: Optional[bool] = Field(False, description="Si es True, envía a todos los colaboradores o empleados de la organización")
    tenant_id: Optional[int | str] = Field(None, description="ID del centro (se inyecta automáticamente)")
    user_id: Optional[int | str] = Field(None, description="ID del usuario actual (se inyecta automáticamente)")
    license_id: Optional[int | str] = Field(None, description="ID de la licencia (se inyecta automáticamente)")


class SendMessageToStaffTool(BaseTool):
    """
    Permite enviar mensajes de WhatsApp o notificaciones oficiales a colaboradores
    del proyecto (educadoras, coordinadoras, auxiliares, nutricionista, administradores o todo el personal).
    Permite buscar al colaborador por nombre, rol, centro o enviar a todos los empleados.
    """
    name: str = "send_message_to_staff"
    description: str = (
        "HERRAMIENTA OBLIGATORIA para enviar WhatsApp a cualquier colaborador, empleado, educadora, coordinadora, administrador o personal del proyecto por su NOMBRE, rol, centro o a todos. "
        "Si el usuario pide enviar un mensaje a una persona o directivo (ej: 'envía un mensaje a Gabriela Orellana', 'escribe a Jonnathan...'): USA ESTA HERRAMIENTA. "
        "También sirve para difusiones a personal: a todos los empleados ('all_staff': true) o al personal de un centro ('center_name': 'Guasmo'). "
        "Busca y resuelve automáticamente el número de teléfono registrado del destinatario en la organización de forma segura y aislada. "
        "Input: {'staff_name': 'Gabriela Orellana', 'message': 'Estimada...', 'tenant_id': 1}"
    )
    args_schema: Type[BaseModel] = SendMessageToStaffInput

    def _run(self, *args, **kwargs) -> dict:
        import logging
        import time
        from agents.tools._guard import unwrap_tool_kwargs
        from models.user import User, Role
        from models.tenant import Tenant

        kwargs = unwrap_tool_kwargs(kwargs)
        if args and isinstance(args[0], dict):
            for k, v in args[0].items():
                if k not in kwargs or kwargs[k] is None:
                    kwargs[k] = v

        logger = logging.getLogger('SendMessageToStaffTool')
        logger.info(f"📨 SendMessageToStaffTool invoked with kwargs: {kwargs}")

        user_id = kwargs.get('user_id')
        if not check_messaging_permission(user_id):
            return {'success': False, 'error': 'No tienes permiso para enviar mensajes a colaboradores.'}

        raw_msg = (
            kwargs.get('message')
            or kwargs.get('content')
            or kwargs.get('text')
            or kwargs.get('body')
            or kwargs.get('msg')
            or kwargs.get('mensaje')
            or kwargs.get('message_template')
            or ''
        )
        message = str(raw_msg).strip()
        if not message:
            return {'success': False, 'error': 'El contenido del mensaje es requerido.'}

        staff_name = (
            kwargs.get('staff_name')
            or kwargs.get('name')
            or kwargs.get('recipient')
            or kwargs.get('destinatario')
            or kwargs.get('colaborador')
            or kwargs.get('user_name')
            or kwargs.get('person')
            or kwargs.get('to')
        )
        role_name = kwargs.get('role_name') or kwargs.get('role') or kwargs.get('rol')
        center_name = kwargs.get('center_name') or kwargs.get('centro')
        all_staff = bool(kwargs.get('all_staff', False))
        tenant_id = kwargs.get('tenant_id')

        # Aislamiento multi-tenant estricto: solo colaboradores bajo la licencia de esta cuenta
        license_id, allowed_tenant_ids, admin_user_ids = resolve_license_scope(user_id, tenant_id)
        if not license_id:
            return {'success': False, 'error': 'No se pudo determinar la licencia de su organización.'}

        # Excluir explícitamente rol super_admin global y usuarios virtuales
        super_role = Role.query.filter(Role.name.ilike('super_admin')).first()

        scope_filter = or_(
            User.tenant_id.in_(allowed_tenant_ids),
            User.id.in_(admin_user_ids)
        )
        q = User.query.filter(User.is_active == True, User.id > 0, scope_filter)
        if super_role:
            q = q.filter(User.role_id != super_role.id)

        # Filtrado por centro si se especificó
        if center_name:
            matching_tenants = Tenant.query.filter(
                Tenant.id.in_(allowed_tenant_ids),
                Tenant.name.ilike(f'%{center_name}%'),
                Tenant.is_active == True
            ).all()
            if matching_tenants:
                target_tenant_ids = [t.id for t in matching_tenants]
                q = q.filter(User.tenant_id.in_(target_tenant_ids))
            else:
                return {'success': False, 'error': f'No se encontró ningún centro con el nombre "{center_name}" bajo su licencia.'}

        if role_name:
            role = Role.query.filter(Role.name.ilike(f'%{role_name}%')).first()
            if role:
                q = q.filter_by(role_id=role.id)

        # Si se busca a una persona específica por su nombre
        is_single_person_search = bool(staff_name and not all_staff and not role_name and not center_name)

        if staff_name:
            parts = normalize_search_term(staff_name)
            # PASO 1: Búsqueda estricta (todas las palabras deben coincidir en first_name o last_name)
            strict_q = q
            for p in parts:
                term = f'%{p}%'
                strict_q = strict_q.filter(or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term)
                ))
            candidates = strict_q.all()

            # Fallback a búsqueda laxa solo si no hubo coincidencias y hay más de una palabra
            if not candidates and len(parts) > 1:
                loose_conds = []
                for p in parts:
                    term = f'%{p}%'
                    loose_conds.append(User.first_name.ilike(term))
                    loose_conds.append(User.last_name.ilike(term))
                candidates = q.filter(or_(*loose_conds)).all()
        else:
            candidates = q.all()

        if not candidates:
            s_name = staff_name or ""
            r_name = role_name or ""
            c_name = center_name or ""
            return {
                'success': False,
                'error': f'No se encontró ningún colaborador activo con los criterios dados (nombre: "{s_name}", rol: "{r_name}", centro: "{c_name}").'
            }

        # PASO 2: Desambiguación si se buscaba a una persona específica y hay múltiples resultados
        if is_single_person_search and len(candidates) > 1:
            options = []
            for c in candidates:
                c_tenant = Tenant.query.get(c.tenant_id) if c.tenant_id else None
                c_center = c_tenant.name if c_tenant else 'Administración Central'
                c_phone = c.whatsapp_phone or c.phone or 'Sin teléfono'
                options.append(f"{c.full_name} ({c.role.name if c.role else 'Colaborador'} - Centro: {c_center} - Tel: {c_phone})")
            return {
                'success': False,
                'error': f'Se encontraron {len(candidates)} colaboradores que coinciden con "{staff_name}". Por favor especifica cuál:',
                'options': options
            }

        # Filtrar o priorizar a los que tienen teléfono activo
        candidates_with_phone = [s for s in candidates if (s.whatsapp_phone or s.phone)]
        if candidates_with_phone:
            staff_members = candidates_with_phone
        else:
            staff_members = candidates

        sent_count = 0
        failed_count = 0
        details = []

        is_broadcast = len(staff_members) > 1
        for idx, staff in enumerate(staff_members):
            raw_phone = staff.whatsapp_phone or staff.phone
            if not raw_phone:
                failed_count += 1
                details.append({'name': staff.full_name, 'status': 'sin_telefono'})
                continue

            clean_phone = re.sub(r'[^0-9]', '', raw_phone)
            staff_tenant = Tenant.query.get(staff.tenant_id) if staff.tenant_id else None

            personalized_msg = message.replace('{nombre}', staff.full_name)
            personalized_msg = personalized_msg.replace('{colaborador}', staff.full_name)
            personalized_msg = personalized_msg.replace('{centro}', staff_tenant.name if staff_tenant else 'Centro CMCI')

            # Enviar WhatsApp
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
                details.append({'name': staff.full_name, 'phone': clean_phone, 'status': 'enviado'})
            else:
                failed_count += 1
                details.append({'name': staff.full_name, 'phone': clean_phone, 'status': 'fallido', 'error': last_err})

            # Pausa de protección anti-spam si es envío masivo (más de 1 destinatario)
            if is_broadcast and idx < len(staff_members) - 1:
                import random
                sleep_seconds = round(random.uniform(1.5, 3.5), 2)
                time.sleep(sleep_seconds)

        return {
            'success': True,
            'summary': f"Mensajería a colaboradores completada: {sent_count} enviados, {failed_count} fallidos o sin número.",
            'sent_count': sent_count,
            'failed_count': failed_count,
            'details': details
        }



