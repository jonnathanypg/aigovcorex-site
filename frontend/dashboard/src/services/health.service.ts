import api from './api';

export interface HealthActivity {
    id: number;
    child_id: number;
    child_name: string;
    child_cedula?: string;
    type: string;
    date: string;
    result: string;
    professional: string;
    age_at_measurement?: string;
}

export interface HealthProfile {
    blood_type?: string;
    allergies?: string[];
    chronic_conditions?: string[];
    current_medications?: string[];
}

export interface WHOReferencePoint {
    age_months: number;
    sd_neg3: number;
    sd_neg2: number;
    sd_neg1: number;
    median: number;
    sd_pos1: number;
    sd_pos2: number;
    sd_pos3: number;
}

export const healthService = {
    async getRecentActivity(limit = 100, tenantId?: number, search?: string): Promise<HealthActivity[]> {
        let url = `/api/health/activity?limit=${limit}`;
        if (tenantId) url += `&tenant_id=${tenantId}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const { data } = await api.get<{ records: HealthActivity[] }>(url);
        return data.records;
    },

    async getWhoCurves(indicator: 'height' | 'weight' = 'height', gender: string = 'M', minAge: number = 0, maxAge: number = 60): Promise<{ curves: WHOReferencePoint[] }> {
        const { data } = await api.get<{ indicator: string; gender: string; curves: WHOReferencePoint[] }>(
            `/api/health/who-curves?indicator=${indicator}&gender=${gender}&min_age=${minAge}&max_age=${maxAge}`
        );
        return data;
    },

    async getChildHealth(childId: number) {
        const { data } = await api.get(`/api/health/child/${childId}`);
        return data;
    },

    async recordGrowth(childId: number, growthData: { weight?: number; height?: number; head_circumference?: number; notes?: string; record_date?: string }) {
        const { data } = await api.post(`/api/health/child/${childId}/growth`, growthData);
        return data;
    },

    async createHealthRecord(childId: number, recordData: {
        record_type: 'crecimiento' | 'incidente' | 'enfermedad' | 'brigada_medica';
        weight?: number;
        height?: number;
        head_circumference?: number;
        incident_description?: string;
        symptoms?: string;
        treatment?: string;
        medical_professional?: string;
        notes?: string;
        record_date?: string;
    }) {
        const { data } = await api.post(`/api/health/child/${childId}/record`, recordData);
        return data;
    },

    async getGrowthHistory(childId: number) {
        const { data } = await api.get(`/api/health/child/${childId}/growth`);
        return data;
    },

    async getVaccines(childId: number) {
        const { data } = await api.get(`/api/health/child/${childId}/vaccines`);
        return data;
    },

    async recordVaccine(childId: number, vaccineData: any) {
        const { data } = await api.post(`/api/health/child/${childId}/vaccine`, vaccineData);
        return data;
    },

    async getPendingVaccines() {
        const { data } = await api.get('/api/health/vaccines/pending');
        return data;
    },

    async getHealthRecord(id: number) {
        const { data } = await api.get<{ record: any }>(`/api/health/records/${id}`);
        return data.record;
    },

    async updateHealthRecord(id: number, recordData: any) {
        const { data } = await api.put<{ message: string; record: any }>(`/api/health/records/${id}`, recordData);
        return data.record;
    },

    async deleteHealthRecord(id: number) {
        await api.delete(`/api/health/records/${id}`);
    }
};
