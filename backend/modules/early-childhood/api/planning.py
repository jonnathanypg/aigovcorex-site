"""
Planning API - Planificaciones Lúdicas para Educadoras
CRUD + Filtrado por centro, educadora y fecha
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.planning import LudicPlanning
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)

planning_bp = Blueprint('planning', __name__, url_prefix='/planning')


def get_user_context():
    """Get authenticated user and resolve tenant access"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return None, None
    
    # Multi-center roles resolve tenant list
    from utils.role_helpers import is_multi_center_role, get_tenant_ids_for_user
    
    if is_multi_center_role(user):
        tenant_ids = get_tenant_ids_for_user(user)
    elif user.tenant_id:
        tenant_ids = [user.tenant_id]
    else:
        tenant_ids = []
    
    return user, tenant_ids


@planning_bp.route('/list', methods=['GET'])
@jwt_required()
def list_plannings():
    """
    Listar planificaciones.
    - Educadoras: Solo las suyas.
    - Coordinadores: Todas las de su centro.
    - License Admin / Supervisor: Todas las de sus centros.
    """
    try:
        user, tenant_ids = get_user_context()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401
        
        if not tenant_ids:
            return jsonify({'plannings': []}), 200
        
        # Optional filters
        educator_id = request.args.get('educator_id', type=int)
        age_group = request.args.get('age_group')
        status = request.args.get('status')
        month = request.args.get('month')
        year = request.args.get('year', type=int)
        center_id = request.args.get('center_id', type=int)
        
        query = LudicPlanning.query.filter(LudicPlanning.tenant_id.in_(tenant_ids))
        
        # Educadoras solo ven las suyas
        if user.role.name == 'educator':
            query = query.filter(LudicPlanning.educator_id == user.id)
        elif educator_id:
            query = query.filter(LudicPlanning.educator_id == educator_id)
            
        if age_group:
            query = query.filter(LudicPlanning.age_group == age_group)
        if status:
            query = query.filter(LudicPlanning.status == status)
        if month:
            query = query.filter(LudicPlanning.month == month)
        if year:
            query = query.filter(LudicPlanning.year == year)
        if center_id and center_id in tenant_ids:
            query = query.filter(LudicPlanning.tenant_id == center_id)
        
        plannings = query.order_by(LudicPlanning.planning_date.desc()).all()
        
        return jsonify({
            'plannings': [p.to_dict() for p in plannings],
            'total': len(plannings)
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing plannings: {str(e)}")
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/create', methods=['POST'])
@jwt_required()
def create_planning():
    """Crear nueva planificación lúdica"""
    try:
        db.session.rollback()
        user, tenant_ids = get_user_context()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401
        
        data = request.get_json()
        
        # Determine tenant_id
        tenant_id = data.get('tenant_id')
        if not tenant_id:
            tenant_id = user.tenant_id
        
        if not tenant_id or tenant_id not in tenant_ids:
            return jsonify({'error': 'Centro no válido o sin acceso'}), 403
        
        planning = LudicPlanning(
            tenant_id=tenant_id,
            educator_id=data.get('educator_id', user.id),
            planning_date=datetime.strptime(data['planning_date'], '%Y-%m-%d').date() if 'planning_date' in data else date.today(),
            age_group=data['age_group'],
            week_number=data.get('week_number'),
            month=data.get('month'),
            year=data.get('year'),
            tema_integrador=data.get('tema_integrador'),
            nombre_actividad=data['nombre_actividad'],
            objetivo=data.get('objetivo'),
            momento_bienvenida=data.get('momento_bienvenida'),
            momento_juego_intencionado=data.get('momento_juego_intencionado'),
            momento_juego_libre=data.get('momento_juego_libre'),
            momento_higiene=data.get('momento_higiene'),
            momento_alimentacion=data.get('momento_alimentacion'),
            momento_descanso=data.get('momento_descanso'),
            momento_despedida=data.get('momento_despedida'),
            ambito_vinculacion=data.get('ambito_vinculacion'),
            ambito_descubrimiento=data.get('ambito_descubrimiento'),
            ambito_expresion=data.get('ambito_expresion'),
            ambito_exploracion=data.get('ambito_exploracion'),
            indicadores_logro=data.get('indicadores_logro'),
            observaciones=data.get('observaciones'),
            status=data.get('status', 'borrador'),
        )
        
        db.session.add(planning)
        db.session.commit()
        
        return jsonify({
            'message': 'Planificación creada exitosamente',
            'planning': planning.to_dict()
        }), 201
        
    except KeyError as e:
        return jsonify({'error': f'Campo requerido faltante: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating planning: {str(e)}")
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/<int:planning_id>', methods=['GET'])
@jwt_required()
def get_planning(planning_id):
    """Obtener detalle de una planificación"""
    try:
        user, tenant_ids = get_user_context()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401
        
        planning = LudicPlanning.query.get(planning_id)
        if not planning or planning.tenant_id not in tenant_ids:
            return jsonify({'error': 'Planificación no encontrada'}), 404
        
        return jsonify({'planning': planning.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/<int:planning_id>', methods=['PUT'])
@jwt_required()
def update_planning(planning_id):
    """Actualizar planificación"""
    try:
        db.session.rollback()
        user, tenant_ids = get_user_context()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401
        
        planning = LudicPlanning.query.get(planning_id)
        if not planning or planning.tenant_id not in tenant_ids:
            return jsonify({'error': 'Planificación no encontrada'}), 404
        
        data = request.get_json()
        
        # Campos actualizables
        updatable_fields = [
            'planning_date', 'age_group', 'week_number', 'month', 'year',
            'tema_integrador', 'nombre_actividad', 'objetivo',
            'momento_bienvenida', 'momento_juego_intencionado', 'momento_juego_libre',
            'momento_higiene', 'momento_alimentacion', 'momento_descanso', 'momento_despedida',
            'ambito_vinculacion', 'ambito_descubrimiento', 'ambito_expresion', 'ambito_exploracion',
            'indicadores_logro', 'observaciones', 'status',
        ]
        
        for field in updatable_fields:
            if field in data:
                if field == 'planning_date':
                    setattr(planning, field, datetime.strptime(data[field], '%Y-%m-%d').date())
                else:
                    setattr(planning, field, data[field])
        
        # Si se aprueba, registrar el revisor
        if data.get('status') == 'aprobado' and planning.status == 'aprobado':
            planning.reviewed_by = user.id
            planning.review_date = date.today()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Planificación actualizada',
            'planning': planning.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating planning: {str(e)}")
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/<int:planning_id>', methods=['DELETE'])
@jwt_required()
def delete_planning(planning_id):
    """Eliminar planificación"""
    try:
        db.session.rollback()
        user, tenant_ids = get_user_context()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401
        
        planning = LudicPlanning.query.get(planning_id)
        if not planning or planning.tenant_id not in tenant_ids:
            return jsonify({'error': 'Planificación no encontrada'}), 404
        
        db.session.delete(planning)
        db.session.commit()
        
        return jsonify({'message': 'Planificación eliminada'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
