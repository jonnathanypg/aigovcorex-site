import api from './api';

export interface Notification {
    id: number;
    tenant_id: number;
    title: string;
    description: string;
    type: string;
    time: string;
    read: boolean;
    created_by_id: number | null;
    created_by_name: string;
    center_name: string | null;
    /** IDs de centros en difusión (solo cuando es multi-centro); puede venir como array o string desde la API */
    target_tenants?: number[] | string;
}

export interface CreateNotificationParams {
    title: string;
    description?: string;
    type?: string;
    start_at?: string;
    end_at?: string;
    target_tenants?: number[];
}

export const notificationsService = {
    async getAll(tenantId?: number): Promise<Notification[]> {
        let url = '/api/notifications/';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ notifications: Notification[] }>(url);
        return data.notifications;
    },

    async create(params: CreateNotificationParams, tenantId?: number) {
        let url = '/api/notifications/';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.post<{ message: string; notification: Notification }>(url, params);
        return data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/api/notifications/${id}`);
    },

    async markRead(id: number) {
        const { data } = await api.post(`/api/notifications/${id}/read`);
        return data;
    }
};
