import api from './api';
import type { Child } from '@/types';

interface GetChildrenParams {
    status?: string;
    search?: string;
    tenantId?: number;
}

interface ChildrenResponse {
    children: Child[];
    total: number;
}



export interface CenterEducator {
    id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    assigned_count: number;
    max_per_educator: number;
    has_quota: boolean;
}

export interface EducatorsResponse {
    educators: CenterEducator[];
    max_children_per_educator: number;
}

export const childrenService = {
    async getEducators(tenantId: number): Promise<EducatorsResponse> {
        const { data } = await api.get<EducatorsResponse>(`/api/children/educators?tenant_id=${tenantId}`);
        return data;
    },

    async getAll(params?: GetChildrenParams): Promise<Child[]> {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.tenantId) queryParams.append('tenant_id', params.tenantId.toString());

        const url = queryParams.toString()
            ? `/api/children?${queryParams.toString()}`
            : '/api/children';

        const { data } = await api.get<ChildrenResponse>(url);
        return data.children;
    },

    async getById(id: number): Promise<{ child: Child; family: any; representatives: any[] }> {
        const { data } = await api.get<{ child: Child; family: any; representatives: any[] }>(`/api/children/${id}`);
        return data;
    },

    async create(childData: any): Promise<Child> {
        const { data } = await api.post<{ message: string; child: Child }>('/api/children', childData);
        return data.child;
    },

    async update(id: number, childData: any): Promise<Child> {
        const { data } = await api.put<{ message: string; child: Child }>(`/api/children/${id}`, childData);
        return data.child;
    },

    // Representatives (Legacy/Specific usage)
    async getRepresentatives(childId: number): Promise<any[]> {
        const { data } = await api.get<{ representatives: any[] }>(`/api/children/${childId}/representatives`);
        return data.representatives;
    },

    async addRepresentative(childId: number, representative: any): Promise<any> {
        const { data } = await api.post<{ message: string; representative: any }>(`/api/children/${childId}/representatives`, representative);
        return data.representative;
    },

    async updateRepresentative(repId: number, representative: any): Promise<any> {
        const { data } = await api.put<{ message: string; representative: any }>(`/api/children/representatives/${repId}`, representative);
        return data.representative;
    },

    async deleteRepresentative(repId: number): Promise<void> {
        await api.delete(`/api/children/representatives/${repId}`);
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/api/children/${id}`);
    },
};
