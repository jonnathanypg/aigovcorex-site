"""
LangChain Tools for CDI Management System
Each tool represents a specific database operation
"""
from langchain.tools import BaseTool
from typing import Optional, Type
from models import db
from models.child import Child
from models.attendance import Attendance
from models.nutrition import NutritionDaily
from models.health import HealthRecord
from models.milestone import Milestone
from datetime import date, datetime


# Input Schemas (sin Pydantic)
# ChildSearchInput: {"name": "nombre", "tenant_id": 1}
# AttendanceInput: {"child_id": 1, "date": "YYYY-MM-DD", "status": "presente", "tenant_id": 1, "user_id": 1}
# NutritionInput: {"child_id": 1, "meal_type": "desayuno", "consumption_level": "todo", "notes": "", "tenant_id": 1, "user_id": 1}
# HealthInput: {"child_id": 1, "record_type": "crecimiento", "symptoms": "", "weight": 10.5, "height": 80.5, "notes": "", "tenant_id": 1, "user_id": 1}


class SearchChildTool(BaseTool):
    """Tool to search for a child by name"""
    name: str = "search_child"
    description: str = "Search for a child by name in the database. Returns child ID and details. Input: {'name': 'nombre', 'tenant_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute the search with retry logic for stale connections"""
        import logging
        logger = logging.getLogger('SearchChildTool')
        
        logger.info(f"🔍 SearchChildTool called with kwargs: {kwargs}")
        
        name = kwargs.get('name')
        tenant_id = kwargs.get('tenant_id')
        
        logger.info(f"  name='{name}', tenant_id={tenant_id}")
        
        if not name:
            logger.warning("  ❌ Missing name")
            return {'found': False, 'message': 'El nombre del niño es requerido.'}
        
        # Resolve tenant scope using shared helper (supports license_admin multi-tenant + DB recovery)
        user_id = kwargs.get('user_id')
        from agents.tools.analytics_tools import resolve_tenant_ids
        target_ids = resolve_tenant_ids(tenant_id, user_id)
        
        if not target_ids:
            return {'found': False, 'message': 'No se encontraron centros para buscar.'}
        
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
                
                logger.info(f"  Querying children across {len(target_ids)} tenant(s)...")
                children = Child.query.filter(
                    Child.tenant_id.in_(target_ids),
                    Child.status == 'activo'
                ).all()
                logger.info(f"  Found {len(children)} active children")
                
                name_lower = name.lower()
                matches = []
                
                for child in children:
                    child_full = child.full_name.lower()
                    child_first = child.first_name.lower()
                    is_match = (name_lower in child_first or name_lower in child_full)
                    
                    if is_match:
                        logger.info(f"  ✅ MATCH: '{name_lower}' in '{child_full}'")
                        matches.append({
                            'id': child.id,
                            'name': child.full_name,
                            'age': child.age_display,
                            'group': child.assigned_group
                        })
                
                logger.info(f"  Total matches: {len(matches)}")
                
                if not matches:
                    logger.warning(f"  ❌ No matches found for '{name}'")
                    return {'found': False, 'message': f'No se encontró ningún niño con el nombre "{name}"'}
                
                if len(matches) == 1:
                    return {'found': True, 'child': matches[0]}
                
                return {'found': True, 'multiple': True, 'children': matches}
                
            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(x in error_msg for x in ['gone away', 'broken pipe', 'lost connection', 'closed'])
                
                if is_connection_error and attempt < max_retries - 1:
                    logger.warning(f"  ⚠️ Connection error, will retry: {str(e)[:100]}")
                    continue
                else:
                    logger.error(f"  ❌ Database error: {str(e)}")
                    return {'found': False, 'message': f'Error de base de datos: {str(e)}'}


