from utils.role_helpers import is_multi_center_role
"""
Monitoring API - KPIs y Estadísticas de Monitoreo
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.child import Child
from models.attendance import Attendance
from models.milestone import Milestone
from models.health import Vaccine, HealthRecord
from models.tenant import Tenant
from sqlalchemy import func, and_
from datetime import date, timedelta
from services.who_standards import WHOStandardsService

monitoring_bp = Blueprint('monitoring', __name__, url_prefix='/monitoring')

def require_authenticated(f):
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        # Permitir si tiene tenant_id O es license_admin/super_admin
        if not user or (not user.tenant_id and user.role.name not in ['license_admin', 'super_admin']):
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 403
        return f(user, *args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@monitoring_bp.route('/kpis', methods=['GET'])
@require_authenticated
def get_kpis(user):
    """Obtener KPIs de monitoreo"""
    try:
        today = date.today()
        first_of_month = today.replace(day=1)
        
        target_tenant_ids = []
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        # Determinar scope de tenants
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                all_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
                allowed_ids = [t.id for t in all_tenants]
                
                if requested_tenant_id:
                    if requested_tenant_id in allowed_ids:
                        target_tenant_ids = [requested_tenant_id]
                    else:
                        return jsonify({'error': 'Acceso denegado al centro solicitado'}), 403
                else:
                    target_tenant_ids = allowed_ids
        elif user.tenant_id:
            target_tenant_ids = [user.tenant_id]
            
        if not target_tenant_ids:
            return jsonify({'kpis': [], 'message': 'No hay centros asignados'}), 200

        # Calcular métricas agregadas
        
        # 1. Indicador de Asistencia (Mes actual)
        total_attendance = Attendance.query.filter(
            Attendance.tenant_id.in_(target_tenant_ids),
            Attendance.date >= first_of_month
        ).count()
        
        present_attendance = Attendance.query.filter(
            Attendance.tenant_id.in_(target_tenant_ids),
            Attendance.date >= first_of_month,
            Attendance.status == 'presente'
        ).count()
        
        attendance_rate = (present_attendance / total_attendance * 100) if total_attendance > 0 else 0

        # 2. Indicador de Salud (Vacunación al día)
        # Lógica Estricta: 
        # - Debe tener AL MENOS un registro de vacuna (para evitar 100% ficticio en niños nuevos sin datos)
        # - No debe tener vacunas vencidas
        
        # A. Niños con al menos un registro de vacuna (cualquier estado)
        kids_with_records_query = db.session.query(Vaccine.child_id).filter(
            Vaccine.tenant_id.in_(target_tenant_ids)
        ).distinct()
        kids_with_records = {row[0] for row in kids_with_records_query.all()}
        
        # B. Niños con vacunas vencidas
        kids_with_overdue_query = db.session.query(Vaccine.child_id).filter(
            Vaccine.tenant_id.in_(target_tenant_ids),
            Vaccine.status == 'pendiente',
            Vaccine.next_dose_date < today
        ).distinct()
        kids_with_overdue = {row[0] for row in kids_with_overdue_query.all()}
        
        # C. Niños Compliant = Tienen registro Y No tienen vencidas
        # Intersección: (Tienen Registros) - (Tienen Vencidas)
        compliant_kids_count = len(kids_with_records - kids_with_overdue)
        
        total_kids = Child.query.filter(
            Child.tenant_id.in_(target_tenant_ids), 
            Child.status == 'activo'
        ).count()
        
        health_compliance = (compliant_kids_count / total_kids * 100) if total_kids > 0 else 0

        # 3. Indicador de Desarrollo (Promedio ponderado por nivel de logro)
        # Uses latest milestone per child per domain, weighted by achievement_level
        achievement_scores = {
            'no_iniciado': 0,
            'en_proceso': 33,
            'adquirido': 66,
            'consolidado': 100
        }
        
        # Get latest milestone per child (across all domains)
        from sqlalchemy import and_
        latest_sub = db.session.query(
            Milestone.child_id,
            func.max(Milestone.record_date).label('max_date')
        ).filter(
            Milestone.tenant_id.in_(target_tenant_ids)
        ).group_by(Milestone.child_id).subquery()
        
        latest_milestones = db.session.query(Milestone.achievement_level).join(
            latest_sub,
            and_(
                Milestone.child_id == latest_sub.c.child_id,
                Milestone.record_date == latest_sub.c.max_date
            )
        ).filter(
            Milestone.tenant_id.in_(target_tenant_ids)
        ).all()
        
        if latest_milestones:
            total_score = sum(achievement_scores.get(m[0], 0) for m in latest_milestones)
            development_rate = total_score / len(latest_milestones)
        else:
            development_rate = 0

        # 4. Indicador de Nutrición (Controles crecimiento mes actual)
        kids_with_growth = db.session.query(HealthRecord.child_id).filter(
            HealthRecord.tenant_id.in_(target_tenant_ids),
            HealthRecord.record_type == 'crecimiento',
            HealthRecord.record_date >= first_of_month
        ).distinct().count()
        
        nutrition_rate = (kids_with_growth / total_kids * 100) if total_kids > 0 else 0

        return jsonify({
            'kpis': [
                {
                    'title': 'Tasa de Asistencia',
                    'value': f"{round(attendance_rate)}%",
                    'target': '95%',
                    'status': 'success' if attendance_rate >= 95 else ('warning' if attendance_rate >= 85 else 'danger'),
                    'icon': 'Users'
                },
                {
                    'title': 'Cumplimiento Salud',
                    'value': f"{round(health_compliance)}%",
                    'target': '100%',
                    'status': 'success' if health_compliance >= 95 else ('warning' if health_compliance >= 80 else 'danger'),
                    'icon': 'Heart'
                },
                {
                    'title': 'Desarrollo Infantil',
                    'value': f"{round(development_rate)}%",
                    'target': '90%',
                    'status': 'success' if development_rate >= 90 else ('warning' if development_rate >= 70 else 'danger'),
                    'icon': 'Activity'
                },
                {
                    'title': 'Estado Nutricional', 
                    'value': f"{round(nutrition_rate)}%",
                    'target': '100%',
                    'status': 'success' if nutrition_rate >= 95 else ('warning' if nutrition_rate >= 80 else 'danger'),
                    'icon': 'Apple'
                }
            ]
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_kpis: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@monitoring_bp.route('/development-chart', methods=['GET'])
@jwt_required()
def get_development_chart():
    """Obtener datos para gráfico comparativo de desarrollo"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        target_tenant_ids = []
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        # Logic to determine scope (reused pattern)
        if user.role.name == 'super_admin':
            if requested_tenant_id:
                target_tenant_ids = [requested_tenant_id]
            else:
                target_tenant_ids = [t.id for t in Tenant.query.filter_by(is_active=True).all()]
                
        elif is_multi_center_role(user):
            from models.license import LicenseAdmin
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                scope_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
                allowed_ids = [t.id for t in scope_tenants]
                if requested_tenant_id:
                    if requested_tenant_id in allowed_ids:
                        target_tenant_ids = [requested_tenant_id]
                    else:
                        return jsonify({'error': 'Acceso denegado'}), 403
                else:
                    target_tenant_ids = allowed_ids
            else:
                target_tenant_ids = []
        else:
            # Regular user
            if user.tenant_id:
                target_tenant_ids = [user.tenant_id]
            else:
                target_tenant_ids = []

        if not target_tenant_ids:
             return jsonify({'chart_data': []}), 200

        # Dominios de desarrollo
        domains = ['vinculacion_emocional', 'descubrimiento_natural_cultural', 'expresion_corporal', 'lenguaje']
        
        # Mapeo para nombres cortos en gráfico
        domain_labels = {
            'vinculacion_emocional': 'Socio-Emocional',
            'descubrimiento_natural_cultural': 'Descubrimiento',
            'expresion_corporal': 'Físico',
            'lenguaje': 'Lenguaje'
        }
        
        chart_data = []
        
        # Para cada dominio, calculamos el % promedio de logro
        # achievement_level es enum: 'inicio', 'proceso', 'logrado'
        # Asignamos valor numérico: 0, 50, 100
        
        for domain in domains:
            # Obtener milestones filtrados por los tenants seleccionados
            subq = db.session.query(
                Milestone.child_id,
                func.max(Milestone.record_date).label('max_date')
            ).filter(
                Milestone.tenant_id.in_(target_tenant_ids),
                Milestone.domain == domain
            ).group_by(Milestone.child_id).subquery()
            
            latest_milestones = db.session.query(Milestone).join(
                subq,
                and_(
                    Milestone.child_id == subq.c.child_id,
                    Milestone.record_date == subq.c.max_date
                )
            ).filter(
                Milestone.tenant_id.in_(target_tenant_ids),
                Milestone.domain == domain
            ).all()
            
            total_score = 0
            count = 0
            
            for m in latest_milestones:
                score = 0
                # Actual enum values from DB: no_iniciado, en_proceso, adquirido, consolidado
                if m.achievement_level == 'consolidado':
                    score = 100
                elif m.achievement_level == 'adquirido':
                    score = 75
                elif m.achievement_level == 'en_proceso':
                    score = 50
                elif m.achievement_level == 'no_iniciado':
                    score = 0
                total_score += score
                count += 1
            
            avg_score = round(total_score / count) if count > 0 else 0
            
            # Estructura para Recharts
            data_label = "Promedio Global" if len(target_tenant_ids) > 1 else (Tenant.query.get(target_tenant_ids[0]).name if target_tenant_ids else "N/A")
            
            # Build dict with variable key properly
            data_point = {"area": domain_labels[domain]}
            data_point[data_label] = avg_score
            chart_data.append(data_point)
            
        return jsonify({'chart_data': chart_data}), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_development_chart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


