"""
CMCI Reports & Exports API — F4 (Fase 4 del plan).
NUEVO blueprint bajo /api/cmci (no rompe reports existente):
  POST /api/cmci/reports/compose        compose multi-rol (guarda MonthlyReport)
  GET  /api/cmci/monthly-reports        lista
  GET  /api/cmci/monthly-reports/<id>   detalle + print view firmable en papel
  GET  /api/cmci/export/matriz-general|matriz-posibles|matriz-unica|matriz-consolidada|asistencia
  POST /api/cmci/nutrition/intake       ficha diaria recepción (75/25, organoléptico...)
  GET  /api/cmci/nutrition/intake       lista + eficiencia
  GET  /api/cmci/wizard/pending         pendientes que el educador valida
  POST /api/cmci/cron/tick              tick manual del scheduler 22/24 (solo multi-rol)
Sin firma electrónica en ningún endpoint.
"""
from flask import Blueprint, request, jsonify, send_file, Response
from middleware.tenant_context import tenant_required, TenantContext
from utils.role_helpers import (is_multi_center_role, is_catering,
                                can_view_cmci_global,
                                get_tenant_ids_for_user)
from models import db
from datetime import date
import base64
import io
import logging

logger = logging.getLogger(__name__)

cmci_reports_bp = Blueprint('cmci_reports', __name__, url_prefix='/cmci')


def _resolve_center(user, requested_id=None):
    if is_multi_center_role(user):
        return requested_id or user.tenant_id
    return user.tenant_id


def _deny_catering():
    """F5 RBAC §10.7: catering solo menú e ingesta diaria (nutrition/intake).
    Resto de /api/cmci/* → 403."""
    user = TenantContext.get_current_user()
    if is_catering(user):
        return jsonify({"error": "Rol catering: solo menú e ingesta diaria"}), 403
    return None


def _ensure_site_access(user, center_id):
    """F5 IDOR tenant==site: el centro pedido debe estar en la lista
    autorizada del usuario (o ser global). Si cruza → 404."""
    if not center_id:
        return None
    if can_view_cmci_global(user):
        return None
    allowed = set(get_tenant_ids_for_user(user) or [])
    allowed.add(getattr(user, "tenant_id", None))
    if center_id not in allowed:
        return jsonify({"error": "Centro no encontrado"}), 404
    return None


# ── Informes mensuales multi-rol ──────────────────────────────────────────

