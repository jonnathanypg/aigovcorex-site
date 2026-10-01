import api from './api';
import type { DashboardStats, RecentApplication } from '@/types';

export const dashboardService = {
    async getStats(tenantId?: number, range?: { from?: string; to?: string }): Promise<DashboardStats> {
        let url = tenantId ? `/api/dashboard/stats?tenant_id=${tenantId}` : '/api/dashboard/stats';
        if (range?.from) url += `${url.includes('?') ? '&' : '?'}from=${encodeURIComponent(range.from)}`;
        if (range?.to) url += `${url.includes('?') ? '&' : '?'}to=${encodeURIComponent(range.to)}`;
        const { data } = await api.get<DashboardStats>(url);
        return data;
    },

    async getRecentApplications(limit = 6, tenantId?: number, range?: { from?: string; to?: string }): Promise<RecentApplication[]> {
        let url = `/api/dashboard/recent-applications?limit=${limit}`;
        if (tenantId) {
            url += `&tenant_id=${tenantId}`;
        }
        if (range?.from) url += `&from=${encodeURIComponent(range.from)}`;
        if (range?.to) url += `&to=${encodeURIComponent(range.to)}`;
        const { data } = await api.get<{ applications: RecentApplication[] }>(url);
        return data.applications;
    },
};
