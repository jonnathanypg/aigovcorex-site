"""
Documents API for Social Module - Upload, list, manage documents for RAG
"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
from utils.role_helpers import is_multi_center_role, get_license_id_for_user
from social.services.rag_service import SocialRAGService
import os
from werkzeug.utils import secure_filename

documents_bp = Blueprint('social_documents', __name__, url_prefix='/documents')

ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md', 'docx', 'doc', 'csv', 'json'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _get_rag_service():
    """Create RAG service for current user context"""
    current_user = TenantContext.get_current_user()
    license_id = get_license_id_for_user(current_user) if is_multi_center_role(current_user) else None
    
    if not license_id:
        # For single-center users, get license from tenant
        from models.tenant import Tenant
        tenant = Tenant.query.get(current_user.tenant_id)
        if tenant:
            license_id = tenant.license_id
    
    if not license_id:
        return None, jsonify({'error': 'No license found for user'}), 403
    
    tenant_id = current_user.tenant_id if not is_multi_center_role(current_user) else None
    return SocialRAGService(license_id, tenant_id), None, None

@documents_bp.route('', methods=['POST'])
@tenant_required
def upload_document():
    """Upload a document for RAG indexing"""
    try:
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Allowed: pdf, txt, md, docx, doc, csv, json'}), 400

        filename = secure_filename(file.filename)
        content = file.read()
        
        # Try to decode as text
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            # For binary files like PDF, we'd need a parser
            # For now, store as binary metadata
            text_content = f"[Binary file: {filename}]"
        
        # Get metadata from form
        scope = request.form.get('scope', 'global')
        if scope not in ['global', 'center']:
            scope = 'global'
        
        # For non-admin users, force scope to 'center' with their tenant_id
        current_user = TenantContext.get_current_user()
        if not is_multi_center_role(current_user):
            scope = 'center'
        
        metadata = {
            'filename': filename,
            'content_type': file.content_type,
            'source': 'user_upload',
            'scope': scope
        }
        
        result = rag_service.ingest_text(text_content, metadata, scope)
        
        return jsonify({
            'success': result['success'],
            'message': 'Documento indexado correctamente' if result['success'] else 'Error al indexar',
            'chunks': result['chunks'],
            'namespace': result['namespace']
        }), 201 if result['success'] else 500
        
    except Exception as e:
        import traceback
        logger_msg = f"Error uploading document: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500


@documents_bp.route('', methods=['GET'])
@tenant_required
def list_documents():
    """List indexed documents (metadata only - vectors not returned)"""
    # This is a simplified version - in production you'd want a separate index for document metadata
    return jsonify({
        'message': 'List documents endpoint - requires document metadata store implementation',
        'documents': []
    }), 200


@documents_bp.route('/<doc_hash>', methods=['DELETE'])
@tenant_required
def delete_document(doc_hash):
    """Delete a document by hash"""
    try:
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        current_user = TenantContext.get_current_user()
        
        # Only license admins can delete by hash
        if not is_multi_center_role(current_user):
            return jsonify({'error': 'Solo administradores de licencia pueden eliminar documentos por hash'}), 403
        
        success = rag_service.delete_document(doc_hash)
        
        return jsonify({
            'success': success,
            'message': 'Documento eliminado' if success else 'Documento no encontrado'
        }), 200 if success else 404
        
    except Exception as e:
        import traceback
        logger_msg = f"Error deleting document: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/clear-all', methods=['POST'])
@tenant_required
def clear_all_documents():
    """Clear all documents in license namespace (license_admin only)"""
    try:
        current_user = TenantContext.get_current_user()
        
        if not is_multi_center_role(current_user):
            return jsonify({'error': 'Solo administradores de licencia pueden limpiar todo'}), 403
        
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        success = rag_service.delete_all_for_tenant()
        
        return jsonify({
            'success': success,
            'message': 'Todos los documentos eliminados' if success else 'Error al limpiar'
        }), 200 if success else 500
        
    except Exception as e:
        import traceback
        logger_msg = f"Error clearing documents: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500