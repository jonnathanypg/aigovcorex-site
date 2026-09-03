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
    }
};
