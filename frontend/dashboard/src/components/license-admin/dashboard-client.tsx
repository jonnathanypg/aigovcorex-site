"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    Users,
    Activity,
    AlertCircle,
    CheckCircle2,
    Trophy,
    Loader2,
    TrendingUp,
    MapPin,
    AlertTriangle,
    FileText,
    Sparkles,
    Landmark
} from "lucide-react";
import { licenseAdminService, type GlobalStats, type LicenseAdminDashboard } from "@/services/license-admin.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { Progress } from "@/components/ui/progress";

export function LicenseAdminDashboardClient() {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [dashboard, setDashboard] = useState<LicenseAdminDashboard | null>(null);
    const [territorialData, setTerritorialData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [globalStats, dashData, terrData] = await Promise.all([
                licenseAdminService.getGlobalStats(),
                licenseAdminService.getDashboard(),
                licenseAdminService.getTerritorialControl().catch(() => null)
            ]);
            setStats(globalStats);
            setDashboard(dashData);
            setTerritorialData(terrData);
        } catch (err: any) {
            console.error("Error loading license dashboard:", err);
            setError("Error al cargar los datos del dashboard");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useAgentRefresh(loadData);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) return <div className="p-4 text-destructive">{error}</div>;

    const kpis = stats?.global_kpis;
    const demand = territorialData?.demand_analysis;
    const macro = territorialData?.macro_summary;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/20 pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Landmark className="h-7 w-7 text-primary" />
                        Torre de Control Macro (DASE / Municipio)
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Supervisión Territorial de Demanda, Capacidad y Bienestar Infantil • Licencia:{" "}
                        <span className="font-semibold text-foreground">{dashboard?.license.name}</span>
                    </p>
                </div>
                {demand && (
                    <Badge
                        variant={demand.sobredemanda_rate > 20 ? "destructive" : "outline"}
                        className="text-xs px-3 py-1 font-medium flex items-center gap-1.5"
                    >
                        <TrendingUp className="h-3.5 w-3.5" />
                        {demand.expansion_need_score}
                    </Badge>
                )}
            </div>

            {/* Demanda Territorial e Indicadores Macro de Focalización */}
            {demand && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-card/70 border-border/30 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Postulaciones Totales</CardTitle>
                            <FileText className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{demand.total_applications || dashboard?.total_enrollment}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Demanda registrada para evaluación
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/70 border-border/30 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Cupos Autorizados</CardTitle>
                            <Building2 className="h-4 w-4 text-emerald-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{dashboard?.total_capacity}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {dashboard?.total_enrollment} niños activos matriculados
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/70 border-border/30 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Demanda No Atendida (Espera/Sin Cupo)</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-400">{demand.unmet_demand}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {demand.waiting_list} en lista de espera • {demand.rejected_no_spots} sin cupo
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/70 border-border/30 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Presión / Sobredemanda</CardTitle>
                            <TrendingUp className="h-4 w-4 text-rose-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-rose-400">
                                {demand.sobredemanda_rate > 0 ? `+${demand.sobredemanda_rate}%` : "Cubierta"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Justificación técnica para nuevos centros
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Global KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/50 border-border/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Centros</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard?.centers_count}</div>
                        <p className="text-xs text-muted-foreground">
                            {dashboard?.license.available_centers} cupos de centros por habilitar
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ocupación Global</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard?.total_enrollment} / {dashboard?.total_capacity}</div>
                        <p className="text-xs text-muted-foreground">
                            {dashboard?.occupancy_rate}% de ocupación efectiva
                        </p>
                        <Progress value={dashboard?.occupancy_rate} className="h-1.5 mt-2" />
                    </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Asistencia Hoy</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis?.attendance_today}</div>
                        <p className="text-xs text-muted-foreground">
                            Niños presentes registrados hoy
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas Nutricionales</CardTitle>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis?.active_nutrition_alerts}</div>
                        <p className="text-xs text-muted-foreground">
                            Alertas activas para intervención
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Centers Breakdown & Territorial Allocation */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-card/50 border-border/20 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            Distribución de Centros y Cobertura Territorial
                        </CardTitle>
                        <CardDescription>
                            Capacidad, ocupación actual y monitoreo por centro de desarrollo infantil.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.centers_breakdown.map((center) => (
                                <div key={center.id} className="flex items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="w-[200px] space-y-1">
                                        <p className="text-sm font-medium leading-none text-foreground">{center.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {center.enrollment} / {center.capacity} niños ({center.occupancy_rate}%)
                                        </p>
                                    </div>
                                    <div className="flex-1 px-4">
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all rounded-full"
                                                style={{ width: `${Math.min(100, center.occupancy_rate)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm w-[150px] justify-end">
                                        <div className="flex items-center gap-1 text-xs" title="Asistencia Hoy">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                            <span>{center.attendance_today}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs" title="Alertas Nutrición">
                                            <AlertCircle className={`h-3.5 w-3.5 ${center.nutrition_alerts > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                                            <span className={center.nutrition_alerts > 0 ? "font-bold text-destructive" : "text-muted-foreground"}>
                                                {center.nutrition_alerts}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Logros e Hitos del Mes */}
                <Card className="col-span-3 bg-card/50 border-border/20 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-lg">Logros e Impacto Poblacional</CardTitle>
                        <CardDescription>Hitos y bienestar alcanzados este mes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center p-6 space-y-4">
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                <Trophy className="h-10 w-10 text-yellow-500" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-4xl font-bold tracking-tight text-foreground">{kpis?.milestones_achieved_month}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Hitos del desarrollo infantil adquiridos o consolidados
                                </p>
                            </div>

                            <div className="w-full pt-4 border-t border-border/20 mt-4 space-y-2.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Incidentes de Salud:</span>
                                    <Badge variant={kpis?.health_incidents_month === 0 ? "outline" : "destructive"}>
                                        {kpis?.health_incidents_month} casos
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Vacunas en Alerta:</span>
                                    <Badge variant="secondary" className="text-amber-400 bg-amber-500/10">
                                        {territorialData?.alerts_summary?.vaccines_overdue ?? 0} pendientes
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
