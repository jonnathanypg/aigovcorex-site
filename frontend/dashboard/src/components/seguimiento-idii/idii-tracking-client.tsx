"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Loader2, PlusCircle, ChevronDown, ChevronRight, Users, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/use-role";
import { milestonesService, type MilestoneRecord } from "@/services/milestones.service";
import { childrenService } from "@/services/children.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { AssessmentMatrixDialog } from "./assessment-matrix-dialog";
import { ChildMilestoneDetail } from "./child-milestone-detail";
import type { Child } from "@/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ChildSummary {
    id: number;
    name: string;
    age_display?: string;
    cedula?: string;
    milestones_count: number;
    last_domain?: string;
    last_level?: string;
    last_date?: string;
    last_period?: string;
    tenant_name?: string;
}

// ─── IDII Color System (Rojo/Amarillo/Verde) ─────────────────
const LEVEL_LABELS: Record<string, string> = {
    no_iniciado: "Requiere Apoyo",
    en_proceso: "En Desarrollo",
    adquirido: "Logro Alcanzado",
    consolidado: "Logro Alcanzado",
};

const LEVEL_COLORS: Record<string, string> = {
    no_iniciado: "bg-red-500 text-white",
    en_proceso: "bg-yellow-400 text-yellow-900",
    adquirido: "bg-green-500 text-white",
    consolidado: "bg-green-500 text-white",
};

const LEVEL_DOT_COLORS: Record<string, string> = {
    no_iniciado: "bg-red-500",
    en_proceso: "bg-yellow-400",
    adquirido: "bg-green-500",
    consolidado: "bg-green-500",
};

const DOMAIN_LABELS: Record<string, string> = {
    vinculacion_emocional: "Vinculación Emocional",
    descubrimiento_natural_cultural: "Descubrimiento Natural",
    expresion_corporal: "Exploración Corporal",
    lenguaje: "Lenguaje",
};