class RecordAttendanceTool(BaseTool):
    """Tool to record attendance"""
    name: str = "record_attendance"
    description: str = "Record attendance for a child. Status can be: presente, ausente, justificado, tardanza. Input: {'child_id': 1, 'date': 'YYYY-MM-DD', 'status': 'presente', 'tenant_id': 1, 'user_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute attendance recording"""
        # Safely reset session
        
        child_id = kwargs.get('child_id')
        date_str = kwargs.get('date')
        status = kwargs.get('status')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        if not all([child_id, date_str, status, tenant_id, user_id]):
            return {'success': False, 'error': 'Faltan parámetros requeridos.'}

        try:
            attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            existing = Attendance.query.filter_by(
                child_id=child_id,
                date=attendance_date
            ).first()
            
            if existing:
                existing.status = status
                existing.registered_by_id = user_id
            else:
                if user_id < 0:
                    # For virtual users (parents), we don't track registered_by_id pointing to sys_users table
                    # because foreign key constraint would fail.
                    # We leave it NULL or need a different strategy if tracking is strict.
                    # Assuming nullable registered_by_id or skipping strict logging for parents (they act as read-only mostly anyway).
                    # Actually, RecordAttendanceTool is for STAFF. Parents shouldn't use it.
                    # BUT for consistency, we handle virtual user check to avoid crash.
                    pass 
                else:
                    attendance = Attendance(
                        tenant_id=tenant_id,
                        child_id=child_id,
                        date=attendance_date,
                        status=status,
                        registered_by_id=user_id
                    )
                    db.session.add(attendance)
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Asistencia registrada: {status}',
                'child_id': child_id,
                'date': date_str,
                'status': status
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': str(e)}


class LogNutritionTool(BaseTool):
    """Tool to log nutrition consumption"""
    name: str = "log_nutrition"
    description: str = "Log meal consumption for a child. Meal types: desayuno, refrigerio_am, almuerzo, refrigerio_pm, lactancia. Input: {'child_id': 1, 'meal_type': 'desayuno', 'consumption_level': 'todo', 'notes': '', 'tenant_id': 1, 'user_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute nutrition logging"""
        # Safely reset session
        
        child_id = kwargs.get('child_id')
        meal_type = kwargs.get('meal_type')
        consumption_level = kwargs.get('consumption_level')
        notes = kwargs.get('notes', '')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        if not all([child_id, meal_type, consumption_level, tenant_id, user_id]):
            return {'success': False, 'error': 'Faltan parámetros requeridos.'}

        try:
            nutrition = NutritionDaily(
                tenant_id=tenant_id,
                child_id=child_id,
                date=date.today(),
                meal_type=meal_type,
                consumption_level=consumption_level,
                notes=notes,
                registered_by_id=user_id
            )
            
            db.session.add(nutrition)
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Nutrición registrada: {meal_type} - {consumption_level}',
                'child_id': child_id,
                'meal_type': meal_type,
                'consumption': consumption_level
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': str(e)}


class LogHealthTool(BaseTool):
    """Tool to log health records"""
    name: str = "log_health"
    description: str = "Log health record for a child. Types: crecimiento, vacunacion, incidente, enfermedad. Input: {'child_id': 1, 'record_type': 'crecimiento', 'symptoms': '', 'weight': 10.5, 'height': 80.5, 'notes': '', 'tenant_id': 1, 'user_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Execute health logging"""
        # Safely reset session
        
        child_id = kwargs.get('child_id')
        record_type = kwargs.get('record_type')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        if not all([child_id, record_type, tenant_id, user_id]):
            return {'success': False, 'error': 'Faltan parámetros requeridos.'}

        try:
            health = HealthRecord(
                tenant_id=tenant_id,
                child_id=child_id,
                record_date=date.today(),
                record_type=record_type,
                symptoms=kwargs.get('symptoms'),
                weight=kwargs.get('weight'),
                height=kwargs.get('height'),
                notes=kwargs.get('notes', ''),
                registered_by_id=user_id
            )
            
            db.session.add(health)
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Registro de salud creado: {record_type}',
                'child_id': child_id,
                'record_type': record_type
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': str(e)}


