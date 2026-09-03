import api from './api';

export interface Report {
    id: number;
    title: string;
    type: string;
    date: string;
    start_date?: string;
    end_date?: string;
    format: string;
    generated_by: string;
    download_url?: string;
}

export interface GenerateReportParams {
    report_type: string;
    start_date: string;
    end_date: string;
    export_format?: string;
}

export const reportsService = {
    async getAll(tenantId?: number): Promise<Report[]> {
        let url = '/api/reports/';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.get<{ reports: Report[] }>(url);
        return data.reports;
    },

    async generate(params: GenerateReportParams, tenantId?: number) {
        let url = '/api/reports/generate';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data: response } = await api.post<{ message: string; report: Report; summary: any }>(url, params);
        return response;
    },

    async download(reportId: number): Promise<Blob> {
        const response = await api.get(`/api/reports/download/${reportId}`, {
            responseType: 'blob'
        });
        return response.data;
    },

    async exportToSheets(params: GenerateReportParams, tenantId?: number): Promise<{ sheet_url: string }> {
        let url = '/api/reports/export-sheets';
        if (tenantId) url += `?tenant_id=${tenantId}`;
        const { data } = await api.post<{ message: string; sheet_url: string }>(url, params);
        return data;
    },

    async delete(reportId: number): Promise<void> {
        await api.delete(`/api/reports/${reportId}`);
    }
};
