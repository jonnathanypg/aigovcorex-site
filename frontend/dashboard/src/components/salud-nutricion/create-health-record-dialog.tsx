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
import { healthService } from "@/services/health.service";
import { childrenService } from "@/services/children.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CreateHealthRecordDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    recordIdToEdit?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type RecordType = 'crecimiento' | 'vacunacion' | 'incidente' | 'enfermedad' | 'brigada_medica';

export function CreateHealthRecordDialog({ children, onSuccess, recordIdToEdit, open, onOpenChange }: CreateHealthRecordDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    // Controlled open state
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingRecord, setIsFetchingRecord] = useState(false);
    const [childrenList, setChildrenList] = useState<Child[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(true);
    const { toast } = useToast();

    // Form state
    const [childId, setChildId] = useState<string>("");
    const [recordDate, setRecordDate] = useState<string>("");
    const [recordType, setRecordType] = useState<RecordType>("crecimiento");
    const [weight, setWeight] = useState<string>("");
    const [height, setHeight] = useState<string>("");
    const [headCircumference, setHeadCircumference] = useState<string>("");
    const [vaccineName, setVaccineName] = useState("");
    const [vaccineDose, setVaccineDose] = useState("");
    const [incidentDescription, setIncidentDescription] = useState("");
    const [symptoms, setSymptoms] = useState("");
    const [treatment, setTreatment] = useState("");
    const [medicalProfessional, setMedicalProfessional] = useState("");
    const [notes, setNotes] = useState("");

    // Load children on open
    useEffect(() => {
        if (isOpen) {
            loadChildren();
            if (recordIdToEdit) {
                loadRecordDetails(recordIdToEdit);
            } else {
                resetForm();
            }
        }
    }, [isOpen, recordIdToEdit]);

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

    const loadRecordDetails = async (id: number) => {
        try {
            setIsFetchingRecord(true);
            const record = await healthService.getHealthRecord(id);

            setChildId(String(record.child_id));
            setRecordDate(record.record_date ? new Date(record.record_date).toISOString().split('T')[0] : "");
            setRecordType(record.record_type as RecordType);
            setNotes(record.notes || "");
            setMedicalProfessional(record.medical_professional || "");

            // Type specific fields
            if (record.record_type === 'crecimiento') {
                setWeight(record.weight || "");
                setHeight(record.height || "");
                setHeadCircumference(record.head_circumference || "");
            } else if (record.record_type === 'vacunacion') {
                setVaccineName(record.vaccine_name || "");
                setVaccineDose(record.vaccine_dose || "");
            } else {
                setIncidentDescription(record.incident_description || "");
                setSymptoms(record.symptoms || "");
                setTreatment(record.treatment || "");
            }
        } catch (error) {
            console.error("Error loading record:", error);
            toast({ title: "Error", description: "No se pudo cargar el registro", variant: "destructive" });
        } finally {
            setIsFetchingRecord(false);
        }
    };

    // Convert children to options for SearchableSelect
    const childOptions = childrenList.map(child => ({
        value: String(child.id),
        label: child.full_name || `${child.first_name} ${child.last_name}`,
        searchKeywords: child.cedula || undefined
    }));

    const resetForm = () => {
        setChildId("");
        setRecordDate(new Date().toISOString().split('T')[0]);
        setRecordType("crecimiento");
        setWeight("");
        setHeight("");
        setHeadCircumference("");
        setVaccineName("");
        setVaccineDose("");
        setIncidentDescription("");
        setSymptoms("");
        setTreatment("");
        setMedicalProfessional("");
        setNotes("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!childId) return;

        setIsLoading(true);
        try {
            const recordData: any = {
                record_type: recordType,
                record_date: recordDate || undefined,
                notes,
            };

            if (recordType === 'crecimiento') {
                if (weight) recordData.weight = parseFloat(weight);
                if (height) recordData.height = parseFloat(height);
                if (headCircumference) recordData.head_circumference = parseFloat(headCircumference);
            } else if (recordType === 'vacunacion') {
                recordData.vaccine_name = vaccineName;
                recordData.vaccine_dose = vaccineDose;
                recordData.medical_professional = medicalProfessional;
            } else {
                recordData.incident_description = incidentDescription;
                recordData.symptoms = symptoms;
                recordData.treatment = treatment;
                recordData.medical_professional = medicalProfessional;
            }

            if (recordIdToEdit) {
                await healthService.updateHealthRecord(recordIdToEdit, recordData);
                toast({ title: "Éxito", description: "Registro actualizado correctamente" });
            } else {
                await healthService.createHealthRecord(parseInt(childId), recordData);
                toast({ title: "Éxito", description: "Registro creado correctamente" });
            }

            setIsOpen(false);
            resetForm();
            onSuccess?.();
        } catch (error) {
            console.error("Error saving health record:", error);
            toast({ title: "Error", description: "No se pudo guardar el registro", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>{recordIdToEdit ? 'Editar Registro de Salud' : 'Nuevo Registro de Salud'}</DialogTitle>
                    <DialogDescription>
                        {recordIdToEdit ? 'Modifique los datos del control o incidente.' : 'Complete los datos del control o incidente de salud.'}
                    </DialogDescription>
                </DialogHeader>

                {isFetchingRecord ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Child Selection - Disabled if editing (usually shouldn't change child) */}
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
                                    disabled={!!recordIdToEdit}
                                />
                            )}
                        </div>

                        {/* Record Date */}
                        <div className="space-y-2">
                            <Label htmlFor="recordDate">Fecha del Registro</Label>
                            <Input
                                id="recordDate"
                                type="date"
                                value={recordDate}
                                onChange={(e) => setRecordDate(e.target.value)}
                            />
                        </div>

                        {/* Record Type */}
                        <div className="space-y-2">
                            <Label htmlFor="recordType">Tipo de Registro *</Label>
                            <Select value={recordType} onValueChange={(v) => setRecordType(v as RecordType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="crecimiento">Control de Crecimiento</SelectItem>
                                    <SelectItem value="vacunacion">Vacunación</SelectItem>
                                    <SelectItem value="incidente">Incidente</SelectItem>
                                    <SelectItem value="enfermedad">Enfermedad</SelectItem>
                                    <SelectItem value="brigada_medica">Brigada Médica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Conditional Fields based on Record Type */}
                        {recordType === 'crecimiento' && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="weight">Peso (kg)</Label>
                                        <Input
                                            id="weight"
                                            type="number"
                                            step="0.1"
                                            placeholder="12.5"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="height">Talla (cm)</Label>
                                        <Input
                                            id="height"
                                            type="number"
                                            step="0.1"
                                            placeholder="85.0"
                                            value={height}
                                            onChange={(e) => setHeight(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="head">P. Cefálico</Label>
                                        <Input
                                            id="head"
                                            type="number"
                                            step="0.1"
                                            placeholder="47.0"
                                            value={headCircumference}
                                            onChange={(e) => setHeadCircumference(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {recordType === 'vacunacion' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="vaccineName">Nombre de Vacuna *</Label>
                                        <Input
                                            id="vaccineName"
                                            placeholder="BCG, Pentavalente, etc."
                                            value={vaccineName}
                                            onChange={(e) => setVaccineName(e.target.value)}
                                            required={recordType === 'vacunacion'}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="vaccineDose">Dosis</Label>
                                        <Input
                                            id="vaccineDose"
                                            placeholder="1ra, 2da, Refuerzo..."
                                            value={vaccineDose}
                                            onChange={(e) => setVaccineDose(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="professional">Profesional de Salud</Label>
                                    <Input
                                        id="professional"
                                        placeholder="Nombre del profesional"
                                        value={medicalProfessional}
                                        onChange={(e) => setMedicalProfessional(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {(recordType === 'incidente' || recordType === 'enfermedad' || recordType === 'brigada_medica') && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Descripción del {recordType === 'incidente' ? 'Incidente' : 'Caso'} *</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describa lo ocurrido..."
                                        value={incidentDescription}
                                        onChange={(e) => setIncidentDescription(e.target.value)}
                                        required={recordType === 'incidente' || recordType === 'enfermedad'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="symptoms">Síntomas</Label>
                                    <Input
                                        id="symptoms"
                                        placeholder="Síntomas observados"
                                        value={symptoms}
                                        onChange={(e) => setSymptoms(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="treatment">Tratamiento Aplicado</Label>
                                    <Input
                                        id="treatment"
                                        placeholder="Tratamiento o acción tomada"
                                        value={treatment}
                                        onChange={(e) => setTreatment(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="professional">Profesional Médico</Label>
                                    <Input
                                        id="professional"
                                        placeholder="Nombre del profesional"
                                        value={medicalProfessional}
                                        onChange={(e) => setMedicalProfessional(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {/* Notes - Common */}
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
                            <Button type="submit" disabled={isLoading || !childId}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    "Guardar Registro"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