def _resolve_tenant_scope(user, requested_tenant_id=None):
    """Helper: resolve target tenant IDs from user role + optional filter."""
    target = []
    if user.role.name == 'super_admin':
        if requested_tenant_id:
            target = [requested_tenant_id]
        else:
            target = [t.id for t in Tenant.query.filter_by(is_active=True).all()]
    elif is_multi_center_role(user):
        from models.license import LicenseAdmin
        lic = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if lic:
            allowed = [t.id for t in Tenant.query.filter_by(license_id=lic.license_id, is_active=True).all()]
            if requested_tenant_id:
                target = [requested_tenant_id] if requested_tenant_id in allowed else []
            else:
                target = allowed
    elif user.tenant_id:
        target = [user.tenant_id]
    return target


@monitoring_bp.route('/attendance-trend', methods=['GET'])
@require_authenticated
def get_attendance_trend(user):
    """Tendencia de asistencia diaria — últimos 30 días (Line Chart)"""
    try:
        requested_tid = request.args.get('tenant_id', type=int)
        target_ids = _resolve_tenant_scope(user, requested_tid)
        if not target_ids:
            return jsonify({'chart_data': []}), 200

        today = date.today()
        start = today - timedelta(days=29)

        # Get daily attendance counts grouped by date and status
        rows = db.session.query(
            Attendance.date,
            Attendance.status,
            func.count(Attendance.id)
        ).filter(
            Attendance.tenant_id.in_(target_ids),
            Attendance.date >= start,
            Attendance.date <= today
        ).group_by(Attendance.date, Attendance.status).all()

        # Build data by day
        day_map = {}
        d = start
        while d <= today:
            day_map[d] = {'fecha': d.strftime('%d/%m'), 'presentes': 0, 'ausentes': 0, 'justificados': 0, 'tardanzas': 0}
            d += timedelta(days=1)

        for row_date, status, cnt in rows:
            if row_date in day_map:
                if status == 'presente':
                    day_map[row_date]['presentes'] = cnt
                elif status == 'ausente':
                    day_map[row_date]['ausentes'] = cnt
                elif status == 'justificado':
                    day_map[row_date]['justificados'] = cnt
                elif status == 'tardanza':
                    day_map[row_date]['tardanzas'] = cnt

        chart_data = list(day_map.values())
        return jsonify({'chart_data': chart_data}), 200

    except Exception as e:
        import traceback
        logger_msg = f"Error in attendance_trend: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500


