"""
Chat Upload API — Procesamiento de archivos adjuntos desde el Copiloto
AI GovCoreX OS — Permite subir CSV, Excel, PDF, Word desde el sidebar de chat

Lógica:
  CSV/Excel → Análisis de columnas + oferta de carga masiva de beneficiarios/personal
  PDF/Word  → Ingesta en base de conocimiento RAG de la licencia
  Imagen    → Análisis visual con IA (futuro)

El agente LangGraph analiza el archivo y responde con contexto en lenguaje natural.
"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
import logging
import os
import tempfile

chat_upload_bp = Blueprint('chat_upload', __name__, url_prefix='/api/ingestion')
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {
    'csv', 'xlsx', 'xls',          # Hojas de cálculo → bulk upload
    'pdf', 'doc', 'docx',           # Documentos → RAG ingestion
    'txt', 'md',                    # Texto plano → RAG ingestion
}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@chat_upload_bp.route('/chat-upload', methods=['POST'])
@tenant_required
def chat_upload():
    """
    Procesar archivo adjunto enviado desde el chat del Copiloto.
    Soporta: CSV, Excel, PDF, Word, TXT

    El agente LangGraph analiza el contenido y:
    - Para CSV/Excel: Detecta tipo de datos y ofrece carga masiva
    - Para PDF/Word: Ingesta en Pinecone RAG con metadatos de licencia/centro
    """
    try:
        tenant_id = TenantContext.get_current_tenant_id()
        user = TenantContext.get_current_user()

        if 'file' not in request.files:
            return jsonify({'error': 'No se proporcionó archivo'}), 400

        file = request.files['file']
        message = request.form.get('message', 'Procesa este archivo').strip()

        if not file.filename or not _allowed_file(file.filename):
            return jsonify({'error': 'Tipo de archivo no soportado. Use: CSV, Excel, PDF, Word'}), 400

        file_bytes = file.read()
        filename = file.filename.lower()

        if filename.endswith(('.csv', '.xlsx', '.xls')):
            return _handle_spreadsheet(file_bytes, file.filename, message, tenant_id, user)
        else:
            return _handle_document(file_bytes, file.filename, message, tenant_id, user)

    except Exception as e:
        logger.error(f"chat_upload error: {e}")
        return jsonify({'error': str(e)}), 500


def _get_license_id(user):
    """Helper: obtener license_id del usuario"""
    try:
        from models.license import LicenseAdmin
        la = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
        if la:
            return la.license_id
        if user.tenant_id:
            from models.tenant import Tenant
            tenant = Tenant.query.get(user.tenant_id)
            if tenant and tenant.license_id:
                return tenant.license_id
    except Exception:
        pass
    return None


def _run_orchestrator(context_message: str, tenant_id, user):
    """Helper: ejecutar orquestador LangGraph"""
    license_id = _get_license_id(user)
    from agents.langgraph_orchestrator import LangGraphOrchestrator
    orch = LangGraphOrchestrator(
        tenant_id=tenant_id,
        user_id=user.id,
        license_id=license_id,
        role=user.role.name if user.role else 'coordinator',
    )
    result = orch.process_message(context_message, channel='web_chat')
    return result.get('response', '✅ Procesado correctamente.')


def _handle_spreadsheet(file_bytes: bytes, filename: str, message: str, tenant_id, user):
    """Manejar archivo CSV/Excel — análisis y oferta de carga masiva"""
    try:
        import pandas as pd
        from io import BytesIO

        df = pd.read_csv(BytesIO(file_bytes)) if filename.lower().endswith('.csv') \
            else pd.read_excel(BytesIO(file_bytes))

        rows = len(df)
        cols = list(df.columns)
        preview = df.head(5).to_string(index=False)

        context = (
            f"[ARCHIVO ADJUNTO - HOJA DE CÁLCULO]\n"
            f"Archivo: {filename}\n"
            f"Filas: {rows} | Columnas: {', '.join(cols)}\n\n"
            f"Primeras 5 filas:\n{preview}\n\n"
            f"Instrucción del usuario: {message}\n\n"
            f"ANALIZA el contenido del archivo y:\n"
            f"1. Identifica qué tipo de datos contiene (beneficiarios, personal, asistencia, etc.)\n"
            f"2. Indica cuántos registros se procesarían\n"
            f"3. Señala si hay columnas con problemas o datos faltantes importantes\n"
            f"4. Ofrece procesar la carga masiva si es aplicable\n"
            f"5. Sugiere los pasos siguientes de forma clara"
        )

        try:
            response = _run_orchestrator(context, tenant_id, user)
        except Exception as e:
            response = (
                f"📊 Archivo **{filename}** recibido:\n"
                f"- **{rows}** filas detectadas\n"
                f"- **{len(cols)}** columnas: {', '.join(cols[:8])}{'...' if len(cols) > 8 else ''}\n\n"
                f"Listo para procesar la carga masiva. ¿Confirmas que deseas importar estos {rows} registros?"
            )

        return jsonify({
            'success': True,
            'response': response,
            'file_info': {
                'filename': filename,
                'rows': rows,
                'columns': cols,
                'type': 'spreadsheet',
            }
        }), 200

    except ImportError:
        return jsonify({
            'success': True,
            'response': (
                f"📊 Archivo **{filename}** recibido exitosamente. "
                f"El análisis detallado requiere `pandas` instalado. "
                f"¿Deseas proceder con la importación directa?"
            ),
        }), 200
    except Exception as e:
        logger.error(f"Spreadsheet handler error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def _handle_document(file_bytes: bytes, filename: str, message: str, tenant_id, user):
    """Manejar PDF/Word/TXT — ingesta en RAG de la licencia"""
    suffix = '.' + filename.rsplit('.', 1)[-1].lower()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        license_id = _get_license_id(user)
        text_content = ''

        # Extract text
        try:
            from services.upload_service import UploadService
            text_content = UploadService.extract_text(tmp_path) or ''
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")

        # Ingest into RAG if license available
        if license_id and text_content:
            try:
                from services.rag_service import RAGService
                rag = RAGService(license_id=license_id, tenant_id=tenant_id)
                rag.ingest_text(
                    text=text_content,
                    metadata={
                        'source': filename,
                        'uploaded_by': user.email,
                        'scope': 'center' if tenant_id else 'global',
                        'tenant_id': tenant_id,
                        'upload_channel': 'chat_sidebar',
                    }
                )
                response = (
                    f"📄 El documento **{filename}** fue ingresado exitosamente "
                    f"en la Base de Conocimiento RAG de tu organización.\n\n"
                    f"Ahora el Copiloto puede responder preguntas basadas en su contenido. "
                    f"¿Hay algo específico que quieras consultar sobre este documento?"
                )
            except Exception as e:
                logger.error(f"RAG ingestion failed: {e}")
                response = (
                    f"📄 Documento **{filename}** recibido. "
                    f"Hubo un inconveniente al ingestarlo en RAG ({str(e)[:80]}). "
                    f"El archivo fue procesado de forma local."
                )
        elif not license_id:
            response = (
                f"📄 Documento **{filename}** recibido. "
                f"No se encontró una licencia activa para ingestar en RAG. "
                f"Contacta a tu administrador de licencia."
            )
        else:
            response = (
                f"📄 Documento **{filename}** recibido. "
                f"No se pudo extraer texto del documento para ingesta RAG. "
                f"¿El archivo tiene contenido textual?"
            )

        return jsonify({
            'success': True,
            'response': response,
            'file_info': {
                'filename': filename,
                'type': 'document',
                'chars_extracted': len(text_content),
                'rag_ingested': bool(license_id and text_content),
            }
        }), 200

    except Exception as e:
        logger.error(f"Document handler error: {e}")
        return jsonify({
            'success': True,
            'response': f"📄 Recibí el documento **{filename}**. Error técnico al procesarlo: {str(e)[:120]}",
        }), 200
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
