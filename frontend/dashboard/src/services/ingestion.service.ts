import api from './api';

export interface IngestionEntity {
    key: string;
    label: string;
    columns: { name: string; label: string; required: boolean }[];
}

export interface IngestionResult {
    success: number;
    errors: { row: number; field: string; message: string }[];
    total_rows?: number;
}

export const ingestionService = {
    async getEntities(): Promise<IngestionEntity[]> {
        const { data } = await api.get<{ entities: IngestionEntity[] }>('/api/ingestion/entities');
        return data.entities;
    },

    async downloadTemplate(entity: string): Promise<void> {
        const response = await api.get(`/api/ingestion/template/${entity}`, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla_${entity}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    },

    async uploadCsv(entity: string, file: File, tenantId?: number): Promise<IngestionResult> {
        const formData = new FormData();
        formData.append('file', file);
        const params = tenantId ? `?tenant_id=${tenantId}` : '';
        const { data } = await api.post<IngestionResult>(
            `/api/ingestion/upload/${entity}${params}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return data;
    },
};
