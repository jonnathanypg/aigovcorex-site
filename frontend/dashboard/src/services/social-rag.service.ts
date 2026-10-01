import api from './api';

export interface KnowledgeMatch {
    id: string;
    score: number;
    metadata: Record<string, any>;
    preview: string;
}

export interface KnowledgeQueryResult {
    query: string;
    context: string;
    matches: KnowledgeMatch[];
    total_matches: number;
}

export interface KnowledgeSearchResult {
    id: string;
    score: number;
    preview: string;
    metadata: Record<string, any>;
}

export interface KnowledgeContextResult {
    context: string;
    formatted: string;
    has_context: boolean;
}

export const socialKnowledgeService = {
    /**
     * Query the vector store for relevant context (full response with matches)
     */
    async query(query: string, topK = 5, maxTokens = 3000): Promise<KnowledgeQueryResult> {
        const { data } = await api.post<KnowledgeQueryResult>(
            '/api/social/knowledge/query',
            { query, top_k: topK, max_tokens: maxTokens }
        );
        return data;
    },

    /**
     * Simple search for autocomplete/typeahead
     */
    async search(query: string, limit = 10): Promise<KnowledgeSearchResult[]> {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        const { data } = await api.get<{ results: KnowledgeSearchResult[] }>(
            `/api/social/knowledge/search?${params.toString()}`
        );
        return data.results;
    },

    /**
     * Get formatted context string ready for LLM prompt injection
     */
    async getContext(query: string, maxTokens = 3000): Promise<KnowledgeContextResult> {
        const { data } = await api.post<KnowledgeContextResult>(
            '/api/social/knowledge/context',
            { query, max_tokens: maxTokens }
        );
        return data;
    },

    /**
     * Upload a document for RAG indexing
     */
    async uploadDocument(file: File, scope: 'global' | 'center' = 'global'): Promise<{
        success: boolean;
        message: string;
        chunks: number;
        namespace: string;
    }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', scope);

        const { data } = await api.post('/api/social/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    },

    /**
     * Delete a document by hash (license_admin only)
     */
    async deleteDocument(docHash: string): Promise<{ success: boolean; message: string }> {
        const { data } = await api.delete(`/api/social/documents/${docHash}`);
        return data;
    },

    /**
     * Clear all documents in license namespace (license_admin only)
     */
    async clearAllDocuments(): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post('/api/social/documents/clear-all');
        return data;
    }
};