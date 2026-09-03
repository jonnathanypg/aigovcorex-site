"""
Coordinator API - Gestión de un Centro Específico
Accesible por usuarios con rol center_coordinator
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.tenant import Tenant
from models.child import Child
from models.attendance import Attendance
from datetime import datetime, date

coordinator_bp = Blueprint('coordinator', __name__, url_prefix='/api/coordinator')


def require_coordinator(f):
    """Decorator to require center_coordinator role"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user or user.role.name != 'center_coordinator':
            return jsonify({'error': 'Acceso denegado. Se requiere rol de Coordinador'}), 403
        
        if not user.tenant_id:
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 400
            
        return f(user, *args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@coordinator_bp.route('/dashboard', methods=['GET'])
@require_coordinator
def get_dashboard(user):
    """Obtener datos del dashboard del coordinador"""
    try:
        center = Tenant.query.get(user.tenant_id)
        
        if not center:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        # Contar personal activo en el centro
        staff_count = User.query.filter_by(
            tenant_id=center.id,
            is_active=True
        ).count()
        
        # Contar niños activos (using status='activo' instead of is_active=True)
        children_count = Child.query.filter_by(
            tenant_id=center.id,
            status='activo'
        ).count()
        
        # Calcular asistencia de hoy
        today = date.today()
        try:
            attendance_today = Attendance.query.filter_by(
                tenant_id=center.id,
                date=today
            ).all()
            
            present_count = sum(1 for a in attendance_today if a.status == 'presente')
            attendance_rate = round((present_count / children_count * 100), 1) if children_count > 0 else 0
        except Exception:
            attendance_rate = 0
        
        # Alertas pendientes
        pending_alerts = 0
        
        return jsonify({
            'center': {
                'id': center.id,
                'name': center.name,
                'city': getattr(center, 'city', ''),
                'province': getattr(center, 'province', ''),
                'max_capacity': getattr(center, 'max_capacity', 40),
                'current_enrollment': getattr(center, 'current_enrollment', children_count)
            },
            'stats': {
                'current_enrollment': children_count,
                'today_attendance': attendance_rate,
                'total_staff': staff_count,
                'pending_alerts': pending_alerts
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@coordinator_bp.route('/staff', methods=['GET'])
@require_coordinator
def get_staff(user):
    """Obtener lista de personal del centro"""
    try:
        center = Tenant.query.get(user.tenant_id)
        
        staff = User.query.filter_by(tenant_id=center.id).all()
        
        staff_list = []
        for member in staff:
            staff_list.append({
                'id': member.id,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'email': member.email,
                'phone': member.phone,
                'role': member.role.name,
                'is_active': member.is_active
            })
        
        return jsonify({'staff': staff_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@coordinator_bp.route('/children', methods=['GET'])
@require_coordinator
def get_children(user):
    """Obtener lista de niños del centro"""
    try:
        center = Tenant.query.get(user.tenant_id)
        
        search = request.args.get('search', '').lower()
        
        query = Child.query.filter_by(tenant_id=center.id)
        
        if search:
            query = query.filter(
                db.or_(
                    Child.first_name.ilike(f'%{search}%'),
                    Child.last_name.ilike(f'%{search}%')
                )
            )
        
        children = query.all()
        
        children_list = []
        for child in children:
            children_list.append({
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name,
                'full_name': child.full_name,
                'birth_date': child.birth_date.isoformat() if child.birth_date else None,
                'age_months': child.age_months,
                'status': child.status,
                'enrollment_date': child.enrollment_date.isoformat() if child.enrollment_date else None,
                'assigned_group': child.assigned_group
            })
        
        return jsonify({'children': children_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@coordinator_bp.route('/children', methods=['POST'])
@require_coordinator
def register_child(user):
    """Registrar un nuevo niño en el centro"""
    try:
        data = request.get_json()
        center = Tenant.query.get(user.tenant_id)
        
        # Validar capacidad
        current_children = Child.query.filter_by(
            tenant_id=center.id,
            is_active=True
        ).count()
        
        if current_children >= center.max_capacity:
            return jsonify({'error': 'Centro ha alcanzado su capacidad máxima'}), 400
        
        # Crear niño
        child = Child(
            tenant_id=center.id,
            first_name=data['first_name'],
            last_name=data['last_name'],
            date_of_birth=datetime.strptime(data.get('date_of_birth'), '%Y-%m-%d').date() if data.get('date_of_birth') else None,
            enrollment_date=date.today(),
            is_active=True
        )
        
        db.session.add(child)
        
        # Actualizar conteo del centro
        center.current_enrollment = current_children + 1
        
        db.session.commit()
        
        return jsonify({
            'message': 'Niño inscrito exitosamente',
            'child': {
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@coordinator_bp.route('/activity', methods=['GET'])
@require_coordinator
def get_recent_activity(user):
    """Obtener actividad reciente del centro"""
    try:
        # Placeholder - en producción esto vendría de un log de actividades
        activities = [
            {
                'time': '08:30',
                'user': 'María González',
                'action': 'Registró asistencia del grupo "Los Pollitos"'
            },
            {
                'time': '09:15',
                'user': 'Dr. Carlos Ruiz',
                'action': 'Completó ficha médica de Juan Pérez'
            },
            {
                'time': '10:00',
                'user': 'Ana López',
                'action': 'Subió reporte de nutrición semanal'
            }
        ]
        
        return jsonify({'activities': activities}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
