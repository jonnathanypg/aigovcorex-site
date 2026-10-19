import api from './api';

export interface NutritionRecord {
    id: number;
    child_id: number;
    child_name: string;
    child_cedula?: string;
    date: string;
    meal_type: 'desayuno' | 'almuerzo' | 'refrigerio_am' | 'refrigerio_pm';
    consumption_level: 'todo' | 'la_mayoria' | 'la_mitad' | 'poco' | 'nada';
    consumption_percentage?: number;
    quantity: number;
    menu_description?: string;
    notes?: string;
}

export interface NutritionalAssessment {
    id: number;
    source?: 'cna' | 'health_record';
    child_id: number;
    child_name: string;
    child_cedula?: string;
    date: string;
    assessment_date: string;
    weight_kg?: number;
    height_cm?: number;
    z_score_weight?: number;
    z_score_height?: number;
    brachial_perimeter_cm?: number;
    hemoglobin_g_dl?: number;
    cephalic_perimeter_cm?: number;
    nutritional_diagnosis: string;
    semaphore: 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO' | string;
    professional: string;
    notes?: string;
}

export const nutritionService = {
    async getDailyRecords(date?: string, tenantId?: number): Promise<NutritionRecord[]> {
        let url = '/api/nutrition/rations';
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (tenantId) params.append('tenant_id', tenantId.toString());

        if (params.toString()) url += `?${params.toString()}`;

        const { data } = await api.get<{ rations: NutritionRecord[] }>(url);
        return data.rations;
    },

    async createRecord(record: Partial<NutritionRecord>) {
        const { data } = await api.post('/api/nutrition/rations', record);
        return data;
    },

    async updateRecord(id: number, record: Partial<NutritionRecord>) {
        const { data } = await api.put(`/api/nutrition/rations/${id}`, record);
        return data;
    },

    async deleteRecord(id: number) {
        await api.delete(`/api/nutrition/rations/${id}`);
    },

    async getAssessments(limit: number = 200, tenantId?: number, search: string = ''): Promise<{ records: NutritionalAssessment[]; nutritionists: string[] }> {
        let url = '/api/nutrition/assessments';
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (tenantId) params.append('tenant_id', tenantId.toString());
        if (search) params.append('search', search);

        if (params.toString()) url += `?${params.toString()}`;

        const { data } = await api.get<{ records: NutritionalAssessment[]; nutritionists: string[]; count: number }>(url);
        return { records: data.records || [], nutritionists: data.nutritionists || [] };
    },

    async createAssessment(assessment: Partial<NutritionalAssessment>) {
        const { data } = await api.post('/api/nutrition/assessments', assessment);
        return data;
    },

    async deleteAssessment(id: number) {
        await api.delete(`/api/nutrition/assessments/${id}`);
    }
};

