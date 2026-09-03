"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { dashboardService } from "@/services/dashboard.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import type { DashboardStats } from "@/types";
import { Users, CalendarCheck, AlertTriangle, ClipboardList, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards({ tenantId }: { tenantId?: number }) {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            const data = await dashboardService.getStats(tenantId);
            setStats(data);
        } catch (err) {
            console.error("Error fetching dashboard stats:", err);
            setError("Error al cargar estadísticas");
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);
    useAgentRefresh(fetchStats);

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-destructive">
                {error}
            </div>
        );
    }

    if (!stats) return null;

    const statsCards = [
        {
            title: "Total Niños/as",
            value: stats.total_children.toLocaleString(),
            change: stats.is_global ? "Todos los centros" : stats.tenant_name,
            icon: Users,
        },
        {
            title: "Asistencia Hoy",
            value: `${stats.attendance_rate}%`,
            change: `${stats.present_today} de ${stats.expected_today} niños`,
            icon: CalendarCheck,
        },
        {
            title: "Alertas Críticas",
            value: stats.critical_alerts.toString(),
            change: "Requieren atención",
            icon: AlertTriangle,
        },
        {
            title: "Postulaciones Pendientes",
            value: stats.pending_applications.toString(),
            change: "Por revisar",
            icon: ClipboardList,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            {statsCards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                        <p className="text-xs text-muted-foreground">
                            {card.change}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
