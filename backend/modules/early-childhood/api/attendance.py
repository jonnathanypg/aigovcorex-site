from utils.role_helpers import is_multi_center_role
"""Attendance API endpoints"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
from models import db
from models.attendance import Attendance
from models.child import Child
from datetime import datetime, date
from utils.time_utils import get_today_date, get_current_time

attendance_bp = Blueprint('attendance', __name__, url_prefix='/attendance')


def _educator_child_ids(user):
    """Ids de niños asignados a la educadora (solo si rol educadora/educator)."""
    if user.role.name not in ['educadora', 'educator']:
        return None
    return [c.id for c in Child.query.filter_by(
        tenant_id=user.tenant_id,
        assigned_educator_id=user.id,
        status='activo'
    ).all()]

@attendance_bp.route('', methods=['GET'])
@tenant_required
def get_attendance():
    """Get attendance records"""
    try:
        current_user = TenantContext.get_current_user()
        # Use Dynamic Timezone for default date
        today_date = get_today_date(current_user).isoformat()
        date_str = request.args.get('date', today_date)
        attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        query = Attendance.query.filter_by(date=attendance_date)
        
        if is_multi_center_role(current_user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            
            requested_tenant_id = request.args.get('tenant_id')
            lic_admin = LicenseAdmin.query.filter_by(user_id=current_user.id).first()
            
            # Base filter: tenants in license
            query = query.join(Tenant).filter(Tenant.license_id == lic_admin.license_id)
            
            if requested_tenant_id and requested_tenant_id != 'all':
                query = query.filter(Attendance.tenant_id == requested_tenant_id)
        elif current_user.role.name in ['educadora', 'educator']:
            tenant_id = TenantContext.get_current_tenant_id()
            query = query.filter_by(tenant_id=tenant_id)
            child_ids = _educator_child_ids(current_user)
            if child_ids:
                query = query.filter(Attendance.child_id.in_(child_ids))
            else:
                query = query.filter(Attendance.child_id == -1)  # no assigned children
        else:
            tenant_id = TenantContext.get_current_tenant_id()
            query = query.filter_by(tenant_id=tenant_id)
            
        records = query.all()
        return jsonify({'attendance': [r.to_dict() for r in records]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('', methods=['POST'])
@tenant_required
def mark_attendance():
    """Mark attendance"""
    data = request.get_json()
    child_id = data.get('child_id')
    user = TenantContext.get_current_user()
    
    if is_multi_center_role(user):
        from models.child import Child
        from models.tenant import Tenant
        from models.license import LicenseAdmin
        
        # Verify access
        child = Child.query.get(child_id)
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if not lic_admin:
            return jsonify({'error': 'No autorizado'}), 403
            
        tenant = Tenant.query.get(child.tenant_id)
        if not tenant or tenant.license_id != lic_admin.license_id:
            return jsonify({'error': 'No tienes acceso a este niño'}), 403
            
        tenant_id = child.tenant_id
    else:
        tenant_id = TenantContext.get_current_tenant_id()
        if user.role.name in ['educadora', 'educator']:
            child = Child.query.get(child_id)
            if not child or child.assigned_educator_id != user.id:
                return jsonify({'error': 'Solo puede registrar asistencia de sus niños asignados'}), 403

    target_date = datetime.strptime(data.get('date', get_today_date(user).isoformat()), '%Y-%m-%d').date()
    status = data['status']
    
    # Prevenir UniqueConstraint error con Upsert
    attendance = Attendance.query.filter_by(
        child_id=child_id,
        date=target_date
    ).first()
    
    if attendance:
        attendance.status = status
        attendance.registered_by_id = user.id
    else:
        attendance = Attendance(
            tenant_id=tenant_id,
            child_id=child_id,
            date=target_date,
            status=status,
            registered_by_id=user.id
        )
        db.session.add(attendance)
        
    # Procesar hora de llegada y notas
    if status in ('presente', 'tardanza'):
        input_time = data.get('arrival_time')
        if input_time:
            # Soporta formato HH:MM o HH:MM:SS
            attendance.arrival_time = datetime.strptime(input_time[:5], '%H:%M').time()
        elif not attendance.arrival_time:
            # Solo asignar hora actual si es nuevo o no tenía
            attendance.arrival_time = get_current_time(user)
        # Limpiar razón de ausencia si cambia de ausente a presente
        attendance.notes = None
    elif status in ('ausente', 'justificado'):
        attendance.arrival_time = None
        if data.get('notes'):
            attendance.notes = data.get('notes')
            
    db.session.commit()
    
    return jsonify({'message': 'Asistencia registrada', 'attendance': attendance.to_dict()}), 201


@attendance_bp.route('/range', methods=['GET'])
@tenant_required
def get_attendance_range():
    """Get attendance for a date range"""
    try:
        current_user = TenantContext.get_current_user()
        start = request.args.get('start_date')
        end = request.args.get('end_date')
        
        if not start or not end:
            return jsonify({'error': 'start_date y end_date son requeridos'}), 400
        
        start_date = datetime.strptime(start, '%Y-%m-%d').date()
        end_date = datetime.strptime(end, '%Y-%m-%d').date()
        
        query = Attendance.query.filter(
            Attendance.date >= start_date,
            Attendance.date <= end_date
        )
        
        if is_multi_center_role(current_user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            
            requested_tenant_id = request.args.get('tenant_id')
            lic_admin = LicenseAdmin.query.filter_by(user_id=current_user.id).first()
            
            # Base filter
            query = query.join(Tenant).filter(Tenant.license_id == lic_admin.license_id)
            
            if requested_tenant_id and requested_tenant_id != 'all':
                query = query.filter(Attendance.tenant_id == requested_tenant_id)
        elif current_user.role.name in ['educadora', 'educator']:
            tenant_id = TenantContext.get_current_tenant_id()
            query = query.filter_by(tenant_id=tenant_id)
            child_ids = _educator_child_ids(current_user)
            if child_ids:
                query = query.filter(Attendance.child_id.in_(child_ids))
            else:
                query = query.filter(Attendance.child_id == -1)
        else:
            tenant_id = TenantContext.get_current_tenant_id()
            query = query.filter_by(tenant_id=tenant_id)
            
        records = query.order_by(Attendance.date.desc()).all()
        
        return jsonify({'attendance': [r.to_dict() for r in records]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