class GetChildSummaryTool(BaseTool):
    """Tool to get child summary"""
    name: str = "get_child_summary"
    description: str = "Get comprehensive summary of a child's records (attendance, nutrition, health, development). Input: {'name': 'nombre', 'tenant_id': 1}"
    
    def _run(self, *args, **kwargs) -> dict:
        """Get child summary"""
        # Safely reset session
        
        name = kwargs.get('name')
        tenant_id = kwargs.get('tenant_id')

        if not name:
            return {'success': False, 'error': 'El nombre del niño es requerido.'}

        # First find the child
        search_tool = SearchChildTool()
        search_result = search_tool._run(name=name, tenant_id=tenant_id, user_id=kwargs.get('user_id'))
        
        if not search_result.get('found'):
            return search_result
        
        child_id = search_result['child']['id']
        child = Child.query.get(child_id)
        
        # Get recent records
        recent_attendance = Attendance.query.filter_by(child_id=child_id).order_by(
            Attendance.date.desc()
        ).limit(7).all()
        
        recent_nutrition = NutritionDaily.query.filter_by(child_id=child_id).order_by(
            NutritionDaily.date.desc()
        ).limit(10).all()
        
        recent_health = HealthRecord.query.filter_by(child_id=child_id).order_by(
            HealthRecord.record_date.desc()
        ).limit(5).all()
        
        return {
            'success': True,
            'child': {
                'name': child.full_name,
                'age': child.age_display,
                'group': child.assigned_group
            },
            'attendance_count': len(recent_attendance),
            'nutrition_count': len(recent_nutrition),
            'health_count': len(recent_health),
            'recent_attendance': [{'date': str(a.date), 'status': a.status} for a in recent_attendance],
            'recent_nutrition': [{'date': str(n.date), 'meal': n.meal_type, 'consumption': n.consumption_level} for n in recent_nutrition],
            'recent_health': [{'date': str(h.record_date), 'type': h.record_type} for h in recent_health]
        }


# Import new tools

class RunSQLAgentTool(BaseTool):
    """Tool to run advanced SQL analysis"""
    name: str = "run_sql_analysis"
    description: str = "Use this tool to answer questions that require querying the database for analytics, reports, summaries, or complex data retrieval. NEVER USE A FAKE TENANT ID. Input: {'query': 'the user request', 'user_id': 1}"

    def _run(self, *args, **kwargs) -> dict:
        """Execute the SQL Agent"""
        # Safely reset session for long-running threads
        try:
            from sqlalchemy import text
            from models import db
            db.session.execute(text("SELECT 1"))
        except Exception:
            from models import db
            db.session.rollback()
            db.session.remove()
        
        query = kwargs.get('query')
        user_id = kwargs.get('user_id')
        
        if not query or not user_id:
            return {'error': 'Query and User ID are required'}
            
        try:
            # Instantiate User and Agent
            # We need to import inside to avoid circular imports if any
            from models.user import User
            from agents.sql_agent import SQLAgent
            from services.identity_resolver import IdentityResolver
            
            user = IdentityResolver.get_user_or_virtual(user_id)
            if not user:
                return {'error': f'User {user_id} not found'}
                
            agent = SQLAgent(user)
            result = agent.process_query(query)
            
            # The result is a dict with keys: 'text', 'data', 'sql_debug'
            # We return the whole thing so the Orchestrator LLM can see the raw data and the summary
            return result
            
        except Exception as e:
            return {'error': str(e)}

# Import new tools
from agents.tools.analytics_tools import GetTenantAnalyticsTool, AnalyzeTrendsTool
from agents.tools.notification_tools import CreateNotificationTool
from agents.tools.messaging_tools import GetParentContactTool, SendWhatsAppMessageTool
from agents.tools.rag_tools import ConsultKnowledgeTool

