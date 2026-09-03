from utils.role_helpers import is_multi_center_role
"""Reports API endpoints"""
from flask import Blueprint, request, jsonify, send_file
from middleware.tenant_context import tenant_required, TenantContext
from flask_jwt_extended import get_jwt_identity
from models import db
from models.report import GeneratedReport
from models.tenant import Tenant
from services.report_generator import ReportGenerator
from services.export_service import ExportService
from datetime import date, datetime
import os
import logging

logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__, url_prefix='/reports')

# Directory to store generated reports
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'reports', 'output')
os.makedirs(REPORTS_DIR, exist_ok=True)


def get_target_tenant_ids(user, requested_tenant_id=None):
    """Helper to get allowed tenant IDs for the current user"""
    if is_multi_center_role(user):
        from models.license import LicenseAdmin
        lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if lic_admin:
            all_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
            allowed_ids = [t.id for t in all_tenants]
            
            if requested_tenant_id:
                if requested_tenant_id in allowed_ids:
                    return [requested_tenant_id]
                else:
                    return None  # Access denied
            else:
                return allowed_ids
    else:
        return [TenantContext.get_current_tenant_id()]


@reports_bp.route('/', methods=['GET'])
@tenant_required
def list_reports():
    """List generated reports - filtered by current user"""
    try:
        user = TenantContext.get_current_user()
        user_id = user.id  # Save before any session operations
        requested_tenant_id = request.args.get('tenant_id', type=int)
        target_tenant_ids = get_target_tenant_ids(user, requested_tenant_id)
        
        if target_tenant_ids is None:
            return jsonify({'error': 'Acceso denegado'}), 403

        if not target_tenant_ids:
            return jsonify({'reports': []}), 200

        # Show all reports for the tenant(s) — includes agent-generated reports
        reports = GeneratedReport.query.filter(
            GeneratedReport.tenant_id.in_(target_tenant_ids)
        ).order_by(GeneratedReport.generated_date.desc()).limit(50).all()
        
        return jsonify({'reports': [r.to_dict() for r in reports]}), 200
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/generate', methods=['POST'])
@tenant_required
def generate_report():
    """
    Generate a new report
    Body: { report_type, start_date, end_date, export_format }
    """
    db.session.rollback()  # Preventive rollback
    
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        # Determine target tenant(s)
        is_global = False
        if is_multi_center_role(user):
            if not requested_tenant_id:
                # Global report: get all tenant IDs for this license admin
                all_tenant_ids = get_target_tenant_ids(user)
                if not all_tenant_ids:
                    return jsonify({'error': 'No tiene centros asignados'}), 400
                is_global = True
                target_tenant_id = all_tenant_ids  # Pass list to generator
            else:
                target_tenant_ids = get_target_tenant_ids(user, requested_tenant_id)
                if target_tenant_ids is None:
                    return jsonify({'error': 'Acceso denegado al centro solicitado'}), 403
                target_tenant_id = target_tenant_ids[0]
        else:
            target_tenant_id = TenantContext.get_current_tenant_id()

        if target_tenant_id is None or (isinstance(target_tenant_id, list) and len(target_tenant_id) == 0):
            return jsonify({'error': 'Tenant no identificado'}), 400

        # Parse parameters
        report_type = data.get('report_type', 'general').lower()
        export_format = data.get('export_format', 'pdf').lower()
        
        try:
            start_date_str = data.get('start_date')
            end_date_str = data.get('end_date')
            start_dt = date.fromisoformat(start_date_str) if start_date_str else date.today().replace(day=1)
            end_dt = date.fromisoformat(end_date_str) if end_date_str else date.today()
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

        # Get tenant info for report header
        if is_global:
            center_name = "Consolidado Global"
            record_tenant_id = target_tenant_id[0]  # For DB record
        else:
            tenant = Tenant.query.get(target_tenant_id)
            center_name = tenant.name if tenant else "Centro"
            record_tenant_id = target_tenant_id
        
        # Generate report data
        logger.info(f"Generating {report_type} report for tenant {target_tenant_id}")
        report_data = ReportGenerator.generate(report_type, target_tenant_id, start_dt, end_dt)
        
        # Export to requested format
        filename_base = f"{report_type}_{start_dt.isoformat()}_{end_dt.isoformat()}"
        
        if export_format == 'pdf':
            file_buffer = ExportService.to_pdf(report_data, center_name)
            filename = f"{filename_base}.pdf"
            content_type = 'application/pdf'
        elif export_format == 'csv':
            file_buffer = ExportService.to_csv(report_data)
            filename = f"{filename_base}.csv"
            content_type = 'text/csv'
        elif export_format == 'excel':
            file_buffer = ExportService.to_excel(report_data, center_name)
            filename = f"{filename_base}.xlsx"
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            return jsonify({'error': f'Formato no soportado: {export_format}'}), 400
        
        # Save file to disk
        file_prefix = 'global' if is_global else str(record_tenant_id)
        file_path = os.path.join(REPORTS_DIR, f"{file_prefix}_{filename}")
        with open(file_path, 'wb') as f:
            f.write(file_buffer.read())
        file_buffer.seek(0)
        
        # Create report record with retry logic for stale connections
        title_map = {
            'asistencia': 'Reporte de Asistencia',
            'asistencia_matriz': 'Reporte de Asistencia (Matriz/Mes)',
            'ninos_matriz': 'Matriz Global de Niños y Familias',
            'salud': 'Reporte de Salud y Nutrición',
            'desarrollo': 'Reporte de Desarrollo Infantil',
            'general': 'Reporte General del Centro'
        }
        
        # Save user.id before any session manipulation (avoid DetachedInstanceError)
        current_user_id = user.id
        report_title = title_map.get(report_type, 'Reporte')
        
        # Retry logic for MySQL "gone away" error
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Ensure fresh connection before commit
                db.session.rollback()
                
                report = GeneratedReport(
                    tenant_id=record_tenant_id,
                    title=report_title,
                    type=report_type.capitalize(),
                    generated_by_id=current_user_id,
                    file_path=file_path,
                    start_date=start_dt,
                    end_date=end_dt,
                    format=export_format
                )
                
                db.session.add(report)
                db.session.commit()
                
                logger.info(f"Report generated successfully: {report.id}")
                
                return jsonify({
                    'message': 'Reporte generado exitosamente',
                    'report': report.to_dict(),
                    'summary': report_data.get('summary', {})
                }), 201
                
            except Exception as commit_error:
                db.session.rollback()
                error_str = str(commit_error).lower()
                
                if 'gone away' in error_str or 'broken pipe' in error_str:
                    logger.warning(f"Connection lost on attempt {attempt + 1}, retrying...")
                    # Force session removal to get fresh connection
                    db.session.remove()
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(0.5)  # Brief pause before retry
                        continue
                    else:
                        logger.error("Max retries reached for DB commit")
                        raise
                else:
                    raise
        
    except ValueError as e:
        db.session.rollback()
        logger.error(f"ValueError generating report: {e}")
        print(f"DEBUG: ValueError generating report: {e}") # Direct stdout
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error generating report: {e}")
        import traceback
        traceback.print_exc() # Print full stack trace
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/download/<int:report_id>', methods=['GET'])
@tenant_required
def download_report(report_id):
    """Download a generated report file"""
    try:
        user = TenantContext.get_current_user()
        report = GeneratedReport.query.get(report_id)
        
        if not report:
            return jsonify({'error': 'Reporte no encontrado'}), 404
        
        # Permission check
        target_tenant_ids = get_target_tenant_ids(user)
        if report.tenant_id not in target_tenant_ids:
            return jsonify({'error': 'No tiene acceso a este reporte'}), 403
        
        if not report.file_path or not os.path.exists(report.file_path):
            return jsonify({'error': 'Archivo del reporte no encontrado'}), 404
        
        # Determine content type
        content_types = {
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        content_type = content_types.get(report.format, 'application/octet-stream')
        
        # Get filename from path
        filename = os.path.basename(report.file_path)
        
        return send_file(
            report.file_path,
            mimetype=content_type,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error downloading report: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/public/<string:token>', methods=['GET'])
def public_download_report(token):
    """Public download endpoint — uses token (no JWT required). Safe for sharing in chat."""
    try:
        if not token or len(token) < 16:
            return jsonify({'error': 'Token inválido'}), 400

        report = GeneratedReport.query.filter_by(download_token=token).first()
        
        if not report:
            return jsonify({'error': 'Reporte no encontrado o token inválido'}), 404
        
        if not report.file_path or not os.path.exists(report.file_path):
            return jsonify({'error': 'Archivo del reporte no disponible'}), 404
        
        content_types = {
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        content_type = content_types.get(report.format, 'application/octet-stream')
        filename = os.path.basename(report.file_path)
        
        logger.info(f"📥 Public download: report {report.id} (token={token[:8]}...)")
        return send_file(
            report.file_path,
            mimetype=content_type,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error in public_download_report: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/file/<string:token>', methods=['GET'])
def file_download_fallback(token):
    """Fallback download using disk-stored token→path map (for when DB save fails)."""
    try:
        token_map_path = os.path.join(REPORTS_DIR, f"{token}.path")
        if not os.path.exists(token_map_path):
            return jsonify({'error': 'Archivo no encontrado'}), 404
        
        with open(token_map_path, 'r') as f:
            file_path = f.read().strip()
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Archivo no disponible'}), 404
        
        ext = os.path.splitext(file_path)[1].lower()
        content_types = {
            '.pdf': 'application/pdf',
            '.csv': 'text/csv',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        content_type = content_types.get(ext, 'application/octet-stream')
        return send_file(file_path, mimetype=content_type, as_attachment=True,
                         download_name=os.path.basename(file_path))
    except Exception as e:
        logger.error(f"Error in file_download_fallback: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/<int:report_id>', methods=['DELETE'])
@tenant_required
def delete_report(report_id):
    """Delete a report - removes from DB and deletes file from disk"""
    try:
        user = TenantContext.get_current_user()
        user_id = user.id  # Save before session operations
        
        report = GeneratedReport.query.get(report_id)
        
        if not report:
            return jsonify({'error': 'Reporte no encontrado'}), 404
        
        # Only the owner can delete their own reports
        if report.generated_by_id != user_id:
            return jsonify({'error': 'Solo puede eliminar sus propios reportes'}), 403
        
        # Get file path before deleting record
        file_path = report.file_path
        
        # Delete from database
        db.session.delete(report)
        db.session.commit()
        
        # Delete file from disk if it exists
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted report file: {file_path}")
            except OSError as e:
                logger.warning(f"Could not delete file {file_path}: {e}")
        
        logger.info(f"Report {report_id} deleted by user {user_id}")
        
        return jsonify({'message': 'Reporte eliminado correctamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting report: {e}")
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/export-sheets', methods=['POST'])
@tenant_required
def export_to_sheets():
    """
    Export report data directly to Google Sheets
    Body: { report_type, start_date, end_date }
    Returns: { sheet_url }
    """
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        # Determine target tenant
        if is_multi_center_role(user):
            if not requested_tenant_id:
                all_tenant_ids = get_target_tenant_ids(user)
                if not all_tenant_ids:
                    return jsonify({'error': 'No tiene centros asignados'}), 400
                target_tenant_id = all_tenant_ids
            else:
                target_tenant_ids = get_target_tenant_ids(user, requested_tenant_id)
                if target_tenant_ids is None:
                    return jsonify({'error': 'Acceso denegado'}), 403
                target_tenant_id = target_tenant_ids[0]
        else:
            target_tenant_id = TenantContext.get_current_tenant_id()

        # Get Google credentials from tenant/company
        tenant = Tenant.query.get(target_tenant_id)
        if not tenant:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        # Try to get Google credentials
        import google.oauth2.credentials
        google_creds = None
        
        # Check if company has Google OAuth configured
        if hasattr(tenant, 'license') and tenant.license:
            license_obj = tenant.license
            if hasattr(license_obj, 'api_keys') and license_obj.api_keys:
                google_oauth = license_obj.api_keys.get('google_oauth_credentials')
                if google_oauth:
                    try:
                        google_creds = google.oauth2.credentials.Credentials.from_authorized_user_info(
                            google_oauth,
                            scopes=['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
                        )
                    except Exception as e:
                        logger.warning(f"Failed to load Google credentials: {e}")
        
        if not google_creds:
            return jsonify({
                'error': 'Integración con Google no configurada. Configure OAuth en la configuración del sistema.'
            }), 400
        
        # Parse dates
        report_type = data.get('report_type', 'general').lower()
        try:
            start_dt = date.fromisoformat(data.get('start_date')) if data.get('start_date') else date.today().replace(day=1)
            end_dt = date.fromisoformat(data.get('end_date')) if data.get('end_date') else date.today()
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido'}), 400
        
        # Generate report data
        report_data = ReportGenerator.generate(report_type, target_tenant_id, start_dt, end_dt)
        
        # Export to Google Sheets
        sheet_title = f"{report_data.get('title', 'Reporte')} - {tenant.name}"
        sheet_url = ExportService.to_google_sheets(report_data, google_creds, sheet_title)
        
        logger.info(f"Report exported to Google Sheets: {sheet_url}")
        
        return jsonify({
            'message': 'Reporte exportado a Google Sheets',
            'sheet_url': sheet_url
        }), 200
        
    except Exception as e:
        logger.error(f"Error exporting to Sheets: {e}")
        return jsonify({'error': str(e)}), 500
