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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { interventionsService } from "@/services/interventions.service";
import { childrenService } from "@/services/children.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CreateInterventionDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    interventionIdToEdit?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

interface FamilyOption {
    id: number;
    name: string;
    childName: string;
}

const INTERVENTION_TYPES = [
    { value: 'visita_domiciliaria', label: 'Visita Domiciliaria' },
    { value: 'entrevista', label: 'Entrevista' },
    { value: 'seguimiento', label: 'Seguimiento' },
    { value: 'taller', label: 'Taller' },
    { value: 'coordinacion', label: 'Coordinación Interinstitucional' },
    { value: 'crisis', label: 'Intervención en Crisis' },
];

const RELATIONSHIP_OPTIONS = [
    { value: 'madre', label: 'Madre' },
    { value: 'padre', label: 'Padre' },
    { value: 'abuelo', label: 'Abuelo/a' },
    { value: 'tio', label: 'Tío/a' },
    { value: 'hermano', label: 'Hermano/a' },
    { value: 'tutor_legal', label: 'Tutor Legal' },
    { value: 'otro', label: 'Otro' },
];

export function CreateInterventionDialog({ children, onSuccess, interventionIdToEdit, open, onOpenChange }: CreateInterventionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
    const [families, setFamilies] = useState<FamilyOption[]>([]);
    const { toast } = useToast();

    // Form state
    const [familyId, setFamilyId] = useState<string>("");
    const [date, setDate] = useState("");
    const [type, setType] = useState("");
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [status, setStatus] = useState("programada");
    const [intervieweeName, setIntervieweeName] = useState("");
    const [intervieweeRelationship, setIntervieweeRelationship] = useState("");

    // Load families from active children when dialog opens
    useEffect(() => {
        if (isOpen) {
            loadFamilies();
            if (interventionIdToEdit) {
                loadIntervention(interventionIdToEdit);
            } else {
                resetForm();
            }
        }
    }, [isOpen, interventionIdToEdit]);

    const loadIntervention = async (id: number) => {
        try {
            setIsFetching(true);
            const data = await interventionsService.getById(id);
            setFamilyId(String(data.family_id));
            setDate(data.date ? new Date(data.date).toISOString().split('T')[0] : "");
            setType(data.type);
            setReason(data.reason);
            setNotes(data.notes || "");
            setStatus(data.status);
            setIntervieweeName(data.interviewee_name || "");
            setIntervieweeRelationship(data.interviewee_relationship || "");
        } catch (error) {
            console.error("Error loading intervention:", error);
            toast({ title: "Error", description: "No se pudo cargar la intervención", variant: "destructive" });
        } finally {
            setIsFetching(false);
        }
    };

    const loadFamilies = async () => {
        try {
            setIsLoadingFamilies(true);
            const childrenData = await childrenService.getAll({ status: 'activo' });

            // Extract unique families from children
            const familyMap = new Map<number, FamilyOption>();
            childrenData.forEach((child: Child) => {
                if (child.family_id && !familyMap.has(child.family_id)) {
                    familyMap.set(child.family_id, {
                        id: child.family_id,
                        name: child.last_name || child.full_name,  // Show just last names (apellidos)
                        childName: child.full_name
                    });
                }
            });

            setFamilies(Array.from(familyMap.values()));
        } catch (error) {
            console.error("Error loading families:", error);
        } finally {
            setIsLoadingFamilies(false);
        }
    };

    // Convert families to options for SearchableSelect
    const familyOptions = families.map(family => ({
        value: String(family.id),
        label: family.name
    }));

    const resetForm = () => {
        setFamilyId("");
        setDate("");
        setType("");
        setReason("");
        setNotes("");
        setStatus("programada");
        setIntervieweeName("");
        setIntervieweeRelationship("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!familyId || !date || !type || !reason) return;

        setIsLoading(true);
        try {
            const data = {
                family_id: parseInt(familyId),
                date,
                type,
                reason,
                notes,
                status,
                interviewee_name: intervieweeName,
                interviewee_relationship: intervieweeRelationship
            };

            if (interventionIdToEdit) {
                await interventionsService.update(interventionIdToEdit, data);
                toast({ title: "Éxito", description: "Intervención actualizada correctamente" });
            } else {
                await interventionsService.create(data);
                toast({ title: "Éxito", description: "Intervención creada correctamente" });
            }

            setIsOpen(false);
            resetForm();
            onSuccess?.();
        } catch (error) {
            console.error("Error saving intervention:", error);
            toast({ title: "Error", description: "No se pudo guardar la intervención", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>{interventionIdToEdit ? 'Editar Intervención' : 'Nueva Intervención Familiar'}</DialogTitle>
                    <DialogDescription>
                        {interventionIdToEdit ? 'Modifique los datos de la intervención.' : 'Registre una nueva intervención o visita familiar.'}
                    </DialogDescription>
                </DialogHeader>

                {isFetching ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="family">Familia *</Label>
                            {isLoadingFamilies ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando familias...
                                </div>
                            ) : (
                                <SearchableSelect
                                    options={familyOptions}
                                    value={familyId}
                                    onValueChange={setFamilyId}
                                    placeholder="Seleccionar familia"
                                    searchPlaceholder="Buscar por apellido..."
                                    emptyMessage="No se encontraron familias"
                                    disabled={!!interventionIdToEdit}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="date">Fecha *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Intervención *</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INTERVENTION_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {interventionIdToEdit && (
                            <div className="space-y-2">
                                <Label htmlFor="status">Estado</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="programada">Programada</SelectItem>
                                        <SelectItem value="realizada">Realizada</SelectItem>
                                        <SelectItem value="cancelada">Cancelada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="reason">Motivo de la Intervención *</Label>
                            <Textarea
                                id="reason"
                                placeholder="Describa el motivo de la intervención..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="intervieweeName">Persona Entrevistada</Label>
                                <Input
                                    id="intervieweeName"
                                    placeholder="Nombre del entrevistado"
                                    value={intervieweeName}
                                    onChange={(e) => setIntervieweeName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="intervieweeRelationship">Parentesco</Label>
                                <Select value={intervieweeRelationship} onValueChange={setIntervieweeRelationship}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RELATIONSHIP_OPTIONS.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {r.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notas Adicionales</Label>
                            <Textarea
                                id="notes"
                                placeholder="Observaciones..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading || !familyId || !date || !type || !reason}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    "Guardar Intervención"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
