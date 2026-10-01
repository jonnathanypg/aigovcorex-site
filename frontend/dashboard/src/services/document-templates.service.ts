import api from './api';

export interface DocumentTemplate {
    id: number;
    title: string;
    category: string;
    file_url: string | null;
    version?: string | null;
    created_at?: string;
    updated_at?: string;
}

/**
 * Biblioteca documental — plantillas oficiales CMCI.
 * Descarga: todo el equipo autenticado. Carga/eliminación: admins y coordinación.
 */
export const documentTemplatesService = {
    async list(): Promise<{ templates: DocumentTemplate[]; total: number }> {
        const { data } = await api.get('/api/document-templates');
        return data;
    },

    async upload(formData: FormData): Promise<{ message: string; template: DocumentTemplate }> {
        const { data } = await api.post('/api/document-templates/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 180000,
        });
        return data;
    },

    async remove(templateId: number): Promise<{ message: string }> {
        const { data } = await api.delete(`/api/document-templates/${templateId}`);
        return data;
    },

    downloadUrl(templateId: number): string {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        return `${base}/api/document-templates/${templateId}/download`;
    },
};
