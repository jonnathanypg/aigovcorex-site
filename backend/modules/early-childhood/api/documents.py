"""
Documents API - Gestión de Expedientes Digitales
Accesible por usuarios autenticados
"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db
from models.user import User
from models.document import Document
from models.child import Child
from models.application import Application
import os
from datetime import datetime

documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')

# Configuración de uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'documents')
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Crear carpeta si no existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def require_authenticated(f):
    """Decorator to require any authenticated user"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user or not user.tenant_id:
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 403
            
        return f(user, *args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@documents_bp.route('/upload', methods=['POST'])
@require_authenticated
def upload_document(user):
    """Subir documento"""
    try:
        db.session.rollback()
        
        # Verificar que hay archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Tipo de archivo no permitido'}), 400
        
        # Obtener datos del formulario
        child_id = request.form.get('child_id')
        application_id = request.form.get('application_id')
        document_type = request.form.get('document_type', 'otro')
        description = request.form.get('description', '')
        
        if not child_id and not application_id:
            return jsonify({'error': 'Debe especificar child_id o application_id'}), 400
        
        # Verificar permisos (mismo tenant)
        if child_id:
            child = Child.query.get(child_id)
            if not child or child.tenant_id != user.tenant_id:
                return jsonify({'error': 'Niño no encontrado o sin permisos'}), 403
        
        if application_id:
            application = Application.query.get(application_id)
            if not application or application.tenant_id != user.tenant_id:
                return jsonify({'error': 'Solicitud no encontrada o sin permisos'}), 403
        
        # Guardar archivo
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        file.save(file_path)
        file_size = os.path.getsize(file_path)
        
        # Crear registro en BD
        document = Document(
            tenant_id=user.tenant_id,
            child_id=int(child_id) if child_id else None,
            application_id=int(application_id) if application_id else None,
            document_type=document_type,
            file_name=filename,
            file_size=file_size,
            file_path=file_path,
            mime_type=file.content_type,
            description=description,
            uploaded_by=user.id,
            status='pending'
        )
        
        db.session.add(document)
        db.session.commit()
        
        return jsonify({
            'message': 'Documento subido exitosamente',
            'document': document.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/child/<int:child_id>', methods=['GET'])
@require_authenticated
def get_child_documents(user, child_id):
    """Listar documentos de un niño"""
    try:
        child = Child.query.filter_by(
            id=child_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        documents = Document.query.filter_by(
            child_id=child_id,
            is_current_version=True
        ).order_by(Document.created_at.desc()).all()
        
        return jsonify({
            'documents': [doc.to_dict() for doc in documents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/application/<int:application_id>', methods=['GET'])
@require_authenticated
def get_application_documents(user, application_id):
    """Listar documentos de una solicitud"""
    try:
        application = Application.query.filter_by(
            id=application_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        documents = Document.query.filter_by(
            application_id=application_id,
            is_current_version=True
        ).order_by(Document.created_at.desc()).all()
        
        return jsonify({
            'documents': [doc.to_dict() for doc in documents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<int:document_id>/download', methods=['GET'])
@require_authenticated
def download_document(user, document_id):
    """Descargar documento"""
    try:
        document = Document.query.filter_by(id=document_id).first()
        
        if not document:
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        # Verificar permisos
        if document.tenant_id != user.tenant_id:
            return jsonify({'error': 'Sin permisos para acceder a este documento'}), 403
        
        if not os.path.exists(document.file_path):
            return jsonify({'error': 'Archivo no encontrado en el servidor'}), 404
        
        return send_file(
            document.file_path,
            as_attachment=True,
            download_name=document.file_name
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<int:document_id>/approve', methods=['POST'])
@require_authenticated
def approve_document(user, document_id):
    """Aprobar documento"""
    try:
        db.session.rollback()
        
        document = Document.query.filter_by(
            id=document_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not document:
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        document.approve(user.id)
        
        return jsonify({
            'message': 'Documento aprobado',
            'document': document.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<int:document_id>/reject', methods=['POST'])
@require_authenticated
def reject_document(user, document_id):
    """Rechazar documento"""
    try:
        db.session.rollback()
        
        data = request.get_json()
        reason = data.get('reason', 'No especificado')
        
        document = Document.query.filter_by(
            id=document_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not document:
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        document.reject(user.id, reason)
        
        return jsonify({
            'message': 'Documento rechazado',
            'document': document.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<int:document_id>', methods=['DELETE'])
@require_authenticated
def delete_document(user, document_id):
    """Eliminar documento"""
    try:
        db.session.rollback()
        
        document = Document.query.filter_by(
            id=document_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not document:
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        # Eliminar archivo físico
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Eliminar registro
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'message': 'Documento eliminado'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<int:document_id>/versions', methods=['GET'])
@require_authenticated
def get_document_versions(user, document_id):
    """Obtener versiones de un documento"""
    try:
        document = Document.query.filter_by(
            id=document_id,
            tenant_id=user.tenant_id
        ).first()
        
        if not document:
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        # Obtener todas las versiones (incluyendo la actual)
        if document.parent_document_id:
            # Este es una versión, obtener el padre
            parent_id = document.parent_document_id
        else:
            # Este es el padre
            parent_id = document.id
        
        versions = Document.query.filter(
            db.or_(
                Document.id == parent_id,
                Document.parent_document_id == parent_id
            )
        ).order_by(Document.version.desc()).all()
        
        return jsonify({
            'versions': [v.to_dict() for v in versions]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
