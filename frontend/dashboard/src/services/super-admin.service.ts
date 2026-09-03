import api from './api';

export interface License {
    id: number;
    name: string;
    description: string | null;
    max_centers: number;
    active_centers: number;
    available_centers: number;
    start_date: string;
    end_date: string;
    status: string;
    annual_cost: number | null;
    legal_name: string | null;
    ruc: string | null;
    is_active: boolean;
    is_expired: boolean;
    created_at: string;
    admins?: LicenseAdmin[];
    centers?: Center[];
    // AI GovCoreX OS Platform & Module System
    enabled_modules: string[];
    max_users: number | null;
    storage_quota_mb: number | null;
    allow_public_chatbot: boolean;
    allow_whatsapp_public: boolean;
    allow_telegram_public: boolean;
    public_org_slug: string | null;
    agent_name?: string | null;
    agent_icon_path?: string | null;
}

export interface LicenseAdmin {
    id: number;
    license_id: number;
    license_name: string;
    user_id: number;
    user_email: string;
    user_name: string;
    can_create_centers: boolean;
    can_delete_centers: boolean;
    can_manage_users: boolean;
    assigned_at: string;
    is_active: boolean;
}

export interface Center {
    id: number;
    name: string;
    city: string;
    users_count: number;
    children_count: number;
}

export interface SuperAdminDashboard {
    total_licenses: number;
    active_licenses: number;
    expired_licenses: number;
    total_centers: number;
    total_users: number;
    total_children: number;
    total_annual_revenue: number;
    licenses: License[];
    module_distribution?: Record<string, number>;
}

export interface CreateLicenseData {
    name: string;
    description?: string;
    max_centers: number;
    start_date: string;
    end_date: string;
    annual_cost?: number;
    legal_name?: string;
    ruc?: string;
    // Platform & Modules
    enabled_modules?: string[];
    max_users?: number;
    storage_quota_mb?: number;
    allow_public_chatbot?: boolean;
    allow_whatsapp_public?: boolean;
    allow_telegram_public?: boolean;
    public_org_slug?: string;
}

export interface AssignAdminData {
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    can_create_centers?: boolean;
    can_delete_centers?: boolean;
    can_manage_users?: boolean;
}

export const superAdminService = {
    // Dashboard
    async getDashboard(): Promise<SuperAdminDashboard> {
        const { data } = await api.get('/api/super-admin/dashboard');
        return data;
    },

    // System Stats & Module Distribution
    async getSystemStats(): Promise<any> {
        const { data } = await api.get('/api/super-admin/system/stats');
        return data;
    },

    // Licenses CRUD
    async getLicenses(): Promise<License[]> {
        const { data } = await api.get('/api/super-admin/licenses');
        return data.licenses;
    },

    async getLicense(id: number): Promise<License> {
        const { data } = await api.get(`/api/super-admin/licenses/${id}`);
        return data.license;
    },

    async createLicense(licenseData: CreateLicenseData): Promise<License> {
        const { data } = await api.post('/api/super-admin/licenses', licenseData);
        return data.license;
    },

    async updateLicense(id: number, licenseData: Partial<CreateLicenseData>): Promise<License> {
        const { data } = await api.put(`/api/super-admin/licenses/${id}`, licenseData);
        return data.license;
    },

    async updateLicenseModules(id: number, modules: string[]): Promise<License> {
        const { data } = await api.put(`/api/super-admin/licenses/${id}/modules`, { enabled_modules: modules });
        return data.license;
    },

    async updateLicenseFull(id: number, licenseData: Partial<CreateLicenseData>): Promise<License> {
        const { data } = await api.put(`/api/super-admin/licenses/${id}/full`, licenseData);
        return data.license;
    },

    async deleteLicense(id: number): Promise<void> {
        await api.delete(`/api/super-admin/licenses/${id}`);
    },

    // License Admins
    async assignAdmin(licenseId: number, adminData: AssignAdminData): Promise<LicenseAdmin> {
        const { data } = await api.post(`/api/super-admin/licenses/${licenseId}/admins`, adminData);
        return data.admin;
    },

    async removeAdmin(licenseId: number, adminId: number): Promise<void> {
        await api.delete(`/api/super-admin/licenses/${licenseId}/admins/${adminId}`);
    },

    // Create license admin user (creates user + assigns to license)
    async createLicenseAdminUser(adminData: AssignAdminData & { license_id: number }): Promise<any> {
        const { data } = await api.post('/api/super-admin/create-license-admin', adminData);
        return data;
    }
};

export default superAdminService;
