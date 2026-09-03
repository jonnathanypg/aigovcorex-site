"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    TrendingUp,
    AlertTriangle,
    PlusCircle,
    CheckCircle,
    Activity,
    Ruler,
    Scale as ScaleIcon,
    Sparkles
} from "lucide-react";
import { healthService, type WHOReferencePoint } from "@/services/health.service";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface GrowthData {
    id: number;
    date: string;
    age_months: number | null;
    weight: number | null;
    height: number | null;
    head_circumference: number | null;
    z_score_weight: number | null;
    z_score_height: number | null;
    weight_status?: string;
    height_status?: string;
    anomalies?: string[];
    has_anomaly?: boolean;
    notes: string | null;
}

interface GrowthChartDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    child: Child | null;
}

export function GrowthChartDialog({ open, onOpenChange, child }: GrowthChartDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<GrowthData[]>([]);
    const [childInfo, setChildInfo] = useState<{ name: string; gender: string; birth_date: string } | null>(null);

    // WHO Reference curves
    const [heightCurves, setHeightCurves] = useState<WHOReferencePoint[]>([]);
    const [weightCurves, setWeightCurves] = useState<WHOReferencePoint[]>([]);

    // View filters
    const [ageRange, setAgeRange] = useState<"0-24" | "24-60">("0-24");
    const [activeTab, setActiveTab] = useState<string>("height");

    // New measurement quick form
    const [showNewMeasurement, setShowNewMeasurement] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newWeight, setNewWeight] = useState("");
    const [newHeight, setNewHeight] = useState("");
    const [newHeadCirc, setNewHeadCirc] = useState("");
    const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
    const [newNotes, setNewNotes] = useState("");

    const fetchGrowthData = useCallback(async () => {
        if (!child) return;
        setIsLoading(true);
        try {
            const gender = child.gender || "M";
            const [data, whoHeight, whoWeight] = await Promise.all([
                healthService.getGrowthHistory(child.id),
                healthService.getWhoCurves("height", gender, 0, 60),
                healthService.getWhoCurves("weight", gender, 0, 60),
            ]);

            setHistory(data.history || []);
            setChildInfo(data.child || null);
            setHeightCurves(whoHeight.curves || []);
            setWeightCurves(whoWeight.curves || []);

            // Auto select age range based on child age
            if (data.history && data.history.length > 0) {
                const latestAge = data.history[data.history.length - 1].age_months ?? 0;
                if (latestAge > 24) {
                    setAgeRange("24-60");
                } else {
                    setAgeRange("0-24");
                }
            }
        } catch (error) {
            console.error("Error fetching growth data:", error);
            setHistory([]);
        } finally {
            setIsLoading(false);
        }
    }, [child]);

    useEffect(() => {
        if (open && child) {
            fetchGrowthData();
            setShowNewMeasurement(false);
        }
    }, [open, child, fetchGrowthData]);

    const handleSaveMeasurement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!child) return;

        const weightVal = parseFloat(newWeight);
        const heightVal = parseFloat(newHeight);
        const headCircVal = newHeadCirc ? parseFloat(newHeadCirc) : undefined;

        if (isNaN(weightVal) && isNaN(heightVal)) {
            toast({
                title: "Campos requeridos",
                description: "Ingrese al menos el peso o la talla del niño/a.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            await healthService.recordGrowth(child.id, {
                weight: !isNaN(weightVal) ? weightVal : undefined,
                height: !isNaN(heightVal) ? heightVal : undefined,
                head_circumference: headCircVal,
                record_date: newDate,
                notes: newNotes || undefined,
            });

            toast({
                title: "Toma registrada exitosamente",
                description: "La curva de crecimiento OMS ha sido actualizada en tiempo real.",
            });

            setNewWeight("");
            setNewHeight("");
            setNewHeadCirc("");
            setNewNotes("");
            setShowNewMeasurement(false);

            await fetchGrowthData();
        } catch (err: any) {
            toast({
                title: "Error al registrar toma",
                description: err?.response?.data?.error || "Ocurrió un error al guardar los datos.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Filter curves and points by active age range
    const minAge = ageRange === "0-24" ? 0 : 24;
    const maxAge = ageRange === "0-24" ? 24 : 60;

    // Build chart data combining WHO Curves + Child Measurements
    const combinedHeightData = useMemo(() => {
        const filteredCurves = heightCurves.filter((c) => c.age_months >= minAge && c.age_months <= maxAge);
        const pointsMap = new Map<number, number>();
        history.forEach((h) => {
            if (h.age_months !== null && h.height !== null && h.age_months >= minAge && h.age_months <= maxAge) {
                pointsMap.set(h.age_months, h.height);
            }
        });

        return filteredCurves.map((curve) => ({
            age: curve.age_months,
            sd_neg3: curve.sd_neg3,
            sd_neg2: curve.sd_neg2,
            median: curve.median,
            sd_pos2: curve.sd_pos2,
            sd_pos3: curve.sd_pos3,
            childHeight: pointsMap.get(curve.age_months) ?? null,
        }));
    }, [heightCurves, history, minAge, maxAge]);

    const combinedWeightData = useMemo(() => {
        const filteredCurves = weightCurves.filter((c) => c.age_months >= minAge && c.age_months <= maxAge);
        const pointsMap = new Map<number, number>();
        history.forEach((h) => {
            if (h.age_months !== null && h.weight !== null && h.age_months >= minAge && h.age_months <= maxAge) {
                pointsMap.set(h.age_months, h.weight);
            }
        });

        return filteredCurves.map((curve) => ({
            age: curve.age_months,
            sd_neg3: curve.sd_neg3,
            sd_neg2: curve.sd_neg2,
            median: curve.median,
            sd_pos2: curve.sd_pos2,
            sd_pos3: curve.sd_pos3,
            childWeight: pointsMap.get(curve.age_months) ?? null,
        }));
    }, [weightCurves, history, minAge, maxAge]);

    // All active anomaly alerts across measurements
    const allAnomalies = useMemo(() => {
        const list: { date: string; message: string }[] = [];
        history.forEach((h) => {
            if (h.anomalies && h.anomalies.length > 0) {
                h.anomalies.forEach((msg) => list.push({ date: h.date, message: msg }));
            }
        });
        return list;
    }, [history]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl">
                <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/20">
                    <div>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Curvas de Crecimiento OMS (Patrones Oficiales)
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            {childInfo ? (
                                <span>
                                    <span className="font-semibold text-foreground">{childInfo.name}</span> • Sexo:{" "}
                                    {childInfo.gender === "F" ? "Femenino" : "Masculino"} • Nacimiento:{" "}
                                    {childInfo.birth_date}
                                </span>
                            ) : (
                                "Cargando datos del infante..."
                            )}
                        </DialogDescription>
                    </div>
                    <Button
                        size="sm"
                        variant={showNewMeasurement ? "outline" : "default"}
                        onClick={() => setShowNewMeasurement(!showNewMeasurement)}
                        className="flex items-center gap-1.5"
                    >
                        <PlusCircle className="h-4 w-4" />
                        {showNewMeasurement ? "Cerrar Formulario" : "+ Nueva Toma"}
                    </Button>
                </DialogHeader>

                {/* Formulario rápido de Nueva Toma */}
                {showNewMeasurement && (
                    <Card className="bg-primary/5 border-primary/20 transition-all duration-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                                <Sparkles className="h-4 w-4" />
                                Registro Inmediato de Antropometría
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Ingrese las mediciones tomadas hoy para actualizar la curva instantáneamente.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <form onSubmit={handleSaveMeasurement} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                <div>
                                    <Label className="text-xs">Fecha de Toma</Label>
                                    <Input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="h-8 text-xs bg-background/80"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs flex items-center gap-1">
                                        <ScaleIcon className="h-3 w-3 text-amber-500" /> Peso (kg)
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Ej: 12.4"
                                        value={newWeight}
                                        onChange={(e) => setNewWeight(e.target.value)}
                                        className="h-8 text-xs bg-background/80"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs flex items-center gap-1">
                                        <Ruler className="h-3 w-3 text-emerald-500" /> Talla (cm)
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="Ej: 86.5"
                                        value={newHeight}
                                        onChange={(e) => setNewHeight(e.target.value)}
                                        className="h-8 text-xs bg-background/80"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Perím. Cefálico (cm)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="Opcional"
                                        value={newHeadCirc}
                                        onChange={(e) => setNewHeadCirc(e.target.value)}
                                        className="h-8 text-xs bg-background/80"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button type="submit" size="sm" disabled={isSaving} className="w-full h-8 text-xs">
                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                        Guardar Toma
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Banner de Detección de Anomalías / Inconsistencias */}
                {allAnomalies.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-amber-200">
                                    Alerta de Inconsistencia Antropométrica Detectada ({allAnomalies.length})
                                </p>
                                <ul className="text-xs list-disc list-inside space-y-0.5 text-amber-300/90">
                                    {allAnomalies.map((a, i) => (
                                        <li key={i}>
                                            <span className="font-mono text-amber-200">[{a.date}]:</span> {a.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="height" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <TabsList className="grid grid-cols-3 w-full sm:w-[380px]">
                                <TabsTrigger value="height" className="text-xs">
                                    Talla / Edad
                                </TabsTrigger>
                                <TabsTrigger value="weight" className="text-xs">
                                    Peso / Edad
                                </TabsTrigger>
                                <TabsTrigger value="history" className="text-xs">
                                    Historial ({history.length})
                                </TabsTrigger>
                            </TabsList>

                            {/* Selector de Rango de Edad OMS: 0 a 2 años / 2 a 5 años */}
                            {activeTab !== "history" && (
                                <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/30">
                                    <span className="text-xs text-muted-foreground px-2 font-medium">Tramo OMS:</span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={ageRange === "0-24" ? "default" : "ghost"}
                                        onClick={() => setAgeRange("0-24")}
                                        className="h-7 text-xs px-3"
                                    >
                                        0 a 2 Años (0-24 m)
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={ageRange === "24-60" ? "default" : "ghost"}
                                        onClick={() => setAgeRange("24-60")}
                                        className="h-7 text-xs px-3"
                                    >
                                        2 a 5 Años (24-60 m)
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Pestaña: Talla para la Edad */}
                        <TabsContent value="height" className="space-y-4 m-0">
                            <Card className="bg-card/40 border-border/30">
                                <CardHeader className="py-3 px-4 border-b border-border/10 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <Ruler className="h-4 w-4 text-emerald-400" />
                                            Longitud / Estatura para la Edad — OMS {childInfo?.gender === "F" ? "(Niñas)" : "(Niños)"}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Línea Verde: Mediana OMS • Líneas Amarillas: ±2 SD (Alertas) • Líneas Rojas: ±3 SD (Severo) • Puntos Azules: Tomas del Niño/a
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        Rango: {minAge} a {maxAge} meses
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="h-[360px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={combinedHeightData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                                <XAxis
                                                    dataKey="age"
                                                    domain={[minAge, maxAge]}
                                                    type="number"
                                                    label={{ value: "Edad en Meses Cumplidos", position: "insideBottom", offset: -5, fill: "#94a3b8", fontSize: 11 }}
                                                    stroke="#64748b"
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <YAxis
                                                    domain={["auto", "auto"]}
                                                    label={{ value: "Estatura (cm)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                                                    stroke="#64748b"
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                                                        borderColor: "rgba(255,255,255,0.15)",
                                                        borderRadius: "8px",
                                                        fontSize: "12px",
                                                    }}
                                                    formatter={(val: any, name: string) => {
                                                        if (name === "Toma del Niño/a") return [`${val} cm`, name];
                                                        if (name === "Mediana (0 SD)") return [`${val} cm`, "Mediana OMS"];
                                                        return [`${val} cm`, name];
                                                    }}
                                                    labelFormatter={(label) => `Edad: ${label} meses`}
                                                />
                                                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

                                                {/* Bandas Percentilares OMS */}
                                                <Line type="monotone" dataKey="sd_pos3" name="+3 SD (Muy Alta)" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_pos2" name="+2 SD (Alerta Alta)" stroke="#eab308" strokeDasharray="3 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="median" name="Mediana (0 SD)" stroke="#22c55e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_neg2" name="-2 SD (Talla Baja)" stroke="#eab308" strokeDasharray="3 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_neg3" name="-3 SD (Retardo Severo)" stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />

                                                {/* Puntos y Curva de Tomas Reales del Niño */}
                                                <Line
                                                    type="monotone"
                                                    dataKey="childHeight"
                                                    name="Toma del Niño/a"
                                                    stroke="#38bdf8"
                                                    strokeWidth={3}
                                                    connectNulls={true}
                                                    dot={{ fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2, r: 6 }}
                                                    activeDot={{ r: 8, fill: "#38bdf8" }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Pestaña: Peso para la Edad */}
                        <TabsContent value="weight" className="space-y-4 m-0">
                            <Card className="bg-card/40 border-border/30">
                                <CardHeader className="py-3 px-4 border-b border-border/10 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <ScaleIcon className="h-4 w-4 text-amber-400" />
                                            Peso para la Edad — OMS {childInfo?.gender === "F" ? "(Niñas)" : "(Niños)"}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Línea Verde: Mediana OMS • Líneas Amarillas: ±2 SD (Sobrepeso / Desnutrición) • Puntos Naranjas: Tomas del Niño/a
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                                        Rango: {minAge} a {maxAge} meses
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="h-[360px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={combinedWeightData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                                <XAxis
                                                    dataKey="age"
                                                    domain={[minAge, maxAge]}
                                                    type="number"
                                                    label={{ value: "Edad en Meses Cumplidos", position: "insideBottom", offset: -5, fill: "#94a3b8", fontSize: 11 }}
                                                    stroke="#64748b"
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <YAxis
                                                    domain={["auto", "auto"]}
                                                    label={{ value: "Peso (kg)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                                                    stroke="#64748b"
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                                                        borderColor: "rgba(255,255,255,0.15)",
                                                        borderRadius: "8px",
                                                        fontSize: "12px",
                                                    }}
                                                    formatter={(val: any, name: string) => {
                                                        if (name === "Peso del Niño/a") return [`${val} kg`, name];
                                                        if (name === "Mediana (0 SD)") return [`${val} kg`, "Mediana OMS"];
                                                        return [`${val} kg`, name];
                                                    }}
                                                    labelFormatter={(label) => `Edad: ${label} meses`}
                                                />
                                                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

                                                {/* Bandas Percentilares OMS */}
                                                <Line type="monotone" dataKey="sd_pos3" name="+3 SD (Obesidad)" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_pos2" name="+2 SD (Sobrepeso)" stroke="#eab308" strokeDasharray="3 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="median" name="Mediana (0 SD)" stroke="#22c55e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_neg2" name="-2 SD (Desnutrición)" stroke="#eab308" strokeDasharray="3 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="sd_neg3" name="-3 SD (Desnutrición Severa)" stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />

                                                {/* Puntos y Curva de Tomas Reales del Niño */}
                                                <Line
                                                    type="monotone"
                                                    dataKey="childWeight"
                                                    name="Peso del Niño/a"
                                                    stroke="#f97316"
                                                    strokeWidth={3}
                                                    connectNulls={true}
                                                    dot={{ fill: "#ea580c", stroke: "#ffffff", strokeWidth: 2, r: 6 }}
                                                    activeDot={{ r: 8, fill: "#fb923c" }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Pestaña: Historial Completo y Diagnósticos OMS */}
                        <TabsContent value="history" className="space-y-4 m-0">
                            <Card className="bg-card/40 border-border/30">
                                <CardHeader className="py-3 px-4 border-b border-border/10">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" />
                                        Registro Nominal de Tomas Antropométricas y Diagnóstico OMS
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {history.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground text-sm">
                                            No hay registros de crecimiento disponibles para este infante.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent text-xs">
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead>Edad (meses)</TableHead>
                                                        <TableHead>Peso</TableHead>
                                                        <TableHead>Talla</TableHead>
                                                        <TableHead>Z-Peso (OMS)</TableHead>
                                                        <TableHead>Z-Talla (OMS)</TableHead>
                                                        <TableHead>Estado Nutricional</TableHead>
                                                        <TableHead>Alertas</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody className="text-xs">
                                                    {history.map((record) => (
                                                        <TableRow key={record.id} className="hover:bg-muted/20">
                                                            <TableCell className="font-mono">{record.date || "-"}</TableCell>
                                                            <TableCell>{record.age_months !== null ? `${record.age_months} m` : "-"}</TableCell>
                                                            <TableCell className="font-semibold">{record.weight ? `${record.weight} kg` : "-"}</TableCell>
                                                            <TableCell className="font-semibold">{record.height ? `${record.height} cm` : "-"}</TableCell>
                                                            <TableCell>
                                                                {record.z_score_weight !== null ? (
                                                                    <Badge variant="outline" className={record.z_score_weight < -2 ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}>
                                                                        {record.z_score_weight > 0 ? `+${record.z_score_weight}` : record.z_score_weight}
                                                                    </Badge>
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {record.z_score_height !== null ? (
                                                                    <Badge variant="outline" className={record.z_score_height < -2 ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}>
                                                                        {record.z_score_height > 0 ? `+${record.z_score_height}` : record.z_score_height}
                                                                    </Badge>
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="font-medium text-foreground">
                                                                    {record.weight_status || "Evaluado"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {record.has_anomaly ? (
                                                                    <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                                                        <AlertTriangle className="h-2.5 w-2.5" />
                                                                        Inconsistencia
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-[10px] text-emerald-400 bg-emerald-500/10">
                                                                        Normal
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
