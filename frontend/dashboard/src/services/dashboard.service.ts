import api from './api';
import type { DashboardStats, RecentApplication } from '@/types';

export const dashboardService = {
    async getStats(tenantId?: number): Promise<DashboardStats> {
        const url = tenantId ? `/api/dashboard/stats?tenant_id=${tenantId}` : '/api/dashboard/stats';
        const { data } = await api.get<DashboardStats>(url);
        return data;
    },

    async getRecentApplications(limit = 6, tenantId?: number): Promise<RecentApplication[]> {
        let url = `/api/dashboard/recent-applications?limit=${limit}`;
        if (tenantId) {
            url += `&tenant_id=${tenantId}`;
        }
        const { data } = await api.get<{ applications: RecentApplication[] }>(url);
        return data.applications;
    },
};
