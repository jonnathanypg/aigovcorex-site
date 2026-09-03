from utils.role_helpers import is_multi_center_role
"""
Ingestion API - Bulk CSV Import/Export Endpoints
"""
import logging
from flask import Blueprint, request, jsonify, Response
from middleware.tenant_context import tenant_required, TenantContext
from services.ingestion_service import (
    generate_csv_template,
    process_csv_upload,
    get_available_entities,
    ENTITY_DEFINITIONS,
)

logger = logging.getLogger(__name__)

ingestion_bp = Blueprint('ingestion', __name__, url_prefix='/ingestion')


@ingestion_bp.route('/entities', methods=['GET'])
@tenant_required
def list_entities():
    """List available entities for the current user's role."""
    try:
        user = TenantContext.get_current_user()
        role_name = user.role.name if user.role else 'viewer'
        entities = get_available_entities(role_name)
        return jsonify({'entities': entities}), 200
    except Exception as e:
        logger.error(f"Error listing entities: {e}")
        return jsonify({'error': str(e)}), 500


@ingestion_bp.route('/template/<entity>', methods=['GET'])
@tenant_required
def download_template(entity):
    """Download a CSV template for a given entity."""
    try:
        csv_content, filename = generate_csv_template(entity)
        if not csv_content:
            return jsonify({'error': f'Entidad desconocida: {entity}'}), 404

        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        logger.error(f"Error generating template for {entity}: {e}")
        return jsonify({'error': str(e)}), 500


@ingestion_bp.route('/upload/<entity>', methods=['POST'])
@tenant_required
def upload_csv(entity):
    """Upload and process a CSV file for a given entity."""
    try:
        if entity not in ENTITY_DEFINITIONS:
            return jsonify({'error': f'Entidad desconocida: {entity}'}), 404

        if 'file' not in request.files:
            return jsonify({'error': 'No se encontró un archivo en la solicitud'}), 400

        file = request.files['file']
        if not file.filename or not file.filename.endswith('.csv'):
            return jsonify({'error': 'El archivo debe ser un CSV (.csv)'}), 400

        user = TenantContext.get_current_user()
        
        # Determine tenant_id: from query param (for license_admin) or from user context
        tenant_id = request.args.get('tenant_id', type=int) or user.tenant_id
        
        # License admins can specify a target center; others use their own
        if not is_multi_center_role(user) and tenant_id != user.tenant_id:
            return jsonify({'error': 'No tiene permiso para cargar datos en otro centro'}), 403

        result = process_csv_upload(entity, file.stream, user, tenant_id)

        status_code = 200 if not result['errors'] else 207  # 207 = Multi-Status
        return jsonify(result), status_code

    except Exception as e:
        logger.error(f"Error uploading CSV for {entity}: {e}")
        return jsonify({'error': str(e)}), 500
