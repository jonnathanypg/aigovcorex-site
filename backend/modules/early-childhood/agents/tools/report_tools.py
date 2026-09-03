"""
Report Generation Tool for AI Agent
Allows the agent to generate reports (PDF/CSV/Excel) and return a download link.
Supports single-center and global (license_admin) reports.
"""
from langchain.tools import BaseTool
import os
import logging
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'reports', 'output')
os.makedirs(REPORTS_DIR, exist_ok=True)

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')


def resolve_report_tenant_ids(tenant_id, user_id, center_name: str = None):
    """
    Resolve the tenant IDs for the report.
    - If center_name is given, search by name within the user's license
    - If tenant_id is given, use directly
    - If tenant_id is None (license_admin), return all under license
    Returns: (tenant_ids: list, scope_label: str)
    """
    from agents.tools.analytics_tools import resolve_tenant_ids
    from models.tenant import Tenant

    if center_name:
        # Search for tenant by name (case-insensitive partial match)
        matches = Tenant.query.filter(
            Tenant.name.ilike(f'%{center_name}%'),
            Tenant.is_active == True
        ).all()

        if not matches:
            return [], f'No se encontró ningún centro con el nombre "{center_name}"'

        if len(matches) == 1:
            return [matches[0].id], matches[0].name

        # Multiple matches — try exact match first
        exact = [t for t in matches if t.name.lower() == center_name.lower()]
        if exact:
            return [exact[0].id], exact[0].name

        names = ', '.join(t.name for t in matches)
        return [], f'Múltiples centros encontrados: {names}. Especifica el nombre exacto.'

    ids = resolve_tenant_ids(tenant_id, user_id)
    if not ids:
        return [], 'No se encontraron centros asignados'

    if len(ids) == 1:
        from models.tenant import Tenant
        t = Tenant.query.get(ids[0])
        label = t.name if t else f'Centro {ids[0]}'
    else:
        label = f'Consolidado Global ({len(ids)} centros)'

    return ids, label


def resolve_period(period: str, start_date_str: str = None, end_date_str: str = None):
    """Resolve start and end dates from period string or explicit dates."""
    today = date.today()

    if start_date_str and end_date_str:
        try:
            return date.fromisoformat(start_date_str), date.fromisoformat(end_date_str)
        except ValueError:
            pass

    period = (period or 'mes').lower()
    if period in ('semana', 'week'):
        return today - timedelta(days=7), today
    elif period in ('mes', 'month', 'este mes'):
        return today.replace(day=1), today
    elif period in ('anio', 'año', 'year'):
        return today.replace(month=1, day=1), today
    else:
        # Default: current month
        return today.replace(day=1), today


