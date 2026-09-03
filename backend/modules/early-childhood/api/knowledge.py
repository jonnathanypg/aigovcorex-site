"""
Knowledge Base API - Gestión de Documentos RAG
Accesible por usuarios con rol license_admin o center_coordinator.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.tenant import Tenant
from models.license import LicenseAdmin
from models.knowledge import KnowledgeDocument
from services.rag_service import RAGService
from utils.text_extractor import TextExtractor
from datetime import datetime
import os
import json
import logging

logger = logging.getLogger(__name__)

knowledge_bp = Blueprint('knowledge', __name__, url_prefix='/api/knowledge')

# Allowed file extensions for knowledge documents
ALLOWED_KNOWLEDGE_EXTENSIONS = {'pdf', 'txt', 'docx'}


def _get_user_context():
    """
    Determine the user's role and scope for knowledge operations.
    Returns: (user, license_id, tenant_id, role, error_response)
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return None, None, None, None, (jsonify({'error': 'Usuario no encontrado'}), 404)

    role_name = user.role.name if user.role else None
    
    # Standardize role alias
    if role_name == 'coordinator':
        role_name = 'center_coordinator'

    # License Admin
    if role_name == 'license_admin':
        license_admin = LicenseAdmin.query.filter_by(user_id=user_id, is_active=True).first()
        if not license_admin:
            return None, None, None, None, (jsonify({'error': 'Licencia no asignada'}), 403)
        return user, license_admin.license_id, None, 'license_admin', None

    # Center Coordinator
    if role_name == 'center_coordinator':
        if not user.tenant_id:
            return None, None, None, None, (jsonify({'error': 'No asignado a ningún centro'}), 400)
        tenant = Tenant.query.get(user.tenant_id)
        if not tenant or not tenant.license_id:
            return None, None, None, None, (jsonify({'error': 'Centro sin licencia asociada'}), 400)
        return user, tenant.license_id, user.tenant_id, 'center_coordinator', None

    # Other roles → access denied
    return None, None, None, None, (jsonify({'error': 'Acceso denegado. Solo License Admin y Coordinadores pueden gestionar la base de conocimiento.'}), 403)


@knowledge_bp.route('', methods=['GET'])
@jwt_required()
def list_documents():
    """List knowledge documents based on user role and scope"""
    try:
        user, license_id, tenant_id, role, error = _get_user_context()
        if error:
            return error

        query = KnowledgeDocument.query.filter_by(
            license_id=license_id,
            is_active=True
        )

        # Coordinators only see global docs + their center's docs
        if role == 'center_coordinator' and tenant_id:
            query = query.filter(
                db.or_(
                    KnowledgeDocument.tenant_id.is_(None),  # Global
                    KnowledgeDocument.tenant_id == tenant_id  # Own center
                )
            )

        # Optional scope filter from query params
        scope_filter = request.args.get('scope')
        if scope_filter == 'global':
            query = query.filter(KnowledgeDocument.tenant_id.is_(None))
        elif scope_filter == 'center':
            if tenant_id:
                query = query.filter(KnowledgeDocument.tenant_id == tenant_id)

        documents = query.order_by(KnowledgeDocument.created_at.desc()).all()

        # Enrich with tenant name
        docs_data = []
        for doc in documents:
            d = doc.to_dict()
            if doc.tenant:
                d['tenant_name'] = doc.tenant.name
            else:
                d['tenant_name'] = None
            docs_data.append(d)

        return jsonify({
            'documents': docs_data,
            'total': len(docs_data),
            'role': role
        }), 200

    except Exception as e:
        is_gone_away = '2006' in str(e) or 'Gone away' in str(e) or 'Lost connection' in str(e) or 'Broken pipe' in str(e)
        if is_gone_away:
            logger.warning(f"⚠️ MySQL connection lost during list. Retrying... ({e})")
            db.session.remove()
            try:
                # Retry the query
                user, license_id, tenant_id, role, error = _get_user_context()
                if error:
                    return error
                query = KnowledgeDocument.query.filter_by(license_id=license_id, is_active=True)
                if role == 'center_coordinator' and tenant_id:
                    query = query.filter(db.or_(KnowledgeDocument.tenant_id.is_(None), KnowledgeDocument.tenant_id == tenant_id))
                documents = query.order_by(KnowledgeDocument.created_at.desc()).all()
                docs_data = []
                for doc in documents:
                    d = doc.to_dict()
                    d['tenant_name'] = doc.tenant.name if doc.tenant else None
                    docs_data.append(d)
                return jsonify({'documents': docs_data, 'total': len(docs_data), 'role': role}), 200
            except Exception as retry_err:
                logger.error(f"❌ Retry list failed: {retry_err}")
                return jsonify({'error': 'Error de conexión a la base de datos. Intente nuevamente.'}), 500
        logger.error(f"Error listing knowledge documents: {e}")
        return jsonify({'error': str(e)}), 500


