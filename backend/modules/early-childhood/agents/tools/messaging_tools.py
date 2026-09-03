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
    user = User.query.get(user_id)
    if not user or not user.role:
        return False
    # Only staff roles allowed
    allowed_roles = ['license_admin', 'center_coordinator', 'educator', 'admin', 'worker', 'super_admin']
    return user.role.name in allowed_roles


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
                
                # Resolve license_id from tenant or user (for license_admin)
                license_id = None
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
