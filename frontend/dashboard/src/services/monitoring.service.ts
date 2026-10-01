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

export interface DateRangeParams {
    from?: string;
    to?: string;
}

function withRange(url: string, range?: DateRangeParams): string {
    if (!range) return url;
    const sep = url.includes("?") ? "&" : "?";
    const parts: string[] = [];
    if (range.from) parts.push(`from=${encodeURIComponent(range.from)}`);
    if (range.to) parts.push(`to=${encodeURIComponent(range.to)}`);
    return parts.length ? `${url}${sep}${parts.join("&")}` : url;
}

export const monitoringService = {
    async getKpis(tenantId?: number, range?: DateRangeParams): Promise<MonitoringKPI[]> {
        let url = '/api/monitoring/kpis';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        url = withRange(url, range);
        const { data } = await api.get<{ kpis: MonitoringKPI[] }>(url);
        return data.kpis;
    },

    async getDevelopmentChart(tenantId?: number, range?: DateRangeParams): Promise<ChartDataPoint[]> {
        let url = '/api/monitoring/development-chart';
        if (tenantId) {
            url += `?tenant_id=${tenantId}`;
        }
        url = withRange(url, range);
        const { data } = await api.get<{ chart_data: ChartDataPoint[] }>(url);
        return data.chart_data;
    },

    async getAttendanceTrend(tenantId?: number, range?: DateRangeParams): Promise<AttendanceTrendPoint[]> {
        let url = '/api/monitoring/attendance-trend';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        url = withRange(url, range);
        const { data } = await api.get<{ chart_data: AttendanceTrendPoint[] }>(url);
        return data.chart_data;
    },

    async getHealthOverview(tenantId?: number, range?: DateRangeParams): Promise<{ chart_data: HealthOverviewPoint[]; total: number }> {
        let url = '/api/monitoring/health-overview';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        url = withRange(url, range);
        const { data } = await api.get<{ chart_data: HealthOverviewPoint[]; total: number }>(url);
        return data;
    },

    async getNutritionBmi(tenantId?: number, range?: DateRangeParams): Promise<{ chart_data: NutritionBmiPoint[]; total: number }> {
        let url = '/api/monitoring/nutrition-bmi';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        url = withRange(url, range);
        const { data } = await api.get<{ chart_data: NutritionBmiPoint[]; total: number }>(url);
        return data;
    },

    async getCentersComparison(tenantId?: number, range?: DateRangeParams): Promise<CentersComparisonPoint[]> {
        let url = '/api/monitoring/centers-comparison';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        url = withRange(url, range);
        const { data } = await api.get<{ chart_data: CentersComparisonPoint[] }>(url);
        return data.chart_data;
    }
};

