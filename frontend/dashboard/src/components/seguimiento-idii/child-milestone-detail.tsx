"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlusCircle, FileEdit, Trash2, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { milestonesService, type MilestoneRecord } from "@/services/milestones.service";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DOMAIN_LABELS: Record<string, string> = {
    vinculacion_emocional: "Vinculación Emocional y Social",
    descubrimiento_natural_cultural: "Descubrimiento del Medio Natural y Cultural",
    expresion_corporal: "Exploración del Cuerpo y Motricidad",
    lenguaje: "Lenguaje Verbal y No Verbal",
};

const DOMAIN_COLORS: Record<string, string> = {
    vinculacion_emocional: "bg-rose-500",
    descubrimiento_natural_cultural: "bg-emerald-500",
    expresion_corporal: "bg-sky-500",
    lenguaje: "bg-amber-500",
};

const LEVEL_LABELS: Record<string, string> = {
    no_iniciado: "Requiere Apoyo",
    en_proceso: "En Desarrollo",
    adquirido: "Logro Alcanzado",
    consolidado: "Logro Alcanzado",
};

const LEVEL_BADGE_COLORS: Record<string, string> = {
    no_iniciado: "bg-red-500 text-white border-0",
    en_proceso: "bg-yellow-400 text-yellow-900 border-0",
    adquirido: "bg-green-500 text-white border-0",
    consolidado: "bg-green-500 text-white border-0",
};

interface ChildMilestoneDetailProps {
    childId: number;
    childName: string;
    isExpanded: boolean;
    onToggle: () => void;
    milestonesCount: number;
    onDataChange: () => void;
}

interface DomainProgress {
    latest_milestone: string | null;
    achievement_level: string;
    achievement_percentage: number;
    record_date: string | null;
}

export function ChildMilestoneDetail({
    childId,
    childName,
    isExpanded,
    onToggle,
    milestonesCount,
    onDataChange,
}: ChildMilestoneDetailProps) {
    const { canDelete } = useRole();
    const { toast } = useToast();

    const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
    const [progress, setProgress] = useState<Record<string, DomainProgress> | null>(null);
    const [averageProgress, setAverageProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

    const loadDetail = useCallback(async () => {
        if (hasLoaded) return;
        setIsLoading(true);
        try {
            const [childData, progressData] = await Promise.all([
                milestonesService.getByChild(childId),
                milestonesService.getChildProgress(childId),
            ]);
            setMilestones(childData.milestones);
            setProgress(progressData.progress_by_domain);
            setAverageProgress(progressData.average_progress);
            setHasLoaded(true);
        } catch (error) {
            console.error("Error loading child detail:", error);
            toast({ title: "Error", description: "No se pudo cargar el detalle del niño.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [childId, hasLoaded, toast]);

    useEffect(() => {
        if (isExpanded && !hasLoaded) {
            loadDetail();
        }
    }, [isExpanded, hasLoaded, loadDetail]);

    const refreshData = async () => {
        setHasLoaded(false);
        setIsLoading(true);
        try {
            const [childData, progressData] = await Promise.all([
                milestonesService.getByChild(childId),
                milestonesService.getChildProgress(childId),
            ]);
            setMilestones(childData.milestones);
            setProgress(progressData.progress_by_domain);
            setAverageProgress(progressData.average_progress);
            setHasLoaded(true);
        } catch (error) {
            console.error("Error refreshing:", error);
        } finally {
            setIsLoading(false);
        }
        onDataChange();
    };

    const handleAddMilestone = () => {
        setEditingId(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (id: number) => {
        setEditingId(id);
        setIsDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!recordToDelete) return;
        try {
            await milestonesService.delete(recordToDelete);
            toast({ title: "Eliminado", description: "Hito eliminado correctamente." });
            setMilestones((prev) => prev.filter((m) => m.id !== recordToDelete));
            refreshData();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo eliminar el hito.", variant: "destructive" });
        } finally {
            setRecordToDelete(null);
        }
    };

    if (!isExpanded) return null;

    return (
        <div className="px-2 pb-4 pt-1 animate-in slide-in-from-top-2 duration-300">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Progress by Domain */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {progress &&
                            Object.entries(DOMAIN_LABELS).map(([key, label]) => {
                                const domainData = progress[key];
                                const percentage = domainData?.achievement_percentage ?? 0;
                                const level = domainData?.achievement_level ?? "no_iniciado";
                                return (
                                    <div key={key} className="p-3 rounded-lg bg-background/30 border border-border/10 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium truncate mr-2">{label}</span>
                                            <Badge className={`text-xs shrink-0 ${LEVEL_BADGE_COLORS[level] || "bg-gray-400 text-white border-0"}`}>
                                                {LEVEL_LABELS[level] || level}
                                            </Badge>
                                        </div>
                                        <Progress value={percentage} className="h-2" />
                                        {domainData?.latest_milestone && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                Último: {domainData.latest_milestone}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                    </div>

                    {/* Average progress summary */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span>Progreso promedio: <strong className="text-foreground">{averageProgress}%</strong></span>
                        </div>
                        <Button size="sm" onClick={handleAddMilestone}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Agregar Hito
                        </Button>
                    </div>

                    {/* Milestones History Table */}
                    {milestones.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6 border border-dashed rounded-md">
                            No hay hitos registrados para este niño/a. Haga click en &quot;Agregar Hito&quot; para comenzar.
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden bg-card/30 border-border/10">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Área</TableHead>
                                        <TableHead>Descripción del Hito</TableHead>
                                        <TableHead>Resultado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {milestones.map((m) => (
                                        <TableRow key={m.id} className="hover:bg-white/5">
                                            <TableCell className="text-sm whitespace-nowrap">{m.record_date}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${DOMAIN_COLORS[m.domain] || "bg-gray-400"}`} />
                                                    <span className="text-sm">{DOMAIN_LABELS[m.domain] || m.domain}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[250px] truncate">{m.milestone_description}</TableCell>
                                            <TableCell>
                                                <Badge className={`${LEVEL_BADGE_COLORS[m.achievement_level] || "bg-gray-400 text-white border-0"}`}>
                                                    {LEVEL_LABELS[m.achievement_level] || m.achievement_level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m.id)}>
                                                        <FileEdit className="h-4 w-4" />
                                                    </Button>
                                                    {canDelete && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRecordToDelete(m.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <CreateMilestoneDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSuccess={refreshData}
                milestoneIdToEdit={editingId}
                preselectedChildId={childId}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este hito?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El registro será eliminado permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
