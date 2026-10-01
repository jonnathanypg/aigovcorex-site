from utils.role_helpers import is_multi_center_role
"""
Dashboard Statistics API
Provides consolidated KPIs for the dashboard
"""
from flask import Blueprint, jsonify, request
from models import db
from models.child import Child
from models.attendance import Attendance
from models.tenant import Tenant
from models.application import Application
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from datetime import date, datetime
from utils.time_utils import get_today_date

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get consolidated dashboard statistics"""
    db.session.rollback()
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 401
    
    # Use Dynamic Timezone
    today = get_today_date(user)
    requested_tenant_id = request.args.get('tenant_id', type=int)
    # Filtro periodo personalizado ?from=YYYY-MM-DD&to=YYYY-MM-DD (opcional)
    from datetime import datetime as _dt
    f_from = f_to = None
    try:
        _fr = request.args.get('from') or request.args.get('start')
        _to = request.args.get('to') or request.args.get('end')
        if _fr:
            f_from = _dt.strptime(_fr[:10], '%Y-%m-%d').date()
        if _to:
            f_to = _dt.strptime(_to[:10], '%Y-%m-%d').date()
    except Exception:
        f_from = f_to = None
    period_start = f_from or today
    period_end = f_to or today
    has_custom_range = bool(f_from or f_to)
    
    is_super_admin = user.role.name == 'super_admin'
    is_license_admin = is_multi_center_role(user)
    
    target_tenant_ids = []
    scope_tenants = []
    
    # Determine scope
    if is_super_admin:
        if requested_tenant_id:
            target_tenant_ids = [requested_tenant_id]
        else:
            # All active tenants
            scope_tenants = Tenant.query.filter_by(is_active=True).all()
            target_tenant_ids = [t.id for t in scope_tenants]
            
    elif is_license_admin:
        from models.license import LicenseAdmin
        lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        
        if lic_admin:
            scope_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
            allowed_ids = [t.id for t in scope_tenants]
            
            if requested_tenant_id:
                if requested_tenant_id in allowed_ids:
                    target_tenant_ids = [requested_tenant_id]
                else:
                    return jsonify({'error': 'Acceso denegado al centro solicitado'}), 403
            else:
                target_tenant_ids = allowed_ids
        else:
            target_tenant_ids = [] # No license assigned
            
    else:
        # Regular user
        if user.tenant_id:
            target_tenant_ids = [user.tenant_id]
        else:
            target_tenant_ids = [] # User without assigned center
        
    if not target_tenant_ids:
        # No access or empty license
        return jsonify({
            'total_children': 0,
            'attendance_rate': 0,
            'present_today': 0,
            'expected_today': 0,
            'critical_alerts': 0,
            'pending_applications': 0,
            'is_global': False,
            'tenant_name': user.tenant.name if user.tenant else 'Desconocido'
        }), 200

    # Execute Aggregated Queries
    total_children = Child.query.filter(
        Child.tenant_id.in_(target_tenant_ids), 
        Child.status == 'activo'
    ).count()
    
    total_expected = total_children
    
    present_today = Attendance.query.filter(
        Attendance.tenant_id.in_(target_tenant_ids),
        Attendance.date >= period_start,
        Attendance.date <= period_end,
        Attendance.status == 'presente'
    ).count()
    total_in_period = Attendance.query.filter(
        Attendance.tenant_id.in_(target_tenant_ids),
        Attendance.date >= period_start,
        Attendance.date <= period_end
    ).count() if has_custom_range else 0
    
    pending_apps = Application.query.filter(
        Application.center_id.in_(target_tenant_ids),
        Application.status.in_(['pending', 'waitlist'])
    ).count()
    
    # Calculate attendance rate (rango personalizado: presentes/registros del periodo; por defecto: presentes hoy / total niños)
    if has_custom_range and total_in_period > 0:
        attendance_rate = (present_today / total_in_period * 100)
    else:
        attendance_rate = (present_today / total_expected * 100) if total_expected > 0 else 0
    
    # Health Alerts
    from models.health import HealthRecord
    from datetime import timedelta
    week_ago = today - timedelta(days=7)
    alert_start = f_from or week_ago
    alert_end = f_to or today
    
    critical_alerts = HealthRecord.query.filter(
        HealthRecord.tenant_id.in_(target_tenant_ids),
        HealthRecord.record_type.in_(['incidente', 'enfermedad']),
        HealthRecord.record_date >= alert_start,
        HealthRecord.record_date <= alert_end
    ).count()
    
    # Also count unread alert-type notifications
    from models.notification import Notification
    unread_alerts = Notification.query.filter(
        Notification.tenant_id.in_(target_tenant_ids),
        Notification.type == 'Alerta',
        Notification.read == False
    ).count()
    critical_alerts += unread_alerts
    
    # Determine if showing global breakdown (admin/license_admin with no specific tenant selected)
    is_global_view = (is_super_admin or is_license_admin) and (requested_tenant_id is None)
    
    response = {
        'total_children': total_children,
        'attendance_rate': round(attendance_rate, 1),
        'present_today': present_today,
        'expected_today': total_expected,
        'critical_alerts': critical_alerts,
        'pending_applications': pending_apps,
        'is_global': is_global_view,
        'tenant_name': 'Vista Global' if is_global_view else (Tenant.query.get(target_tenant_ids[0]).name if target_tenant_ids else 'N/A')
    }
    
    if is_global_view:
        response['tenants_summary'] = [
            {
                'id': t.id,
                'name': t.name,
                'children_count': Child.query.filter_by(tenant_id=t.id, status='activo').count(),
                'capacity': t.max_capacity
            }
            for t in scope_tenants
        ]
    
    return jsonify(response), 200


@dashboard_bp.route('/recent-applications', methods=['GET'])
@jwt_required()
def get_recent_applications():
    """Get recent applications for dashboard"""
    db.session.rollback()
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 401
    
    limit = request.args.get('limit', 6, type=int)
    requested_tenant_id = request.args.get('tenant_id', type=int)
    
    target_tenant_ids = []
    
    # ---------------------------------------------------------
    # Determine Scope (Reuse logic similar to get_stats)
    # ---------------------------------------------------------
    if user.role.name == 'super_admin':
        if requested_tenant_id:
            target_tenant_ids = [requested_tenant_id]
        else:
            # All active tenants
            tenants = Tenant.query.filter_by(is_active=True).all()
            target_tenant_ids = [t.id for t in tenants]
            
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
                    return jsonify({'error': 'Acceso denegado al centro solicitado'}), 403
            else:
                target_tenant_ids = allowed_ids
        else:
            target_tenant_ids = []
            
    else:
        # Regular user
        if user.tenant_id:
            target_tenant_ids = [user.tenant_id]
        else:
            target_tenant_ids = [] # User not assigned yet
            
    if not target_tenant_ids:
        return jsonify({'applications': []}), 200

    # Filtro periodo opcional ?from/?to sobre application_date
    from datetime import datetime as _dt2
    q = Application.query.filter(
        Application.center_id.in_(target_tenant_ids),
        Application.status.in_(['pending', 'waitlist'])
    )
    try:
        _fr = request.args.get('from') or request.args.get('start')
        _to = request.args.get('to') or request.args.get('end')
        if _fr:
            _fd = _dt2.strptime(_fr[:10], '%Y-%m-%d').date()
            q = q.filter(Application.application_date >= _fd)
        if _to:
            _td = _dt2.strptime(_to[:10], '%Y-%m-%d').date()
            q = q.filter(Application.application_date <= _td)
    except Exception:
        pass
    # Execute Query
    applications = q.order_by(Application.application_date.desc()).limit(limit).all()
    
    return jsonify({
        'applications': [
            {
                'id': app.id,
                'child_name': app.child.full_name if app.child else 'Desconocido',
                'status': app.status,
                'submission_date': app.application_date.isoformat() if app.application_date else None,
                'center': app.center.name if app.center else 'N/A'
            }
            for app in applications
        ]
    }), 200
