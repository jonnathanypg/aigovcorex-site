"""
Educator API - Gestión de Grupo y Actividades Diarias
Accesible por usuarios con rol educadora
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.child import Child
from models.attendance import Attendance
from datetime import datetime, date

educator_bp = Blueprint('educator', __name__, url_prefix='/api/educator')


def require_educator(f):
    """Decorator to require educadora role"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user or user.role.name != 'educadora':
            return jsonify({'error': 'Acceso denegado. Se requiere rol de Educadora'}), 403
        
        if not user.tenant_id:
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 400
            
        return f(user, *args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@educator_bp.route('/dashboard', methods=['GET'])
@require_educator
def get_dashboard(user):
    """Obtener datos del dashboard de la educadora"""
    try:
        # Solo niños asignados a esta educadora
        children = Child.query.filter_by(
            tenant_id=user.tenant_id,
            assigned_educator_id=user.id,
            status='activo'
        ).all()
        children_count = len(children)
        child_ids = [c.id for c in children]
        
        today = date.today()
        if child_ids:
            attendance_today = Attendance.query.filter_by(
                tenant_id=user.tenant_id, date=today
            ).filter(Attendance.child_id.in_(child_ids)).all()
        else:
            attendance_today = []
        
        present_count = sum(1 for a in attendance_today if a.status in ('presente', 'present'))
        absent_count = sum(1 for a in attendance_today if a.status in ('ausente', 'absent'))
        
        # Actividades pendientes (placeholder)
        pending_activities = 0
        
        return jsonify({
            'educator': {
                'name': f"{user.first_name} {user.last_name}",
                'center_name': user.tenant.name if user.tenant else 'N/A'
            },
            'stats': {
                'my_children_count': children_count,
                'present_today': present_count,
                'absent_today': absent_count,
                'pending_activities': pending_activities
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/children', methods=['GET'])
@require_educator
def get_my_children(user):
    """Obtener lista de niños asignados a la educadora"""
    try:
        children = Child.query.filter_by(
            tenant_id=user.tenant_id,
            assigned_educator_id=user.id,
            status='activo'
        ).all()
        
        children_list = []
        for child in children:
            children_list.append({
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name,
                'birth_date': child.birth_date.isoformat() if child.birth_date else None,
                'age_months': child.age_months,
                'status': child.status
            })
        
        return jsonify({'children': children_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/attendance', methods=['GET'])
@require_educator
def get_attendance(user):
    """Obtener asistencia del día"""
    try:
        date_str = request.args.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = date.today()
        
        # Solo niños asignados a la educadora
        children = Child.query.filter_by(
            tenant_id=user.tenant_id,
            assigned_educator_id=user.id,
            status='activo'
        ).all()
        child_ids = [c.id for c in children]
        
        attendance_records = Attendance.query.filter(
            Attendance.tenant_id == user.tenant_id,
            Attendance.date == target_date
        ).filter(Attendance.child_id.in_(child_ids)).all() if child_ids else []
        
        # Crear diccionario de asistencia
        attendance_dict = {a.child_id: a for a in attendance_records}
        
        attendance_list = []
        for child in children:
            attendance = attendance_dict.get(child.id)
            attendance_list.append({
                'child_id': child.id,
                'child_name': f"{child.first_name} {child.last_name}",
                'status': attendance.status if attendance else None,
                'notes': attendance.notes if attendance else ''
            })
        
        return jsonify({
            'date': target_date.isoformat(),
            'attendance': attendance_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/attendance', methods=['POST'])
@require_educator
def save_attendance(user):
    """Guardar asistencia del día"""
    try:
        data = request.get_json()
        target_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        attendance_data = data['attendance']  # Lista de {child_id, status, notes}
        
        for item in attendance_data:
            child_id = item['child_id']
            status = item['status']
            notes = item.get('notes', '')
            
            # Verificar si ya existe registro
            attendance = Attendance.query.filter_by(
                tenant_id=user.tenant_id,
                child_id=child_id,
                date=target_date
            ).first()
            
            if attendance:
                # Actualizar
                attendance.status = status
                attendance.notes = notes
                attendance.recorded_by = user.id
            else:
                # Crear nuevo
                attendance = Attendance(
                    tenant_id=user.tenant_id,
                    child_id=child_id,
                    date=target_date,
                    status=status,
                    notes=notes,
                    recorded_by=user.id
                )
                db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({'message': 'Asistencia guardada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/activities', methods=['GET'])
@require_educator
def get_activities(user):
    """Obtener actividades registradas"""
    try:
        # Placeholder - en producción esto vendría de una tabla de actividades
        activities = [
            {
                'id': 1,
                'title': 'Lectura de cuentos',
                'description': 'Sesión de lectura con cuentos infantiles',
                'activity_type': 'pedagogica',
                'date': date.today().isoformat(),
                'educator_name': f"{user.first_name} {user.last_name}"
            }
        ]
        
        return jsonify({'activities': activities}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/activities', methods=['POST'])
@require_educator
def add_activity(user):
    """Registrar nueva actividad"""
    try:
        data = request.get_json()
        
        # Placeholder - en producción esto se guardaría en una tabla de actividades
        # Por ahora solo retornamos éxito
        
        return jsonify({
            'message': 'Actividad registrada exitosamente',
            'activity': {
                'title': data['title'],
                'description': data['description'],
                'activity_type': data['activity_type']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/summary', methods=['GET'])
@require_educator
def get_daily_summary(user):
    """Obtener resumen del día"""
    try:
        today = date.today()
        
        # Contar asistencia
        attendance_today = Attendance.query.filter_by(
            tenant_id=user.tenant_id,
            date=today
        ).all()
        
        present = sum(1 for a in attendance_today if a.status == 'present')
        absent = sum(1 for a in attendance_today if a.status == 'absent')
        excused = sum(1 for a in attendance_today if a.status == 'excused')
        
        summary = {
            'date': today.isoformat(),
            'attendance': {
                'present': present,
                'absent': absent,
                'excused': excused,
                'total': len(attendance_today)
            },
            'activities_completed': 1,  # Placeholder
            'notes': 'Día normal de actividades'
        }
        
        return jsonify({'summary': summary}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/attendance/quick-checkin', methods=['POST'])
@require_educator
def quick_checkin(user):
    """Registro rápido de entrada"""
    try:
        db.session.rollback()
        
        data = request.get_json()
        child_id = data['child_id']
        arrival_time = data.get('arrival_time')  # HH:MM format
        
        today = date.today()
        
        # Buscar o crear registro de asistencia
        attendance = Attendance.query.filter_by(
            tenant_id=user.tenant_id,
            child_id=child_id,
            date=today
        ).first()
        
        if attendance:
            # Actualizar hora de llegada
            if arrival_time:
                from datetime import datetime as dt
                attendance.arrival_time = dt.strptime(arrival_time, '%H:%M').time()
            attendance.status = 'presente'
        else:
            # Crear nuevo registro
            from datetime import datetime as dt
            attendance = Attendance(
                tenant_id=user.tenant_id,
                child_id=child_id,
                date=today,
                arrival_time=dt.strptime(arrival_time, '%H:%M').time() if arrival_time else None,
                status='presente',
                registered_by_id=user.id
            )
            db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-in registrado',
            'attendance': attendance.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/attendance/quick-checkout', methods=['POST'])
@require_educator
def quick_checkout(user):
    """Registro rápido de salida"""
    try:
        db.session.rollback()
        
        data = request.get_json()
        child_id = data['child_id']
        departure_time = data.get('departure_time')  # HH:MM format
        picked_up_by = data.get('picked_up_by', '')
        
        today = date.today()
        
        attendance = Attendance.query.filter_by(
            tenant_id=user.tenant_id,
            child_id=child_id,
            date=today
        ).first()
        
        if not attendance:
            return jsonify({'error': 'No hay registro de entrada para hoy'}), 400
        
        # Actualizar hora de salida
        if departure_time:
            from datetime import datetime as dt
            attendance.departure_time = dt.strptime(departure_time, '%H:%M').time()
        
        attendance.picked_up_by = picked_up_by
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out registrado',
            'attendance': attendance.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@educator_bp.route('/attendance/alerts', methods=['GET'])
@require_educator
def get_attendance_alerts(user):
    """Obtener alertas de inasistencia reiterada"""
    try:
        from datetime import timedelta
        
        # Últimos 30 días
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        # Obtener todos los niños
        children = Child.query.filter_by(
            tenant_id=user.tenant_id,
            status='activo'
        ).all()
        
        alerts = []
        
        for child in children:
            # Contar ausencias en los últimos 30 días
            absences = Attendance.query.filter(
                Attendance.child_id == child.id,
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status == 'ausente'
            ).count()
            
            # Alerta si más de 5 ausencias
            if absences >= 5:
                alerts.append({
                    'child_id': child.id,
                    'child_name': child.full_name,
                    'absences_count': absences,
                    'severity': 'high' if absences >= 10 else 'medium'
                })
        
        return jsonify({'alerts': alerts}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
