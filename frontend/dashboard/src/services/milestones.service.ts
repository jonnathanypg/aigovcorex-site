import api from './api';

export interface MilestoneRecord {
    id: number;
    child_id: number;
    child_name: string;
    child_cedula?: string;
    record_date: string; // YYYY-MM-DD
    period?: string;
    domain: string;
    domain_display?: string;
    milestone_description: string;
    achievement_level: string;
    achievement_percentage?: number;
    color_code?: string; // 'rojo' | 'amarillo' | 'verde'
    notes?: string;
    registered_by?: string;
    registered_by_id?: number;
}

export interface BatchEvaluation {
    domain: string;
    milestone_description: string;
    achievement_level: 'no_iniciado' | 'en_proceso' | 'adquirido';
    notes?: string;
}

export interface BatchRecordPayload {
    child_id: number;
    record_date: string;
    period: string;
    notes?: string;
    evaluations: BatchEvaluation[];
}

export const milestonesService = {
    async getRecent(): Promise<MilestoneRecord[]> {
        const { data } = await api.get<{ milestones: MilestoneRecord[] }>('/api/milestones/');
        return data.milestones;
    },

    async getCatalog(ageRange?: string) {
        const { data } = await api.get('/api/milestones/catalog', { params: { age_range: ageRange } });
        return data;
    },

    async getCatalogForChild(childId: number) {
        const { data } = await api.get(`/api/milestones/catalog/child/${childId}`);
        return data;
    },

    async create(milestoneData: {
        child_id: number;
        milestone_id?: number;
        milestone_description: string;
        domain: string;
        achievement_level: 'no_iniciado' | 'en_proceso' | 'adquirido' | 'consolidado';
        notes?: string;
        record_date?: string;
        period?: string;
    }) {
        const { data } = await api.post('/api/milestones/record', milestoneData);
        return data;
    },

    async recordBatch(payload: BatchRecordPayload) {
        const { data } = await api.post('/api/milestones/record-batch', payload);
        return data;
    },

    async getById(id: number) {
        const { data } = await api.get<{ milestone: MilestoneRecord }>(`/api/milestones/${id}`);
        return data.milestone;
    },

    async update(id: number, milestoneData: Partial<MilestoneRecord>) {
        const { data } = await api.put(`/api/milestones/${id}`, milestoneData);
        return data;
    },

    async delete(id: number) {
        await api.delete(`/api/milestones/${id}`);
    },

    async getByChild(childId: number): Promise<{ child_id: number; child_name: string; milestones: MilestoneRecord[] }> {
        const { data } = await api.get<{ child_id: number; child_name: string; milestones: MilestoneRecord[] }>(`/api/milestones/child/${childId}`);
        return data;
    },

    async getChildProgress(childId: number): Promise<{
        child_id: number;
        child_name: string;
        age_months: number;
        progress_by_domain: Record<string, {
            latest_milestone: string | null;
            achievement_level: string;
            achievement_percentage: number;
            record_date: string | null;
        }>;
        average_progress: number;
    }> {
        const { data } = await api.get(`/api/milestones/child/${childId}/progress`);
        return data;
    }
};
