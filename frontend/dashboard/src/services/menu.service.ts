import api from './api';

export interface WeeklyMenu {
    id: number;
    tenant_id?: number | null;
    license_id?: number | null;
    week_start_date: string;
    day_of_week: number;
    day_name: string;
    meal_type: 'desayuno' | 'refrigerio_am' | 'almuerzo' | 'refrigerio_pm';
    meal_name: string;
    description: string;
    ingredients?: string[];
    calories?: number;
    created_by?: string;
}

export interface DayMenu {
    day_name: string;
    meals: Record<string, WeeklyMenu>;
}

export interface WeeklyMenuResponse {
    week_start: string;
    menu_by_day: Record<number, DayMenu>;
    menus: WeeklyMenu[];
}

export interface TodayMenuResponse {
    date: string;
    day_name: string;
    meals: Record<string, WeeklyMenu>;
}

export const menuService = {
    async getCurrentMenu(weekStart?: string, tenantId?: number): Promise<WeeklyMenuResponse> {
        let url = '/api/nutrition/menu/current';
        const params = new URLSearchParams();
        if (weekStart) params.append('week_start', weekStart);
        if (tenantId) params.append('tenant_id', tenantId.toString());
        if (params.toString()) url += `?${params.toString()}`;

        const { data } = await api.get<WeeklyMenuResponse>(url);
        return data;
    },

    async getTodayMenu(date?: string, tenantId?: number): Promise<TodayMenuResponse> {
        let url = '/api/nutrition/menu/today';
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (tenantId) params.append('tenant_id', tenantId.toString());
        if (params.toString()) url += `?${params.toString()}`;

        const { data } = await api.get<TodayMenuResponse>(url);
        return data;
    },

    async saveMenu(menuData: Partial<WeeklyMenu>) {
        const { data } = await api.post('/api/nutrition/menu', menuData);
        return data;
    }
};
