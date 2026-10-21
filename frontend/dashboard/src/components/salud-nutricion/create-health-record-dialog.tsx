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
import { authService } from "@/services/auth.service";

interface CreateHealthRecordDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    recordIdToEdit?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type RecordType = 'crecimiento' | 'vacunacion' | 'incidente' | 'enfermedad' | 'brigada_medica';

const VACCINE_CHECKLIST = [
    { id: 'bcg', name: 'BCG (Recién nacido)' },
    { id: 'hep_b', name: 'Hepatitis B (Recién nacido)' },
    { id: 'penta_1', name: 'Pentavalente 1ra (2m)' },
    { id: 'rota_1', name: 'Rotavirus 1ra (2m)' },
    { id: 'neumo_1', name: 'Neumococo 1ra (2m)' },
    { id: 'polio_1', name: 'Polio IPV 1ra (2m)' },
    { id: 'penta_2', name: 'Pentavalente 2da (4m)' },
    { id: 'rota_2', name: 'Rotavirus 2da (4m)' },
    { id: 'neumo_2', name: 'Neumococo 2da (4m)' },
    { id: 'polio_2', name: 'Polio IPV 2da (4m)' },
    { id: 'penta_3', name: 'Pentavalente 3ra (6m)' },
    { id: 'polio_3', name: 'Polio bOPV 3ra (6m)' },
    { id: 'srp_1', name: 'SRP 1ra (12m)' },
    { id: 'neumo_3', name: 'Neumococo 3ra (12m)' },
    { id: 'varicela', name: 'Varicela (12m)' },
    { id: 'fa', name: 'Fiebre Amarilla (15m)' },
    { id: 'dpt_ref1', name: 'DPT Refuerzo 1 (18m)' },
    { id: 'polio_ref1', name: 'Polio Refuerzo 1 (18m)' },
];

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
    const [vaccineScheme, setVaccineScheme] = useState<"completo" | "incompleto">("completo");
    const [vaccineName, setVaccineName] = useState("");
    const [vaccineDose, setVaccineDose] = useState("");
    const [pendingVaccines, setPendingVaccines] = useState("");
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
                const isInc = (record.notes || "").toLowerCase().includes("incompleto") || (record.vaccine_dose || "").toLowerCase().includes("incomplet");
                setVaccineScheme(isInc ? "incompleto" : "completo");
                setPendingVaccines((record as any).pending_vaccines || "");
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
        setVaccineScheme("completo");
        setVaccineName("Esquema Regular");
        setVaccineDose("Completo");
        setPendingVaccines("");
        setIncidentDescription("");
        setSymptoms("");
        setTreatment("");
        
        const currentUser = authService.getStoredUser();
        const defaultProfName = currentUser?.full_name || 
            (currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : "");
        setMedicalProfessional(defaultProfName);
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
                medical_professional: medicalProfessional.trim() || undefined,
                notes,
            };

            if (recordType === 'crecimiento') {
                if (weight) recordData.weight = parseFloat(weight);
                if (height) recordData.height = parseFloat(height);
                if (headCircumference) recordData.head_circumference = parseFloat(headCircumference);
            } else if (recordType === 'vacunacion') {
                recordData.vaccine_name = vaccineScheme === 'completo' ? (vaccineName || 'Esquema de Vacunación Completo') : (vaccineName || 'Esquema Incompleto');
                recordData.vaccine_dose = vaccineScheme === 'completo' ? 'Completo' : (vaccineDose || 'Incompleto');
                recordData.pending_vaccines = pendingVaccines;
                if (pendingVaccines) {
                    recordData.notes = recordData.notes
                        ? `${recordData.notes} | Pendientes: ${pendingVaccines}`
                        : `Vacunas pendientes: ${pendingVaccines}`;
                }
            } else {
                recordData.incident_description = incidentDescription;
                recordData.symptoms = symptoms;
                recordData.treatment = treatment;
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
                                <div className="space-y-2">
                                    <Label htmlFor="growth-professional">Profesional Evaluador / Médico / Nutricionista</Label>
                                    <Input
                                        id="growth-professional"
                                        placeholder="Nombre del profesional evaluador"
                                        value={medicalProfessional}
                                        onChange={(e) => setMedicalProfessional(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {recordType === 'vacunacion' && (
                            <>
                                <div className="space-y-2 border border-blue-200 bg-blue-50/40 p-3 rounded-lg">
                                    <Label className="text-xs font-semibold text-blue-900">Estado del Esquema de Vacunación *</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={vaccineScheme === 'completo' ? 'default' : 'outline'}
                                            className={`h-9 text-xs justify-center ${vaccineScheme === 'completo' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                                            onClick={() => {
                                                setVaccineScheme('completo');
                                                if (!vaccineName || vaccineName === 'Esquema Incompleto') setVaccineName('Esquema Regular');
                                                setVaccineDose('Completo');
                                            }}
                                        >
                                            ✓ Esquema Completo
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={vaccineScheme === 'incompleto' ? 'default' : 'outline'}
                                            className={`h-9 text-xs justify-center ${vaccineScheme === 'incompleto' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                                            onClick={() => {
                                                setVaccineScheme('incompleto');
                                                setVaccineDose('Incompleto');
                                            }}
                                        >
                                            ⚠️ Esquema Incompleto
                                        </Button>
                                    </div>
                                </div>

                                {vaccineScheme === 'incompleto' && (
                                    <div className="space-y-2 border border-amber-200 bg-amber-50/40 p-3 rounded-lg">
                                        <Label htmlFor="pendingVaccines" className="text-xs font-semibold text-amber-900">
                                            Vacunas Pendientes / Dosis Faltantes *
                                        </Label>
                                        <Input
                                            id="pendingVaccines"
                                            placeholder="Ej: Falta Neumococo 2da dosis, Pentavalente 3ra..."
                                            value={pendingVaccines}
                                            onChange={(e) => setPendingVaccines(e.target.value)}
                                            required={vaccineScheme === 'incompleto'}
                                        />
                                        
                                        {/* Cartilla MIES Selección Rápida */}
                                        <div className="pt-2">
                                            <Label className="text-[11px] font-medium text-amber-950 mb-1.5 block">
                                                Seleccionar de la Cartilla Oficial MIES para agregar a pendientes:
                                            </Label>
                                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white/70 rounded border border-amber-200">
                                                {VACCINE_CHECKLIST.map((vac) => {
                                                    const isSelected = pendingVaccines.includes(vac.name);
                                                    return (
                                                        <button
                                                            key={vac.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    const updated = pendingVaccines
                                                                        .split(', ')
                                                                        .filter(v => v.trim() !== vac.name)
                                                                        .join(', ');
                                                                    setPendingVaccines(updated);
                                                                } else {
                                                                    const updated = pendingVaccines 
                                                                        ? `${pendingVaccines}, ${vac.name}`
                                                                        : vac.name;
                                                                    setPendingVaccines(updated);
                                                                }
                                                            }}
                                                            className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                                                isSelected 
                                                                    ? 'bg-amber-600 text-white border-amber-700 font-medium' 
                                                                    : 'bg-white text-muted-foreground border-gray-200 hover:border-amber-400'
                                                            }`}
                                                        >
                                                            {isSelected ? '✓ ' : '+ '}{vac.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-amber-800/80">
                                            Estas vacunas pendientes se registrarán en observaciones para seguimiento prioritario.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="vaccineName">Nombre de Vacuna / Descripción</Label>
                                        <Input
                                            id="vaccineName"
                                            placeholder="BCG, Pentavalente, Rotavirus, etc."
                                            value={vaccineName}
                                            onChange={(e) => setVaccineName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="vaccineDose">Dosis / Detalle</Label>
                                        <Input
                                            id="vaccineDose"
                                            placeholder="1ra, 2da, Refuerzo, Al día..."
                                            value={vaccineDose}
                                            onChange={(e) => setVaccineDose(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="professional">Profesional de Salud / Responsable</Label>
                                    <Input
                                        id="professional"
                                        placeholder="Nombre del profesional de salud o enfermera"
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
