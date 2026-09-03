import api from './api';

export interface FamilyIntervention {
    id: number;
    family_id: number;
    family_name: string;
    date: string; // YYYY-MM-DD
    type: string;
    reason: string;
    notes?: string;
    professional: string;
    status: 'programada' | 'realizada' | 'cancelada';
    interviewee_name?: string;
    interviewee_relationship?: string;
}

export const interventionsService = {
    async getAll(tenantId?: number): Promise<FamilyIntervention[]> {
        let url = '/api/interventions/';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ interventions: FamilyIntervention[] }>(url);
        return data.interventions;
    },

    async create(interventionData: any) {
        const { data } = await api.post('/api/interventions/', interventionData);
        return data;
    },

    async getById(id: number) {
        const { data } = await api.get<{ intervention: FamilyIntervention }>(`/api/interventions/${id}`);
        return data.intervention;
    },

    async update(id: number, interventionData: any) {
        const { data } = await api.put(`/api/interventions/${id}`, interventionData);
        return data;
    },

    async delete(id: number) {
        await api.delete(`/api/interventions/${id}`);
    }
};
