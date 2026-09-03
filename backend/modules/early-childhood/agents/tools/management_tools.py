"""
Management Tools — CRUD tools for modules not yet exposed to the multi-agent system.
Covers: Planificaciones Lúdicas, Menú Semanal, Operaciones/Mantenimiento, Intervención Familiar.
"""
from langchain.tools import BaseTool
from models import db
from datetime import date, datetime
import logging

logger = logging.getLogger('ManagementTools')


def _safe_session():
    """Proactive session health-check before any DB operation."""
    try:
        from sqlalchemy import text
        db.session.execute(text("SELECT 1"))
    except Exception:
        db.session.rollback()
        db.session.remove()


def _resolve_tenants(tenant_id, user_id):
    """Re-use the shared resolver from analytics_tools."""
    from agents.tools.analytics_tools import resolve_tenant_ids
    return resolve_tenant_ids(tenant_id, user_id)


# ═══════════════════════════════════════════════════════
# 1. Planificaciones Lúdicas
# ═══════════════════════════════════════════════════════

class ManagePlanningTool(BaseTool):
    """Tool to create, list, or update Ludic Plannings (Planificaciones Lúdicas)."""
    name: str = "manage_planning"
    description: str = (
        "Manage ludic activity plannings (planificaciones lúdicas). "
        "Actions: 'list' (query existing), 'create' (new planning), 'update' (edit existing). "
        "IMPORTANT: When creating, fill ALL available fields — not just the required ones. "
        "Available fields: nombre_actividad (required), age_group (required), "
        "planning_date, tema_integrador, objetivo, week_number, month, year, "
        "ambito_vinculacion, ambito_descubrimiento, ambito_expresion, ambito_exploracion, "
        "observaciones, status (borrador/aprobado/revisado). "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'age_group': '18-24 meses'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'nombre_actividad': 'Colores', 'age_group': '18-24 meses', "
        "'tema_integrador': 'Mi Familia', 'objetivo': 'Identificar colores', "
        "'ambito_vinculacion': 'Compartir con compañeros', "
        "'ambito_descubrimiento': 'Explorar mezclas de colores', "
        "'ambito_expresion': 'Nombrar colores en voz alta', "
        "'ambito_exploracion': 'Pintar con los dedos'}\n"
        "  Update: {'action': 'update', 'planning_id': 5, 'status': 'aprobado', 'tenant_id': 1, 'user_id': 1}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.planning import LudicPlanning

            # ── LIST ──
            if action == 'list':
                query = LudicPlanning.query.filter(LudicPlanning.tenant_id.in_(target_ids))
                age_group = kwargs.get('age_group')
                status = kwargs.get('status')
                if age_group:
                    query = query.filter(LudicPlanning.age_group == age_group)
                if status:
                    query = query.filter(LudicPlanning.status == status)
                plannings = query.order_by(LudicPlanning.planning_date.desc()).limit(20).all()
                return {
                    'success': True,
                    'total': len(plannings),
                    'plannings': [
                        {
                            'id': p.id,
                            'actividad': p.nombre_actividad,
                            'grupo_etario': p.age_group,
                            'fecha': str(p.planning_date),
                            'educadora': p.educator.full_name if p.educator else 'Sin asignar',
                            'estado': p.status,
                            'tema': p.tema_integrador or '',
                        }
                        for p in plannings
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                nombre = kwargs.get('nombre_actividad')
                age_group = kwargs.get('age_group')
                if not nombre or not age_group:
                    return {'success': False, 'error': 'Se requiere nombre_actividad y age_group.'}

                planning = LudicPlanning(
                    tenant_id=target_ids[0],
                    educator_id=user_id if user_id and user_id > 0 else None,
                    planning_date=datetime.strptime(kwargs.get('planning_date', date.today().isoformat()), '%Y-%m-%d').date(),
                    age_group=age_group,
                    week_number=kwargs.get('week_number'),
                    month=kwargs.get('month'),
                    year=kwargs.get('year', date.today().year),
                    tema_integrador=kwargs.get('tema_integrador'),
                    nombre_actividad=nombre,
                    objetivo=kwargs.get('objetivo'),
                    ambito_vinculacion=kwargs.get('ambito_vinculacion'),
                    ambito_descubrimiento=kwargs.get('ambito_descubrimiento'),
                    ambito_expresion=kwargs.get('ambito_expresion'),
                    ambito_exploracion=kwargs.get('ambito_exploracion'),
                    observaciones=kwargs.get('observaciones'),
                    status=kwargs.get('status', 'borrador'),
                )
                db.session.add(planning)
                db.session.commit()
                return {
                    'success': True,
                    'message': f'Planificación "{nombre}" creada exitosamente (estado: borrador).',
                    'id': planning.id,
                }

            # ── UPDATE ──
            elif action == 'update':
                planning_id = kwargs.get('planning_id')
                if not planning_id:
                    return {'success': False, 'error': 'Se requiere planning_id para actualizar.'}
                planning = LudicPlanning.query.get(int(planning_id))
                if not planning or planning.tenant_id not in target_ids:
                    return {'success': False, 'error': 'Planificación no encontrada o sin acceso.'}
                updatable = [
                    'nombre_actividad', 'age_group', 'tema_integrador', 'objetivo',
                    'ambito_vinculacion', 'ambito_descubrimiento', 'ambito_expresion',
                    'ambito_exploracion', 'observaciones', 'status', 'week_number', 'month', 'year',
                ]
                for field in updatable:
                    if field in kwargs and kwargs[field] is not None:
                        setattr(planning, field, kwargs[field])
                db.session.commit()
                return {'success': True, 'message': f'Planificación #{planning_id} actualizada.'}

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManagePlanningTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 2. Menú Semanal
# ═══════════════════════════════════════════════════════

class ManageWeeklyMenuTool(BaseTool):
    """Tool to query or create weekly menus (Menú Semanal)."""
    name: str = "manage_weekly_menu"
    description: str = (
        "Manage weekly nutritional menus for the center. "
        "Actions: 'list' (query current week or specific week), 'create' (add a menu entry). "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'week_start_date': '2026-02-23'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'week_start_date': '2026-02-23', 'day_name': 'Lunes', "
        "'meal_type': 'almuerzo', 'description': 'Arroz con pollo', "
        "'ingredients': 'arroz, pollo, zanahoria'}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.nutrition import Menu

            # ── LIST ──
            if action == 'list':
                query = Menu.query.filter(Menu.tenant_id.in_(target_ids))
                week = kwargs.get('week_start_date')
                if week:
                    query = query.filter(Menu.week_start_date == datetime.strptime(week, '%Y-%m-%d').date())
                else:
                    # Default: current week (Monday)
                    today = date.today()
                    monday = today - __import__('datetime').timedelta(days=today.weekday())
                    query = query.filter(Menu.week_start_date == monday)

                menus = query.order_by(Menu.day_name, Menu.meal_type).all()
                if not menus:
                    return {'success': True, 'total': 0, 'message': 'No hay menú registrado para esta semana.', 'menus': []}

                return {
                    'success': True,
                    'total': len(menus),
                    'menus': [
                        {
                            'dia': m.day_name,
                            'tipo_comida': m.meal_type,
                            'descripcion': m.description,
                            'ingredientes': m.ingredients,
                        }
                        for m in menus
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                day_name = kwargs.get('day_name')
                meal_type = kwargs.get('meal_type')
                description = kwargs.get('description')
                week_start = kwargs.get('week_start_date')
                if not all([day_name, meal_type, description, week_start]):
                    return {'success': False, 'error': 'Se requiere day_name, meal_type, description y week_start_date.'}

                # Resolve license_id for menu
                license_id = kwargs.get('license_id')
                if not license_id and user_id:
                    from models.user import User
                    from models.license import LicenseAdmin
                    user = User.query.get(int(user_id))
                    if user and user.role.name == 'license_admin':
                        la = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
                        if la:
                            license_id = la.license_id

                menu = Menu(
                    tenant_id=target_ids[0],
                    license_id=license_id,
                    week_start_date=datetime.strptime(week_start, '%Y-%m-%d').date(),
                    day_name=day_name,
                    meal_type=meal_type,
                    description=description,
                    ingredients=kwargs.get('ingredients'),
                    created_by_id=user_id if user_id and user_id > 0 else None,
                )
                db.session.add(menu)
                db.session.commit()
                return {'success': True, 'message': f'Menú {day_name} - {meal_type} creado exitosamente.'}

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageWeeklyMenuTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 3. Operaciones / Mantenimiento
# ═══════════════════════════════════════════════════════

class ManageMaintenanceTaskTool(BaseTool):
    """Tool to create, list, or update maintenance tasks (Tareas de Mantenimiento)."""
    name: str = "manage_maintenance_task"
    description: str = (
        "Manage maintenance/operations tasks for the center. "
        "Actions: 'list' (query tasks), 'create' (new task), 'update' (change status). "
        "Priority: Baja, Media, Alta, Critica. Status: Pendiente, En Progreso, Completado. "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'status': 'Pendiente'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'description': 'Reparar columpio', 'center_area': 'Área de Juegos', "
        "'priority': 'Alta', 'date_due': '2026-03-01'}\n"
        "  Update: {'action': 'update', 'task_id': 3, 'status': 'Completado', 'tenant_id': 1, 'user_id': 1}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.operation import MaintenanceTask

            # ── LIST ──
            if action == 'list':
                query = MaintenanceTask.query.filter(MaintenanceTask.tenant_id.in_(target_ids))
                status = kwargs.get('status')
                priority = kwargs.get('priority')
                if status:
                    query = query.filter(MaintenanceTask.status == status)
                if priority:
                    query = query.filter(MaintenanceTask.priority == priority)
                tasks = query.order_by(MaintenanceTask.date_created.desc()).limit(20).all()
                return {
                    'success': True,
                    'total': len(tasks),
                    'tareas': [
                        {
                            'id': t.id,
                            'descripcion': t.description,
                            'area': t.center_area or '',
                            'prioridad': t.priority,
                            'estado': t.status,
                            'fecha_creacion': str(t.date_created) if t.date_created else '',
                            'fecha_limite': str(t.date_due) if t.date_due else 'Sin fecha',
                            'asignado_a': t.assigned_to.full_name if t.assigned_to else 'Sin asignar',
                        }
                        for t in tasks
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                desc = kwargs.get('description')
                if not desc:
                    return {'success': False, 'error': 'Se requiere description para crear una tarea.'}

                task = MaintenanceTask(
                    tenant_id=target_ids[0],
                    description=desc,
                    center_area=kwargs.get('center_area'),
                    notes=kwargs.get('notes'),
                    priority=kwargs.get('priority', 'Media'),
                    status='Pendiente',
                    date_due=datetime.strptime(kwargs['date_due'], '%Y-%m-%d').date() if kwargs.get('date_due') else None,
                    assigned_to_id=kwargs.get('assigned_to_id'),
                )
                db.session.add(task)
                db.session.commit()
                return {'success': True, 'message': f'Tarea de mantenimiento creada: "{desc}" (Prioridad: {task.priority}).', 'id': task.id}

            # ── UPDATE ──
            elif action == 'update':
                task_id = kwargs.get('task_id')
                if not task_id:
                    return {'success': False, 'error': 'Se requiere task_id para actualizar.'}
                task = MaintenanceTask.query.get(int(task_id))
                if not task or task.tenant_id not in target_ids:
                    return {'success': False, 'error': 'Tarea no encontrada o sin acceso.'}
                for field in ['status', 'priority', 'notes', 'description', 'center_area']:
                    if field in kwargs and kwargs[field] is not None:
                        setattr(task, field, kwargs[field])
                if kwargs.get('date_due'):
                    task.date_due = datetime.strptime(kwargs['date_due'], '%Y-%m-%d').date()
                db.session.commit()
                return {'success': True, 'message': f'Tarea #{task_id} actualizada.'}

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageMaintenanceTaskTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 4. Intervención Familiar
# ═══════════════════════════════════════════════════════

class ManageInterventionTool(BaseTool):
    """Tool to create or list family interventions (Intervenciones Familiares)."""
    name: str = "manage_intervention"
    description: str = (
        "Manage family interventions (Intervenciones Familiares). "
        "Actions: 'list' (query interventions), 'create' (register a new intervention). "
        "Types: Visita, Entrevista, Llamada. Status: programada, realizada, cancelada. "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'status': 'programada'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'family_id': 5, 'type': 'Visita', 'reason': 'Seguimiento académico', "
        "'notes': 'Reunión con la madre', 'interviewee_name': 'María López', "
        "'interviewee_relationship': 'madre'}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.intervention import FamilyIntervention

            # ── LIST ──
            if action == 'list':
                query = FamilyIntervention.query.filter(FamilyIntervention.tenant_id.in_(target_ids))
                status = kwargs.get('status')
                if status:
                    query = query.filter(FamilyIntervention.status == status)
                interventions = query.order_by(FamilyIntervention.date.desc()).limit(20).all()
                return {
                    'success': True,
                    'total': len(interventions),
                    'intervenciones': [
                        {
                            'id': i.id,
                            'familia': i.to_dict().get('family_name', ''),
                            'tipo': i.type,
                            'motivo': i.reason or '',
                            'fecha': str(i.date),
                            'estado': i.status,
                            'profesional': i.professional.full_name if i.professional else 'Sin asignar',
                            'entrevistado': i.interviewee_name or '',
                        }
                        for i in interventions
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                int_type = kwargs.get('type')
                family_id = kwargs.get('family_id')
                if not int_type:
                    return {'success': False, 'error': 'Se requiere type (Visita, Entrevista, Llamada).'}
                if not family_id:
                    return {'success': False, 'error': 'Se requiere family_id. Usa run_sql_analysis para buscar la familia primero.'}

                intervention = FamilyIntervention(
                    tenant_id=target_ids[0],
                    family_id=int(family_id),
                    date=datetime.strptime(kwargs.get('date', date.today().isoformat()), '%Y-%m-%d').date(),
                    type=int_type,
                    reason=kwargs.get('reason'),
                    notes=kwargs.get('notes'),
                    professional_id=user_id if user_id and user_id > 0 else None,
                    status=kwargs.get('status', 'programada'),
                    interviewee_name=kwargs.get('interviewee_name'),
                    interviewee_relationship=kwargs.get('interviewee_relationship'),
                )
                db.session.add(intervention)
                db.session.commit()
                return {'success': True, 'message': f'Intervención familiar ({int_type}) registrada exitosamente.', 'id': intervention.id}

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageInterventionTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 5. Admisiones (Postulaciones)
# ═══════════════════════════════════════════════════════

class ManageAdmissionTool(BaseTool):
    """Tool to create or list admission applications (Postulaciones)."""
    name: str = "manage_admission"
    description: str = (
        "Manage admission applications (postulaciones/solicitudes de admisión). "
        "Actions: 'list' (query applications), 'create' (new application with child + family + representative). "
        "When CREATING, the child is set to 'lista_espera' and the application to 'pending'. "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'status': 'pending'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'child_first_name': 'Ana', 'child_last_name': 'López', "
        "'child_birth_date': '2023-05-15', 'child_gender': 'femenino', "
        "'rep_first_name': 'María', 'rep_last_name': 'López', "
        "'rep_cedula': '0912345678', 'rep_phone': '0991234567', "
        "'rep_relationship': 'madre', "
        "'family_address': 'Av. Principal 123', 'family_city': 'Guayaquil', "
        "'priority': 'normal', 'notes': 'Referida por MIES'}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.application import Application
            from models.child import Child, Family, Representative

            # ── LIST ──
            if action == 'list':
                query = Application.query.filter(Application.tenant_id.in_(target_ids))
                status = kwargs.get('status')
                if status:
                    query = query.filter(Application.status == status)
                apps = query.order_by(Application.created_at.desc()).limit(20).all()
                return {
                    'success': True,
                    'total': len(apps),
                    'postulaciones': [
                        {
                            'id': a.id,
                            'nino': a.child.full_name if a.child else 'N/A',
                            'estado': a.status,
                            'prioridad': a.priority or 'normal',
                            'fecha': str(a.created_at.date()) if a.created_at else '',
                            'notas': a.notes or '',
                        }
                        for a in apps
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                child_fn = kwargs.get('child_first_name')
                child_ln = kwargs.get('child_last_name')
                child_bd = kwargs.get('child_birth_date')
                if not all([child_fn, child_ln, child_bd]):
                    return {'success': False, 'error': 'Se requiere child_first_name, child_last_name y child_birth_date.'}

                tid = target_ids[0]

                # Atomic: Family -> Representative -> Child -> Application
                # 1. Family
                family = Family(
                    tenant_id=tid,
                    address=kwargs.get('family_address'),
                    city=kwargs.get('family_city'),
                    province=kwargs.get('family_province'),
                    sector=kwargs.get('family_sector'),
                    neighborhood=kwargs.get('family_neighborhood'),
                    phone_primary=kwargs.get('rep_phone'),
                    emergency_contact_name=kwargs.get('emergency_contact_name'),
                    emergency_contact_phone=kwargs.get('emergency_contact_phone'),
                    emergency_contact_relationship=kwargs.get('emergency_contact_relationship'),
                )
                db.session.add(family)
                db.session.flush()

                # 2. Representative
                rep = Representative(
                    family_id=family.id,
                    first_name=kwargs.get('rep_first_name', ''),
                    last_name=kwargs.get('rep_last_name', ''),
                    cedula=kwargs.get('rep_cedula'),
                    relationship=kwargs.get('rep_relationship', 'otro'),
                    phone=kwargs.get('rep_phone'),
                    email=kwargs.get('rep_email'),
                    occupation=kwargs.get('rep_occupation'),
                    nationality=kwargs.get('rep_nationality', 'Ecuatoriana'),
                    is_primary=True,
                )
                db.session.add(rep)
                db.session.flush()

                # 3. Child (lista_espera)
                child = Child(
                    tenant_id=tid,
                    family_id=family.id,
                    first_name=child_fn,
                    last_name=child_ln,
                    birth_date=datetime.strptime(child_bd, '%Y-%m-%d').date(),
                    gender=kwargs.get('child_gender', 'masculino'),
                    cedula=kwargs.get('child_cedula'),
                    blood_type=kwargs.get('child_blood_type'),
                    allergies=kwargs.get('child_allergies'),
                    medical_conditions=kwargs.get('child_medical_conditions'),
                    special_needs=kwargs.get('child_special_needs'),
                    assigned_group=kwargs.get('child_assigned_group'),
                    status='lista_espera',
                )
                db.session.add(child)
                db.session.flush()

                # 4. Application (pending)
                application = Application(
                    center_id=tid,
                    tenant_id=tid,
                    child_id=child.id,
                    status='pending',
                    priority=kwargs.get('priority', 'normal'),
                    notes=kwargs.get('notes'),
                )
                db.session.add(application)
                db.session.commit()

                return {
                    'success': True,
                    'message': f'Postulación creada para {child_fn} {child_ln}. Estado: pendiente, Niño: lista de espera.',
                    'application_id': application.id,
                    'child_id': child.id,
                }

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageAdmissionTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 6. Registro Directo de Niños (sin pasar por admisión)
# ═══════════════════════════════════════════════════════

class ManageChildTool(BaseTool):
    """Tool to register children directly (without admission process)."""
    name: str = "manage_child"
    description: str = (
        "Register a child directly (Registro Directo) — skips admissions. "
        "Child status is 'activo' immediately. "
        "Actions: 'create' (new child + family + representative), 'list' (query children). "
        "Input examples:\n"
        "  List:   {'action': 'list', 'tenant_id': 1, 'user_id': 1, 'status': 'activo'}\n"
        "  Create: {'action': 'create', 'tenant_id': 1, 'user_id': 1, "
        "'first_name': 'Carlos', 'last_name': 'Pérez', "
        "'birth_date': '2023-03-10', 'gender': 'masculino', "
        "'assigned_group': 'Sala 1', "
        "'rep_first_name': 'Pedro', 'rep_last_name': 'Pérez', "
        "'rep_phone': '0991234567', 'rep_relationship': 'padre', "
        "'family_address': 'Calle 5 y 10', 'family_city': 'Quito'}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from models.child import Child, Family, Representative

            # ── LIST ──
            if action == 'list':
                query = Child.query.filter(Child.tenant_id.in_(target_ids))
                status = kwargs.get('status', 'activo')
                if status and status != 'all':
                    query = query.filter(Child.status == status)
                search = kwargs.get('search')
                if search:
                    from sqlalchemy import or_
                    query = query.filter(or_(
                        Child.first_name.ilike(f'%{search}%'),
                        Child.last_name.ilike(f'%{search}%')
                    ))
                children = query.order_by(Child.last_name).limit(30).all()
                return {
                    'success': True,
                    'total': len(children),
                    'ninos': [
                        {
                            'id': c.id,
                            'nombre': c.full_name,
                            'grupo': c.assigned_group or '',
                            'estado': c.status,
                            'fecha_nacimiento': str(c.birth_date) if c.birth_date else '',
                        }
                        for c in children
                    ],
                }

            # ── CREATE ──
            elif action == 'create':
                fn = kwargs.get('first_name')
                ln = kwargs.get('last_name')
                bd = kwargs.get('birth_date')
                if not all([fn, ln, bd]):
                    return {'success': False, 'error': 'Se requiere first_name, last_name y birth_date.'}

                tid = target_ids[0]

                # 1. Family (or link to existing)
                family_id = kwargs.get('family_id')
                if not family_id:
                    family = Family(
                        tenant_id=tid,
                        address=kwargs.get('family_address'),
                        city=kwargs.get('family_city'),
                        province=kwargs.get('family_province'),
                        sector=kwargs.get('family_sector'),
                        neighborhood=kwargs.get('family_neighborhood'),
                        phone_primary=kwargs.get('rep_phone') or kwargs.get('family_phone_primary'),
                        emergency_contact_name=kwargs.get('emergency_contact_name'),
                        emergency_contact_phone=kwargs.get('emergency_contact_phone'),
                        emergency_contact_relationship=kwargs.get('emergency_contact_relationship'),
                    )
                    db.session.add(family)
                    db.session.flush()
                    family_id = family.id

                    # 2. Representative
                    rep_fn = kwargs.get('rep_first_name')
                    rep_ln = kwargs.get('rep_last_name')
                    if rep_fn and rep_ln:
                        rep = Representative(
                            family_id=family_id,
                            first_name=rep_fn,
                            last_name=rep_ln,
                            cedula=kwargs.get('rep_cedula'),
                            relationship=kwargs.get('rep_relationship', 'otro'),
                            phone=kwargs.get('rep_phone'),
                            email=kwargs.get('rep_email'),
                            occupation=kwargs.get('rep_occupation'),
                            nationality=kwargs.get('rep_nationality', 'Ecuatoriana'),
                            is_primary=True,
                        )
                        db.session.add(rep)
                        db.session.flush()

                # 3. Child (activo)
                child = Child(
                    tenant_id=tid,
                    family_id=family_id,
                    first_name=fn,
                    last_name=ln,
                    birth_date=datetime.strptime(bd, '%Y-%m-%d').date(),
                    gender=kwargs.get('gender', 'masculino'),
                    enrollment_date=date.today(),
                    cedula=kwargs.get('cedula'),
                    blood_type=kwargs.get('blood_type'),
                    allergies=kwargs.get('allergies'),
                    medical_conditions=kwargs.get('medical_conditions'),
                    special_needs=kwargs.get('special_needs'),
                    assigned_group=kwargs.get('assigned_group'),
                    status='activo',
                )
                db.session.add(child)
                db.session.commit()

                return {
                    'success': True,
                    'message': f'Niño/a {fn} {ln} registrado exitosamente con estado ACTIVO.',
                    'child_id': child.id,
                }

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageChildTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 7. Carga Masiva (Ingestion / CSV Templates)
# ═══════════════════════════════════════════════════════

class ManageIngestionTool(BaseTool):
    """Tool to share CSV templates and process bulk data uploads."""
    name: str = "manage_ingestion"
    description: str = (
        "Handle bulk data loading (Carga Masiva) and CSV templates. "
        "Actions:\n"
        "  'get_template' — Returns a download link for a CSV template. "
        "entity must be one of: usuarios, ninos, asistencia, nutricion, hitos, menu_semanal, salud.\n"
        "  'list_entities' — Lists all available entities for bulk import.\n"
        "  'process_csv' — Processes a CSV file (from attachment_path). "
        "Input examples:\n"
        "  {'action': 'get_template', 'entity': 'ninos', 'tenant_id': 1, 'user_id': 1}\n"
        "  {'action': 'list_entities', 'tenant_id': 1, 'user_id': 1}\n"
        "  {'action': 'process_csv', 'entity': 'ninos', 'attachment_path': '/tmp/upload_123.csv', 'tenant_id': 1, 'user_id': 1}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list_entities')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        target_ids = _resolve_tenants(tenant_id, user_id)
        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros accesibles.'}

        try:
            from services.ingestion_service import (
                generate_csv_template,
                process_csv_upload,
                get_available_entities,
                ENTITY_DEFINITIONS,
            )
            from models.user import User
            import os

            # Resolve user for role check
            user = User.query.get(int(user_id)) if user_id and int(user_id) > 0 else None
            role_name = user.role.name if user and user.role else 'viewer'

            # ── LIST ENTITIES ──
            if action == 'list_entities':
                entities = get_available_entities(role_name)
                return {
                    'success': True,
                    'entities': entities,
                    'message': 'Estas son las entidades disponibles para carga masiva. Pide una plantilla con get_template.',
                }

            # ── GET TEMPLATE ──
            elif action == 'get_template':
                entity = kwargs.get('entity')
                if not entity or entity not in ENTITY_DEFINITIONS:
                    available = list(ENTITY_DEFINITIONS.keys())
                    return {'success': False, 'error': f'Entidad inválida. Opciones: {available}'}

                csv_content, filename = generate_csv_template(entity)
                if not csv_content:
                    return {'success': False, 'error': f'No se pudo generar plantilla para: {entity}'}

                # Save to tmp and return download link
                tmp_dir = '/tmp/kindicore_templates'
                os.makedirs(tmp_dir, exist_ok=True)
                filepath = os.path.join(tmp_dir, filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(csv_content)

                # Return the API download path
                backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
                download_link = f"{backend_url}/ingestion/template/{entity}"

                return {
                    'success': True,
                    'message': f'Plantilla CSV para "{ENTITY_DEFINITIONS[entity]["label"]}" generada.',
                    'download_link': download_link,
                    'filename': filename,
                    'instructions': (
                        f'Descarga la plantilla desde: {download_link}\n'
                        'Llena los campos marcados con * (obligatorios) y sube el archivo '
                        'desde la sección "Carga Masiva" en la plataforma web, o envíalo aquí.'
                    ),
                }

            # ── PROCESS CSV ──
            elif action == 'process_csv':
                entity = kwargs.get('entity')
                attachment_path = kwargs.get('attachment_path')

                if not entity or entity not in ENTITY_DEFINITIONS:
                    available = list(ENTITY_DEFINITIONS.keys())
                    return {'success': False, 'error': f'Entidad inválida. Opciones: {available}'}

                if not attachment_path:
                    return {
                        'success': False,
                        'error': 'Se necesita un archivo CSV. Pide al usuario que envíe el archivo por el chat o que suba el archivo desde la plataforma web.',
                    }

                if not os.path.exists(attachment_path):
                    return {'success': False, 'error': f'Archivo no encontrado: {attachment_path}'}

                # Process the CSV
                with open(attachment_path, 'r', encoding='utf-8') as f:
                    result = process_csv_upload(entity, f, user, target_ids[0])

                return {
                    'success': True,
                    'message': f'Carga masiva completada para "{ENTITY_DEFINITIONS[entity]["label"]}".',
                    'resultado': {
                        'registros_exitosos': result.get('success', 0),
                        'errores': result.get('errors', []),
                        'total_filas': result.get('total_rows', 0),
                    },
                }

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageIngestionTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 8. Envío de Correos (SendEmailTool)
# ═══════════════════════════════════════════════════════

class SendEmailTool(BaseTool):
    """Tool to send emails using the organization's SMTP credentials, auto-resolving recipient emails."""
    name: str = "send_email"
    description: str = (
        "Send an email using the organization's SMTP server. "
        "The tool auto-resolves email addresses from the database. "
        "Actions: 'send_to_user' (by target_user_id or target_user_name), "
        "'send_to_parent' (by child_id, sends to primary rep), "
        "'send_to_email' (direct to_email address). "
        "CRITICAL INSTRUCTIONS FOR AI LOGIC: "
        "1. NEVER ask the user for confirmation before sending the email. "
        "2. If the user doesn't provide a subject/body, INVENT ONE based on the context. "
        "3. NEVER ask for tenant_id or user_id (they are auto-injected). "
        "4. If the user says 'envía un correo a X', EXECUTE THIS TOOL IMMEDIATELY without questions. "
        "5. If you are writing to someone in multiple possible centers (e.g. as an admin), write the placeholder '{centro}' in the body. The backend will automatically replace '{centro}' with their actual center's name.\n"
        "Input examples:\n"
        "  Send to user: {'action': 'send_to_user', 'target_user_name': 'María López', 'subject': 'Info', 'body': 'Bienvenido a {centro}...'}\n"
        "  Send to parent: {'action': 'send_to_parent', 'child_id': 10, 'subject': 'Informe', 'body': '...'}\n"
        "  Send to email: {'action': 'send_to_email', 'to_email': 'juan@mail.com', 'subject': 'Asunto', 'body': '...'}\n"
    )

    def _run(self, **kwargs) -> dict:
        try:
            _safe_session()
            from services.email_service import EmailService
            from models.user import User
            from models.child import Child, Representative

            action = kwargs.get('action', 'send_to_email')
            user_id = kwargs.get('user_id')
            tenant_id = kwargs.get('tenant_id')
            subject = kwargs.get('subject', 'Notificación KindiCore AI')
            body = kwargs.get('body', '')

            if not user_id:
                return {'success': False, 'error': 'Se requiere user_id en el contexto'}
            
            user = User.query.get(user_id)
            if not user:
                return {'success': False, 'error': 'Usuario iniciador no encontrado'}

            license_id = None
            target_ids = []

            # Auto-resolve tenant_id / license_id
            if user.role and user.role.name == 'license_admin':
                from utils.role_helpers import get_license_id_for_user
                license_id = get_license_id_for_user(user)
                # Target all centers under this admin's license if no tenant provided
                from models.tenant import Tenant
                tenants = Tenant.query.filter_by(license_id=license_id, is_active=True).all()
                target_ids = [t.id for t in tenants]
                if tenant_id:
                    # Filter down to the requested one
                    target_ids = [t for t in target_ids if t == int(tenant_id)]
            else:
                # If tenant_id not provided by AI, fallback to user's native center
                if not tenant_id and user.tenant_id:
                    tenant_id = user.tenant_id
                target_ids = _resolve_tenants(tenant_id, user_id)
                if not target_ids:
                    return {'success': False, 'error': 'Sin acceso a los centros'}
                license_id = EmailService._get_license_id_from_tenant(target_ids[0])

            if not license_id:
                return {'success': False, 'error': 'No se encontró la licencia de la organización'}

            if not subject or not body:
                return {'success': False, 'error': 'Se requiere subject y body'}

            # Check SMTP is configured
            config = EmailService._get_smtp_config(license_id)
            if not config:
                return {'success': False, 'error': 'El correo SMTP no está configurado para esta organización. El administrador debe configurarlo en Ajustes > Organización.'}

            html = EmailService.template_generic(subject, body)

            # ── SEND TO USER ──
            if action == 'send_to_user':
                target_user_id = kwargs.get('target_user_id')
                target_user_name = kwargs.get('target_user_name')

                if target_user_id:
                    target = User.query.get(target_user_id)
                elif target_user_name:
                    # Fuzzy search by name
                    parts = target_user_name.strip().split()
                    query = User.query.filter(User.tenant_id.in_(target_ids), User.is_active == True)
                    for part in parts:
                        query = query.filter(
                            db.or_(
                                User.first_name.ilike(f'%{part}%'),
                                User.last_name.ilike(f'%{part}%')
                            )
                        )
                    target = query.first()
                else:
                    return {'success': False, 'error': 'Se necesita target_user_id o target_user_name'}

                if not target or not target.email:
                    return {'success': False, 'error': 'Usuario no encontrado o sin correo registrado'}

                # Automatically replace {centro} with the target's actual center name
                if '{centro}' in html and target.tenant_id:
                    from models.tenant import Tenant
                    target_tenant = Tenant.query.get(target.tenant_id)
                    if target_tenant:
                        html = html.replace('{centro}', target_tenant.name)

                sent = EmailService.send_email(license_id, target.email, subject, html)
                return {
                    'success': sent,
                    'message': f'Correo enviado a {target.first_name} {target.last_name} ({target.email})' if sent else 'Error al enviar'
                }

            # ── SEND TO PARENT ──
            elif action == 'send_to_parent':
                child_id = kwargs.get('child_id')
                if not child_id:
                    return {'success': False, 'error': 'Se necesita child_id para enviar al padre/representante'}

                sent = EmailService.send_to_child_parent(license_id, child_id, subject, html)
                if sent:
                    child = Child.query.get(child_id)
                    child_name = f"{child.first_name} {child.last_name}" if child else str(child_id)
                    return {'success': True, 'message': f'Correo enviado al representante del niño {child_name}'}
                return {'success': False, 'error': 'No se encontró un correo del representante para este niño'}

            # ── SEND TO DIRECT EMAIL ──
            elif action == 'send_to_email':
                to_email = kwargs.get('to_email')
                if not to_email:
                    return {'success': False, 'error': 'Se necesita to_email'}

                sent = EmailService.send_email(license_id, to_email, subject, html)
                return {
                    'success': sent,
                    'message': f'Correo enviado a {to_email}' if sent else 'Error al enviar'
                }

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"SendEmailTool error: {e}")
            return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════
# 9. Programas Sociales & Formularios Dinámicos
# ═══════════════════════════════════════════════════════

class ManageSocialProgramsTool(BaseTool):
    """Tool to create, list, and configure Social Programs and Dynamic Forms for AI GovCoreX OS."""
    name: str = "manage_social_programs"
    description: str = (
        "Create, manage, and configure Social Programs (Programas Sociales) and dynamic registration forms. "
        "Actions:\n"
        "  - 'list_programs': list existing social programs with stats.\n"
        "  - 'create_program': create a new social program and automatically generate its dynamic form schema "
        "     with customized fields, conversational prompts, and eligibility scoring.\n"
        "  - 'get_form': inspect the dynamic form JSON schema for a program.\n"
        "  - 'configure_form': add or update fields, conversational prompts, and eligibility rules.\n"
        "  - 'register_applicant': submit a new applicant with custom form_data.\n"
        "Input examples:\n"
        "  {'action': 'list_programs'}\n"
        "  {'action': 'create_program', 'name': 'Beca Nutrición Infantil', 'category': 'infancia', "
        "'description': 'Apoyo alimentario para menores de 5 años en vulnerabilidad'}\n"
        "  {'action': 'get_form', 'program_id': 1}\n"
        "  {'action': 'register_applicant', 'program_id': 1, 'full_name': 'María Pérez', 'cedula': '0928374651', "
        "'form_data': {'monthly_income': 180, 'children_count': 3}}"
    )

    def _run(self, *args, **kwargs) -> dict:
        _safe_session()
        action = kwargs.get('action', 'list_programs')
        license_id = kwargs.get('license_id')
        user_id = kwargs.get('user_id')

        try:
            from models.social_program import SocialProgram, ProgramFormDefinition, ProgramBeneficiary
            from api.social_programs import _generate_default_social_form, _calculate_eligibility_score

            # ── LIST PROGRAMS ──
            if action == 'list_programs':
                programs = SocialProgram.query.all()
                return {
                    'success': True,
                    'count': len(programs),
                    'programs': [p.to_dict(include_stats=True) for p in programs]
                }

            # ── CREATE PROGRAM WITH DYNAMIC FORM ──
            elif action == 'create_program':
                name = kwargs.get('name')
                if not name:
                    return {'success': False, 'error': 'El nombre del programa es obligatorio'}

                category = kwargs.get('category', 'social')
                description = kwargs.get('description', '')
                import re
                from datetime import datetime

                short_code = kwargs.get('short_code')
                if not short_code:
                    words = re.findall(r'\b[A-Za-z]', name)
                    prefix = ''.join(words[:4]).upper() or 'PROG'
                    short_code = f"{prefix}-{datetime.utcnow().strftime('%y%m%d')}"

                program = SocialProgram(
                    license_id=license_id,
                    created_by_user_id=user_id or 1,
                    name=name,
                    short_code=short_code,
                    category=category,
                    description=description,
                    status='active',
                    max_beneficiaries=kwargs.get('max_beneficiaries', 1000)
                )
                db.session.add(program)
                db.session.flush()

                # Generate dynamic form schema
                fields = kwargs.get('fields')
                if not fields:
                    schema = _generate_default_social_form(name, category, description)
                    fields = schema.get('fields', [])
                    rules = schema.get('eligibility_rules', [])
                    conv_instructions = schema.get('conversational_instructions', '')
                    success_msg = schema.get('success_message', '')
                else:
                    rules = kwargs.get('eligibility_rules', [])
                    conv_instructions = kwargs.get('conversational_instructions', '')
                    success_msg = kwargs.get('success_message', 'Postulación registrada exitosamente.')

                form_def = ProgramFormDefinition(
                    program_id=program.id,
                    form_title=f"Ficha de Postulación: {name}",
                    form_description=description,
                    fields=fields,
                    eligibility_rules=rules,
                    conversational_instructions=conv_instructions,
                    success_message=success_msg,
                    version=1
                )
                db.session.add(form_def)
                db.session.commit()

                return {
                    'success': True,
                    'message': f"Programa '{name}' creado exitosamente con {len(fields)} campos dinámicos configurados.",
                    'program_id': program.id,
                    'short_code': short_code,
                    'form': form_def.to_dict()
                }

            # ── GET FORM ──
            elif action == 'get_form':
                program_id = kwargs.get('program_id')
                if not program_id:
                    return {'success': False, 'error': 'program_id es requerido'}
                program = SocialProgram.query.get(program_id)
                if not program:
                    return {'success': False, 'error': f'Programa {program_id} no encontrado'}
                form = program.form_definition
                return {
                    'success': True,
                    'program': program.to_dict(),
                    'form': form.to_dict() if form else None
                }

            # ── CONFIGURE FORM ──
            elif action == 'configure_form':
                program_id = kwargs.get('program_id')
                if not program_id:
                    return {'success': False, 'error': 'program_id es requerido'}
                program = SocialProgram.query.get(program_id)
                if not program:
                    return {'success': False, 'error': f'Programa {program_id} no encontrado'}

                form = program.form_definition
                if not form:
                    form = ProgramFormDefinition(program_id=program.id, fields=[])
                    db.session.add(form)

                if 'fields' in kwargs: form.fields = kwargs['fields']
                if 'eligibility_rules' in kwargs: form.eligibility_rules = kwargs['eligibility_rules']
                if 'conversational_instructions' in kwargs: form.conversational_instructions = kwargs['conversational_instructions']
                if 'success_message' in kwargs: form.success_message = kwargs['success_message']
                form.version = (form.version or 1) + 1
                db.session.commit()

                return {
                    'success': True,
                    'message': f"Formulario del programa '{program.name}' actualizado a versión {form.version}.",
                    'form': form.to_dict()
                }

            # ── REGISTER APPLICANT ──
            elif action == 'register_applicant':
                program_id = kwargs.get('program_id')
                if not program_id:
                    return {'success': False, 'error': 'program_id es requerido'}

                program = SocialProgram.query.get(program_id)
                if not program:
                    return {'success': False, 'error': f'Programa {program_id} no encontrado'}

                form_data = kwargs.get('form_data', {})
                rules = program.form_definition.eligibility_rules if program.form_definition else []
                score, notes = _calculate_eligibility_score(form_data, rules)

                beneficiary = ProgramBeneficiary(
                    program_id=program.id,
                    full_name=kwargs.get('full_name') or form_data.get('full_name', 'Postulante'),
                    cedula=kwargs.get('cedula') or form_data.get('cedula'),
                    phone=kwargs.get('phone') or form_data.get('phone'),
                    intake_channel=kwargs.get('intake_channel', 'copilot_agent'),
                    form_data=form_data,
                    status='applicant' if score < 70 else 'approved',
                    eligibility_score=score,
                    eligibility_notes=notes,
                )
                db.session.add(beneficiary)
                db.session.commit()

                return {
                    'success': True,
                    'message': f"Postulante {beneficiary.full_name} registrado en '{program.name}'.",
                    'beneficiary_id': beneficiary.id,
                    'eligibility_score': score,
                    'status': beneficiary.status
                }

            return {'success': False, 'error': f'Acción desconocida: {action}'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"ManageSocialProgramsTool error: {e}")
            return {'success': False, 'error': str(e)}


