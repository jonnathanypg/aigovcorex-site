import api from './api';

export interface MaintenanceTask {
    id: number;
    task: string;
    center: string;
    center_id?: number;
    center_area?: string;
    notes?: string;
    assignedTo: string;
    assigned_to_id?: number;
    status: 'Pendiente' | 'En Progreso' | 'Completado';
    priority: string;
    date_created?: string;
    date_due: string;
}

export interface CreateTaskData {
    task: string;
    center_area?: string;
    center_id?: number; // For admin
    assigned_to_id?: number;
    priority?: string;
    date_due?: string;
    notes?: string;
    status?: string;
}

export const operationsService = {
    async getAll(tenantId?: number): Promise<MaintenanceTask[]> {
        let url = '/api/operations/';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ tasks: MaintenanceTask[] }>(url);
        return data.tasks;
    },

    async create(taskData: CreateTaskData) {
        const { data } = await api.post('/api/operations/', taskData);
        return data;
    },

    async update(id: number, updates: any) {
        const { data } = await api.put(`/api/operations/${id}`, updates);
        return data;
    },

    async getUsers() {
        const { data } = await api.get('/users/');
        return data.users;
    },

    async delete(id: number) {
        const { data } = await api.delete(`/api/operations/${id}`);
        return data;
    }
};
