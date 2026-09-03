import api from './api';
import type { KnowledgeDocument, KnowledgeListResponse } from '@/types/knowledge';

/**
 * Knowledge Base Service
 * Handles RAG document management API calls
 */
export const knowledgeService = {
    /**
     * List knowledge documents based on user role
     */
    async list(scope?: 'global' | 'center'): Promise<KnowledgeListResponse> {
        const params = scope ? { scope } : {};
        const { data } = await api.get('/api/knowledge', { params });
        return data;
    },

    /**
     * Upload a new knowledge document (file or text)
     */
    async upload(formData: FormData): Promise<{ message: string; document: KnowledgeDocument }> {
        const { data } = await api.post('/api/knowledge/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300000, // 5 min - embedding + indexing can be slow
        });
        return data;
    },

    /**
     * Delete a knowledge document
     */
    async remove(docId: number): Promise<{ message: string }> {
        const { data } = await api.delete(`/api/knowledge/${docId}`);
        return data;
    },
};
