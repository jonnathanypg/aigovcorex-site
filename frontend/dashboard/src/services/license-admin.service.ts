import api from './api';

export interface LicenseCustomization {
    agent_name?: string;
    agent_personality?: string;
    agent_icon_path?: string;
    agent_voice?: string;
}

export interface SponsorLogo {
    id: number;
    license_id: number;
    logo_path: string;
    uploaded_at: string;
}

export interface LicenseAdminDashboard {
    license: {
        id: number;
        name: string;
        max_centers: number;
        active_centers: number;
        start_date: string;
        end_date: string;
        available_centers: number;
        // Nuevos campos de personalización
        agent_name?: string;
        agent_personality?: string;
        agent_icon_path?: string;
        agent_voice?: string;
        timezone?: string;
    };
    centers_count: number;
    total_capacity: number;
    total_enrollment: number;
    total_staff: number;
    occupancy_rate: number;
}

export interface Center {
    id: number;
    name: string;
    legal_name: string;
    city: string;
    province: string;
    address?: string;
    phone?: string;
    email?: string;
    max_capacity: number;
    current_enrollment: number;
    max_children_per_educator?: number;
    is_active: boolean;
    staff_count?: number;
    active_children?: number;
}

export interface GlobalStats {
    global_kpis: {
        total_centers: number;
        total_children: number;
        attendance_today: number;
        health_incidents_month: number;
        active_nutrition_alerts: number;
        milestones_achieved_month: number;
    };
    centers_breakdown: {
        id: number;
        name: string;
        enrollment: number;
        capacity: number;
        attendance_today: number;
        nutrition_alerts: number;
        occupancy_rate: number;
    }[];
}

export interface LicenseUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    role: string;
    center_name?: string;
    is_active: boolean;
    tenant_id?: number;
}

export interface CreateCenterData {
    name: string;
    legal_name: string;
    city: string;
    province: string;
    address?: string;
    ruc?: string;
    phone?: string;
    email?: string;
    max_capacity: number;
    max_children_per_educator?: number;
}

export const licenseAdminService = {
    getDashboard: async () => {
        const response = await api.get<LicenseAdminDashboard>('/api/license-admin/dashboard');
        return response.data;
    },

    getGlobalStats: async () => {
        const response = await api.get<GlobalStats>('/api/license-admin/global-stats');
        return response.data;
    },

    getCenters: async () => {
        const response = await api.get<{ centers: Center[] }>('/api/license-admin/centers');
        return response.data.centers;
    },

    getCenter: async (id: number) => {
        const response = await api.get<{ center: Center }>(`/api/license-admin/centers/${id}`);
        return response.data.center;
    },

    createCenter: async (data: CreateCenterData) => {
        const response = await api.post<{ center: Center }>('/api/license-admin/centers', data);
        return response.data.center;
    },

    updateCenter: async (id: number, data: Partial<CreateCenterData>) => {
        const response = await api.put<{ center: Center }>(`/api/license-admin/centers/${id}`, data);
        return response.data.center;
    },

    deleteCenter: async (id: number) => {
        await api.delete(`/api/license-admin/centers/${id}`);
    },

    getUsers: async (centerId?: number, role?: string) => {
        const params = new URLSearchParams();
        if (centerId) params.append('center_id', centerId.toString());
        if (role) params.append('role', role);

        const response = await api.get<{ users: LicenseUser[] }>(`/api/license-admin/users?${params.toString()}`);
        return response.data.users;
    },

    createUser: async (data: any) => {
        const response = await api.post<{ user: LicenseUser }>('/api/license-admin/users', data);
        return response.data.user;
    },

    updateUser: async (id: number, data: any) => {
        const response = await api.put<{ user: LicenseUser }>(`/api/license-admin/users/${id}`, data);
        return response.data.user;
    },

    deleteUser: async (id: number) => {
        await api.delete(`/api/license-admin/users/${id}`);
    },

    // --- Nuevas funciones para Personalización y Logos ---

    // --- Nuevas funciones para Personalización y Logos ---

    getLicenseCustomization: async () => {
        const response = await licenseAdminService.getDashboard(); // Reutilizamos el dashboard que ya trae la licencia
        return response.license;
    },

    updateCustomization: async (data: {
        agent_name?: string;
        agent_personality?: string;
        agent_icon?: File | null;
        agent_voice?: string;
        timezone?: string;
    }) => {
        const formData = new FormData();
        if (data.agent_name) formData.append('agent_name', data.agent_name);
        if (data.agent_personality) formData.append('agent_personality', data.agent_personality);
        if (data.agent_voice) formData.append('agent_voice', data.agent_voice);
        if (data.timezone) formData.append('timezone', data.timezone);
        if (data.agent_icon) formData.append('agent_icon', data.agent_icon);

        const response = await api.put<{ license: LicenseAdminDashboard['license'] }>(
            '/api/license-admin/customization',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data.license;
    },

    getSponsorLogos: async () => {
        const response = await api.get<{ logos: SponsorLogo[] }>('/api/license-admin/logos');
        return response.data.logos;
    },

    addSponsorLogo: async (file: File) => {
        const formData = new FormData();
        formData.append('logo', file);

        const response = await api.post<{ logo: SponsorLogo }>(
            '/api/license-admin/logos',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data.logo;
    },

    deleteSponsorLogo: async (logoId: number) => {
        await api.delete(`/api/license-admin/logos/${logoId}`);
    },

    getPublicConfig: async () => {
        const response = await api.get<{
            agent_name: string;
            agent_icon: string | null;
            sponsor_logos: SponsorLogo[];
        }>('/api/license-admin/public-config');
        return response.data;
    },

    resetLicense: async (confirmation: string, password: string) => {
        const response = await api.post<{
            message: string;
            deleted_counts: Record<string, number>;
            total_deleted: number;
        }>('/api/license-admin/reset-license', { confirmation, password });
        return response.data;
    },

    // --- Datos de Organización ---
    getOrganization: async () => {
        const response = await api.get<{ legal_name: string | null; ruc: string | null; description: string | null; license_name: string }>('/api/license-admin/organization');
        return response.data;
    },

    updateOrganization: async (data: { legal_name?: string; ruc?: string; description?: string }) => {
        const response = await api.put<{ message: string; legal_name: string; ruc: string; description: string }>('/api/license-admin/organization', data);
        return response.data;
    },

    // --- Torre de Control Macro (DASE / Municipio / MIES) ---
    getTerritorialControl: async () => {
        const response = await api.get<{
            macro_summary: {
                license_name: string;
                sponsor_name: string;
                total_centers: number;
                total_capacity: number;
                total_enrolled: number;
                available_spots: number;
                occupancy_rate: number;
            };
            demand_analysis: {
                total_applications: number;
                accepted: number;
                waiting_list: number;
                rejected_no_spots: number;
                unmet_demand: number;
                sobredemanda_rate: number;
                expansion_need_score: string;
            };
            alerts_summary: {
                total_health_alerts: number;
                vaccines_overdue: number;
            };
            territorial_breakdown: Array<{
                province: string;
                canton: string;
                total_centers: number;
                total_capacity: number;
                total_enrolled: number;
                total_applications: number;
                centers: Array<{
                    id: number;
                    name: string;
                    capacity: number;
                    enrolled: number;
                    applications: number;
                    occupancy_pct: number;
                    unmet_demand: number;
                }>;
            }>;
        }>('/api/license-admin/territorial-control');
        return response.data;
    },
};

