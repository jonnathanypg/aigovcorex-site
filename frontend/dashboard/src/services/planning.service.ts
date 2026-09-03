import api from './api';

export interface LudicPlanning {
    id: number;
    tenant_id: number;
    center_name?: string;
    educator_id: number;
    educator_name?: string;
    planning_date: string;
    age_group: string;
    week_number?: number;
    month?: string;
    year?: number;
    tema_integrador?: string;
    nombre_actividad: string;
    objetivo?: string;
    momento_bienvenida?: Record<string, unknown>;
    momento_juego_intencionado?: Record<string, unknown>;
    momento_juego_libre?: Record<string, unknown>;
    momento_higiene?: Record<string, unknown>;
    momento_alimentacion?: Record<string, unknown>;
    momento_descanso?: Record<string, unknown>;
    momento_despedida?: Record<string, unknown>;
    ambito_vinculacion?: string;
    ambito_descubrimiento?: string;
    ambito_expresion?: string;
    ambito_exploracion?: string;
    indicadores_logro?: string[];
    observaciones?: string;
    status: 'borrador' | 'aprobado' | 'revisado';
    reviewed_by?: number;
    reviewer_name?: string;
    review_date?: string;
    created_at?: string;
    updated_at?: string;
}

export interface PlanningFilters {
    educator_id?: number;
    age_group?: string;
    status?: string;
    month?: string;
    year?: number;
    center_id?: number;
}

export const planningService = {
    async list(filters?: PlanningFilters): Promise<{ plannings: LudicPlanning[]; total: number }> {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    params.append(key, String(value));
                }
            });
        }
        const { data } = await api.get(`/api/planning/list?${params.toString()}`);
        return data;
    },

    async getById(id: number): Promise<LudicPlanning> {
        const { data } = await api.get(`/api/planning/${id}`);
        return data.planning;
    },

    async create(planning: Partial<LudicPlanning>): Promise<LudicPlanning> {
        const { data } = await api.post('/api/planning/create', planning);
        return data.planning;
    },

    async update(id: number, planning: Partial<LudicPlanning>): Promise<LudicPlanning> {
        const { data } = await api.put(`/api/planning/${id}`, planning);
        return data.planning;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/api/planning/${id}`);
    },
};
