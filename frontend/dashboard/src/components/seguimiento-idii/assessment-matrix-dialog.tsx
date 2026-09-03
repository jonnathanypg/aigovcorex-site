"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { milestonesService, type BatchEvaluation } from "@/services/milestones.service";
import { childrenService } from "@/services/children.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────
type AchievementLevel = "no_iniciado" | "en_proceso" | "adquirido";

interface CatalogDomainItems {
    [domain: string]: string[];
}

interface CatalogData {
    name: string;
    age_range_label?: string;
    milestones: CatalogDomainItems;
}

// Map: item key => chosen level
type EvaluationState = Record<string, AchievementLevel | null>;

// ─── Constants ───────────────────────────────────────────────
const DOMAIN_LABELS: Record<string, string> = {
    vinculacion_emocional: "Vinculación Emocional y Social",
    expresion_corporal: "Exploración del Cuerpo y Motricidad",
    lenguaje: "Lenguaje Verbal y No Verbal",
    descubrimiento_natural_cultural: "Descubrimiento del Medio Natural y Cultural",
};

const DOMAIN_ORDER = [
    "vinculacion_emocional",
    "expresion_corporal",
    "lenguaje",
    "descubrimiento_natural_cultural",
];

const DOMAIN_ICONS: Record<string, string> = {
    vinculacion_emocional: "❤️",
    expresion_corporal: "🏃",
    lenguaje: "💬",
    descubrimiento_natural_cultural: "🌿",
};

const LEVEL_CONFIG = {
    no_iniciado: { label: "Requiere Apoyo", color: "bg-red-500", ring: "ring-red-400", text: "text-red-600", bgLight: "bg-red-50 dark:bg-red-950/30" },
    en_proceso: { label: "En Desarrollo", color: "bg-yellow-400", ring: "ring-yellow-400", text: "text-yellow-600", bgLight: "bg-yellow-50 dark:bg-yellow-950/30" },
    adquirido: { label: "Logro Alcanzado", color: "bg-green-500", ring: "ring-green-400", text: "text-green-600", bgLight: "bg-green-50 dark:bg-green-950/30" },
};

// ─── Props ───────────────────────────────────────────────────
interface AssessmentMatrixDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    preselectedChildId?: number | null;
}