class GenerateReportTool(BaseTool):
    """Tool to generate PDF/CSV/Excel reports and return a download link."""
    name: str = "generate_report"
    description: str = (
        "Generate a report (PDF, Excel or CSV) and return a download link to share in chat. "
        "Report types: 'asistencia', 'salud', 'desarrollo', 'general'. "
        "Formats: 'pdf' (default), 'excel', 'csv'. "
        "Periods: 'mes' (default), 'semana', 'anio'. "
        "Input: {'report_type': 'asistencia', 'format': 'pdf', 'period': 'mes', "
        "'center_name': 'CMCI Orquídeas', 'tenant_id': null, 'user_id': 1, 'license_id': 1}. "
        "For license_admin, omit tenant_id or center_name to get a global report."
    )

    def _run(self, *args, **kwargs) -> dict:
        report_type = (kwargs.get('report_type') or 'general').lower()
        export_format = (kwargs.get('format') or kwargs.get('export_format') or 'pdf').lower()
        period = kwargs.get('period', 'mes')
        center_name = kwargs.get('center_name')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')
        license_id = kwargs.get('license_id')
        start_date_str = kwargs.get('start_date')
        end_date_str = kwargs.get('end_date')

        # --- 1. Resolve tenants ---
        try:
            from models import db
            from sqlalchemy import text
            try:
                db.session.execute(text("SELECT 1"))
            except Exception:
                db.session.rollback()
                db.session.remove()

            target_ids, scope_label = resolve_report_tenant_ids(tenant_id, user_id, center_name)
        except Exception as e:
            logger.error(f"❌ Error resolving tenant: {e}")
            db.session.rollback()
            db.session.remove()
            try:
                target_ids, scope_label = resolve_report_tenant_ids(tenant_id, user_id, center_name)
            except Exception as e2:
                return {'success': False, 'error': f'No se pudo resolver el centro: {e2}'}

        if not target_ids:
            return {'success': False, 'error': scope_label}

        # --- 2. Resolve period ---
        start_dt, end_dt = resolve_period(period, start_date_str, end_date_str)

        # --- 3. Validate ---
        valid_types = ['asistencia', 'salud', 'desarrollo', 'general']
        if report_type not in valid_types:
            return {'success': False, 'error': f'Tipo de reporte inválido. Use: {", ".join(valid_types)}'}

        valid_formats = ['pdf', 'csv', 'excel']
        if export_format not in valid_formats:
            export_format = 'pdf'

        # --- 4. Generate data ---
        try:
            from services.report_generator import ReportGenerator
            tenant_arg = target_ids if len(target_ids) > 1 else target_ids[0]
            report_data = ReportGenerator.generate(report_type, tenant_arg, start_dt, end_dt)
        except Exception as e:
            logger.error(f"❌ ReportGenerator error: {e}")
            return {'success': False, 'error': f'Error generando datos del reporte: {e}'}

        # --- 5. Export to file ---
        try:
            from services.export_service import ExportService
            filename_base = f"{report_type}_{start_dt.isoformat()}_{end_dt.isoformat()}"
            prefix = 'global' if len(target_ids) > 1 else str(target_ids[0])
            import uuid as _uuid
            token = _uuid.uuid4().hex

            if export_format == 'pdf':
                file_buffer = ExportService.to_pdf(report_data, scope_label)
                filename = f"{prefix}_{filename_base}.pdf"
            elif export_format == 'csv':
                file_buffer = ExportService.to_csv(report_data)
                filename = f"{prefix}_{filename_base}.csv"
            else:  # excel
                file_buffer = ExportService.to_excel(report_data, scope_label)
                filename = f"{prefix}_{filename_base}.xlsx"

            file_path = os.path.join(REPORTS_DIR, filename)
            with open(file_path, 'wb') as f:
                f.write(file_buffer.read())

        except Exception as e:
            logger.error(f"❌ ExportService error: {e}")
            return {'success': False, 'error': f'Error exportando el archivo: {e}'}

        # --- 6. Save DB record with download_token ---
        try:
            from models import db
            from models.report import GeneratedReport

            title_map = {
                'asistencia': 'Reporte de Asistencia',
                'salud': 'Reporte de Salud y Nutrición',
                'desarrollo': 'Reporte de Desarrollo Infantil',
                'general': 'Reporte General'
            }

            db.session.rollback()
            report = GeneratedReport(
                tenant_id=target_ids[0],  # Use first tenant for DB record
                title=f"{title_map.get(report_type, 'Reporte')} — {scope_label}",
                type=report_type.capitalize(),
                generated_by_id=user_id if user_id and user_id > 0 else None,
                file_path=file_path,
                start_date=start_dt,
                end_date=end_dt,
                format=export_format,
                download_token=token
            )
            db.session.add(report)
            db.session.commit()
            logger.info(f"✅ Report saved: id={report.id} token={token}")

        except Exception as e:
            logger.error(f"❌ DB save error: {e}")
            db.session.rollback()
            # Still return a result — the file was generated even if DB save fails
            download_url = f"{BACKEND_URL}/api/reports/file/{token}"
            # Save token → file mapping to disk as fallback
            token_map_path = os.path.join(REPORTS_DIR, f"{token}.path")
            with open(token_map_path, 'w') as f:
                f.write(file_path)

            summary = report_data.get('summary', {})
            instruction = f"IMPORTANT: Diles que el reporte está listo y pon EXACTAMENTE esta cadena invisible al final de tu respuesta: [ATTACH_REPORT:{download_url}|{filename}]"
            return {
                'success': True,
                'warning': 'Reporte generado pero no se pudo registrar en DB.',
                'download_url': download_url,
                'report_title': title_map.get(report_type, 'Reporte'),
                'scope': scope_label,
                'period': f"{start_dt.isoformat()} al {end_dt.isoformat()}",
                'summary': summary,
                'format': export_format.upper(),
                'instruction_to_ai': instruction
            }

        summary = report_data.get('summary', {})
        download_url = f"{BACKEND_URL}/api/reports/public/{token}"
        instruction = f"IMPORTANT: Diles que el reporte está listo y pon EXACTAMENTE esta cadena oculta al final de tu respuesta: [ATTACH_REPORT:{download_url}|{filename}]"

        return {
            'success': True,
            'download_url': download_url,
            'report_title': report.title,
            'scope': scope_label,
            'period': f"{start_dt.isoformat()} al {end_dt.isoformat()}",
            'summary': summary,
            'format': export_format.upper(),
            'message': f"✅ Reporte listo. Descárgalo aquí: {download_url}",
            'instruction_to_ai': instruction
        }