@monitoring_bp.route('/health-overview', methods=['GET'])
@require_authenticated
def get_health_overview(user):
    """Distribución estado vacunación — Pie/Donut Chart"""
    try:
        requested_tid = request.args.get('tenant_id', type=int)
        target_ids = _resolve_tenant_scope(user, requested_tid)
        if not target_ids:
            return jsonify({'chart_data': []}), 200

        today = date.today()

        total_kids = Child.query.filter(
            Child.tenant_id.in_(target_ids),
            Child.status == 'activo'
        ).count()

        # Kids with at least one vaccine record
        kids_with_records = {r[0] for r in db.session.query(Vaccine.child_id).filter(
            Vaccine.tenant_id.in_(target_ids)
        ).distinct().all()}

        # Kids with overdue vaccines
        kids_with_overdue = {r[0] for r in db.session.query(Vaccine.child_id).filter(
            Vaccine.tenant_id.in_(target_ids),
            Vaccine.status == 'pendiente',
            Vaccine.next_dose_date < today
        ).distinct().all()}

        # Kids with pending (but not overdue) vaccines
        kids_with_pending = {r[0] for r in db.session.query(Vaccine.child_id).filter(
            Vaccine.tenant_id.in_(target_ids),
            Vaccine.status == 'pendiente',
            Vaccine.next_dose_date >= today
        ).distinct().all()} - kids_with_overdue

        al_dia = len(kids_with_records - kids_with_overdue - kids_with_pending)
        pendientes = len(kids_with_pending)
        vencidos = len(kids_with_overdue)
        sin_registro = total_kids - len(kids_with_records)

        chart_data = [
            {'name': 'Al Día', 'value': al_dia, 'fill': '#22c55e'},
            {'name': 'Pendientes', 'value': pendientes, 'fill': '#eab308'},
            {'name': 'Vencidos', 'value': vencidos, 'fill': '#ef4444'},
            {'name': 'Sin Registro', 'value': sin_registro, 'fill': '#94a3b8'},
        ]

        return jsonify({'chart_data': chart_data, 'total': total_kids}), 200

    except Exception as e:
        import traceback
        print(f"Error in health_overview: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@monitoring_bp.route('/nutrition-bmi', methods=['GET'])
@require_authenticated
def get_nutrition_bmi(user):
    """Distribución estado nutricional OMS (Peso/Edad y Talla/Edad) — Bar Chart"""
    try:
        requested_tid = request.args.get('tenant_id', type=int)
        target_ids = _resolve_tenant_scope(user, requested_tid)
        if not target_ids:
            return jsonify({'chart_data': [], 'total': 0, 'height_chart_data': []}), 200

        # Get active children in target tenants
        active_children = Child.query.filter(
            Child.tenant_id.in_(target_ids),
            Child.status == 'activo'
        ).all()
        
        child_map = {c.id: c for c in active_children}
        
        # Subquery for latest growth record per child
        latest_sub = db.session.query(
            HealthRecord.child_id,
            func.max(HealthRecord.record_date).label('max_date')
        ).filter(
            HealthRecord.tenant_id.in_(target_ids),
            HealthRecord.record_type == 'crecimiento'
        ).group_by(HealthRecord.child_id).subquery()

        latest_records = db.session.query(HealthRecord).join(
            latest_sub,
            and_(
                HealthRecord.child_id == latest_sub.c.child_id,
                HealthRecord.record_date == latest_sub.c.max_date
            )
        ).filter(
            HealthRecord.tenant_id.in_(target_ids),
            HealthRecord.record_type == 'crecimiento'
        ).all()

        # Classify by WHO Weight-for-Age z-score ranges
        desnutricion_severa = 0  # z < -3
        desnutricion = 0         # -3 <= z < -2
        normal = 0               # -2 <= z <= 2
        sobrepeso = 0            # 2 < z <= 3
        obesidad = 0             # z > 3

        # Classify by WHO Height-for-Age
        talla_muy_baja = 0
        talla_baja = 0
        talla_adecuada = 0
        talla_alta = 0

        evaluated_count = 0
        from dateutil.relativedelta import relativedelta

        for r in latest_records:
            child = child_map.get(r.child_id) or Child.query.get(r.child_id)
            if not child:
                continue

            z_w = float(r.z_score_weight) if r.z_score_weight is not None else None
            z_h = float(r.z_score_height) if r.z_score_height is not None else None

            # On-the-fly calculate if missing
            if child.birth_date and r.record_date:
                delta = relativedelta(r.record_date, child.birth_date)
                age_m = max(0, delta.years * 12 + delta.months)
                if z_w is None and r.weight:
                    z_w = WHOStandardsService.calculate_weight_zscore(float(r.weight), age_m, child.gender or 'M')
                if z_h is None and r.height:
                    z_h = WHOStandardsService.calculate_height_zscore(float(r.height), age_m, child.gender or 'M')

            if z_w is not None:
                evaluated_count += 1
                if z_w < -3.0:
                    desnutricion_severa += 1
                elif z_w < -2.0:
                    desnutricion += 1
                elif z_w <= 2.0:
                    normal += 1
                elif z_w <= 3.0:
                    sobrepeso += 1
                else:
                    obesidad += 1

            if z_h is not None:
                if z_h < -3.0:
                    talla_muy_baja += 1
                elif z_h < -2.0:
                    talla_baja += 1
                elif z_h <= 2.0:
                    talla_adecuada += 1
                else:
                    talla_alta += 1

        chart_data = [
            {'categoria': 'Desnutrición Severa', 'cantidad': desnutricion_severa, 'fill': '#dc2626'},
            {'categoria': 'Desnutrición', 'cantidad': desnutricion, 'fill': '#f97316'},
            {'categoria': 'Normal', 'cantidad': normal, 'fill': '#22c55e'},
            {'categoria': 'Sobrepeso', 'cantidad': sobrepeso, 'fill': '#eab308'},
            {'categoria': 'Obesidad', 'cantidad': obesidad, 'fill': '#ef4444'},
        ]

        height_chart_data = [
            {'categoria': 'Talla Muy Baja', 'cantidad': talla_muy_baja, 'fill': '#dc2626'},
            {'categoria': 'Talla Baja', 'cantidad': talla_baja, 'fill': '#f97316'},
            {'categoria': 'Talla Adecuada', 'cantidad': talla_adecuada, 'fill': '#22c55e'},
            {'categoria': 'Talla Alta', 'cantidad': talla_alta, 'fill': '#3b82f6'},
        ]

        return jsonify({
            'chart_data': chart_data,
            'height_chart_data': height_chart_data,
            'total': evaluated_count,
            'total_active_children': len(active_children),
            'sin_registro': max(0, len(active_children) - evaluated_count)
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in nutrition_bmi: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@monitoring_bp.route('/centers-comparison', methods=['GET'])
@require_authenticated
def get_centers_comparison(user):
    """Comparativo KPIs por centro — Radar Chart (license_admin only)"""
    try:
        requested_tid = request.args.get('tenant_id', type=int)
        target_ids = _resolve_tenant_scope(user, requested_tid)

        # Only meaningful with multiple centers
        if len(target_ids) <= 1:
            return jsonify({'chart_data': [], 'message': 'Se requieren múltiples centros'}), 200

        today = date.today()
        first_of_month = today.replace(day=1)
        chart_data = []

        for tid in target_ids:
            tenant = Tenant.query.get(tid)
            if not tenant:
                continue

            # Attendance rate
            total_att = Attendance.query.filter(
                Attendance.tenant_id == tid,
                Attendance.date >= first_of_month
            ).count()
            present_att = Attendance.query.filter(
                Attendance.tenant_id == tid,
                Attendance.date >= first_of_month,
                Attendance.status == 'presente'
            ).count()
            att_rate = round((present_att / total_att * 100)) if total_att > 0 else 0

            # Health compliance
            total_kids = Child.query.filter(Child.tenant_id == tid, Child.status == 'activo').count()
            kids_with_v = {r[0] for r in db.session.query(Vaccine.child_id).filter(Vaccine.tenant_id == tid).distinct().all()}
            kids_overdue = {r[0] for r in db.session.query(Vaccine.child_id).filter(
                Vaccine.tenant_id == tid, Vaccine.status == 'pendiente', Vaccine.next_dose_date < today
            ).distinct().all()}
            compliant = len(kids_with_v - kids_overdue)
            health_rate = round((compliant / total_kids * 100)) if total_kids > 0 else 0

            # Development rate (using latest milestones)
            achievement_scores = {'no_iniciado': 0, 'en_proceso': 33, 'adquirido': 66, 'consolidado': 100}
            milestones = db.session.query(Milestone.achievement_level).filter(
                Milestone.tenant_id == tid
            ).all()
            if milestones:
                dev_rate = round(sum(achievement_scores.get(m[0], 0) for m in milestones) / len(milestones))
            else:
                dev_rate = 0

            # Nutrition rate (kids with growth record this month)
            kids_growth = db.session.query(HealthRecord.child_id).filter(
                HealthRecord.tenant_id == tid,
                HealthRecord.record_type == 'crecimiento',
                HealthRecord.record_date >= first_of_month
            ).distinct().count()
            nut_rate = round((kids_growth / total_kids * 100)) if total_kids > 0 else 0

            chart_data.append({
                'centro': tenant.name,
                'Asistencia': att_rate,
                'Salud': health_rate,
                'Desarrollo': dev_rate,
                'Nutrición': nut_rate,
            })

        return jsonify({'chart_data': chart_data}), 200

    except Exception as e:
        import traceback
        print(f"Error in centers_comparison: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