export function IdiiTrackingClient() {
    const { role, center } = useRole();
    const showCenterColumn = role === "super_admin" || role === "license_admin";
    const [rawChildren, setRawChildren] = useState<Child[]>([]);
    const [rawMilestones, setRawMilestones] = useState<MilestoneRecord[]>([]);
    const [childSummaries, setChildSummaries] = useState<ChildSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [timeRange, setTimeRange] = useState<string>("all");
    const [expandedChildId, setExpandedChildId] = useState<number | null>(null);

    // Dialogs
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [isSingleOpen, setIsSingleOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Fetch all children and recent milestones in parallel
            const [children, milestonesData] = await Promise.all([
                childrenService.getAll({ status: 'activo' }),
                milestonesService.getRecent(),
            ]);

            setRawChildren(children);
            setRawMilestones(milestonesData);
        } catch (error) {
            console.error("Error fetching IDII data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    useAgentRefresh(fetchData);

    useEffect(() => {
        if (!rawChildren.length && !rawMilestones.length) return;

        // Apply time range filter to milestones
        let filteredMilestones = rawMilestones;
        if (timeRange !== "all") {
            const now = new Date();
            filteredMilestones = rawMilestones.filter(m => {
                if (!m.record_date) return false;
                const d = new Date(m.record_date);
                if (timeRange === "last_30") {
                    const diff = now.getTime() - d.getTime();
                    return diff <= 30 * 24 * 60 * 60 * 1000;
                } else if (timeRange === "this_month") {
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                } else if (timeRange === "last_month") {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
                } else if (timeRange === "this_year") {
                    return d.getFullYear() === now.getFullYear();
                }
                return true;
            });
        }

        const milestonesByChild: Record<number, MilestoneRecord[]> = {};
        for (const m of filteredMilestones) {
            if (!milestonesByChild[m.child_id]) {
                milestonesByChild[m.child_id] = [];
            }
            milestonesByChild[m.child_id].push(m);
        }

        const summaries: ChildSummary[] = rawChildren.map((child: Child) => {
            const childMilestones = milestonesByChild[child.id] || [];
            const latest = childMilestones[0];
            return {
                id: child.id,
                name: child.full_name || `${child.first_name} ${child.last_name}`,
                age_display: child.age_display,
                cedula: child.cedula,
                milestones_count: childMilestones.length,
                last_domain: latest?.domain,
                last_level: latest?.achievement_level,
                last_date: latest?.record_date,
                last_period: latest?.period,
                tenant_name: child.tenant_name,
            };
        });

        summaries.sort((a, b) => {
            if (a.milestones_count > 0 && b.milestones_count === 0) return -1;
            if (a.milestones_count === 0 && b.milestones_count > 0) return 1;
            return a.name.localeCompare(b.name);
        });

        setChildSummaries(summaries);
    }, [rawChildren, rawMilestones, timeRange]);

    const handleToggleChild = (childId: number) => {
        setExpandedChildId((prev) => (prev === childId ? null : childId));
    };

    const filteredChildren = childSummaries.filter((child) => {
        if (!filter.trim()) return true;
        const q = filter.toLowerCase();
        return (
            child.name.toLowerCase().includes(q) ||
            child.cedula?.toLowerCase().includes(q)
        );
    });

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6 flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    const childrenWithMilestones = childSummaries.filter((c) => c.milestones_count > 0).length;
    const childrenWithoutMilestones = childSummaries.filter((c) => c.milestones_count === 0).length;

    return (
        <Card>
            <CardContent className="pt-6">
                {/* Stats Summary */}
                <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span><strong className="text-foreground">{childSummaries.length}</strong> niños registrados</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="default" className="font-normal">{childrenWithMilestones} con hitos</Badge>
                    </div>
                    {childrenWithoutMilestones > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-amber-500">{childrenWithoutMilestones} sin evaluación</span>
                        </div>
                    )}
                </div>

                {/* Color Legend */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Requiere Apoyo
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> En Desarrollo
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Logro Alcanzado
                    </span>
                </div>

                {/* Search + Action Buttons */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex flex-1 gap-2 w-full max-w-lg">
                        <Input
                            placeholder="Buscar por nombre o cédula..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-background/50 w-full"
                        />
                        <div className="w-[180px] shrink-0">
                            <Select value={timeRange} onValueChange={setTimeRange}>
                                <SelectTrigger className="w-full bg-background/50">
                                    <SelectValue placeholder="Rango de fecha" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todo el tiempo</SelectItem>
                                    <SelectItem value="last_30">Últimos 30 días</SelectItem>
                                    <SelectItem value="this_month">Este mes</SelectItem>
                                    <SelectItem value="last_month">Mes anterior</SelectItem>
                                    <SelectItem value="this_year">Este año</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" onClick={() => setIsMatrixOpen(true)} className="flex-1 md:flex-none">
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Evaluación IDII
                        </Button>
                        <Button onClick={() => setIsSingleOpen(true)} className="flex-1 md:flex-none">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Registrar Hito
                        </Button>
                    </div>
                </div>

                {/* Children Table */}
                <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Niño/a</TableHead>
                                <TableHead className="hidden md:table-cell">Edad</TableHead>
                                {showCenterColumn && <TableHead className="hidden md:table-cell">Centro</TableHead>}
                                <TableHead className="text-center">Hitos</TableHead>
                                <TableHead className="hidden md:table-cell">Último Registro</TableHead>
                                <TableHead className="hidden md:table-cell">Último Nivel</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredChildren.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={showCenterColumn ? 7 : 6} className="text-center py-8 text-muted-foreground">
                                        No se encontraron niños que coincidan con la búsqueda.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredChildren.map((child) => {
                                    const isExpanded = expandedChildId === child.id;
                                    return (
                                        <React.Fragment key={child.id}>
                                            <TableRow
                                                className={`cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/5"}`}
                                                onClick={() => handleToggleChild(child.id)}
                                            >
                                                <TableCell className="w-8 pr-0">
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-primary" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">{child.name}</TableCell>
                                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                    {child.age_display || "—"}
                                                </TableCell>
                                                {showCenterColumn && (
                                                    <TableCell className="hidden md:table-cell text-sm">{child.tenant_name || center || "—"}</TableCell>
                                                )}
                                                <TableCell className="text-center">
                                                    <Badge variant={child.milestones_count > 0 ? "default" : "outline"}>
                                                        {child.milestones_count}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                    {child.last_date ? (
                                                        <span>{child.last_date} — {DOMAIN_LABELS[child.last_domain || ""] || child.last_domain}</span>
                                                    ) : (
                                                        <span className="text-amber-500/70 italic">Sin evaluación</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {child.last_level ? (
                                                        <Badge className={`${LEVEL_COLORS[child.last_level] || "bg-gray-400 text-white"} border-0`}>
                                                            {LEVEL_LABELS[child.last_level] || child.last_level}
                                                        </Badge>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={showCenterColumn ? 7 : 6} className="p-0 bg-card/30">
                                                        <ChildMilestoneDetail
                                                            childId={child.id}
                                                            childName={child.name}
                                                            isExpanded={isExpanded}
                                                            onToggle={() => handleToggleChild(child.id)}
                                                            milestonesCount={child.milestones_count}
                                                            onDataChange={fetchData}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Assessment Matrix Dialog (New IDII Flow) */}
                <AssessmentMatrixDialog
                    open={isMatrixOpen}
                    onOpenChange={setIsMatrixOpen}
                    onSuccess={fetchData}
                />

                {/* Legacy Single Create Dialog */}
                <CreateMilestoneDialog
                    open={isSingleOpen}
                    onOpenChange={setIsSingleOpen}
                    onSuccess={fetchData}
                />
            </CardContent>
        </Card>
    );
}