// ─── Component ───────────────────────────────────────────────
export function AssessmentMatrixDialog({
    open,
    onOpenChange,
    onSuccess,
    preselectedChildId,
}: AssessmentMatrixDialogProps) {
    const { toast } = useToast();

    // Step management
    const [step, setStep] = useState<"setup" | "evaluate" | "report">("setup");

    // Setup state
    const [childrenList, setChildrenList] = useState<Child[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(true);
    const [childId, setChildId] = useState<string>("");
    const [period, setPeriod] = useState("");
    const [periodType, setPeriodType] = useState("");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [notes, setNotes] = useState("");
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);

    // Evaluation state
    const [catalog, setCatalog] = useState<CatalogData | null>(null);
    const [childName, setChildName] = useState("");
    const [ageMonths, setAgeMonths] = useState(0);
    const [evaluations, setEvaluations] = useState<EvaluationState>({});
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Report state  
    const [reportData, setReportData] = useState<Record<string, { total: number; scored: number; percentage: number }> | null>(null);

    // ─── Effects ─────────────────────────────────────────────
    useEffect(() => {
        if (open) {
            loadChildren();
            setStep("setup");
            setEvaluations({});
            setReportData(null);
            setCatalog(null);
            if (preselectedChildId) {
                setChildId(String(preselectedChildId));
            } else {
                setChildId("");
            }
            setPeriod("");
            setPeriodType("");
            setPeriodStart("");
            setPeriodEnd("");
            setNotes("");
            setRecordDate(new Date().toISOString().split("T")[0]);
        }
    }, [open, preselectedChildId]);

    // Period Generator
    useEffect(() => {
        if (!periodType) {
            setPeriod("");
            return;
        }

        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        const now = new Date();
        
        switch (periodType) {
            case "last_28": {
                const start = new Date(now);
                start.setDate(now.getDate() - 28);
                setPeriod(`${formatDate(start)} al ${formatDate(now)}`);
                break;
            }
            case "this_month": {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                setPeriod(`${formatDate(start)} al ${formatDate(end)}`);
                break;
            }
            case "last_month": {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                setPeriod(`${formatDate(start)} al ${formatDate(end)}`);
                break;
            }
            case "this_year": {
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                setPeriod(`${formatDate(start)} al ${formatDate(end)}`);
                break;
            }
            case "custom": {
                if (periodStart && periodEnd) {
                    setPeriod(`${periodStart} al ${periodEnd}`);
                } else {
                    setPeriod(""); // Waiting for both
                }
                break;
            }
        }
    }, [periodType, periodStart, periodEnd]);

    const loadChildren = async () => {
        try {
            setIsLoadingChildren(true);
            const data = await childrenService.getAll({ status: "activo" });
            setChildrenList(data);
        } catch (error) {
            console.error("Error loading children:", error);
        } finally {
            setIsLoadingChildren(false);
        }
    };

    const childOptions = childrenList.map((child) => ({
        value: String(child.id),
        label: child.full_name || `${child.first_name} ${child.last_name}`,
    }));

    // ─── Step: Setup -> Evaluate ─────────────────────────────
    const handleStartEvaluation = async () => {
        if (!childId || !period) return;

        setIsLoadingCatalog(true);
        try {
            const [data, existingData] = await Promise.all([
                milestonesService.getCatalogForChild(parseInt(childId)),
                milestonesService.getByChild(parseInt(childId))
            ]);
            
            setCatalog(data.catalog);
            setChildName(data.child_name);
            setAgeMonths(data.age_months || 0);

            // Fetch existing levels to prefill
            const existingMap: Record<string, AchievementLevel> = {};
            if (existingData && existingData.milestones) {
                existingData.milestones.forEach((m: any) => {
                    existingMap[m.milestone_description] = m.achievement_level as AchievementLevel;
                });
            }

            // Initialize evaluation state: pre-filled if it exists, otherwise null
            const initial: EvaluationState = {};
            if (data.catalog?.milestones) {
                for (const domain of DOMAIN_ORDER) {
                    const items = data.catalog.milestones[domain] || [];
                    items.forEach((item: string, idx: number) => {
                        initial[`${domain}::${idx}`] = existingMap[item] || null;
                    });
                }
            }
            setEvaluations(initial);
            setStep("evaluate");
        } catch (error) {
            console.error("Error loading catalog:", error);
            toast({ title: "Error", description: "No se pudo cargar el catálogo de hitos para este niño.", variant: "destructive" });
        } finally {
            setIsLoadingCatalog(false);
        }
    };

    // ─── Set Item Level ──────────────────────────────────────
    const setItemLevel = (key: string, level: AchievementLevel) => {
        setEvaluations((prev) => ({
            ...prev,
            [key]: prev[key] === level ? null : level, // Toggle off if same
        }));
    };

    // ─── Stats ───────────────────────────────────────────────
    const stats = useMemo(() => {
        if (!catalog?.milestones) return { total: 0, answered: 0, domains: {} as Record<string, { total: number; answered: number }> };

        let total = 0;
        let answered = 0;
        const domains: Record<string, { total: number; answered: number }> = {};

        for (const domain of DOMAIN_ORDER) {
            const items = catalog.milestones[domain] || [];
            const domainTotal = items.length;
            let domainAnswered = 0;
            items.forEach((_: string, idx: number) => {
                total++;
                if (evaluations[`${domain}::${idx}`] !== null && evaluations[`${domain}::${idx}`] !== undefined) {
                    answered++;
                    domainAnswered++;
                }
            });
            domains[domain] = { total: domainTotal, answered: domainAnswered };
        }

        return { total, answered, domains };
    }, [evaluations, catalog]);

    // ─── Save (Finalizar) ────────────────────────────────────
    const handleFinalize = async () => {
        if (!catalog?.milestones) return;

        // Build batch payload
        const batchEvals: BatchEvaluation[] = [];
        for (const domain of DOMAIN_ORDER) {
            const items = catalog.milestones[domain] || [];
            items.forEach((item: string, idx: number) => {
                const level = evaluations[`${domain}::${idx}`];
                if (level) {
                    batchEvals.push({
                        domain,
                        milestone_description: item,
                        achievement_level: level,
                    });
                }
            });
        }

        if (batchEvals.length === 0) {
            toast({ title: "Atención", description: "Debe evaluar al menos un ítem antes de finalizar.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            await milestonesService.recordBatch({
                child_id: parseInt(childId),
                record_date: recordDate,
                period,
                notes,
                evaluations: batchEvals,
            });

            // Compute report
            const report: Record<string, { total: number; scored: number; percentage: number }> = {};
            for (const domain of DOMAIN_ORDER) {
                const items = catalog.milestones[domain] || [];
                let scored = 0;
                let evaluated = 0;
                items.forEach((_, idx) => {
                    const level = evaluations[`${domain}::${idx}`];
                    if (level) {
                        evaluated++;
                        if (level === "adquirido") scored += 100;
                        else if (level === "en_proceso") scored += 50;
                    }
                });
                const percentage = evaluated > 0 ? Math.round(scored / evaluated) : 0;
                report[domain] = { total: items.length, scored: evaluated, percentage };
            }
            setReportData(report);

            toast({ title: "Evaluación Guardada", description: `${batchEvals.length} ítems registrados exitosamente.` });
            setStep("report");
            onSuccess?.();
        } catch (error) {
            console.error("Error saving batch:", error);
            toast({ title: "Error", description: "No se pudo guardar la evaluación.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
            <DialogContent className={`${step === "setup" ? "sm:max-w-[520px]" : "sm:max-w-[780px]"} max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl`}>

                {/* ════════ STEP 1: SETUP ════════ */}
                {step === "setup" && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl">📋 Nueva Evaluación IDII</DialogTitle>
                            <DialogDescription>
                                Seleccione el niño/a, el periodo de evaluación y la fecha para comenzar.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Child */}
                            <div className="space-y-2">
                                <Label>Niño/a *</Label>
                                {isLoadingChildren ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={childOptions}
                                        value={childId}
                                        onValueChange={setChildId}
                                        placeholder="Seleccionar niño/a"
                                        searchPlaceholder="Buscar por nombre..."
                                        emptyMessage="No se encontraron niños"
                                        disabled={!!preselectedChildId}
                                    />
                                )}
                            </div>

                            {/* Period */}
                            <div className="space-y-4 border p-4 bg-background/50 rounded-lg">
                                <div className="space-y-2">
                                    <Label>Periodo de Evaluación *</Label>
                                    <Select value={periodType} onValueChange={setPeriodType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar cómo medir el periodo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="last_28">Últimos 28 días</SelectItem>
                                            <SelectItem value="this_month">Este mes</SelectItem>
                                            <SelectItem value="last_month">Mes anterior</SelectItem>
                                            <SelectItem value="this_year">Este año</SelectItem>
                                            <SelectItem value="custom">Rango Personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {periodType === "custom" && (
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-2">
                                            <Label>Desde</Label>
                                            <Input
                                                type="date"
                                                value={periodStart}
                                                onChange={(e) => setPeriodStart(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Hasta</Label>
                                            <Input
                                                type="date"
                                                value={periodEnd}
                                                onChange={(e) => setPeriodEnd(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {period && periodType !== "custom" && (
                                    <div className="text-xs text-muted-foreground bg-primary/10 text-primary px-3 py-1.5 rounded-sm inline-flex">
                                        Fechas: {period}
                                    </div>
                                )}
                            </div>

                            {/* Date */}
                            <div className="space-y-2">
                                <Label>Fecha de Evaluación</Label>
                                <Input
                                    type="date"
                                    value={recordDate}
                                    onChange={(e) => setRecordDate(e.target.value)}
                                />
                            </div>

                            {/* Global Notes */}
                            <div className="space-y-2">
                                <Label>Observaciones Generales (Opcional)</Label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Ingrese comentarios adicionales sobre la evaluación..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleStartEvaluation}
                                disabled={!childId || !period || isLoadingCatalog}
                            >
                                {isLoadingCatalog ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...</>
                                ) : (
                                    "Iniciar Evaluación"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* ════════ STEP 2: EVALUATE ════════ */}
                {step === "evaluate" && catalog && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl">
                                📋 Evaluación IDII — {childName}
                            </DialogTitle>
                            <DialogDescription>
                                {catalog.age_range_label || catalog.name} · Periodo: {period} · {ageMonths} meses
                            </DialogDescription>
                        </DialogHeader>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3 px-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500 rounded-full"
                                    style={{ width: `${stats.total > 0 ? (stats.answered / stats.total) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {stats.answered}/{stats.total} ítems
                            </span>
                        </div>

                        {/* Color legend */}
                        <div className="flex flex-wrap gap-3 px-1 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-500" /> Requiere Apoyo
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-yellow-400" /> En Desarrollo
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-green-500" /> Logro Alcanzado
                            </span>
                        </div>

                        {/* Domain Accordions */}
                        <Accordion type="multiple" defaultValue={DOMAIN_ORDER} className="space-y-2">
                            {DOMAIN_ORDER.map((domain) => {
                                const items = catalog.milestones[domain] || [];
                                if (items.length === 0) return null;
                                const domainStats = stats.domains[domain];
                                const allAnswered = domainStats && domainStats.answered === domainStats.total;
                                return (
                                    <AccordionItem key={domain} value={domain} className="border rounded-lg bg-card/50 backdrop-blur-sm">
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-lg">{DOMAIN_ICONS[domain]}</span>
                                                <span className="font-semibold text-sm">
                                                    {DOMAIN_LABELS[domain]}
                                                </span>
                                                <Badge variant={allAnswered ? "default" : "outline"} className="ml-auto mr-2 text-xs">
                                                    {domainStats?.answered || 0}/{domainStats?.total || 0}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            <div className="space-y-2">
                                                {items.map((item: string, idx: number) => {
                                                    const key = `${domain}::${idx}`;
                                                    const currentLevel = evaluations[key];
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                                                                currentLevel
                                                                    ? LEVEL_CONFIG[currentLevel].bgLight + " border-transparent"
                                                                    : "bg-background/40 border-border/30"
                                                            }`}
                                                        >
                                                            {/* Item text */}
                                                            <span className="flex-1 text-sm leading-snug">{item}</span>

                                                            {/* Color buttons */}
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {(["no_iniciado", "en_proceso", "adquirido"] as const).map((level) => {
                                                                    const cfg = LEVEL_CONFIG[level];
                                                                    const isSelected = currentLevel === level;
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={level}
                                                                            title={cfg.label}
                                                                            onClick={() => setItemLevel(key, level)}
                                                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${cfg.color} ${
                                                                                isSelected
                                                                                    ? `ring-2 ${cfg.ring} ring-offset-2 ring-offset-background scale-110 shadow-lg`
                                                                                    : "opacity-40 hover:opacity-80 hover:scale-105"
                                                                            }`}
                                                                        >
                                                                            {isSelected && (
                                                                                <CheckCircle2 className="h-4 w-4 text-white drop-shadow-sm" />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={() => setStep("setup")} disabled={isSaving}>
                                ← Volver
                            </Button>
                            <Button
                                onClick={handleFinalize}
                                disabled={isSaving || stats.answered === 0}
                                className="bg-primary"
                            >
                                {isSaving ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    `Finalizar Evaluación (${stats.answered} ítems)`
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* ════════ STEP 3: REPORT ════════ */}
                {step === "report" && reportData && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl">
                                ✅ Informe de Logros — {childName}
                            </DialogTitle>
                            <DialogDescription>
                                Periodo: {period} · Fecha: {recordDate}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {DOMAIN_ORDER.map((domain) => {
                                const data = reportData[domain];
                                if (!data) return null;
                                const pct = data.percentage;
                                const barColor =
                                    pct >= 75
                                        ? "bg-green-500"
                                        : pct >= 40
                                        ? "bg-yellow-400"
                                        : "bg-red-500";
                                const label = DOMAIN_LABELS[domain];
                                return (
                                    <div key={domain} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium flex items-center gap-2">
                                                <span>{DOMAIN_ICONS[domain]}</span>
                                                {label}
                                            </span>
                                            <span className="text-sm font-bold">{pct}%</span>
                                        </div>
                                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${barColor} transition-all duration-700 rounded-full`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {data.scored} de {data.total} ítems evaluados
                                        </p>
                                    </div>
                                );
                            })}

                            {/* Overall Average */}
                            {(() => {
                                const vals = DOMAIN_ORDER.map(d => reportData[d]?.percentage || 0);
                                const evaluatedDomains = DOMAIN_ORDER.filter(d => reportData[d] && reportData[d].scored > 0);
                                const avg = evaluatedDomains.length > 0
                                    ? Math.round(vals.reduce((a, b) => a + b, 0) / evaluatedDomains.length)
                                    : 0;
                                return (
                                    <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">Promedio General</span>
                                            <span className={`text-2xl font-bold ${
                                                avg >= 75 ? "text-green-500" : avg >= 40 ? "text-yellow-500" : "text-red-500"
                                            }`}>
                                                {avg}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <DialogFooter>
                            <Button onClick={() => onOpenChange(false)}>
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
