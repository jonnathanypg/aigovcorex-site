from utils.role_helpers import is_multi_center_role
"""
Milestones API - Seguimiento de Hitos del Desarrollo
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.child import Child
from models.milestone import Milestone
from services.milestones_catalog import MILESTONES_CATALOG, get_milestones_for_age, get_all_age_ranges
from datetime import date, datetime

milestones_bp = Blueprint('milestones', __name__, url_prefix='/milestones')


def require_authenticated(f):
    """Decorator to require any authenticated user"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401

        # License Admin doesn't need a fixed tenant_id
        if not is_multi_center_role(user) and not user.tenant_id:
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 403
            
        return f(user, *args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@milestones_bp.route('/', methods=['GET'])
@require_authenticated
def get_recent_milestones(user):
    """Obtener hitos recientes de todos los niños del centro"""
    try:
        # Join with Child to ensure tenant isolation and get child name
        query = db.session.query(Milestone, Child).join(Child)
        
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                query = query.join(Tenant, Child.tenant_id == Tenant.id).filter(
                    Tenant.license_id == lic_admin.license_id
                )
            else:
                return jsonify({'milestones': []}), 200
        else:
            query = query.filter(Milestone.tenant_id == user.tenant_id)
            
        milestones = query.order_by(Milestone.record_date.desc()).all()
        
        result = []
        for m, c in milestones:
            m_dict = m.to_dict()
            m_dict['child_name'] = c.full_name
            result.append(m_dict)
            
        return jsonify({'milestones': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@milestones_bp.route('/catalog', methods=['GET'])
@require_authenticated
def get_catalog(user):
    """Obtener catálogo completo de hitos"""
    try:
        age_range = request.args.get('age_range')
        
        if age_range and age_range in MILESTONES_CATALOG:
            return jsonify({
                'age_range': age_range,
                'catalog': MILESTONES_CATALOG[age_range]
            }), 200
        
        return jsonify({
            'age_ranges': get_all_age_ranges(),
            'catalog': MILESTONES_CATALOG
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/catalog/child/<int:child_id>', methods=['GET'])
@require_authenticated
def get_catalog_for_child(user, child_id):
    """Obtener catálogo apropiado para la edad del niño"""
    try:
        if is_multi_center_role(user):
            child = Child.query.get(child_id)
            if child:
                from models.tenant import Tenant
                from models.license import LicenseAdmin
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                if lic_admin:
                    tenant = Tenant.query.get(child.tenant_id)
                    if not tenant or tenant.license_id != lic_admin.license_id:
                        return jsonify({'error': 'No tienes acceso a este niño'}), 403
        else:
            child = Child.query.filter_by(
                id=child_id,
                tenant_id=user.tenant_id
            ).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        age_months = child.age_months or 0
        catalog = get_milestones_for_age(age_months)
        
        return jsonify({
            'child_id': child_id,
            'child_name': child.full_name,
            'age_months': age_months,
            'catalog': catalog
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/record', methods=['POST'])
@require_authenticated
def record_milestone(user):
    """Registrar logro de hito"""
    try:
        db.session.rollback()
        
        data = request.get_json()
        
        # Admin Friendly: Find child first by ID
        child = Child.query.get(data['child_id'])
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        # Check permissions
        if not is_multi_center_role(user):
             if child.tenant_id != user.tenant_id:
                 return jsonify({'error': 'No tienes acceso a este niño'}), 403
        
        milestone = Milestone(
            tenant_id=child.tenant_id, # Use child's tenant
            child_id=data['child_id'],
            record_date=datetime.strptime(data.get('record_date'), '%Y-%m-%d').date() if data.get('record_date') else date.today(),
            period=data.get('period'),
            domain=data['domain'],
            milestone_description=data['milestone_description'],
            achievement_level=data['achievement_level'],
            age_months=child.age_months,
            registered_by_id=user.id,
            notes=data.get('notes', '')
        )
        
        db.session.add(milestone)
        db.session.commit()
        
        return jsonify({
            'message': 'Hito registrado exitosamente',
            'milestone': milestone.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/record-batch', methods=['POST'])
@require_authenticated
def record_batch(user):
    """
    Registrar evaluación IDII completa (batch).
    Recibe múltiples ítems evaluados para un niño en una sola transacción.
    
    Body JSON:
    {
        "child_id": 123,
        "record_date": "2026-04-15",
        "period": "Inicial 2026",
        "evaluations": [
            { "domain": "vinculacion_emocional", "milestone_description": "...", "achievement_level": "adquirido" },
            ...
        ]
    }
    """
    try:
        db.session.rollback()
        
        data = request.get_json()
        child_id = data.get('child_id')
        record_date_str = data.get('record_date')
        period = data.get('period', '')
        global_notes = data.get('notes', '')
        evaluations = data.get('evaluations', [])
        
        if not child_id or not evaluations:
            return jsonify({'error': 'Se requiere child_id y evaluations'}), 400
        
        child = Child.query.get(child_id)
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if child.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso a este niño'}), 403
        
        record_dt = datetime.strptime(record_date_str, '%Y-%m-%d').date() if record_date_str else date.today()
        
        milestones_to_add = []
        updates_made = False
        
        for ev in evaluations:
            domain = ev.get('domain')
            desc = ev.get('milestone_description', '')
            level = ev.get('achievement_level', 'no_iniciado')
            # Use item-specific notes if present, otherwise fallback to global notes
            item_notes = ev.get('notes') or global_notes
            
            if not domain or not desc:
                continue
                
            # Upsert logic: check if this indicator is already evaluated for this child
            existing = Milestone.query.filter_by(
                tenant_id=child.tenant_id,
                child_id=child_id,
                domain=domain,
                milestone_description=desc
            ).first()
            
            if existing:
                existing.achievement_level = level
                existing.period = period
                existing.record_date = record_dt
                if item_notes:
                    existing.notes = item_notes
                existing.registered_by_id = user.id
                existing.age_months = child.age_months_precise
                updates_made = True
            else:
                milestone = Milestone(
                    tenant_id=child.tenant_id,
                    child_id=child_id,
                    record_date=record_dt,
                    period=period,
                    domain=domain,
                    milestone_description=desc,
                    achievement_level=level,
                    age_months=child.age_months_precise,
                    registered_by_id=user.id,
                    notes=item_notes
                )
                milestones_to_add.append(milestone)
        
        if not milestones_to_add and not updates_made:
            return jsonify({'error': 'No se encontraron evaluaciones válidas o cambios.'}), 400
        
        if milestones_to_add:
            db.session.add_all(milestones_to_add)
            
        db.session.commit()
        
        return jsonify({
            'message': f'{len(milestones_to_add)} hitos registrados exitosamente',
            'count': len(milestones_to_add),
            'milestones': [m.to_dict() for m in milestones_to_add]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/child/<int:child_id>', methods=['GET'])
@require_authenticated
def get_child_milestones(user, child_id):
    """Obtener hitos registrados de un niño"""
    try:
        if is_multi_center_role(user):
            child = Child.query.get(child_id)
            if child:
                from models.license import LicenseAdmin
                from models.tenant import Tenant
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                if lic_admin:
                    tenant = Tenant.query.get(child.tenant_id)
                    if not tenant or tenant.license_id != lic_admin.license_id:
                        return jsonify({'error': 'No tienes acceso a este niño'}), 403
        else:
            child = Child.query.filter_by(
                id=child_id,
                tenant_id=user.tenant_id
            ).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        domain = request.args.get('domain')
        
        query = Milestone.query.filter_by(child_id=child_id)
        
        if domain:
            query = query.filter_by(domain=domain)
        
        milestones = query.order_by(Milestone.record_date.desc()).all()
        
        return jsonify({
            'child_id': child_id,
            'child_name': child.full_name,
            'milestones': [m.to_dict() for m in milestones]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/child/<int:child_id>/progress', methods=['GET'])
@require_authenticated
def get_child_progress(user, child_id):
    """Obtener progreso general del niño por dominio"""
    try:
        if is_multi_center_role(user):
            child = Child.query.get(child_id)
            if child:
                from models.license import LicenseAdmin
                from models.tenant import Tenant
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                if lic_admin:
                    tenant = Tenant.query.get(child.tenant_id)
                    if not tenant or tenant.license_id != lic_admin.license_id:
                        return jsonify({'error': 'No tienes acceso a este niño'}), 403
        else:
            child = Child.query.filter_by(
                id=child_id,
                tenant_id=user.tenant_id
            ).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Obtener últimos hitos por dominio
        domains = ['vinculacion_emocional', 'descubrimiento_natural_cultural', 'expresion_corporal', 'lenguaje']
        
        progress = {}
        for domain in domains:
            latest = Milestone.query.filter_by(
                child_id=child_id,
                domain=domain
            ).order_by(Milestone.record_date.desc()).first()
            
            if latest:
                progress[domain] = {
                    'latest_milestone': latest.milestone_description,
                    'achievement_level': latest.achievement_level,
                    'achievement_percentage': latest.achievement_percentage,
                    'record_date': latest.record_date.isoformat()
                }
            else:
                progress[domain] = {
                    'latest_milestone': None,
                    'achievement_level': 'no_iniciado',
                    'achievement_percentage': 0,
                    'record_date': None
                }
        
        # Calcular promedio general
        total_percentage = sum(p['achievement_percentage'] for p in progress.values())
        average_progress = total_percentage / len(domains) if domains else 0
        
        return jsonify({
            'child_id': child_id,
            'child_name': child.full_name,
            'age_months': child.age_months_precise,
            'progress_by_domain': progress,
            'average_progress': round(average_progress, 1)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/alerts', methods=['GET'])
@require_authenticated
def get_milestone_alerts(user):
    """Obtener alertas de niños con retrasos en el desarrollo"""
    try:
        # Obtener todos los niños activos
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                 children = Child.query.join(Tenant).filter(
                    Tenant.license_id == lic_admin.license_id,
                    Child.status == 'activo'
                ).all()
            else:
                children = []
        elif user.role.name in ['educadora', 'educator']:
            children = Child.query.filter_by(
                tenant_id=user.tenant_id,
                assigned_educator_id=user.id,
                status='activo'
            ).all()
        else:
            children = Child.query.filter_by(
                tenant_id=user.tenant_id,
                status='activo'
            ).all()
        
        alerts = []
        
        for child in children:
            if not child.age_months:
                continue
            
            # Contar hitos registrados
            milestones_count = Milestone.query.filter_by(child_id=child.id).count()
            
            # Alerta si tiene más de 12 meses y menos de 3 hitos registrados
            if child.age_months >= 12 and milestones_count < 3:
                alerts.append({
                    'child_id': child.id,
                    'child_name': child.full_name,
                    'age_months': child.age_months,
                    'milestones_count': milestones_count,
                    'severity': 'high' if milestones_count == 0 else 'medium',
                    'message': 'Pocos hitos registrados para su edad'
                })
        
        return jsonify({'alerts': alerts}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================
# MILESTONES EDIT/DELETE
# ========================

@milestones_bp.route('/<int:milestone_id>', methods=['GET'])
@require_authenticated
def get_milestone(user, milestone_id):
    """Get a specific milestone record"""
    try:
        milestone = Milestone.query.get(milestone_id)
        
        if not milestone:
            return jsonify({'error': 'Hito no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if milestone.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
            if user.role.name in ['educadora', 'educator']:
                child = Child.query.get(milestone.child_id)
                if not child or child.assigned_educator_id != user.id:
                    return jsonify({'error': 'Solo puede ver hitos de sus niños asignados'}), 403
        
        child = Child.query.get(milestone.child_id)
        data = milestone.to_dict()
        data['child_name'] = child.full_name if child else 'Desconocido'
        
        return jsonify({'milestone': data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/<int:milestone_id>', methods=['PUT'])
@require_authenticated
def update_milestone(user, milestone_id):
    """Update a milestone record"""
    db.session.rollback()
    
    try:
        milestone = Milestone.query.get(milestone_id)
        
        if not milestone:
            return jsonify({'error': 'Hito no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if milestone.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
            if user.role.name in ['educadora', 'educator']:
                child = Child.query.get(milestone.child_id)
                if not child or child.assigned_educator_id != user.id:
                    return jsonify({'error': 'Solo puede editar hitos de sus niños asignados'}), 403
        
        data = request.get_json()
        
        # Update allowed fields
        for field in ['domain', 'milestone_description', 'achievement_level', 'notes', 'period']:
            if field in data:
                setattr(milestone, field, data[field])
        
        if 'record_date' in data:
            milestone.record_date = date.fromisoformat(data['record_date']) if isinstance(data['record_date'], str) else data['record_date']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Hito actualizado',
            'milestone': milestone.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@milestones_bp.route('/<int:milestone_id>', methods=['DELETE'])
@require_authenticated
def delete_milestone(user, milestone_id):
    """Delete a milestone record"""
    db.session.rollback()
    
    try:
        milestone = Milestone.query.get(milestone_id)
        
        if not milestone:
            return jsonify({'error': 'Hito no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if milestone.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
            if user.role.name in ['educadora', 'educator']:
                child = Child.query.get(milestone.child_id)
                if not child or child.assigned_educator_id != user.id:
                    return jsonify({'error': 'Solo puede eliminar hitos de sus niños asignados'}), 403
        
        db.session.delete(milestone)
        db.session.commit()
        
        return jsonify({'message': 'Hito eliminado'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
