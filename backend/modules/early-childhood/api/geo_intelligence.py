"""
Geo Intelligence API Blueprint
AI GovCoreX OS — Endpoints para "Ojo de Dios" — Inteligencia Geoespacial
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import db
from models.geo_intelligence import GeoPoint, GeoLayer, GeoFence, OrgNetworkEdge
import logging

logger = logging.getLogger(__name__)

geo_intelligence_bp = Blueprint('geo_intelligence', __name__, url_prefix='/geo')


@geo_intelligence_bp.route('/points', methods=['GET'])
@jwt_required()
def list_geo_points():
    """Lista todos los puntos georreferenciados con filtros"""
    try:
        program_id = request.args.get('program_id', type=int)
        point_type = request.args.get('point_type')
        layer_id = request.args.get('layer_id', type=int)

        query = GeoPoint.query.filter_by(is_active=True)
        if program_id:
            query = query.filter_by(program_id=program_id)
        if point_type:
            query = query.filter_by(point_type=point_type)
        if layer_id:
            query = query.filter_by(layer_id=layer_id)

        points = query.all()
        return jsonify({
            'success': True,
            'data': [p.to_dict() for p in points],
            'count': len(points)
        })
    except Exception as e:
        logger.error(f'Error listing geo points: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/points', methods=['POST'])
@jwt_required()
def create_geo_point():
    """Crea un nuevo punto georreferenciado"""
    try:
        data = request.get_json() or {}

        required = ['point_type', 'latitude', 'longitude']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({'success': False, 'error': f'Missing required fields: {missing}'}), 400

        point = GeoPoint(
            program_id=data.get('program_id'),
            tenant_id=data.get('tenant_id'),
            license_id=data.get('license_id'),
            point_type=data['point_type'],
            layer_id=data.get('layer_id'),
            name=data.get('name'),
            description=data.get('description'),
            latitude=data['latitude'],
            longitude=data['longitude'],
            altitude=data.get('altitude'),
            color=data.get('color', '#10b981'),
            icon=data.get('icon'),
            size=data.get('size', 10),
            ref_entity_type=data.get('ref_entity_type'),
            ref_entity_id=data.get('ref_entity_id'),
            properties=data.get('properties', {}),
        )
        db.session.add(point)
        db.session.commit()
        return jsonify({'success': True, 'data': point.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creating geo point: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/points/<int:point_id>', methods=['DELETE'])
@jwt_required()
def delete_geo_point(point_id: int):
    """Desactiva un punto georreferenciado (soft delete)"""
    try:
        point = GeoPoint.query.get_or_404(point_id)
        point.is_active = False
        db.session.commit()
        return jsonify({'success': True, 'message': 'Point deactivated'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/layers', methods=['GET'])
@jwt_required()
def list_layers():
    """Lista todas las capas geográficas"""
    try:
        program_id = request.args.get('program_id', type=int)
        query = GeoLayer.query.filter_by(is_visible=True)
        if program_id:
            query = query.filter_by(program_id=program_id)
        layers = query.order_by(GeoLayer.order_index).all()
        return jsonify({
            'success': True,
            'data': [l.to_dict() for l in layers]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/layers', methods=['POST'])
@jwt_required()
def create_layer():
    """Crea una nueva capa geográfica"""
    try:
        data = request.get_json() or {}
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Missing required field: name'}), 400

        layer = GeoLayer(
            program_id=data.get('program_id'),
            license_id=data.get('license_id'),
            name=data['name'],
            description=data.get('description'),
            layer_type=data.get('layer_type', 'points'),
            default_color=data.get('default_color', '#10b981'),
            is_visible=data.get('is_visible', True),
            opacity=data.get('opacity', 0.8),
            order_index=data.get('order_index', 0),
        )
        db.session.add(layer)
        db.session.commit()
        return jsonify({'success': True, 'data': layer.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/fences', methods=['GET'])
@jwt_required()
def list_fences():
    """Lista todos los cercos digitales"""
    try:
        program_id = request.args.get('program_id', type=int)
        query = GeoFence.query.filter_by(is_active=True)
        if program_id:
            query = query.filter_by(program_id=program_id)
        fences = query.all()
        return jsonify({'success': True, 'data': [f.to_dict() for f in fences]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/fences', methods=['POST'])
@jwt_required()
def create_fence():
    """Crea un nuevo cerco digital"""
    try:
        data = request.get_json() or {}
        if not data.get('name') or not data.get('geojson'):
            return jsonify({'success': False, 'error': 'Missing required fields: name, geojson'}), 400

        fence = GeoFence(
            program_id=data.get('program_id'),
            license_id=data.get('license_id'),
            layer_id=data.get('layer_id'),
            name=data['name'],
            description=data.get('description'),
            fence_type=data.get('fence_type', 'sector'),
            geojson=data['geojson'],
            color=data.get('color', '#10b981'),
            fill_opacity=data.get('fill_opacity', 0.2),
            border_color=data.get('border_color'),
            alert_threshold=data.get('alert_threshold'),
            properties=data.get('properties', {}),
        )
        db.session.add(fence)
        db.session.commit()
        return jsonify({'success': True, 'data': fence.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/network/edges', methods=['GET'])
@jwt_required()
def list_network_edges():
    """Lista aristas del grafo de red interinstitucional"""
    try:
        edges = OrgNetworkEdge.query.filter_by(is_active=True).all()
        return jsonify({'success': True, 'data': [e.to_dict() for e in edges]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/network/edges', methods=['POST'])
@jwt_required()
def create_network_edge():
    """Crea una arista en el grafo de red interinstitucional"""
    try:
        data = request.get_json() or {}
        if not data.get('source_org_id'):
            return jsonify({'success': False, 'error': 'Missing required field: source_org_id'}), 400

        edge = OrgNetworkEdge(
            source_org_id=data['source_org_id'],
            target_org_id=data.get('target_org_id'),
            target_program_id=data.get('target_program_id'),
            license_id=data.get('license_id'),
            relationship_type=data.get('relationship_type'),
            label=data.get('label'),
            weight=data.get('weight', 1.0),
            color=data.get('color'),
            properties=data.get('properties', {}),
        )
        db.session.add(edge)
        db.session.commit()
        return jsonify({'success': True, 'data': edge.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@geo_intelligence_bp.route('/stats', methods=['GET'])
@jwt_required()
def geo_stats():
    """Estadísticas globales del módulo geoespacial"""
    try:
        stats = {
            'points': {
                'total': GeoPoint.query.filter_by(is_active=True).count(),
                'centers': GeoPoint.query.filter_by(point_type='center', is_active=True).count(),
                'beneficiaries': GeoPoint.query.filter_by(point_type='beneficiary', is_active=True).count(),
                'brigades': GeoPoint.query.filter_by(point_type='brigade', is_active=True).count(),
                'incidents': GeoPoint.query.filter_by(point_type='incident', is_active=True).count(),
            },
            'layers': GeoLayer.query.count(),
            'fences': GeoFence.query.filter_by(is_active=True).count(),
            'network_edges': OrgNetworkEdge.query.filter_by(is_active=True).count(),
        }
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
