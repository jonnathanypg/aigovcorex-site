import api from './api';

export interface Application {
    id: number;
    child_name: string;
    child_cedula?: string;
    child_age_months: number;
    application_date: string;
    status: string;
    priority_score: number;
    family_phone?: string;
}

export const applicationsService = {
    async getAll(status?: string): Promise<Application[]> {
        const params = status ? { status } : {};
        const { data } = await api.get<{ applications: Application[] }>('/api/applications/list', { params });
        return data.applications;
    },

    async getById(id: number) {
        const { data } = await api.get(`/api/applications/${id}`);
        return data;
    },

    async create(applicationData: any) {
        const { data: response } = await api.post('/api/applications/create', applicationData);
        return response;
    },

    async approve(id: number, notes?: string) {
        const { data } = await api.post(`/api/applications/${id}/approve`, { notes });
        return data;
    },

    async reject(id: number, notes?: string) {
        const { data } = await api.post(`/api/applications/${id}/reject`, { notes });
        return data;
    },

    async waitlist(id: number, notes?: string) {
        const { data } = await api.post(`/api/applications/${id}/waitlist`, { notes });
        return data;
    },

    async update(id: number, applicationData: any) {
        const { data } = await api.put(`/api/applications/${id}`, applicationData);
        return data;
    },

    async delete(id: number) {
        const { data } = await api.delete(`/api/applications/${id}`);
        return data;
    }
};
