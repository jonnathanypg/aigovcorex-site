import api from './api';

export interface MonitoringKPI {
    title: string;
    value: string;
    target: string;
    status: 'success' | 'warning' | 'danger';
    icon: string;
}

export interface ChartDataPoint {
    area: string;
    [key: string]: string | number;
}

export interface AttendanceTrendPoint {
    fecha: string;
    presentes: number;
    ausentes: number;
    justificados: number;
    tardanzas: number;
}

export interface HealthOverviewPoint {
    name: string;
    value: number;
    fill: string;
}

export interface NutritionBmiPoint {
    categoria: string;
    cantidad: number;
    fill: string;
}

export interface CentersComparisonPoint {
    centro: string;
    Asistencia: number;
    Salud: number;
    Desarrollo: number;
    'Nutrición': number;
}

export const monitoringService = {
    async getKpis(tenantId?: number): Promise<MonitoringKPI[]> {
        let url = '/api/monitoring/kpis';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ kpis: MonitoringKPI[] }>(url);
        return data.kpis;
    },

    async getDevelopmentChart(tenantId?: number): Promise<ChartDataPoint[]> {
        let url = '/api/monitoring/development-chart';
        if (tenantId) {
            url += `?tenant_id=${tenantId}`;
        }
        const { data } = await api.get<{ chart_data: ChartDataPoint[] }>(url);
        return data.chart_data;
    },

    async getAttendanceTrend(tenantId?: number): Promise<AttendanceTrendPoint[]> {
        let url = '/api/monitoring/attendance-trend';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ chart_data: AttendanceTrendPoint[] }>(url);
        return data.chart_data;
    },

    async getHealthOverview(tenantId?: number): Promise<{ chart_data: HealthOverviewPoint[]; total: number }> {
        let url = '/api/monitoring/health-overview';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ chart_data: HealthOverviewPoint[]; total: number }>(url);
        return data;
    },

    async getNutritionBmi(tenantId?: number): Promise<{ chart_data: NutritionBmiPoint[]; total: number }> {
        let url = '/api/monitoring/nutrition-bmi';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ chart_data: NutritionBmiPoint[]; total: number }>(url);
        return data;
    },

    async getCentersComparison(tenantId?: number): Promise<CentersComparisonPoint[]> {
        let url = '/api/monitoring/centers-comparison';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ chart_data: CentersComparisonPoint[] }>(url);
        return data.chart_data;
    }
};