@cmci_reports_bp.route('/reports/compose', methods=['POST'])
@tenant_required
def compose_monthly_report():
    """Compose + guarda MonthlyReport multi-rol."""
    from services.monthly_report_service import MonthlyReportService, REPORT_TYPES
    try:
        denied = _deny_catering()
        if denied:
            return denied
        user = TenantContext.get_current_user()
        data = request.get_json() or {}
        report_type = (data.get('report_type') or 'educadora').lower()
        if report_type not in REPORT_TYPES:
            return jsonify({'error': f'report_type inválido. Use: {list(REPORT_TYPES)}'}), 400
        try:
            ps = date.fromisoformat(data['period_start'])
            pe = date.fromisoformat(data['period_end'])
        except (KeyError, ValueError):
            return jsonify({'error': 'period_start/end requeridos en YYYY-MM-DD'}), 400
        if ps > pe:
            return jsonify({'error': 'period_start no puede ser posterior a period_end'}), 400
        center_id = _resolve_center(user, data.get('center_id') or request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        # Congelado día 24: no se edita lo congelado
        report = MonthlyReportService.compose_and_save(
            educator_id=data.get('educator_id') or user.id,
            report_type=report_type, period_start=ps, period_end=pe,
            tenant_id=center_id, educator_notes=data.get('educator_notes', ''),
            redact_with_llm=data.get('redact_with_llm', True))
        return jsonify({'message': 'Informe mensual compuesto',
                        'report_id': report.id, 'report_type': report_type,
                        'conclusions_auto': report.conclusions_auto}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"compose error: {e}")
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/monthly-reports', methods=['GET'])
@tenant_required
def list_monthly_reports():
    from models.cmci import MonthlyReport
    try:
        denied = _deny_catering()
        if denied:
            return denied
        user = TenantContext.get_current_user()
        center_id = _resolve_center(user, request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        rtype = request.args.get('report_type')
        q = MonthlyReport.query
        if center_id:
            q = q.filter_by(center_id=center_id)
        if rtype:
            q = q.filter_by(report_type=rtype)
        if not is_multi_center_role(user):
            q = q.filter_by(educator_id=user.id)
        items = q.order_by(MonthlyReport.period_end.desc()).limit(50).all()
        return jsonify({'reports': [{
            'id': r.id, 'report_type': r.report_type, 'center_id': r.center_id,
            'educator_id': r.educator_id,
            'period_start': r.period_start.isoformat() if r.period_start else None,
            'period_end': r.period_end.isoformat() if r.period_end else None,
            'status': r.status} for r in items]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/monthly-reports/<int:report_id>', methods=['GET'])
@tenant_required
def get_monthly_report(report_id):
    """Detalle + print view firmable en papel (sin e-firma)."""
    from models.cmci import MonthlyReport
    from services.monthly_report_service import MonthlyReportService
    try:
        user = TenantContext.get_current_user()
        r = MonthlyReport.query.get(report_id)
        if not r:
            return jsonify({'error': 'Informe no encontrado'}), 404
        if is_catering(user):
            return jsonify({"error": "Rol catering: solo menú e ingesta diaria"}), 403
        site_err = _ensure_site_access(user, r.center_id)
        if site_err:
            return site_err
        if not is_multi_center_role(user) and r.educator_id != user.id:
            return jsonify({'error': 'Sin acceso'}), 403
        return jsonify({
            'id': r.id, 'report_type': r.report_type,
            'period_start': r.period_start.isoformat() if r.period_start else None,
            'period_end': r.period_end.isoformat() if r.period_end else None,
            'status': r.status, 'conclusions_auto': r.conclusions_auto,
            'educator_notes': r.educator_notes,
            'payload': r.payload,
            'print_view': MonthlyReportService.print_view(r)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Exports 5 matrices ────────────────────────────────────────────────────

def _period_label():
    f = request.args.get('from')
    t = request.args.get('to')
    if f or t:
        return f"{f or '?'} al {t or '?'}"
    return f"Al {date.today().isoformat()}"


@cmci_reports_bp.route('/export/<string:matrix>', methods=['GET'])
@tenant_required
def export_matrix(matrix):
    """xlsx con encabezado distintivo + fecha corte + filtros."""
    from services.cmci_export import (
        MATRIX_STYLE, build_matrix_workbook, build_attendance_matrix_workbook)
    from services.report_generator import ReportGenerator
    from models.tenant import Tenant
    try:
        denied = _deny_catering()
        if denied:
            return denied
        user = TenantContext.get_current_user()
        if matrix not in MATRIX_STYLE:
            return jsonify({'error': f'matriz inválida. Use: {sorted(MATRIX_STYLE)}'}), 400
        center_id = _resolve_center(user, request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        target = center_id or TenantContext.get_current_tenant_id()
        if not target:
            return jsonify({'error': 'Centro no identificado'}), 400
        tenant = Tenant.query.get(target)
        center_name = tenant.name if tenant else 'Centro'
        try:
            f = date.fromisoformat(request.args.get('from')) if request.args.get('from') else date.today().replace(day=1)
            t = date.fromisoformat(request.args.get('to')) if request.args.get('to') else date.today()
        except ValueError:
            return jsonify({'error': 'from/to en YYYY-MM-DD'}), 400
        period = f"{f.isoformat()} al {t.isoformat()}"
        filters = f"center_id={target}, from={f.isoformat()}, to={t.isoformat()}"

        if matrix == 'asistencia':
            data = ReportGenerator.generate_attendance_matrix_report(target, f, t)
            day_headers = [h for h in data['headers'] if h not in ('Centro', 'N.', 'Cédula', 'Niño')]
            rows = []
            for i, r in enumerate(data['rows'], 1):
                vals = {'n': i,
                        'cedula': r.get('Cédula') or r.get('cédula') or '',
                        'nino': r.get('Niño') or r.get('niño') or ''}
                for d in day_headers:
                    vals[d] = r.get(d, '')
                rows.append(vals)
            buf = build_attendance_matrix_workbook(rows, day_headers, center_name, period, filters)
        elif matrix == 'matriz-consolidada':
            data = ReportGenerator.generate_general_report(target, f, t)
            rows = data['rows'] if isinstance(data['rows'], list) else []
            buf = build_matrix_workbook(matrix, rows, center_name, period, filters)
        else:
            data = ReportGenerator.generate_children_matrix_report(target, f, t)
            if matrix == 'matriz-unica':
                rows = [{'n': r.get('n.'), 'codigo': r.get('cédula_id'),
                         'nino': f"{r.get('apellidos')} {r.get('nombres')}",
                         'cedula': r.get('cédula_id'), 'edad': r.get('edad'),
                         'centro': r.get('centro'), 'total': '',
                         'nivel': '', 'prioridad': '',
                         'estado': 'activo'} for r in data['rows']]
            elif matrix == 'matriz-posibles':
                rows = [{'n': i + 1, 'fecha': '', 'solicitante': '',
                         'cedula': '', 'telefono': r.get('teléfono_rep'),
                         'ninos': '', 'ingreso': r.get('ingresos'),
                         'estado': 'posible', 'obs': ''} for i, r in enumerate(data['rows'])]
            else:  # matriz-general
                rows = [{'n': r.get('n.'), 'centro': r.get('centro'),
                         'cedula': r.get('cédula_id'), 'apellidos': r.get('apellidos'),
                         'nombres': r.get('nombres'), 'sexo': r.get('sexo'),
                         'fnac': r.get('fecha_de_nacimiento'), 'edad': r.get('edad'),
                         'rep': r.get('representante'), 'tel': r.get('teléfono_rep'),
                         'dir': r.get('dirección'), 'estado': 'activo',
                         'puntaje': r.get('puntaje_vulnerabilidad')} for r in data['rows']]
            buf = build_matrix_workbook(matrix, rows, center_name, period, filters)

        return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True, download_name=f'{matrix}_{f.isoformat()}_{t.isoformat()}.xlsx')
    except Exception as e:
        logger.error(f"export {matrix} error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Nutrición / intake diario (§10.3) ─────────────────────────────────────

@cmci_reports_bp.route('/nutrition/intake', methods=['POST'])
@tenant_required
def create_intake():
    """Ficha diaria de recepción: 75/25, 4 tiempos, organoléptico, 2 entregas, cumplió_menú."""
    from models.cmci import FoodIntakeReception
    try:
        user = TenantContext.get_current_user()
        data = request.get_json() or {}
        center_id = _resolve_center(user, data.get('center_id'))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        if not center_id:
            return jsonify({'error': 'Centro no identificado'}), 400
        meal = (data.get('meal_time') or '').lower()
        if meal not in FoodIntakeReception.MEAL_TIMES:
            return jsonify({'error': f"meal_time inválido. Use: {list(FoodIntakeReception.MEAL_TIMES)}"}), 400
        entrega = data.get('entrega')
        if entrega and entrega not in FoodIntakeReception.DELIVERIES:
            return jsonify({'error': 'entrega inválida. Use 07:00 (desayuno+fruta) u 11:00 (almuerzo+colada)'}), 400
        acept = data.get('aceptabilidad')
        if acept and acept not in ('Excelente', 'Buena', 'Regular', 'Mala'):
            return jsonify({'error': 'aceptabilidad inválida'}), 400
        for k in ('olor', 'color', 'sabor'):
            if data.get(k) and data[k] not in ('Conforme', 'NoConforme'):
                return jsonify({'error': f'{k} inválido: Conforme|NoConforme'}), 400
        try:
            d = date.fromisoformat(data['date']) if data.get('date') else date.today()
        except ValueError:
            return jsonify({'error': 'date en YYYY-MM-DD'}), 400
        rec = FoodIntakeReception(
            center_id=center_id, date=d, meal_time=meal,
            aporte_cmci_pct=float(data.get('aporte_cmci_pct', 75.0)),
            aporte_hogar_pct=float(data.get('aporte_hogar_pct', 25.0)),
            ingesta_real=data.get('ingesta_real'), cobertura_total=data.get('cobertura_total'),
            olor=data.get('olor'), color=data.get('color'), sabor=data.get('sabor'),
            aceptabilidad=acept, entrega=entrega,
            cumplio_menu=data.get('cumplio_menu'), novedades=data.get('novedades'),
            registered_by=user.id)
        db.session.add(rec)
        db.session.commit()
        return jsonify({'message': 'Ficha diaria registrada', 'intake': rec.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/nutrition/intake', methods=['GET'])
@tenant_required
def list_intake():
    """Lista fichas + eficiencia diaria y consolidada mensual (pago catering)."""
    from models.cmci import FoodIntakeReception
    try:
        user = TenantContext.get_current_user()
        center_id = _resolve_center(user, request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        d = request.args.get('date')
        recs = FoodIntakeReception.query
        if center_id:
            recs = recs.filter_by(center_id=center_id)
        if d:
            recs = recs.filter_by(date=date.fromisoformat(d))
        recs = recs.order_by(FoodIntakeReception.date.desc()).limit(200).all()
        tot_ing = sum(float(r.ingesta_real or 0) for r in recs)
        tot_cob = sum(float(r.cobertura_total or 0) for r in recs)
        eficiencia = round(tot_ing / tot_cob * 100, 2) if tot_cob else None
        return jsonify({'intakes': [r.to_dict() for r in recs],
                        'eficiencia_consolidada': eficiencia}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Wizard pendientes + cron ──────────────────────────────────────────────

@cmci_reports_bp.route('/wizard/pending', methods=['GET'])
@tenant_required
def wizard_pending():
    """Pendientes que el educador valida (wizard WA 33+7)."""
    try:
        denied = _deny_catering()
        if denied:
            return denied
        user = TenantContext.get_current_user()
        center_id = _resolve_center(user, request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        from services.cmci_wizard import pending_for_educator
        return jsonify({'pending': pending_for_educator(user.id, center_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/cron/tick', methods=['POST'])
@tenant_required
def cron_tick():
    """Tick manual del scheduler 22/24 (solo multi-rol). El cron real llama aquí."""
    from services.cmci_scheduler import due_actions, incomplete_profiles, freeze_period_snapshot
    try:
        user = TenantContext.get_current_user()
        if not is_multi_center_role(user):
            return jsonify({'error': 'Solo rol multi-centro'}), 403
        data = request.get_json() or {}
        center_id = data.get('center_id') or user.tenant_id
        iso = data.get('country_iso', 'EC')
        actions = due_actions()
        out = {'actions': actions, 'frozen': 0, 'incomplete': []}
        if actions['freeze_snapshot'] and center_id:
            f = date.fromisoformat(data['from']) if data.get('from') else date.today().replace(day=1)
            t = date.fromisoformat(data['to']) if data.get('to') else date.today()
            out['frozen'] = freeze_period_snapshot(center_id, f, t)
        out['incomplete'] = incomplete_profiles(center_id) if actions['remind_closing'] else []
        _ = iso
        return jsonify(out), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── F5 · Reportes pesados async: 202 Accepted + task_id ───────────────────
# Fallback thread (sin Redis/Celery) + SSE existente (sse_manager).
# Flujo: POST /export/<matrix>/async → 202 {task_id} →
#        GET /tasks/<id> (poll) o /tasks/<id>/stream (SSE) →
#        GET /tasks/<id>/download (xlsx listo para imprimir/descargar).

def _build_export_task(app, matrix, target, center_name, f_iso, t_iso,
                       period, filters):
    """Worker en thread (con app_context): genera el xlsx y lo guarda b64."""
    from services.cmci_export import (
        MATRIX_STYLE, build_matrix_workbook, build_attendance_matrix_workbook)
    from services.report_generator import ReportGenerator
    f = date.fromisoformat(f_iso)
    t = date.fromisoformat(t_iso)
    if matrix == 'asistencia':
        data = ReportGenerator.generate_attendance_matrix_report(target, f, t)
        day_headers = [h for h in data['headers'] if h not in ('Centro', 'N.', 'Cédula', 'Niño')]
        rows = []
        for i, r in enumerate(data['rows'], 1):
            vals = {'n': i,
                    'cedula': r.get('Cédula') or r.get('cédula') or '',
                    'nino': r.get('Niño') or r.get('niño') or ''}
            for d in day_headers:
                vals[d] = r.get(d, '')
            rows.append(vals)
        buf = build_attendance_matrix_workbook(rows, day_headers, center_name,
                                               period, filters)
    elif matrix == 'matriz-consolidada':
        data = ReportGenerator.generate_general_report(target, f, t)
        rows = data['rows'] if isinstance(data['rows'], list) else []
        buf = build_matrix_workbook(matrix, rows, center_name, period, filters)
    else:
        data = ReportGenerator.generate_children_matrix_report(target, f, t)
        if matrix == 'matriz-unica':
            rows = [{'n': r.get('n.'), 'codigo': r.get('cédula_id'),
                     'nino': f"{r.get('apellidos')} {r.get('nombres')}",
                     'cedula': r.get('cédula_id'), 'edad': r.get('edad'),
                     'centro': r.get('centro'), 'total': '',
                     'nivel': '', 'prioridad': '',
                     'estado': 'activo'} for r in data['rows']]
        elif matrix == 'matriz-posibles':
            rows = [{'n': i + 1, 'fecha': '', 'solicitante': '',
                     'cedula': '', 'telefono': r.get('teléfono_rep'),
                     'ninos': '', 'ingreso': r.get('ingresos'),
                     'estado': 'posible', 'obs': ''} for i, r in enumerate(data['rows'])]
        else:  # matriz-general
            rows = [{'n': r.get('n.'), 'centro': r.get('centro'),
                     'cedula': r.get('cédula_id'), 'apellidos': r.get('apellidos'),
                     'nombres': r.get('nombres'), 'sexo': r.get('sexo'),
                     'fnac': r.get('fecha_de_nacimiento'), 'edad': r.get('edad'),
                     'rep': r.get('representante'), 'tel': r.get('teléfono_rep'),
                     'dir': r.get('dirección'), 'estado': 'activo',
                     'puntaje': r.get('puntaje_vulnerabilidad')} for r in data['rows']]
        buf = build_matrix_workbook(matrix, rows, center_name, period, filters)
    raw = buf.getvalue()
    return {'filename': f'{matrix}_{f_iso}_{t_iso}.xlsx',
            'size_bytes': len(raw),
            'b64': base64.b64encode(raw).decode('ascii')}


@cmci_reports_bp.route('/export/<string:matrix>/async', methods=['POST'])
@tenant_required
def export_matrix_async(matrix):
    """Encola exportación pesada → 202 Accepted + task_id."""
    from services.cmci_export import MATRIX_STYLE
    from services.cmci_tasks import submit_task
    from models.tenant import Tenant
    try:
        denied = _deny_catering()
        if denied:
            return denied
        user = TenantContext.get_current_user()
        if matrix not in MATRIX_STYLE:
            return jsonify({'error': f'matriz inválida. Use: {sorted(MATRIX_STYLE)}'}), 400
        center_id = _resolve_center(user, request.args.get('center_id', type=int))
        site_err = _ensure_site_access(user, center_id)
        if site_err:
            return site_err
        target = center_id or TenantContext.get_current_tenant_id()
        if not target:
            return jsonify({'error': 'Centro no identificado'}), 400
        tenant = Tenant.query.get(target)
        center_name = tenant.name if tenant else 'Centro'
        try:
            f = date.fromisoformat(request.args.get('from')) if request.args.get('from') else date.today().replace(day=1)
            t = date.fromisoformat(request.args.get('to')) if request.args.get('to') else date.today()
        except ValueError:
            return jsonify({'error': 'from/to en YYYY-MM-DD'}), 400
        period = f"{f.isoformat()} al {t.isoformat()}"
        filters = f"center_id={target}, from={f.isoformat()}, to={t.isoformat()}"
        task_id = submit_task(_build_export_task, matrix, target, center_name,
                              f.isoformat(), t.isoformat(), period, filters)
        return jsonify({'task_id': task_id, 'status': 'pending',
                        'status_url': f'/api/cmci/tasks/{task_id}',
                        'stream_url': f'/api/cmci/tasks/{task_id}/stream',
                        'download_url': f'/api/cmci/tasks/{task_id}/download'}), 202
    except Exception as e:
        logger.error(f"export async {matrix} error: {e}")
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/tasks/<string:task_id>', methods=['GET'])
@tenant_required
def get_export_task(task_id):
    """Estado de la tarea (poll). Sin b64: use /download al estar done."""
    from services.cmci_tasks import get_task
    try:
        denied = _deny_catering()
        if denied:
            return denied
        task = get_task(task_id)
        if not task:
            return jsonify({'error': 'Tarea no encontrada'}), 404
        out = {'task_id': task['task_id'], 'status': task['status'],
               'error': task['error']}
        if task['status'] == 'done' and task['result']:
            out['filename'] = task['result'].get('filename')
            out['size_bytes'] = task['result'].get('size_bytes')
            out['download_url'] = f'/api/cmci/tasks/{task_id}/download'
        return jsonify(out), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/tasks/<string:task_id>/download', methods=['GET'])
@tenant_required
def download_export_task(task_id):
    """Descarga el xlsx cuando la tarea está done (listo para imprimir)."""
    from services.cmci_tasks import get_task
    try:
        denied = _deny_catering()
        if denied:
            return denied
        task = get_task(task_id)
        if not task:
            return jsonify({'error': 'Tarea no encontrada'}), 404
        if task['status'] != 'done' or not task['result']:
            return jsonify({'task_id': task_id, 'status': task['status'],
                            'error': task['error']}), 202
        raw = base64.b64decode(task['result']['b64'])
        return send_file(io.BytesIO(raw),
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True,
                         download_name=task['result'].get('filename', f'{task_id}.xlsx'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cmci_reports_bp.route('/tasks/<string:task_id>/stream', methods=['GET'])
@tenant_required
def stream_export_task(task_id):
    """SSE del estado de la tarea (usa sse_manager existente)."""
    from services.cmci_tasks import get_task
    from services.sse_manager import SSEManager
    denied = _deny_catering()
    if denied:
        return denied

    def _gen():
        task = get_task(task_id)
        if not task:
            yield SSEManager.create_error_event('Tarea no encontrada')
            return
        yield SSEManager.create_progress_event(
            'export', f"Exportación {task['status']}: {task_id}")
        if task['status'] == 'done' and task['result']:
            yield SSEManager.create_result_event(
                'Exportación lista para descargar/imprimir',
                {'task_id': task_id,
                 'download_url': f'/api/cmci/tasks/{task_id}/download',
                 'filename': task['result'].get('filename')})
        elif task['status'] == 'failed':
            yield SSEManager.create_error_event(task['error'] or 'Falló la exportación')

    return Response(_gen(), mimetype='text/event-stream')
