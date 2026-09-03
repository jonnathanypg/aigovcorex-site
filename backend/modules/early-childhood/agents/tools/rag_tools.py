"""
RAG Tools for LangGraph Agent
Provides the ConsultKnowledgeTool for searching the hierarchical knowledge base.
"""
from langchain.tools import BaseTool
import logging

logger = logging.getLogger(__name__)


class ConsultKnowledgeTool(BaseTool):
    """
    Tool to search the organization's knowledge base (RAG).
    Uses Pinecone vector search with hierarchical License/Center scope.
    """
    name: str = "consult_knowledge_base"
    description: str = (
        "Search the organization's knowledge base for relevant information about "
        "policies, procedures, regulations, protocols, or any uploaded documents. "
        "Use this when the user asks about institutional rules, MIES regulations, "
        "protocols, or any topic that might be in the knowledge base. "
        "Input: {'query': 'search term or question', 'license_id': 1, 'tenant_id': 1}"
    )

    def _run(self, *args, **kwargs) -> dict:
        """Execute knowledge base search with retry logic"""
        query = kwargs.get('query')
        license_id = kwargs.get('license_id')
        tenant_id = kwargs.get('tenant_id')

        if not query:
            return {'found': False, 'message': 'Se requiere una consulta (query).'}

        if not license_id:
            return {'found': False, 'message': 'No hay contexto de licencia disponible.'}

        # Determine user role for scope filtering
        user_id = kwargs.get('user_id')
        role = 'staff'  # Default

        if user_id:
            try:
                from services.identity_resolver import IdentityResolver
                user = IdentityResolver.get_user_or_virtual(user_id)
                if user and hasattr(user, 'role') and user.role:
                    role = user.role.name
                    
                    # 🔒 Security Enforcement:
                    # Non-admins MUST be restricted to their assigned tenant.
                    # We override any LLM-hallucinated 'tenant_id' with the user's actual tenant.
                    if role != 'license_admin':
                        if hasattr(user, 'tenant_id') and user.tenant_id:
                            tenant_id = user.tenant_id
                            logger.info(f"RAG Security: Enforcing tenant_id={tenant_id} for role {role}")
                        else:
                            # If a non-admin has no tenant (e.g. unassigned staff),
                            # they should effectively see NOTHING or only Global.
                            # But RAGService handles None tenant_id by showing only Global if role != license_admin.
                            # So we just ensure we don't accidentally use a passed tenant_id.
                            tenant_id = None
            except Exception as e:
                logger.error(f"Error resolving user context in RAG tool: {e}")
                pass

        # Retry logic for stale connections
        max_retries = 2
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    try:
                        from models import db
                        db.session.rollback()
                        db.session.remove()
                    except Exception:
                        pass

                from services.rag_service import RAGService
                rag = RAGService(license_id=license_id, tenant_id=tenant_id)
                results = rag.query(query, top_k=5, role=role)

                if results:
                    # Format results for the LLM
                    texts = []
                    for r in results:
                        title = r.get('title', '')
                        content = r.get('content', '')
                        score = r.get('score', 0)
                        scope_label = '🌐 Global' if r.get('scope') == 'global' else '🏠 Centro'
                        
                        header = f"[{scope_label}] {title}" if title else f"[{scope_label}]"
                        texts.append(f"{header} (relevancia: {score:.2f})\n{content}")

                    return {
                        'found': True,
                        'results_count': len(results),
                        'context': "\n\n---\n\n".join(texts)
                    }

                return {
                    'found': False,
                    'message': 'No se encontró información relevante en la base de conocimiento.'
                }

            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(x in error_msg for x in [
                    'gone away', 'broken pipe', 'lost connection', 'closed'
                ])

                if is_connection_error and attempt < max_retries - 1:
                    logger.warning(f"RAG connection error, retrying: {str(e)[:100]}")
                    continue
                else:
                    logger.error(f"RAG query error: {e}")
                    return {
                        'found': False,
                        'message': f'Error consultando la base de conocimiento: {str(e)}'
                    }
