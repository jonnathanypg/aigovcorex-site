"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    ChartContainer, ChartTooltip, ChartTooltipContent,
    ChartLegend, ChartLegendContent, type ChartConfig,
} from "@/components/ui/chart";
import { Loader2, TrendingUp, Shield, Scale, Radar as RadarIcon } from "lucide-react";
import {
    monitoringService,
    type AttendanceTrendPoint,
    type HealthOverviewPoint,
    type NutritionBmiPoint,
    type CentersComparisonPoint,
} from "@/services/monitoring.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";

/* ─────────── Warm Color Palette ─────────── */
const COLORS = {
    amber: "#f59e0b",
    coral: "#f97316",
    teal: "#0d9488", // Deep Teal
    emerald: "#059669", // Vibrant Emerald
    golden: "#fbbf24",
    rose: "#fb7185",
    brightBlue: "#2563eb", // Bright Blue (Requested)
    lime: "#84cc16",
    orange: "#fb923c",
    slate: "#94a3b8",
};

/* ─────────── Chart Configs ─────────── */

const attendanceConfig: ChartConfig = {
    presentes: { label: "Presentes", color: COLORS.emerald },
    ausentes: { label: "Ausentes", color: COLORS.rose },
    justificados: { label: "Justificados", color: COLORS.amber },
    tardanzas: { label: "Tardanzas", color: COLORS.orange },
};

const healthConfig: ChartConfig = {
    "Al Día": { label: "Al Día", color: COLORS.emerald },
    "Pendientes": { label: "Pendientes", color: COLORS.amber },
    "Vencidos": { label: "Vencidos", color: COLORS.rose },
    "Sin Registro": { label: "Sin Registro", color: COLORS.slate },
};

const nutritionConfig: ChartConfig = {
    cantidad: { label: "Niños", color: COLORS.amber },
};

/* ─────────── Main Component ─────────── */

interface MonitoringChartsProps {
    tenantId?: number;
    isLicenseAdmin?: boolean;
}

