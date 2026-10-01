"""
Biblioteca documental API - Plantillas oficiales CMCI (§10.6)
- 15 categorías fijas (upsert por categoría: una plantilla vigente por categoría).
- Descarga: cualquier usuario autenticado (el resto del equipo descarga).
- Carga/eliminación: license_admin, center_coordinator (alias coordinator),
  supervisor y super_admin.
"""
import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db
from models.user import User
from models.cmci import DocumentTemplate

logger = logging.getLogger(__name__)

document_templates_bp = Blueprint('document_templates', __name__, url_prefix='/api/document-templates')

ALLOWED_TEMPLATE_EXTENSIONS = {'pdf', 'txt', 'docx', 'csv', 'xlsx', 'xls'}

# Slugs del frontend (params.ts, con guiones) + CATEGORIES del modelo (guion bajo).
# Se aceptan ambos; se guardan tal cual llegan para no romper el front.
FRONTEND_SLUGS = {
    'protocolo-ingreso', 'ficha-postulacion', 'ficha-cdp',
    'ficha-socioeconomica', 'ficha-vulnerabilidad', 'informe-visita',
    'acta-compromiso', 'consentimiento', 'autorizacion-imagen',
    'ficha-idii', 'historia-clinica', 'monitoreo-nutricional',
    'ficha-alimentacion', 'menu-semanal', 'informe-mensual',
}
VALID_CATEGORIES = set(DocumentTemplate.CATEGORIES) | FRONTEND_SLUGS

# Solo el dueño principal de la cuenta de la organización (license_admin) o super_admin puede cargar/borrar plantillas.
UPLOAD_ROLES = {'license_admin', 'super_admin'}


def _current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def _role_name(user):
    name = user.role.name if user and user.role else None
    if name == 'coordinator':
        return 'center_coordinator'
    return name


def _can_manage(user):
    return _role_name(user) in UPLOAD_ROLES


def _template_to_dict(t):
    d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
    for k, v in list(d.items()):
        if hasattr(v, 'isoformat'):
            try:
                d[k] = v.isoformat()
            except Exception:
                pass
    return d


@document_templates_bp.route('', methods=['GET'])
@jwt_required()
def list_templates():
    """Lista todas las plantillas (cualquier usuario autenticado puede descargar)."""
    try:
        user = _current_user()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        templates = DocumentTemplate.query.order_by(DocumentTemplate.category.asc()).all()
        return jsonify({
            'templates': [_template_to_dict(t) for t in templates],
            'total': len(templates),
        }), 200
    except Exception as e:
        logger.error(f"Error listing document templates: {e}")
        return jsonify({'error': str(e)}), 500


@document_templates_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_template():
    """Sube o reemplaza la plantilla de una categoría (solo admins/coordinación)."""
    try:
        user = _current_user()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        if not _can_manage(user):
            return jsonify({'error': 'Acceso denegado. Solo administradores y coordinación pueden cargar plantillas.'}), 403

        title = (request.form.get('title') or '').strip()
        category = (request.form.get('category') or '').strip().lower()
        version = (request.form.get('version') or 'v1').strip() or 'v1'

        if not title:
            return jsonify({'error': 'El título es obligatorio'}), 400
        if not category:
            return jsonify({'error': 'La categoría es obligatoria'}), 400
        if category not in VALID_CATEGORIES:
            return jsonify({'error': f'Categoría inválida: {category}'}), 400
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400

        file = request.files['file']
        if not file or not file.filename:
            return jsonify({'error': 'Nombre de archivo vacío'}), 400

        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in ALLOWED_TEMPLATE_EXTENSIONS:
            return jsonify({
                'error': f'Tipo de archivo no soportado: .{ext}. Permitidos: {", ".join(sorted(ALLOWED_TEMPLATE_EXTENSIONS))}'
            }), 400

        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        base_path = os.path.join(current_app.root_path, 'static/uploads/templates')
        os.makedirs(base_path, exist_ok=True)
        full_path = os.path.join(base_path, unique_filename)
        file.save(full_path)
        file_url = f"/static/uploads/templates/{unique_filename}"

        # Upsert por categoría: una plantilla vigente por categoría
        template = DocumentTemplate.query.filter_by(category=category).first()
        if template:
            old_url = template.file_url
            template.title = title
            template.file_url = file_url
            template.version = version
            db.session.commit()
            # Borra el archivo anterior para no acumular basura
            if old_url:
                try:
                    old_path = os.path.join(current_app.root_path, old_url.lstrip('/'))
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except Exception as e:
                    logger.warning(f"No se pudo borrar plantilla anterior {old_url}: {e}")
            logger.info(f"Plantilla reemplazada: {category} (ID {template.id}) por usuario {user.id}")
        else:
            template = DocumentTemplate(
                title=title, category=category, file_url=file_url, version=version,
            )
            db.session.add(template)
            db.session.commit()
            logger.info(f"Plantilla creada: {category} (ID {template.id}) por usuario {user.id}")

        return jsonify({
            'message': 'Plantilla cargada exitosamente',
            'template': _template_to_dict(template),
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading template: {e}")
        return jsonify({'error': str(e)}), 500


@document_templates_bp.route('/<int:template_id>/download', methods=['GET'])
@jwt_required()
def download_template(template_id):
    """Descarga el archivo de una plantilla (todo el equipo)."""
    try:
        user = _current_user()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        template = DocumentTemplate.query.get(template_id)
        if not template or not template.file_url:
            return jsonify({'error': 'Plantilla no encontrada o sin archivo'}), 404
        full_path = os.path.join(current_app.root_path, template.file_url.lstrip('/'))
        if not os.path.exists(full_path):
            return jsonify({'error': 'Archivo no encontrado en el servidor'}), 404
        return send_file(full_path, as_attachment=True)
    except Exception as e:
        logger.error(f"Error downloading template {template_id}: {e}")
        return jsonify({'error': str(e)}), 500


@document_templates_bp.route('/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Elimina una plantilla (solo admins/coordinación)."""
    try:
        user = _current_user()
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        if not _can_manage(user):
            return jsonify({'error': 'No tiene permisos para eliminar plantillas'}), 403
        template = DocumentTemplate.query.get(template_id)
        if not template:
            return jsonify({'error': 'Plantilla no encontrada'}), 404
        file_url = template.file_url
        db.session.delete(template)
        db.session.commit()
        if file_url:
            try:
                full_path = os.path.join(current_app.root_path, file_url.lstrip('/'))
                if os.path.exists(full_path):
                    os.remove(full_path)
            except Exception as e:
                logger.warning(f"No se pudo borrar archivo {file_url}: {e}")
        return jsonify({'message': 'Plantilla eliminada exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting template {template_id}: {e}")
        return jsonify({'error': str(e)}), 500
