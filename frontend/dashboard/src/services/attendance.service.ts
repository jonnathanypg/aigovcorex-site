import api from './api';
import type { AttendanceRecord } from '@/types';

interface AttendanceResponse {
    attendance: AttendanceRecord[];
}

interface MarkAttendanceParams {
    child_id: number;
    date: string;
    status: 'presente' | 'ausente' | 'justificado' | 'tardanza';
    arrival_time?: string;
    departure_time?: string;
    notes?: string;
}

export const attendanceService = {
    async getByDate(date: string, tenantId?: number): Promise<AttendanceRecord[]> {
        let url = `/api/attendance?date=${date}`;
        if (tenantId) url += `&tenant_id=${tenantId}`;
        const { data } = await api.get<AttendanceResponse>(url);
        return data.attendance;
    },

    async getByRange(startDate: string, endDate: string, tenantId?: number): Promise<AttendanceRecord[]> {
        let url = `/api/attendance/range?start_date=${startDate}&end_date=${endDate}`;
        if (tenantId) url += `&tenant_id=${tenantId}`;
        const { data } = await api.get<AttendanceResponse>(url);
        return data.attendance;
    },

    async mark(params: MarkAttendanceParams): Promise<AttendanceRecord> {
        const { data } = await api.post<{ message: string; attendance: AttendanceRecord }>(
            '/api/attendance',
            params
        );
        return data.attendance;
    },
};
