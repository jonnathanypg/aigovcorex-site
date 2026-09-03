"""
License Admin API - Gestión de Centros
Accesible por usuarios con rol license_admin
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.license import License, LicenseAdmin, SponsorLogo
from models.user import User, Role
from models.tenant import Tenant
from models.attendance import Attendance
from models.health import HealthRecord, MedicalProfile, Vaccine
from models.milestone import Milestone
from models.nutrition import NutritionAlert, NutritionDaily, Menu
from models.child import Child, Family, Representative
from models.application import Application, VulnerabilityForm, WaitingList
from models.document import Document
from models.notification import Notification
from models.operation import MaintenanceTask
from models.intervention import FamilyIntervention
from models.report import GeneratedReport
from sqlalchemy import func, and_, text
from datetime import datetime, date, timedelta
from utils.time_utils import get_today_date
import bcrypt
import logging

logger = logging.getLogger(__name__)

license_admin_bp = Blueprint('license_admin', __name__, url_prefix='/api/license-admin')


@license_admin_bp.route('/public-config', methods=['GET'])
def get_public_config():
    """Endpoint público para obtener configuración básica de la marca/licencia"""
    try:
        from models.license import License, SponsorLogo
        license_obj = License.query.filter_by(status='active').first()
        logos = SponsorLogo.query.all()
        return jsonify({
            'license_name': license_obj.name if license_obj else 'AI GovCoreX OS',
            'legal_name': license_obj.legal_name if license_obj else 'AI GovCoreX OS Platform',
            'sponsor_logos': [l.to_dict() for l in logos] if logos else []
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500



def require_license_admin(f):

    """Decorator to require license_admin or supervisor role"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user or user.role.name not in ('license_admin', 'supervisor'):
            return jsonify({'error': 'Acceso denegado. Se requiere rol de License Admin o Supervisor'}), 403
        
        # Obtener la licencia del admin/supervisor
        license_admin = LicenseAdmin.query.filter_by(user_id=user_id, is_active=True).first()
        
        if not license_admin:
            return jsonify({'error': 'No tiene una licencia asignada'}), 403
        
        # Pasar la licencia al contexto
        kwargs['license_admin'] = license_admin
        
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@license_admin_bp.route('/centers', methods=['GET'])
@jwt_required()
def get_centers():
    """Listar centros de la licencia"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        
        if not is_multi_center_role(user):
            return jsonify({'error': 'Acceso denegado'}), 403
            
        license_id = get_license_id_for_user(user)
        if not license_id:
            return jsonify({'error': 'No tiene una licencia asignada'}), 403
            
        centers = Tenant.query.filter_by(license_id=license_id).all()
        from models.license import License
        license_obj = License.query.get(license_id)
        
        centers_data = []
        for center in centers:
            data = center.to_dict()
            # Use dynamic count for accuracy
            data['current_enrollment'] = center.children.filter_by(status='activo').count()
            centers_data.append(data)
        
        return jsonify({
            'centers': centers_data,
            'total': len(centers),
            'license': license_obj.to_dict() if license_obj else {}
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/centers', methods=['POST'])
@require_license_admin
def create_center(license_admin):
    """Crear nuevo centro"""
    try:
        if not license_admin.can_create_centers:
            return jsonify({'error': 'No tiene permisos para crear centros'}), 403
        
        license = license_admin.license
        
        if not license.can_add_center():
            return jsonify({
                'error': f'Límite de centros alcanzado. Máximo: {license.max_centers}, Activos: {license.active_centers}'
            }), 400
        
        data = request.get_json()
        
        # Validaciones
        required_fields = ['name', 'legal_name', 'city', 'province']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        # Crear centro — heredar legal_name y ruc de la licencia si no vienen
        center = Tenant(
            license_id=license.id,
            name=data['name'],
            legal_name=data.get('legal_name') or license.legal_name or data['name'],
            ruc=data.get('ruc') or license.ruc,
            address=data.get('address'),
            city=data['city'],
            province=data['province'],
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            phone=data.get('phone'),
            email=data.get('email'),
            max_capacity=data.get('max_capacity', 50),
            max_children_per_educator=data.get('max_children_per_educator', 10)
        )
        
        db.session.add(center)
        
        # Incrementar contador de centros en la licencia
        license.increment_centers()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Centro creado exitosamente',
            'center': center.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/organization', methods=['GET'])
@require_license_admin
def get_organization(license_admin):
    """Obtener datos de la organización (RUC, Razón Social y SMTP)"""
    try:
        license = license_admin.license
        return jsonify({
            'legal_name': license.legal_name,
            'ruc': license.ruc,
            'description': license.description,
            'license_name': license.name,
            'smtp_host': license.smtp_host,
            'smtp_port': license.smtp_port,
            'smtp_user': license.smtp_user,
            'smtp_configured': bool(license.smtp_host and license.smtp_user and license.smtp_password),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/organization', methods=['PUT'])
@require_license_admin
def update_organization(license_admin):
    """Actualizar datos de la organización (RUC, Razón Social y SMTP)"""
    try:
        license = license_admin.license
        data = request.get_json()
        
        if 'legal_name' in data:
            license.legal_name = data['legal_name']
        if 'ruc' in data:
            license.ruc = data['ruc']
        if 'description' in data:
            license.description = data['description']
        
        # SMTP Configuration
        if 'smtp_host' in data:
            license.smtp_host = data['smtp_host']
        if 'smtp_port' in data:
            license.smtp_port = data['smtp_port']
        if 'smtp_user' in data:
            license.smtp_user = data['smtp_user']
        if 'smtp_password' in data and data['smtp_password']:
            license.smtp_password = data['smtp_password']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Datos de organización actualizados',
            'legal_name': license.legal_name,
            'ruc': license.ruc,
            'description': license.description,
            'smtp_host': license.smtp_host,
            'smtp_port': license.smtp_port,
            'smtp_user': license.smtp_user,
            'smtp_configured': bool(license.smtp_host and license.smtp_user and license.smtp_password),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/centers/<int:center_id>', methods=['GET'])
@require_license_admin
def get_center(license_admin, center_id):
    """Obtener detalles de un centro"""
    try:
        center = Tenant.query.filter_by(
            id=center_id,
            license_id=license_admin.license_id
        ).first()
        
        if not center:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        # Obtener estadísticas adicionales
        center_data = center.to_dict()
        center_data['staff_count'] = center.users.count()
        center_data['active_children'] = center.children.filter_by(status='activo').count()
        
        return jsonify({'center': center_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/centers/<int:center_id>', methods=['PUT'])
@require_license_admin
def update_center(license_admin, center_id):
    """Actualizar centro"""
    try:
        center = Tenant.query.filter_by(
            id=center_id,
            license_id=license_admin.license_id
        ).first()
        
        if not center:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        data = request.get_json()
        
        # Actualizar campos permitidos
        allowed_fields = [
            'name', 'legal_name', 'ruc', 'address', 'city', 'province',
            'latitude', 'longitude', 'phone', 'email', 'max_capacity', 'max_children_per_educator', 'is_active'
        ]
        
        for field in allowed_fields:
            if field in data:
                value = data[field]
                # Fix: Handle empty string for RUC (unique constraint)
                if field == 'ruc' and value == "":
                    value = None
                
                setattr(center, field, value)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Centro actualizado exitosamente',
            'center': center.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/centers/<int:center_id>', methods=['DELETE'])
@require_license_admin
def delete_center(license_admin, center_id):
    """Eliminar centro (solo si está vacío)"""
    try:
        if not license_admin.can_delete_centers:
            return jsonify({'error': 'No tiene permisos para eliminar centros'}), 403
        
        center = Tenant.query.filter_by(
            id=center_id,
            license_id=license_admin.license_id
        ).first()
        
        if not center:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        # Verificar que no tenga niños activos
        active_children = center.children.filter_by(status='activo').count()
        if active_children > 0:
            return jsonify({
                'error': f'No se puede eliminar. El centro tiene {active_children} niños activos'
            }), 400
        
        # Verificar que no tenga usuarios activos
        active_users = center.users.filter_by(is_active=True).count()
        if active_users > 0:
            return jsonify({
                'error': f'No se puede eliminar. El centro tiene {active_users} usuarios activos'
            }), 400
        
        license = license_admin.license
        
        db.session.delete(center)
        
        # Decrementar contador de centros en la licencia
        license.decrement_centers()
        
        db.session.commit()
        
        return jsonify({'message': 'Centro eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/dashboard', methods=['GET'])
@require_license_admin
def license_admin_dashboard(license_admin):
    """Dashboard con métricas de la licencia"""
    try:
        license = license_admin.license
        centers = Tenant.query.filter_by(license_id=license.id).all()
        
        # Calcular métricas agregadas
        total_capacity = sum(center.max_capacity for center in centers)
        total_enrollment = sum(center.current_enrollment for center in centers)
        total_staff = sum(center.users.count() for center in centers)
        
        return jsonify({
            'license': license.to_dict(),
            'centers_count': len(centers),
            'total_capacity': total_capacity,
            'total_enrollment': total_enrollment,
            'total_staff': total_staff,
            'occupancy_rate': round((total_enrollment / total_capacity * 100), 2) if total_capacity > 0 else 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/global-stats', methods=['GET'])
@require_license_admin
def global_stats(license_admin):
    """Estadísticas globales de todos los módulos"""
    try:
        license_id = license_admin.license_id
        # Use Dynamic Timezone from License
        today = get_today_date(license_admin.user)
        month_start = today.replace(day=1)
        
        # 1. Centros y KPIs básicos
        centers = Tenant.query.filter_by(license_id=license_id).all()
        center_ids = [c.id for c in centers]
        
        if not center_ids:
            return jsonify({'message': 'No hay centros activos'}), 200
            
        # 2. Asistencia Hoy Global
        attendance_stats = db.session.query(
            func.count(Attendance.id)
        ).filter(
            Attendance.tenant_id.in_(center_ids),
            Attendance.date == today,
            Attendance.status == 'presente'  # Fixed: was 'present'
        ).scalar() or 0
        
        # 3. Salud (Alertas del mes actual)
        health_alerts = db.session.query(
            func.count(HealthRecord.id)
        ).filter(
            HealthRecord.tenant_id.in_(center_ids),
            HealthRecord.record_date >= month_start,
            HealthRecord.record_type.in_(['enfermedad', 'incidente'])
        ).scalar() or 0
        
        # 4. Nutrición (Alertas no resueltas)
        nutrition_alerts = db.session.query(
            func.count(NutritionAlert.id)
        ).filter(
            NutritionAlert.tenant_id.in_(center_ids),
            NutritionAlert.resolved == False
        ).scalar() or 0
        
        # 5. Desarrollo (Total hitos adquiridos este mes)
        milestones_achieved = db.session.query(
            func.count(Milestone.id)
        ).filter(
            Milestone.tenant_id.in_(center_ids),
            Milestone.record_date >= month_start,
            Milestone.achievement_level.in_(['adquirido', 'consolidado'])
        ).scalar() or 0
        
        # 6. Desglose por Centro (Top KPIs)
        centers_breakdown = []
        for center in centers:
            # Asistencia del centro
            center_attendance = Attendance.query.filter_by(
                tenant_id=center.id,
                date=today,
                status='presente'  # Fixed: was 'present'
            ).count()
            
            # Alertas activas
            center_nutrition_alerts = NutritionAlert.query.filter_by(
                tenant_id=center.id,
                resolved=False
            ).count()
            
            centers_breakdown.append({
                'id': center.id,
                'name': center.name,
                'enrollment': center.current_enrollment,
                'capacity': center.max_capacity,
                'attendance_today': center_attendance,
                'nutrition_alerts': center_nutrition_alerts,
                'occupancy_rate': center.occupancy_rate()
            })
            
        return jsonify({
            'global_kpis': {
                'total_centers': len(centers),
                'total_children': sum(c.current_enrollment for c in centers),
                'attendance_today': attendance_stats,
                'health_incidents_month': health_alerts,
                'active_nutrition_alerts': nutrition_alerts,
                'milestones_achieved_month': milestones_achieved
            },
            'centers_breakdown': centers_breakdown
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/territorial-control', methods=['GET'])
@require_license_admin
def get_territorial_control(license_admin):
    """
    Torre de Control Macro (Enfoque DASE / Municipio / MIES)
    Métricas de sobredemanda de cupos, focalización territorial y alertas poblacionales
    """
    try:
        license = license_admin.license
        centers = Tenant.query.filter_by(license_id=license.id, is_active=True).all()
        center_ids = [c.id for c in centers]

        if not center_ids:
            return jsonify({
                'macro_summary': {},
                'territorial_breakdown': [],
                'demand_analysis': {}
            }), 200

        # 1. Capacidad y Demanda de Postulaciones
        total_authorized_capacity = sum(c.max_capacity for c in centers)
        total_enrolled = Child.query.filter(Child.tenant_id.in_(center_ids), Child.status == 'activo').count()
        
        # Postulaciones por estado
        applications = Application.query.filter(Application.tenant_id.in_(center_ids)).all()
        total_applications = len(applications)
        
        accepted_apps = sum(1 for a in applications if a.status in ['aprobada', 'matriculado', 'admitida'])
        waiting_apps = sum(1 for a in applications if a.status in ['en_espera', 'lista_espera', 'pendiente'])
        rejected_apps = sum(1 for a in applications if a.status in ['rechazada', 'sin_cupo', 'no_admitido'])

        # Si no hay aplicaciones explícitas, inferir cupos vs demanda estimada
        unmet_demand = waiting_apps + rejected_apps
        sobredemanda_rate = round(((total_applications - total_authorized_capacity) / total_authorized_capacity * 100), 1) if total_authorized_capacity > 0 and total_applications > total_authorized_capacity else 0

        # 2. Desglose Territorial por Cantón / Ciudad / Centros
        territory_map = {}
        for center in centers:
            canton = center.city or "Guayaquil"
            province = center.province or "Guayas"
            key = f"{province} - {canton}"

            if key not in territory_map:
                territory_map[key] = {
                    'province': province,
                    'canton': canton,
                    'total_centers': 0,
                    'total_capacity': 0,
                    'total_enrolled': 0,
                    'total_applications': 0,
                    'centers': []
                }

            center_kids = Child.query.filter_by(tenant_id=center.id, status='activo').count()
            center_apps = Application.query.filter_by(tenant_id=center.id).count()

            territory_map[key]['total_centers'] += 1
            territory_map[key]['total_capacity'] += center.max_capacity
            territory_map[key]['total_enrolled'] += center_kids
            territory_map[key]['total_applications'] += center_apps

            territory_map[key]['centers'].append({
                'id': center.id,
                'name': center.name,
                'capacity': center.max_capacity,
                'enrolled': center_kids,
                'applications': center_apps,
                'occupancy_pct': round((center_kids / center.max_capacity * 100), 1) if center.max_capacity > 0 else 0,
                'unmet_demand': max(0, center_apps - center.max_capacity)
            })

        # 3. Alertas Macro de Salud y Nutrición en la Población
        today = date.today()
        month_start = today.replace(day=1)

        health_alerts_total = HealthRecord.query.filter(
            HealthRecord.tenant_id.in_(center_ids),
            HealthRecord.record_type.in_(['incidente', 'enfermedad'])
        ).count()

        vaccines_overdue = Vaccine.query.filter(
            Vaccine.tenant_id.in_(center_ids),
            Vaccine.status == 'pendiente',
            Vaccine.next_dose_date < today
        ).count()

        return jsonify({
            'macro_summary': {
                'license_name': license.name,
                'sponsor_name': license.sponsor_name or 'DASE / Municipio de Guayaquil',
                'total_centers': len(centers),
                'total_capacity': total_authorized_capacity,
                'total_enrolled': total_enrolled,
                'available_spots': max(0, total_authorized_capacity - total_enrolled),
                'occupancy_rate': round((total_enrolled / total_authorized_capacity * 100), 1) if total_authorized_capacity > 0 else 0,
            },
            'demand_analysis': {
                'total_applications': total_applications,
                'accepted': accepted_apps,
                'waiting_list': waiting_apps,
                'rejected_no_spots': rejected_apps,
                'unmet_demand': unmet_demand,
                'sobredemanda_rate': sobredemanda_rate,
                'expansion_need_score': 'Alta Necesidad de Nuevos Centros' if unmet_demand > 50 or sobredemanda_rate > 20 else 'Demanda Cubierta'
            },
            'alerts_summary': {
                'total_health_alerts': health_alerts_total,
                'vaccines_overdue': vaccines_overdue,
            },
            'territorial_breakdown': list(territory_map.values())
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in territorial_control: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/centers/<int:center_id>/stats', methods=['GET'])
@require_license_admin
def get_center_stats(license_admin, center_id):
    """Obtener estadísticas detalladas de un centro"""
    try:
        center = Tenant.query.filter_by(
            id=center_id,
            license_id=license_admin.license_id
        ).first()
        
        if not center:
            return jsonify({'error': 'Centro no encontrado'}), 404
        
        # Estadísticas detalladas
        from models.attendance import Attendance
        from datetime import date
        
        today = date.today()
        
        # Asistencia de hoy
        today_attendance = Attendance.query.filter_by(
            center_id=center_id,
            date=today,
            status='present'
        ).count()
        
        # Use Dynamic Count instead of stored column to prevent sync issues
        active_children_count = center.children.filter_by(status='activo').count()
        
        stats = {
            'center': center.to_dict(),
            'enrollment': {
                'total': active_children_count,
                'capacity': center.max_capacity,
                'available': max(0, center.max_capacity - active_children_count),
                'occupancy_rate': round((active_children_count / center.max_capacity * 100), 2) if center.max_capacity > 0 else 0
            },
            'attendance_today': today_attendance,
            'staff': {
                'total': center.users.count(),
                'active': center.users.filter_by(is_active=True).count()
            }
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/users', methods=['GET'])
@require_license_admin
def get_users(license_admin):
    """Listar usuarios de los centros de la licencia"""
    try:
        center_id = request.args.get('center_id')
        role_name = request.args.get('role')
        
        from sqlalchemy import or_
        from models.license import LicenseAdmin
        
        # 1. Query for STAFF (Center-based or Multi-center/Universal)
        # Logic: Users belonging to a Tenant of this License OR linked directly via license_admins
        # EXCLUDING super_admin and license_admin roles
        staff_query = User.query.outerjoin(Tenant).outerjoin(LicenseAdmin, User.id == LicenseAdmin.user_id).join(Role).filter(
            or_(
                Tenant.license_id == license_admin.license_id,
                LicenseAdmin.license_id == license_admin.license_id
            ),
            Role.name.notin_(['super_admin', 'license_admin'])
        ).distinct()
        
        if center_id:
            staff_query = staff_query.filter(User.tenant_id == center_id)
            
        if role_name and role_name != 'license_admin':
            staff_query = staff_query.filter(Role.name == role_name)
            
        staff_users = staff_query.all()
        
        # 2. Query for LICENSE ADMINS (Linked to this license)
        # Logic: Users in license_admins table for THIS license
        admin_users = []
        # Only fetch admins if we are not filtering by a specific center (admins don't belong to centers usually)
        # OR if we are explicitly asking for 'license_admin' role
        should_fetch_admins = (not center_id) and (not role_name or role_name == 'license_admin')
        
        if should_fetch_admins:
            admin_subquery = LicenseAdmin.query.filter_by(
                license_id=license_admin.license_id, 
                is_active=True
            ).with_entities(LicenseAdmin.user_id)
            
            admin_users = User.query.filter(User.id.in_(admin_subquery)).all()

        # 3. Combine and Format
        all_users = staff_users + admin_users
        
        # Deduplicate just in case (though logic shouldn't overlap)
        seen_ids = set()
        unique_users = []
        for u in all_users:
            if u.id not in seen_ids:
                seen_ids.add(u.id)
                unique_users.append(u)
        
        users_list = []
        for user in unique_users:
            user_data = user.to_dict()
            user_data['center_name'] = user.tenant.name if user.tenant else "Todos los Centros"
            user_data['role'] = user.role.name if user.role else None
            users_list.append(user_data)
            
        return jsonify({
            'users': users_list,
            'total': len(users_list)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/users', methods=['POST'])
@require_license_admin
def create_user(license_admin):
    """Crear usuario para un centro"""
    try:
        if not license_admin.can_manage_users:
            return jsonify({'error': 'No tiene permisos para gestionar usuarios'}), 403
            
        data = request.get_json()
        
        # Validaciones
        required_fields = ['first_name', 'last_name', 'email', 'password', 'role']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
                
        center_id = data.get('center_id')
        center = None
        
        # Verificar centro si se proporciona
        if center_id:
            center = Tenant.query.filter_by(
                id=center_id, 
                license_id=license_admin.license_id
            ).first()
            
            if not center:
                return jsonify({'error': 'Centro no válido o no pertenece a su licencia'}), 400
                
            if not center.is_active:
                 return jsonify({'error': 'El centro seleccionado está inactivo'}), 400
             
        # Verificar email único
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'El email ya está registrado'}), 400
            
        # Obtener y validar rol
        from models.user import Role
        role = Role.query.filter_by(name=data['role']).first()
        if not role:
            return jsonify({'error': 'Rol no válido'}), 400
            
        # Roles permitidos para crear
        allowed_roles = [
            'coordinator', 'educator', 'psychologist', 
            'nutritionist', 'social_worker', 'doctor', 'administrative',
            'supervisor'
        ]
        
        if role.name not in allowed_roles:
            return jsonify({'error': f'No puede crear usuarios con el rol {role.name}'}), 403
            
        # Roles que operan a nivel de licencia (multicentro) o son universales
        universal_roles = ['doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor']
        is_universal = role.name in universal_roles
        
        # Crear usuario
        user = User(
            tenant_id=center.id if (center and not is_universal) else None,
            role_id=role.id,
            email=data['email'].lower().strip(),
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone'),
            is_active=True
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.flush()  # Get user.id before creating LicenseAdmin entry
        
        # Si es un rol universal o supervisor, vincular directamente a la licencia 
        # para que aparezca en el listado y tenga contexto multitenant
        if is_universal:
            license_link = LicenseAdmin(
                license_id=license_admin.license_id,
                user_id=user.id,
                can_create_centers=False,
                can_delete_centers=False,
                can_manage_users=False,
                assigned_by=license_admin.user_id,
                is_active=True
            )
            db.session.add(license_link)
        
        db.session.commit()
        
        # Send welcome email with credentials (non-blocking)
        try:
            from services.email_service import EmailService
            html = EmailService.template_user_created(
                user_name=f"{user.first_name} {user.last_name}",
                email=user.email,
                password=data['password'],
                org_name=license_admin.license.name
            )
            EmailService.send_email(
                license_id=license_admin.license_id,
                to_email=user.email,
                subject=f"Bienvenido a {license_admin.license.name}",
                html_body=html
            )
        except Exception as email_err:
            import logging
            logging.getLogger(__name__).warning(f"Email notification failed for new user {user.email}: {email_err}")
        
        return jsonify({
            'message': 'Usuario creado exitosamente',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/users/<int:user_id>', methods=['GET'])
@require_license_admin
def get_user(license_admin, user_id):
    """Obtener detalles de un usuario"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
            
        # Verificar pertenencia: por tenant o por license_admins (roles universales)
        belongs = False
        if user.tenant and user.tenant.license_id == license_admin.license_id:
            belongs = True
        else:
            la_link = LicenseAdmin.query.filter_by(
                user_id=user.id, license_id=license_admin.license_id
            ).first()
            if la_link:
                belongs = True
        
        if not belongs:
            return jsonify({'error': 'Usuario no pertenece a esta licencia'}), 403
            
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@require_license_admin
def update_user(license_admin, user_id):
    """Actualizar usuario"""
    try:
        if not license_admin.can_manage_users:
            return jsonify({'error': 'No tiene permisos para gestionar usuarios'}), 403
            
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
            
        # Verificar pertenencia: por tenant o por license_admins (roles universales)
        belongs = False
        if user.tenant and user.tenant.license_id == license_admin.license_id:
            belongs = True
        else:
            la_link = LicenseAdmin.query.filter_by(
                user_id=user.id, license_id=license_admin.license_id
            ).first()
            if la_link:
                belongs = True
        
        if not belongs:
            return jsonify({'error': 'Usuario no pertenece a esta licencia'}), 403
            
        data = request.get_json()
        
        allowed_fields = ['first_name', 'last_name', 'email', 'phone', 'is_active']
        
        for field in allowed_fields:
            if field in data:
                setattr(user, field, data[field])
        
        # Permitir reasignar centro a roles universales
        if 'center_id' in data:
            center_id = data['center_id']
            if center_id:
                center = Tenant.query.filter_by(
                    id=center_id, license_id=license_admin.license_id
                ).first()
                if center:
                    user.tenant_id = center.id
            else:
                # Limpiar asignación de centro (volver a multi-centro)
                user.tenant_id = None
                
        db.session.commit()
        
        return jsonify({
            'message': 'Usuario actualizado exitosamente',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@require_license_admin
def delete_user(license_admin, user_id):
    """Eliminar usuario de la licencia"""
    try:
        if not license_admin.can_manage_users:
            return jsonify({'error': 'No tiene permisos para gestionar usuarios'}), 403
            
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
            
        # Verificar pertenencia: por tenant o por license_admins (roles universales)
        belongs = False
        if user.tenant and user.tenant.license_id == license_admin.license_id:
            belongs = True
        else:
            la_link = LicenseAdmin.query.filter_by(
                user_id=user.id, license_id=license_admin.license_id
            ).first()
            if la_link:
                belongs = True
        
        if not belongs:
            return jsonify({'error': 'Usuario no pertenece a esta licencia'}), 403
        
        # No permitir eliminar al propio usuario
        if user.id == license_admin.user_id:
            return jsonify({'error': 'No puede eliminarse a sí mismo'}), 400
        
        # No permitir eliminar super_admin o license_admin
        if user.role and user.role.name in ['super_admin', 'license_admin']:
            return jsonify({'error': 'No puede eliminar administradores'}), 403
        
        # Limpiar entradas en license_admins antes de eliminar
        LicenseAdmin.query.filter_by(user_id=user.id).delete()
            
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'Usuario eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/customization', methods=['PUT'])
@require_license_admin
def update_license_customization(license_admin):
    """Actualizar la personalización de la licencia (Agente IA)"""
    from services.upload_service import FileService
    
    try:
        license_obj = license_admin.license
        if not license_obj:
            return jsonify({'error': 'Licencia no encontrada'}), 404

        # Handle FormData (mix of files and text fields)
        # Note: In Flask, request.form for text, request.files for files
        
        # 1. Update text fields if present
        if 'agent_name' in request.form:
            license_obj.agent_name = request.form['agent_name']
        elif request.is_json and 'agent_name' in request.json:
             license_obj.agent_name = request.json['agent_name']
             
        if 'agent_personality' in request.form:
            license_obj.agent_personality = request.form['agent_personality']
        elif request.is_json and 'agent_personality' in request.json:
             license_obj.agent_personality = request.json['agent_personality']

        if 'agent_voice' in request.form:
            license_obj.agent_voice = request.form['agent_voice']
        elif request.is_json and 'agent_voice' in request.json:
             license_obj.agent_voice = request.json['agent_voice']

        if 'timezone' in request.form:
            # TODO: Validate timezone against pytz.all_timezones
            license_obj.timezone = request.form['timezone']
        elif request.is_json and 'timezone' in request.json:
             license_obj.timezone = request.json['timezone']

        # 2. Handle Agent Icon Upload
        if 'agent_icon' in request.files:
            file = request.files['agent_icon']
            if file and file.filename != '':
                # Delete old icon if exists
                if license_obj.agent_icon_path:
                    FileService.delete_file(license_obj.agent_icon_path)
                
                # Save new icon
                icon_url = FileService.save_file(file, folder='agent_icons')
                license_obj.agent_icon_path = icon_url

        db.session.commit()

        return jsonify({
            'message': 'Personalización actualizada exitosamente',
            'license': license_obj.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/public-config', methods=['GET'])
@jwt_required()
def get_public_license_config():
    """
    Obtener configuración pública de la licencia (Logos, Agente)
    Accesible para CUALQUIER usuario autenticado que pertenezca a un centro de la licencia.
    """
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
            
        target_license_id = None
        
        # 1. Caso License Admin o Roles Universales
        if user.role.name in ['license_admin', 'supervisor', 'doctor']:
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
            if lic_admin:
                target_license_id = lic_admin.license_id
                
        # 2. Caso Usuario de Centro (Coordinador, Educadora, etc.)
        elif user.tenant_id:
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                target_license_id = tenant.license_id
                
        if not target_license_id:
            return jsonify({'error': 'No se encontró una licencia asociada a su usuario'}), 404
            
        # Obtener datos
        license_obj = License.query.get(target_license_id)
        logos = SponsorLogo.query.filter_by(license_id=target_license_id).all()
        
        return jsonify({
            'agent_name': license_obj.agent_name or 'KindiCore AI',
            'agent_icon': license_obj.agent_icon_path,
            'sponsor_logos': [logo.to_dict() for logo in logos]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Endpoints para Logos de Patrocinadores ---

@license_admin_bp.route('/logos', methods=['GET'])
@require_license_admin
def get_sponsor_logos(license_admin):
    """Obtener todos los logos de patrocinadores de la licencia"""
    try:
        logos = SponsorLogo.query.filter_by(license_id=license_admin.license_id).all()
        return jsonify({'logos': [logo.to_dict() for logo in logos]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/logos', methods=['POST'])
@require_license_admin
def add_sponsor_logo(license_admin):
    """Agregar un nuevo logo de patrocinador (Upload real)"""
    from services.upload_service import FileService
    
    try:
        # Check if file part is present
        if 'logo' not in request.files:
             # Fallback for URL-based add (for backwards compat or URL input)
             if request.is_json and 'logo_path' in request.json:
                 logo_path = request.json['logo_path']
             else:
                 return jsonify({'error': 'No se encontró archivo de logo'}), 400
        else:
            file = request.files['logo']
            if file.filename == '':
                return jsonify({'error': 'Nombre de archivo vacío'}), 400
            
            logo_path = FileService.save_file(file, folder='sponsor_logos')

        if not logo_path:
             return jsonify({'error': 'Error al guardar el archivo'}), 500

        new_logo = SponsorLogo(
            license_id=license_admin.license_id,
            logo_path=logo_path
        )
        db.session.add(new_logo)
        db.session.commit()

        return jsonify(
            {
                'message': 'Logo agregado exitosamente',
                'logo': new_logo.to_dict(),
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@license_admin_bp.route('/logos/<int:logo_id>', methods=['DELETE'])
@require_license_admin
def delete_sponsor_logo(license_admin, logo_id):
    """Eliminar un logo de patrocinador"""
    from services.upload_service import FileService
    
    try:
        logo_to_delete = SponsorLogo.query.filter_by(
            id=logo_id,
            license_id=license_admin.license_id
        ).first()

        if not logo_to_delete:
            return jsonify({'error': 'Logo no encontrado o no pertenece a esta licencia'}), 404
        
        # Opcional: Eliminar el archivo físico del sistema de archivos aquí
        # import os
        # if os.path.exists(logo_to_delete.logo_path):
        #     os.remove(logo_to_delete.logo_path)

        db.session.delete(logo_to_delete)
        db.session.commit()

        return jsonify({'message': 'Logo eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

import os
from werkzeug.utils import secure_filename
from datetime import datetime

# Configuración de uploads para licencias
UPLOAD_LICENSE_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'license')
ALLOWED_IMG_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}

os.makedirs(UPLOAD_LICENSE_FOLDER, exist_ok=True)

def allowed_image_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMG_EXTENSIONS

@license_admin_bp.route('/upload-file', methods=['POST'])
@require_license_admin
def upload_license_file(license_admin):
    """Subir un archivo para la licencia (logo o icono de agente)"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400

        file = request.files['file']
        upload_type = request.form.get('upload_type') # 'agent_icon' o 'sponsor_logo'

        if file.filename == '' or not upload_type:
            return jsonify({'error': 'Nombre de archivo o tipo de subida vacío'}), 400

        if not allowed_image_file(file.filename):
            return jsonify({'error': 'Tipo de archivo no permitido'}), 400

        license_id = license_admin.license_id
        
        # Crear subdirectorio específico
        if upload_type == 'agent_icon':
            specific_folder = 'icons'
        elif upload_type == 'sponsor_logo':
            specific_folder = 'logos'
        else:
            return jsonify({'error': 'Tipo de subida no válido'}), 400
            
        target_folder = os.path.join(UPLOAD_LICENSE_FOLDER, str(license_id), specific_folder)
        os.makedirs(target_folder, exist_ok=True)
        
        # Guardar archivo
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(target_folder, unique_filename)
        
        file.save(file_path)

        # Si es un icono de agente, actualizamos la licencia directamente
        if upload_type == 'agent_icon':
            license_obj = license_admin.license
            # Opcional: eliminar el icono anterior si existe
            # if license_obj.agent_icon_path and os.path.exists(license_obj.agent_icon_path):
            #     os.remove(license_obj.agent_icon_path)
            license_obj.agent_icon_path = file_path
            db.session.commit()

        return jsonify({
            'message': 'Archivo subido exitosamente',
            'file_path': file_path,
            'upload_type': upload_type
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# RESET LICENSE - Operación Destructiva
# ============================================================

@license_admin_bp.route('/reset-license', methods=['POST'])
@require_license_admin
def reset_license(license_admin):
    """
    Reset completo de la licencia.
    Elimina TODOS los datos operativos de todos los centros.
    Preserva: License, Tenants, LicenseAdmin, SponsorLogos.
    Requiere: { confirmation: "RESETEAR", password: "..." }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Datos requeridos'}), 400

        # --- Safety Validations ---
        confirmation = data.get('confirmation', '')
        password = data.get('password', '')

        if confirmation != 'RESETEAR':
            return jsonify({'error': 'Palabra de confirmación incorrecta'}), 400

        if not password:
            return jsonify({'error': 'Contraseña requerida'}), 400

        # Verify password
        admin_user = User.query.get(license_admin.user_id)
        if not admin_user:
            logger.error(f"Reset License: User {license_admin.user_id} not found")
            return jsonify({'error': 'Usuario no encontrado'}), 404

        if not admin_user.check_password(password):
            logger.error(f"Reset License: Password check failed for user {admin_user.id}")
            return jsonify({'error': 'Contraseña incorrecta'}), 401

        # --- Get all tenant IDs for this license ---
        license_id = license_admin.license_id
        tenants = Tenant.query.filter_by(license_id=license_id).all()
        tenant_ids = [t.id for t in tenants]

        if not tenant_ids:
            logger.warning(f"License {license_id} has no centers to reset.")
            # Si no hay centros, no hay nada que borrar, pero NO es un error (400).
            # Retornamos éxito indicando que se borraron 0 registros.
            return jsonify({'message': 'Licencia reseteada correctamente (No habían centros activos)', 'details': {}}), 200

        admin_user_id = admin_user.id
        deleted_counts = {}

        logger.warning(f"🔴 LICENSE RESET initiated by user {admin_user_id} for license {license_id}")
        logger.warning(f"   Tenant IDs to reset: {tenant_ids}")

        # --- IDENTIFY USERS TO DELETE FIRST ---
        # We need this list to handle FKs in other tables (licenses, license_admins)
        # 5. Get all users associated with these tenants
        users_in_tenants = User.query.filter(User.tenant_id.in_(tenant_ids)).all()
        users_to_delete = []

        # CRITICAL SAFETY FILTER
        for u in users_in_tenants:
            # A. Never delete the executor
            if u.id == admin_user_id:
                continue
            
            # B. Never delete the Platform Owner
            if u.email == 'jonnathan.ypg@gmail.com':
                logger.critical(f"🛡️ SAFETY TRIGGERED: Attempted to delete Platform Owner {u.email}. Unlinking instead.")
                u.tenant_id = None
                db.session.add(u)
                continue

            # C. Never delete Super Admins
            if u.role and u.role.name == 'super_admin':
                 logger.critical(f"🛡️ SAFETY TRIGGERED: Attempted to delete Super Admin {u.email}. Unlinking instead.")
                 u.tenant_id = None
                 db.session.add(u)
                 continue

            users_to_delete.append(u)

        user_ids_to_delete = [u.id for u in users_to_delete]

        # --- CASCADE DELETION (strict FK order) ---

        # 1. Waiting Lists (FK -> applications, tenants)
        count = WaitingList.query.filter(WaitingList.center_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['waiting_lists'] = count

        # 2. Vulnerability Forms (FK -> applications)
        app_ids = [a.id for a in Application.query.filter(Application.center_id.in_(tenant_ids)).all()]
        if app_ids:
            count = VulnerabilityForm.query.filter(VulnerabilityForm.application_id.in_(app_ids)).delete(synchronize_session=False)
            deleted_counts['vulnerability_forms'] = count
        else:
            deleted_counts['vulnerability_forms'] = 0

        # 3. Documents (FK -> children, applications, users; self-referential parent_document_id)
        doc_tenant_params = ','.join([str(tid) for tid in tenant_ids])
        db.session.execute(
            text(f"UPDATE documents SET parent_document_id = NULL WHERE tenant_id IN ({doc_tenant_params})")
        )
        count = Document.query.filter(Document.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['documents'] = count

        # 4. Applications (FK -> children, tenants) - Uses center_id
        count = Application.query.filter(Application.center_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['applications'] = count

        # 5. Family Interventions (FK -> families, tenants)
        count = FamilyIntervention.query.filter(FamilyIntervention.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['family_interventions'] = count

        # 6. Milestones (FK -> children)
        count = Milestone.query.filter(Milestone.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['milestones'] = count

        # 7. Vaccines (FK -> children)
        count = Vaccine.query.filter(Vaccine.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['vaccines'] = count

        # 8. Medical Profiles (FK -> children)
        count = MedicalProfile.query.filter(MedicalProfile.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['medical_profiles'] = count

        # 9. Health Records (FK -> children)
        count = HealthRecord.query.filter(HealthRecord.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['health_records'] = count

        # 10. Nutrition Alerts (FK -> children)
        count = NutritionAlert.query.filter(NutritionAlert.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['nutrition_alerts'] = count

        # 11. Nutrition Daily (FK -> children)
        count = NutritionDaily.query.filter(NutritionDaily.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['nutrition_daily'] = count

        # 12. Menus (FK -> tenants)
        count = Menu.query.filter(Menu.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['menus'] = count

        # 13. Attendance (FK -> children)
        count = Attendance.query.filter(Attendance.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['attendance'] = count

        # 14. Maintenance Tasks (FK -> tenants)
        count = MaintenanceTask.query.filter(MaintenanceTask.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['maintenance_tasks'] = count

        # 15. Notifications (FK -> tenants, users)
        count = Notification.query.filter(Notification.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['notifications'] = count

        # 16. Generated Reports (FK -> tenants) - also delete files from disk
        reports = GeneratedReport.query.filter(GeneratedReport.tenant_id.in_(tenant_ids)).all()
        for report in reports:
            if report.file_path and os.path.exists(report.file_path):
                try:
                    os.remove(report.file_path)
                except OSError:
                    pass
        count = GeneratedReport.query.filter(GeneratedReport.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['generated_reports'] = count

        # 17. Conversation History (raw SQL - no ORM model)
        # Delete by TENANT_ID to include anonymous/lead conversations
        if tenant_ids:
            tids_params = ','.join([str(tid) for tid in tenant_ids])
            result = db.session.execute(
                text(f"DELETE FROM conversation_history WHERE tenant_id IN ({tids_params})")
            )
            deleted_counts['conversation_history'] = result.rowcount
        else:
            deleted_counts['conversation_history'] = 0

        # 18. Children (FK -> families, tenants)
        count = Child.query.filter(Child.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['children'] = count

        # 19. Representatives (FK -> families)
        family_ids = [f.id for f in Family.query.filter(Family.tenant_id.in_(tenant_ids)).all()]
        if family_ids:
            count = Representative.query.filter(Representative.family_id.in_(family_ids)).delete(synchronize_session=False)
            deleted_counts['representatives'] = count
        else:
            deleted_counts['representatives'] = 0

        # 20. Families (FK -> tenants)
        count = Family.query.filter(Family.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['families'] = count

        # --- CRITICAL: Handle FK references to USERS before deleting them ---
        if user_ids_to_delete:
            uids_set = ','.join([str(uid) for uid in user_ids_to_delete])

            # A. Update License Admins assigned by deleted users
            db.session.execute(
                text(f"UPDATE license_admins SET assigned_by = NULL WHERE assigned_by IN ({uids_set})")
            )

            # B. Delete License Admin records for deleted users
            # (If a user is being deleted, they shouldn't be a license admin anymore)
            db.session.execute(
                text(f"DELETE FROM license_admins WHERE user_id IN ({uids_set})")
            )
            # Intermediate commit to ensure these FK references are gone before User deletion
            db.session.commit()

            # C. Delete License Admin records for deleted users
        # 21. Users (except the executing License Admin)
        # Using the list we pre-calculated to ensure consistency
        if user_ids_to_delete:
            count = User.query.filter(User.id.in_(user_ids_to_delete)).delete(synchronize_session=False)
            deleted_counts['users'] = count
        else:
            deleted_counts['users'] = 0

        # 22a. Detach remaining users from Tenants before deleting Tenants
        # Example: The executing admin might be linked to one of these tenants.
        # We set their tenant_id to NULL to prevent cascading deletes or constraint errors.
        if tenant_ids:
            tids_params = ','.join([str(tid) for tid in tenant_ids])
            # USAMOS text() DE SQLAlchemy DIRECTAMENTE PARA ASEGURARNOS QUE SE EJECUTE
            db.session.execute(
                text(f"UPDATE users SET tenant_id = NULL WHERE tenant_id IN ({tids_params})")
            )
            # CRÍTICO: Commit intermedio para "salvar" a los usuarios (admin) antes de borrar tenants
            db.session.commit()

        # 23. Tenants (Centros)
        # Now that all related data is gone, we can delete the tenants themselves
        count = Tenant.query.filter(Tenant.id.in_(tenant_ids)).delete(synchronize_session=False)
        deleted_counts['tenants'] = count

        # --- Reset License Counters ---
        # The license now has 0 active centers
        license_obj = License.query.get(license_id)
        if license_obj:
            license_obj.active_centers = 0

        # --- Commit everything ---
        db.session.commit()

        total_deleted = sum(deleted_counts.values())
        logger.warning(f"🔴 LICENSE RESET completed. Total records deleted: {total_deleted}")
        logger.warning(f"   Breakdown: {deleted_counts}")

        return jsonify({
            'message': f'Licencia reseteada exitosamente. {total_deleted} registros eliminados.',
            'deleted_counts': deleted_counts,
            'total_deleted': total_deleted
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"🔴 LICENSE RESET FAILED: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al resetear la licencia: {str(e)}'}), 500