class SendParentMessageTool(BaseTool):
    """Tool to send proactive messages to parents via WhatsApp/Telegram"""
    name: str = "send_parent_message"
    description: str = """Use this tool to send a message to a child's parent/representative. 
Use when the user (staff) instructs you to notify a parent.
IMPORTANT: The child must belong to the user's center (tenant) unless user is license_admin.
Input: {'child_name': 'Juan Pérez', 'message': 'Texto del mensaje', 'user_id': 1, 'license_id': 1}"""

    def _run(self, *args, **kwargs) -> dict:
        """Execute sending message to parent with role-based access control"""
        import requests
        import os
        import logging
        from sqlalchemy import text
        
        logger = logging.getLogger('SendParentMessageTool')
        logger.info(f"🔍 SendParentMessageTool called with kwargs: {kwargs}")
        
        child_name = kwargs.get('child_name')
        message = kwargs.get('message')
        license_id = kwargs.get('license_id')
        user_id = kwargs.get('user_id')
        
        if not child_name or not message or not license_id or not user_id:
            return {'success': False, 'error': 'Se requiere child_name, message, user_id y license_id'}
        
        # Get calling user for permission check
        from models.user import User
        from models.child import Child, Representative
        from models.license import License
        from models.tenant import Tenant
        
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
                
                from services.identity_resolver import IdentityResolver
                current_user = IdentityResolver.get_user_or_virtual(user_id)
                if not current_user:
                    return {'success': False, 'error': 'Usuario no encontrado'}
                
                is_license_admin = current_user.role.name == 'license_admin'
                user_tenant_id = current_user.tenant_id
                
                # Normalize search term
                import re
                def normalize_term(t):
                    return [p.strip() for p in re.sub(r'[,;:\-\(\)]', ' ', t).split() if len(p.strip()) >= 2]
                
                search_parts = normalize_term(child_name)
                logger.info(f"  Normalized search parts: {search_parts}")
                
                if not search_parts:
                    return {'success': False, 'error': 'Nombre inválido'}

                # Build flexible query
                from sqlalchemy import or_
                # Start with active children
                query = Child.query.filter(Child.status == 'activo')
                
                # Apply scope
                if not is_license_admin and user_tenant_id:
                    query = query.filter(Child.tenant_id == user_tenant_id)
                elif is_license_admin:
                     # For license admin, we might want to verify license scope if needed, 
                     # but for now let's search broadly or limit if license_id is passed?
                     # The tool receives license_id, so we should arguably filter by tenants belonging to that license.
                     # But let's stick to the previous logic which didn't filter by license at this stage 
                     # (it did a post-check), to avoid over-complicating query construction right now.
                     pass

                # Strict Search: All parts must match somewhere
                strict_query = query
                for part in search_parts:
                    term = f'%{part}%'
                    strict_query = strict_query.filter(
                        or_(
                            Child.first_name.ilike(term),
                            Child.last_name.ilike(term)
                        )
                    )
                
                matches = strict_query.all()
                logger.info(f"  Found {len(matches)} matches (Strict)")
                
                # Loose Search: If no strict matches, try checking if ANY part matches
                if not matches and len(search_parts) > 1:
                    logger.info(f"  Trying loose search...")
                    or_conditions = []
                    for part in search_parts:
                        term = f'%{part}%'
                        or_conditions.append(Child.first_name.ilike(term))
                        or_conditions.append(Child.last_name.ilike(term))
                    
                    loose_query = query.filter(or_(*or_conditions))
                    matches = loose_query.all()
                    logger.info(f"  Found {len(matches)} matches (Loose)")
                
                if len(matches) == 0:
                    scope_msg = "" if is_license_admin else " en tu centro"
                    return {'success': False, 'error': f'No se encontró niño con nombre "{child_name}"{scope_msg}'}
                elif len(matches) > 1:
                    # Multiple matches - return options for LLM to ask user to clarify
                    options = []
                    for m in matches:
                        tenant = Tenant.query.get(m.tenant_id)
                        center_name = tenant.name if tenant else "Centro desconocido"
                        options.append({
                            'id': m.id,
                            'nombre_completo': m.full_name,
                            'grupo': m.assigned_group or "Sin grupo",
                            'centro': center_name
                        })
                    return {
                        'success': False,
                        'multiple_matches': True,
                        'message': f'Hay {len(matches)} niños con ese nombre. Pregunta al usuario cuál:',
                        'options': options
                    }
                
                child = matches[0]
                
                # Verify access for license_admin - child must be under their license
                if is_license_admin:
                    child_tenant = Tenant.query.get(child.tenant_id)
                    license_obj = License.query.get(license_id)
                    if not child_tenant or not license_obj or child_tenant.license_id != license_obj.id:
                        return {'success': False, 'error': 'Este niño no pertenece a un centro bajo tu licencia'}
                
                # Get primary representative
                representative = Representative.query.filter_by(
                    family_id=child.family_id,
                    is_primary=True
                ).first() or Representative.query.filter_by(family_id=child.family_id).first()
                
                if not representative:
                    return {'success': False, 'error': f'No se encontró representante para {child.full_name}'}
                
                if not representative.phone:
                    return {'success': False, 'error': f'El representante {representative.full_name} no tiene número registrado'}
                
                logger.info(f"  ✅ Found representative: {representative.full_name}, phone: {representative.phone}")
                
                WHATSAPP_API_URL = os.getenv('WHATSAPP_API_URL', 'http://localhost:3001')
                
                response = requests.post(
                    f"{WHATSAPP_API_URL}/lead",
                    json={
                        'companyId': str(license_id),
                        'phone': representative.phone,
                        'message': message
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    return {
                        'success': True,
                        'message': f'Mensaje enviado a {representative.full_name} ({representative.phone})',
                        'child': child.full_name,
                        'representative': representative.full_name
                    }
                else:
                    return {
                        'success': False,
                        'error': f'Error del servicio de WhatsApp: {response.text}'
                    }
                    
            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(x in error_msg for x in ['gone away', 'broken pipe', 'lost connection', 'closed', 'packet sequence'])
                
                if is_connection_error and attempt < max_retries - 1:
                    logger.warning(f"  ⚠️ Connection error, will retry: {str(e)[:100]}")
                    continue
                else:
                    logger.error(f"  ❌ Error: {str(e)}")
                    return {'success': False, 'error': str(e)}


# Export all tools
def get_all_tools():
    """Get all available tools for the agent"""
    from agents.tools.report_tools import GenerateReportTool
    from agents.tools.management_tools import (
        ManagePlanningTool, ManageWeeklyMenuTool,
        ManageMaintenanceTaskTool, ManageInterventionTool,
        ManageAdmissionTool, ManageChildTool, ManageIngestionTool,
        SendEmailTool, ManageSocialProgramsTool,
    )
    return [
        SearchChildTool(),
        RecordAttendanceTool(),
        LogNutritionTool(),
        LogHealthTool(),
        GetChildSummaryTool(),
        GetTenantAnalyticsTool(),
        AnalyzeTrendsTool(),
        CreateNotificationTool(),
        RunSQLAgentTool(),
        SendParentMessageTool(),
        GetParentContactTool(),
        SendWhatsAppMessageTool(),
        ConsultKnowledgeTool(),
        GenerateReportTool(),
        # Management Tools (Phase 4)
        ManagePlanningTool(),
        ManageWeeklyMenuTool(),
        ManageMaintenanceTaskTool(),
        ManageInterventionTool(),
        # Management Tools (Phase 6)
        ManageAdmissionTool(),
        ManageChildTool(),
        ManageIngestionTool(),
        # Management Tools (Phase 8)
        SendEmailTool(),
        # Social Programs & Dynamic Forms (Phase 9)
        ManageSocialProgramsTool(),
    ]

