"use client";

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { milestonesService } from "@/services/milestones.service";
import { childrenService } from "@/services/children.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CreateMilestoneDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    milestoneIdToEdit?: number | null;
    preselectedChildId?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type AchievementLevel = 'no_iniciado' | 'en_proceso' | 'adquirido' | 'consolidado';

const DOMAINS = [
    { value: 'vinculacion_emocional', label: 'Vinculación Emocional y Social' },
    { value: 'expresion_corporal', label: 'Exploración del Cuerpo y Motricidad' },
    { value: 'lenguaje', label: 'Lenguaje Verbal y No Verbal' },
    { value: 'descubrimiento_natural_cultural', label: 'Descubrimiento del Medio Natural y Cultural' },
];

export function CreateMilestoneDialog({ children, onSuccess, milestoneIdToEdit, preselectedChildId, open, onOpenChange }: CreateMilestoneDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [childrenList, setChildrenList] = useState<Child[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(true);
    const { toast } = useToast();

    // Form state
    const [childId, setChildId] = useState<string>("");
    const [domain, setDomain] = useState<string>("");
    const [description, setDescription] = useState("");
    const [achievementLevel, setAchievementLevel] = useState<AchievementLevel>("en_proceso");
    const [notes, setNotes] = useState("");
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
    const [keepOpen, setKeepOpen] = useState(false);

    // New states for dynamic dropdown
    const [catalogData, setCatalogData] = useState<any>(null);
    const [existingDescriptions, setExistingDescriptions] = useState<Set<string>>(new Set());
    const [originalDescription, setOriginalDescription] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            loadChildren();
            if (milestoneIdToEdit) {
                loadMilestone(milestoneIdToEdit);
            } else {
                resetForm();
                if (preselectedChildId) {
                    setChildId(String(preselectedChildId));
                }
            }
        }
    }, [isOpen, milestoneIdToEdit, preselectedChildId]);

    const loadMilestone = async (id: number) => {
        try {
            setIsFetching(true);
            const data = await milestonesService.getById(id);
            setChildId(String(data.child_id));
            setDomain(data.domain);
            setDescription(data.milestone_description);
            setOriginalDescription(data.milestone_description);
            setAchievementLevel(data.achievement_level as AchievementLevel);
            setNotes(data.notes || "");
            setRecordDate(data.record_date ? new Date(data.record_date).toISOString().split('T')[0] : "");
        } catch (error) {
            console.error("Error loading milestone:", error);
            toast({ title: "Error", description: "No se pudo cargar el hito", variant: "destructive" });
        } finally {
            setIsFetching(false);
        }
    };

    // Load extra info when child is selected
    useEffect(() => {
        if (!childId || !isOpen) return;
        
        const fetchDetails = async () => {
            try {
                const [catData, childData] = await Promise.all([
                    milestonesService.getCatalogForChild(parseInt(childId)),
                    milestonesService.getByChild(parseInt(childId))
                ]);
                setCatalogData(catData.catalog);
                const existing = new Set<string>();
                childData.milestones.forEach((m: any) => existing.add(m.milestone_description));
                setExistingDescriptions(existing);
            } catch (err) {
                console.error("Error loading catalog for dropdown", err);
            }
        };
        fetchDetails();
    }, [childId, isOpen, keepOpen]);

    // Available options logic
    const availableOptions = catalogData?.milestones?.[domain] 
        ? catalogData.milestones[domain].filter((item: string) => 
            !existingDescriptions.has(item) || (milestoneIdToEdit && item === originalDescription)
          )
        : [];

    const loadChildren = async () => {
        try {
            setIsLoadingChildren(true);
            const data = await childrenService.getAll();
            setChildrenList(data);
        } catch (error) {
            console.error("Error loading children:", error);
        } finally {
            setIsLoadingChildren(false);
        }
    };

    // Convert children to options for SearchableSelect
    const childOptions = childrenList.map(child => ({
        value: String(child.id),
        label: child.full_name || `${child.first_name} ${child.last_name}`
    }));

    const resetForm = () => {
        setChildId("");
        setDomain("");
        setDescription("");
        setOriginalDescription("");
        setAchievementLevel("en_proceso");
        setNotes("");
        setRecordDate(new Date().toISOString().split('T')[0]);
        setKeepOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!childId || !domain || !description) return;

        setIsLoading(true);
        try {
            const payload = {
                child_id: parseInt(childId),
                domain,
                milestone_description: description,
                achievement_level: achievementLevel,
                notes,
                record_date: recordDate
            };

            if (milestoneIdToEdit) {
                await milestonesService.update(milestoneIdToEdit, payload);
                toast({ title: "Éxito", description: "Hito actualizado correctamente" });
                setIsOpen(false);
                resetForm();
            } else {
                await milestonesService.create(payload);
                if (keepOpen) {
                    toast({ title: "Éxito", description: "Hito guardado. Puede seguir añadiendo áreas para este niño/a." });
                    // Locally update existing to hide it immediately
                    setExistingDescriptions(prev => new Set([...prev, description]));
                    setDomain("");
                    setDescription("");
                    setAchievementLevel("en_proceso");
                    setNotes("");
                } else {
                    toast({ title: "Éxito", description: "Hito registrado correctamente" });
                    setIsOpen(false);
                    resetForm();
                }
            }

            onSuccess?.();
        } catch (error) {
            console.error("Error saving milestone:", error);
            toast({ title: "Error", description: "No se pudo guardar el hito", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>{milestoneIdToEdit ? 'Editar Hito de Desarrollo' : 'Registrar Hito de Desarrollo'}</DialogTitle>
                    <DialogDescription>
                        {milestoneIdToEdit ? 'Modifique los datos del hito.' : 'Registre el avance de un hito del desarrollo infantil.'}
                    </DialogDescription>
                </DialogHeader>

                {isFetching ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Child Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="child">Niño/a *</Label>
                            {isLoadingChildren ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando niños...
                                </div>
                            ) : (
                                <SearchableSelect
                                    options={childOptions}
                                    value={childId}
                                    onValueChange={setChildId}
                                    placeholder="Seleccionar niño/a"
                                    searchPlaceholder="Buscar por nombre o apellido..."
                                    emptyMessage="No se encontraron niños"
                                    disabled={!!milestoneIdToEdit || !!preselectedChildId}
                                />
                            )}
                        </div>

                        {/* Record Date */}
                        <div className="space-y-2">
                            <Label htmlFor="recordDate">Fecha de Registro</Label>
                            <Input
                                id="recordDate"
                                type="date"
                                value={recordDate}
                                onChange={(e) => setRecordDate(e.target.value)}
                            />
                        </div>

                        {/* Domain */}
                        <div className="space-y-2">
                            <Label htmlFor="domain">Área de Desarrollo *</Label>
                            <Select value={domain} onValueChange={setDomain}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar área" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOMAINS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                            {d.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Milestone Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción del Hito *</Label>
                            {domain && catalogData ? (
                                availableOptions.length > 0 || (milestoneIdToEdit && description) ? (
                                    <Select value={description} onValueChange={setDescription}>
                                        <SelectTrigger className="h-auto py-2">
                                            <SelectValue placeholder="Seleccionar pregunta..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableOptions.map((opt: string, idx: number) => (
                                                <SelectItem key={idx} value={opt} className="whitespace-normal py-2 pr-8">
                                                    <span className="block text-sm leading-tight text-left">{opt}</span>
                                                </SelectItem>
                                            ))}
                                            {/* In case the custom description is not in catalog */}
                                            {milestoneIdToEdit && !availableOptions.includes(description) && description && (
                                                <SelectItem value={description} className="whitespace-normal py-2 pr-8">
                                                    <span className="block text-sm leading-tight text-left">{description}</span>
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="text-sm p-3 bg-green-500/10 text-green-600 rounded-md border border-green-500/20">
                                        ✅ Todos los hitos de esta área ya han sido evaluados.
                                    </div>
                                )
                            ) : (
                                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
                                    {!childId ? "Seleccione un niño/a primero" : "Seleccione el área de desarrollo para ver las opciones"}
                                </div>
                            )}
                        </div>

                        {/* Achievement Level */}
                        <div className="space-y-2">
                            <Label htmlFor="level">Nivel de Logro *</Label>
                            <Select value={achievementLevel} onValueChange={(v) => setAchievementLevel(v as AchievementLevel)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no_iniciado">
                                        🔴 Requiere Apoyo
                                    </SelectItem>
                                    <SelectItem value="en_proceso">
                                        🟡 En Desarrollo
                                    </SelectItem>
                                    <SelectItem value="adquirido">
                                        🟢 Logro Alcanzado
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Observaciones</Label>
                            <Textarea
                                id="notes"
                                placeholder="Notas adicionales..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        {!milestoneIdToEdit && (
                            <div className="flex items-center space-x-2 py-2">
                                <Checkbox 
                                    id="keepOpen" 
                                    checked={keepOpen} 
                                    onCheckedChange={(checked) => setKeepOpen(!!checked)} 
                                />
                                <Label htmlFor="keepOpen" className="text-sm font-normal cursor-pointer text-muted-foreground">
                                    Mantener abierto para añadir otro hito al mismo niño/a
                                </Label>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading || !childId || !domain || !description}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    "Guardar Hito"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