@knowledge_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload and index a new knowledge document"""
    try:
        user, license_id, tenant_id, role, error = _get_user_context()
        if error:
            return error

        # ── 1. Validate Input ──
        title = request.form.get('title', '').strip()
        scope = request.form.get('scope', 'global')
        target_tenant_id = request.form.get('tenant_id')  # Only for license_admin
        content_text = request.form.get('content', '').strip()  # For plain text input

        if not title:
            return jsonify({'error': 'El título es obligatorio'}), 400

        # Scope enforcement
        if role == 'center_coordinator':
            scope = 'center'
            target_tenant_id = tenant_id
        elif role == 'license_admin':
            if scope == 'center' and target_tenant_id:
                target_tenant_id = int(target_tenant_id)
                # Verify the tenant belongs to this license
                tenant = Tenant.query.filter_by(id=target_tenant_id, license_id=license_id).first()
                if not tenant:
                    return jsonify({'error': 'El centro no pertenece a su licencia'}), 400
            elif scope == 'global':
                target_tenant_id = None
            else:
                target_tenant_id = None
                scope = 'global'

        # ── 2. Handle File Upload or Text Input ──
        file_path_saved = None
        extracted_text = content_text

        if 'file' in request.files:
            file = request.files['file']
            if file and file.filename:
                # Validate extension
                ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
                if ext not in ALLOWED_KNOWLEDGE_EXTENSIONS:
                    return jsonify({
                        'error': f'Tipo de archivo no soportado: .{ext}. Solo se permiten: {", ".join(ALLOWED_KNOWLEDGE_EXTENSIONS)}'
                    }), 400

                # Save file
                import uuid
                from werkzeug.utils import secure_filename
                from flask import current_app

                filename = secure_filename(file.filename)
                unique_filename = f"{uuid.uuid4().hex}_{filename}"

                base_path = os.path.join(current_app.root_path, 'static/uploads/knowledge')
                os.makedirs(base_path, exist_ok=True)

                full_path = os.path.join(base_path, unique_filename)
                file.save(full_path)
                file_path_saved = f"/static/uploads/knowledge/{unique_filename}"

                # Extract text from file
                extracted_text = TextExtractor.extract(full_path)

        if role not in ['license_admin', 'center_coordinator']:
            return jsonify({'error': 'No autorizado'}), 403

        if not extracted_text:
            return jsonify({'error': 'No se pudo obtener contenido. Suba un archivo o ingrese texto.'}), 400

        # Determine source type
        source_type = 'text'
        if file_path_saved:
            if file_path_saved.endswith('.pdf'):
                source_type = 'pdf'
            elif file_path_saved.endswith('.docx'):
                source_type = 'docx'

        # ── 3. Save to DB (with retry logic for MySQL Gone Away) ──
        final_tenant_id = int(target_tenant_id) if target_tenant_id else None

        def _save_to_db():
            """Inner function to save document to DB, retried on connection loss."""
            doc = KnowledgeDocument(
                license_id=license_id,
                tenant_id=final_tenant_id,
                title=title,
                content=extracted_text,
                source_type=source_type,
                source_url=file_path_saved,
                uploaded_by=user.id,
                is_active=True
            )
            db.session.add(doc)
            db.session.commit()
            return doc

        doc = None
        try:
            doc = _save_to_db()
        except Exception as db_err:
            is_gone_away = '2006' in str(db_err) or 'Gone away' in str(db_err) or 'Lost connection' in str(db_err) or 'Broken pipe' in str(db_err)
            if is_gone_away:
                logger.warning(f"⚠️ MySQL connection lost during upload. Retrying... ({db_err})")
                db.session.remove()  # Force clear connection pool
                try:
                    doc = _save_to_db()
                    logger.info("✅ Retry save successful.")
                except Exception as retry_err:
                    db.session.rollback()
                    logger.error(f"❌ Retry failed: {retry_err}")
                    return jsonify({'error': 'Error de conexión a la base de datos. Intente nuevamente.'}), 500
            else:
                db.session.rollback()
                raise db_err

        # ── 4. Index into Pinecone (after successful DB save) ──
        try:
            rag_service = RAGService(
                license_id=license_id,
                tenant_id=final_tenant_id
            )
            vector_ids = rag_service.index_document(
                document_id=doc.id,
                content=extracted_text,
                title=title,
                scope=scope
            )

            # Update DB record with vector info
            doc.pinecone_ids = json.dumps(vector_ids)
            doc.chunk_count = len(vector_ids)
            doc.indexed_at = datetime.utcnow()
            db.session.commit()
        except Exception as index_err:
            # Document is saved but indexing failed — log but don't delete the doc
            logger.warning(f"⚠️ Pinecone indexing failed for doc {doc.id}: {index_err}. Document saved without vectors.")
            # Still return success since the document content is stored
            pass

        # ── 5. Refresh DB connection after potentially long Pinecone operation ──
        # The Pinecone call can take 30-60s, making the MySQL connection stale.
        # Close the session so the next query gets a fresh connection from the pool.
        try:
            doc_id_saved = doc.id
            db.session.close()
            doc = KnowledgeDocument.query.get(doc_id_saved)
        except Exception as refresh_err:
            logger.warning(f"⚠️ DB refresh after indexing: {refresh_err}")
            db.session.remove()
            doc = KnowledgeDocument.query.get(doc_id_saved)

        logger.info(f"Knowledge document uploaded: '{title}' (ID: {doc.id}, Scope: {scope}, Chunks: {doc.chunk_count or 0})")

        if doc.chunk_count and doc.chunk_count > 0:
            msg = 'Documento cargado e indexado exitosamente'
        else:
            msg = 'Documento guardado, pero la indexación falló (ver logs). RAG no disponible para este archivo.'

        return jsonify({
            'message': msg,
            'document': doc.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading knowledge document: {e}")
        return jsonify({'error': str(e)}), 500


@knowledge_bp.route('/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    """Delete a knowledge document and its vectors"""
    try:
        user, license_id, tenant_id, role, error = _get_user_context()
        if error:
            return error

        doc = KnowledgeDocument.query.filter_by(
            id=doc_id,
            license_id=license_id
        ).first()

        if not doc:
            return jsonify({'error': 'Documento no encontrado'}), 404

        # Coordinators can only delete their center's docs
        if role == 'center_coordinator':
            if doc.tenant_id != tenant_id:
                return jsonify({'error': 'No tiene permisos para eliminar este documento'}), 403

        # ── 1. Delete vectors from Pinecone ──
        try:
            rag_service = RAGService(license_id=license_id, tenant_id=doc.tenant_id)
            rag_service.delete_document(doc.id)
        except Exception as e:
            logger.warning(f"Error deleting vectors for doc {doc_id}: {e}")

        # ── 2. Delete physical file if exists ──
        if doc.source_url:
            try:
                from services.upload_service import FileService
                FileService.delete_file(doc.source_url)
            except Exception as e:
                logger.warning(f"Error deleting file for doc {doc_id}: {e}")

        # ── 3. Delete DB record ──
        db.session.delete(doc)
        db.session.commit()

        logger.info(f"Knowledge document deleted: ID={doc_id}")

        return jsonify({'message': 'Documento eliminado exitosamente'}), 200

    except Exception as e:
        is_gone_away = '2006' in str(e) or 'Gone away' in str(e) or 'Lost connection' in str(e) or 'Broken pipe' in str(e)
        if is_gone_away:
            logger.warning(f"⚠️ MySQL connection lost during delete. Retrying... ({e})")
            db.session.remove()
            try:
                # Re-fetch document to ensure it's attached to new session
                doc_retry = KnowledgeDocument.query.filter_by(id=doc_id, license_id=license_id).first()
                if doc_retry:
                    db.session.delete(doc_retry)
                    db.session.commit()
                    logger.info("✅ Retry delete successful.")
                    return jsonify({'message': 'Documento eliminado exitosamente'}), 200
                else:
                    return jsonify({'error': 'Documento no encontrado al reintentar'}), 404
            except Exception as retry_err:
                db.session.rollback()
                logger.error(f"❌ Retry delete failed: {retry_err}")
                return jsonify({'error': 'Error de conexión a la base de datos. Intente nuevamente.'}), 500
        
        db.session.rollback()
        logger.error(f"Error deleting knowledge document: {e}")
        return jsonify({'error': str(e)}), 500