export function MonitoringCharts({ tenantId, isLicenseAdmin }: MonitoringChartsProps) {
    const [attendanceData, setAttendanceData] = useState<AttendanceTrendPoint[]>([]);
    const [healthData, setHealthData] = useState<HealthOverviewPoint[]>([]);
    const [healthTotal, setHealthTotal] = useState(0);
    const [nutritionData, setNutritionData] = useState<NutritionBmiPoint[]>([]);
    const [nutritionTotal, setNutritionTotal] = useState(0);
    const [centersData, setCentersData] = useState<CentersComparisonPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [att, health, nutrition, centers] = await Promise.all([
                monitoringService.getAttendanceTrend(tenantId),
                monitoringService.getHealthOverview(tenantId),
                monitoringService.getNutritionBmi(tenantId),
                isLicenseAdmin ? monitoringService.getCentersComparison(tenantId) : Promise.resolve([]),
            ]);
            setAttendanceData(att);
            setHealthData(health.chart_data);
            setHealthTotal(health.total);
            setNutritionData(nutrition.chart_data);
            setNutritionTotal(nutrition.total);
            setCentersData(centers);
        } catch (err) {
            console.error("Error loading monitoring charts:", err);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId, isLicenseAdmin]);

    useEffect(() => {
        load();
    }, [load]);

    useAgentRefresh(load);

    // Vibrant colors for nutrition bars
    const nutritionColors = [COLORS.rose, COLORS.orange, COLORS.emerald, COLORS.golden, COLORS.teal];

    // Vibrant health donut colors
    const healthColors = [COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.slate];

    // Build dynamic radar config
    const radarConfig = useMemo<ChartConfig>(() => {
        const radarColors = [COLORS.amber, COLORS.teal, COLORS.golden, COLORS.coral, COLORS.emerald];
        const cfg: ChartConfig = {};
        centersData.forEach((c, i) => {
            cfg[c.centro] = { label: c.centro, color: radarColors[i % radarColors.length] };
        });
        return cfg;
    }, [centersData]);

    // Radar chart data transformation
    const radarData = useMemo(() => {
        if (!centersData.length) return [];
        return [
            { kpi: "Asistencia", ...Object.fromEntries(centersData.map(c => [c.centro, c.Asistencia])) },
            { kpi: "Salud", ...Object.fromEntries(centersData.map(c => [c.centro, c.Salud])) },
            { kpi: "Desarrollo", ...Object.fromEntries(centersData.map(c => [c.centro, c.Desarrollo])) },
            { kpi: "Nutrición", ...Object.fromEntries(centersData.map(c => [c.centro, c['Nutrición']])) },
        ];
    }, [centersData]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Attendance Trend — Line Chart */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                        Tendencia de Asistencia
                    </CardTitle>
                    <CardDescription>Últimos 30 días — distribución diaria</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={attendanceConfig} className="min-h-[260px] w-full">
                        <LineChart data={attendanceData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="fecha" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Line type="monotone" dataKey="presentes" stroke="var(--color-presentes)" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="ausentes" stroke="var(--color-ausentes)" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="justificados" stroke="var(--color-justificados)" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="tardanzas" stroke="var(--color-tardanzas)" strokeWidth={2.5} dot={false} />
                        </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* 2. Health Overview — Donut Chart (ChartContainer wrapping) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-amber-400" />
                        Estado de Vacunación
                    </CardTitle>
                    <CardDescription>Distribución actual — {healthTotal} niños activos</CardDescription>
                </CardHeader>
                <CardContent>
                    {healthData.every(d => d.value === 0) ? (
                        <p className="text-muted-foreground py-10 text-center">Sin datos de vacunación registrados</p>
                    ) : (
                        <ChartContainer config={healthConfig} className="mx-auto aspect-square max-h-[280px]">
                            <PieChart>
                                <Pie
                                    data={healthData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={95}
                                    paddingAngle={4}
                                    strokeWidth={2}
                                >
                                    {healthData.map((entry, i) => (
                                        <Cell key={`cell-${i}`} fill={healthColors[i % healthColors.length]} />
                                    ))}
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                            </PieChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 3. Nutrition BMI — Bar Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-amber-400" />
                        Estado Nutricional (Z-Score)
                    </CardTitle>
                    <CardDescription>Clasificación OMS — {nutritionTotal} registros</CardDescription>
                </CardHeader>
                <CardContent>
                    {nutritionData.every(d => d.cantidad === 0) ? (
                        <p className="text-muted-foreground py-10 text-center">Sin datos de crecimiento registrados</p>
                    ) : (
                        <ChartContainer config={nutritionConfig} className="min-h-[260px] w-full">
                            <BarChart data={nutritionData}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="categoria"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(v) => v.split(" ")[0]}
                                />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="cantidad" radius={8}>
                                    {nutritionData.map((entry, i) => (
                                        <Cell key={`bar-${i}`} fill={nutritionColors[i % nutritionColors.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 4. Centers Comparison — Radar Chart (license_admin only) */}
            {isLicenseAdmin && centersData.length > 0 && (
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RadarIcon className="h-5 w-5 text-orange-400" />
                            Comparativo por Centro
                        </CardTitle>
                        <CardDescription>KPIs del mes actual por cada centro</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[380px]">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis dataKey="kpi" />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                {centersData.map((center, i) => {
                                    const radarColors = [COLORS.amber, COLORS.teal, COLORS.golden, COLORS.coral, COLORS.emerald];
                                    return (
                                        <Radar
                                            key={center.centro}
                                            name={center.centro}
                                            dataKey={center.centro}
                                            stroke={radarColors[i % radarColors.length]}
                                            fill={radarColors[i % radarColors.length]}
                                            fillOpacity={0.2}
                                            strokeWidth={2}
                                        />
                                    );
                                })}
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                            </RadarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
