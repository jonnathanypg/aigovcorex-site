"""
Knowledge/RAG Query API for Social Module - Query vector store for relevant context
"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
from utils.role_helpers import is_multi_center_role, get_license_id_for_user
from social.services.rag_service import SocialRAGService

knowledge_bp = Blueprint('social_knowledge', __name__, url_prefix='/knowledge')

def _get_rag_service():
    """Create RAG service for current user context"""
    current_user = TenantContext.get_current_user()
    license_id = get_license_id_for_user(current_user) if is_multi_center_role(current_user) else None
    
    if not license_id:
        from models.tenant import Tenant
        tenant = Tenant.query.get(current_user.tenant_id)
        if tenant:
            license_id = tenant.license_id
    
    if not license_id:
        return None, jsonify({'error': 'No license found for user'}), 403
    
    tenant_id = current_user.tenant_id if not is_multi_center_role(current_user) else None
    return SocialRAGService(license_id, tenant_id), None, None


@knowledge_bp.route('/query', methods=['POST'])
@tenant_required
def query_knowledge():
    """Query the vector store for relevant context"""
    try:
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        data = request.get_json() or {}
        query = data.get('query', '').strip()
        top_k = data.get('top_k', 5)
        max_tokens = data.get('max_tokens', 3000)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Get context for LLM
        context = rag_service.get_context(query, max_tokens=max_tokens)
        
        # Also return raw matches for debugging
        matches = rag_service.query(query, top_k=top_k)
        
        return jsonify({
            'query': query,
            'context': context,
            'matches': [
                {
                    'id': m['id'],
                    'score': m['score'],
                    'metadata': m['metadata'],
                    'preview': m['content'][:200] + '...' if len(m['content']) > 200 else m['content']
                }
                for m in matches
            ],
            'total_matches': len(matches)
        }), 200
        
    except Exception as e:
        import traceback
        logger_msg = f"Error querying knowledge: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500


@knowledge_bp.route('/search', methods=['GET'])
@tenant_required
def search_knowledge():
    """Simple search endpoint for autocomplete/typeahead"""
    try:
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        query = request.args.get('q', '').strip()
        limit = min(int(request.args.get('limit', 10)), 20)
        
        if not query or len(query) < 2:
            return jsonify({'results': []}), 200
        
        matches = rag_service.query(query, top_k=limit, score_threshold=0.6)
        
        results = [
            {
                'id': m['id'],
                'score': m['score'],
                'preview': m['content'][:150] + '...' if len(m['content']) > 150 else m['content'],
                'metadata': m['metadata']
            }
            for m in matches
        ]
        
        return jsonify({'results': results}), 200
        
    except Exception as e:
        import traceback
        logger_msg = f"Error searching knowledge: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500


@knowledge_bp.route('/context', methods=['POST'])
@tenant_required
def get_context_for_prompt():
    """Get formatted context string ready to inject into LLM prompt"""
    try:
        rag_service, error_resp, error_code = _get_rag_service()
        if error_resp:
            return error_resp, error_code

        data = request.get_json() or {}
        query = data.get('query', '').strip()
        max_tokens = data.get('max_tokens', 3000)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        context = rag_service.get_context(query, max_tokens=max_tokens)
        
        # Format as prompt injection
        if context:
            formatted = f"CONTEXTO RELEVANTE DE DOCUMENTOS:\n{context}\n\n---\n\n"
        else:
            formatted = ""
        
        return jsonify({
            'context': context,
            'formatted': formatted,
            'has_context': bool(context)
        }), 200
        
    except Exception as e:
        import traceback
        logger_msg = f"Error getting context: {e}\n{traceback.format_exc()}"
        print(logger_msg)
        return jsonify({'error': str(e)}), 500