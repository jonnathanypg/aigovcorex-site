"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { planningService, type LudicPlanning } from "@/services/planning.service";
import { authService } from "@/services/auth.service";
import Link from "next/link";
import {
    Gamepad2,
    Plus,
    Loader2,
    Pencil,
    Trash2,
    Search,
    Calendar,
    User,
    CheckCircle2,
    FileSpreadsheet,
    Clock,
    Target,
    Sparkles,
    Check,
    CheckCheck,
} from "lucide-react";

const AGE_GROUPS = [
    "12 a 18 meses",
    "19 a 24 meses",
    "25 a 30 meses",
    "31 a 36 meses",
    "37 a 42 meses"
];
const STATUS_OPTIONS = [
    { value: "borrador", label: "Borrador", color: "bg-yellow-500/10 text-yellow-700" },
    { value: "aprobado", label: "Aprobado", color: "bg-green-500/10 text-green-700" },
    { value: "revisado", label: "Revisado", color: "bg-blue-500/10 text-blue-700" },
];

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const AMBITOS_OPTIONS = [
    { value: "vinculacion_emocional", label: "Vinculación Emocional y Social" },
    { value: "descubrimiento_natural", label: "Descubrimiento Natural y Cultural" },
    { value: "manifestacion_lenguaje", label: "Manifestación del Lenguaje Verbal y No Verbal" },
    { value: "exploracion_corporal", label: "Exploración del Cuerpo y Motricidad" },
];

const emptyForm = {
    planning_date: new Date().toISOString().split("T")[0],
    age_group: "",
    week_number: undefined as number | undefined,
    month: "",
    year: new Date().getFullYear(),
    tema_integrador: "",
    nombre_actividad: "",
    objetivo: "",
    // Actividad 1 (Primera jornada / Mañana)
    actividad_1_nombre: "",
    actividad_1_ambito: "vinculacion_emocional",
    actividad_1_objetivo: "",
    actividad_1_destreza: "",
    actividad_1_indicador: "",
    // Actividad 2 (Segunda jornada / Tarde)
    actividad_2_nombre: "",
    actividad_2_ambito: "manifestacion_lenguaje",
    actividad_2_objetivo: "",
    actividad_2_destreza: "",
    actividad_2_indicador: "",
    // Ámbitos descriptivos generales
    ambito_vinculacion: "",
    ambito_descubrimiento: "",
    ambito_expresion: "",
    ambito_exploracion: "",
    indicador_general: "",
    observaciones: "",
    status: "borrador" as 'borrador' | 'aprobado' | 'revisado',
};

export default function PlanificacionesPage() {
    const [plannings, setPlannings] = useState<LudicPlanning[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filterAgeGroup, setFilterAgeGroup] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [formData, setFormData] = useState(emptyForm);
    const { toast } = useToast();

    const user = authService.getStoredUser();

    const loadPlannings = useCallback(async () => {
        setIsLoading(true);
        try {
            const filters: Record<string, string> = {};
            if (filterAgeGroup && filterAgeGroup !== 'all') filters.age_group = filterAgeGroup;
            if (filterStatus && filterStatus !== 'all') filters.status = filterStatus;
            const data = await planningService.list(filters);
            setPlannings(data.plannings);
        } catch {
            toast({ title: "Error", description: "No se pudieron cargar las planificaciones", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [filterAgeGroup, filterStatus, toast]);

    useEffect(() => { loadPlannings(); }, [loadPlannings]);
    useAgentRefresh(loadPlannings);

    const openCreate = () => {
        setEditingId(null);
        setFormData(emptyForm);
        setIsDialogOpen(true);
    };

    const openEdit = (p: LudicPlanning) => {
        setEditingId(p.id);
        const jInt = (p.momento_juego_intencionado as any) || {};
        const jLib = (p.momento_juego_libre as any) || {};
        const ind = (
            p.indicadores_logro && Array.isArray(p.indicadores_logro)
                ? p.indicadores_logro.join(", ")
                : (typeof p.indicadores_logro === 'string' ? p.indicadores_logro : (p.indicador || ""))
        );

        setFormData({
            planning_date: p.planning_date,
            age_group: p.age_group,
            week_number: p.week_number,
            month: p.month || "",
            year: p.year || new Date().getFullYear(),
            tema_integrador: p.tema_integrador || "",
            nombre_actividad: p.nombre_actividad,
            objetivo: p.objetivo || "",
            // Actividad 1
            actividad_1_nombre: jInt.nombre || p.nombre_actividad || "",
            actividad_1_ambito: jInt.ambito || "vinculacion_emocional",
            actividad_1_objetivo: jInt.objetivo || p.objetivo || "",
            actividad_1_destreza: jInt.destreza || p.ambito_vinculacion || "",
            actividad_1_indicador: jInt.indicador || ind || "",
            // Actividad 2
            actividad_2_nombre: jLib.nombre || "",
            actividad_2_ambito: jLib.ambito || "manifestacion_lenguaje",
            actividad_2_objetivo: jLib.objetivo || "",
            actividad_2_destreza: jLib.destreza || p.ambito_expresion || "",
            actividad_2_indicador: jLib.indicador || "",
            // Ámbitos
            ambito_vinculacion: p.ambito_vinculacion || "",
            ambito_descubrimiento: p.ambito_descubrimiento || "",
            ambito_expresion: p.ambito_expresion || "",
            ambito_exploracion: p.ambito_exploracion || "",
            indicador_general: ind,
            observaciones: p.observaciones || "",
            status: p.status,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        const nombrePrincipal = formData.actividad_1_nombre || formData.nombre_actividad;
        if (!nombrePrincipal || !formData.age_group) {
            toast({ title: "Campos requeridos", description: "Nombre de actividad y grupo etario son obligatorios", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            // Unificar objetivos e indicadores para compatibilidad backend y vistas PDF
            const objetivosList = [
                formData.actividad_1_objetivo ? `Objetivo 1: ${formData.actividad_1_objetivo}` : '',
                formData.actividad_2_objetivo ? `Objetivo 2: ${formData.actividad_2_objetivo}` : ''
            ].filter(Boolean);
            const objetivoConsolidado = objetivosList.length > 0 ? objetivosList.join('\n') : (formData.objetivo || '');

            const indicadoresList = [
                formData.actividad_1_indicador ? `Actividad 1: ${formData.actividad_1_indicador}` : '',
                formData.actividad_2_indicador ? `Actividad 2: ${formData.actividad_2_indicador}` : '',
                formData.indicador_general
            ].filter(Boolean);

            const payload: any = {
                ...formData,
                nombre_actividad: nombrePrincipal,
                objetivo: objetivoConsolidado,
                momento_juego_intencionado: {
                    nombre: formData.actividad_1_nombre || nombrePrincipal,
                    ambito: formData.actividad_1_ambito,
                    objetivo: formData.actividad_1_objetivo,
                    destreza: formData.actividad_1_destreza,
                    indicador: formData.actividad_1_indicador,
                },
                momento_juego_libre: {
                    nombre: formData.actividad_2_nombre,
                    ambito: formData.actividad_2_ambito,
                    objetivo: formData.actividad_2_objetivo,
                    destreza: formData.actividad_2_destreza,
                    indicador: formData.actividad_2_indicador,
                },
                indicadores_logro: indicadoresList,
            };

            // Mapeo retrocompatible a ámbitos si la actividad 1 o 2 los eligieron
            if (formData.actividad_1_ambito === 'vinculacion_emocional') payload.ambito_vinculacion = formData.actividad_1_destreza || payload.ambito_vinculacion;
            if (formData.actividad_1_ambito === 'descubrimiento_natural') payload.ambito_descubrimiento = formData.actividad_1_destreza || payload.ambito_descubrimiento;
            if (formData.actividad_1_ambito === 'manifestacion_lenguaje') payload.ambito_expresion = formData.actividad_1_destreza || payload.ambito_expresion;
            if (formData.actividad_1_ambito === 'exploracion_corporal') payload.ambito_exploracion = formData.actividad_1_destreza || payload.ambito_exploracion;

            if (formData.actividad_2_ambito === 'vinculacion_emocional') payload.ambito_vinculacion = formData.actividad_2_destreza || payload.ambito_vinculacion;
            if (formData.actividad_2_ambito === 'descubrimiento_natural') payload.ambito_descubrimiento = formData.actividad_2_destreza || payload.ambito_descubrimiento;
            if (formData.actividad_2_ambito === 'manifestacion_lenguaje') payload.ambito_expresion = formData.actividad_2_destreza || payload.ambito_expresion;
            if (formData.actividad_2_ambito === 'exploracion_corporal') payload.ambito_exploracion = formData.actividad_2_destreza || payload.ambito_exploracion;

            if (editingId) {
                await planningService.update(editingId, payload);
                toast({ title: "Actualizado", description: "Planificación actualizada exitosamente" });
            } else {
                await planningService.create(payload);
                toast({ title: "Creado", description: "Planificación creada exitosamente" });
            }
            setIsDialogOpen(false);
            loadPlannings();
        } catch (err: any) {
            toast({ title: "Error", description: err.response?.data?.error || "Error al guardar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar esta planificación?")) return;
        try {
            await planningService.delete(id);
            toast({ title: "Eliminado", description: "Planificación eliminada" });
            loadPlannings();
        } catch {
            toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: 'borrador' | 'revisado' | 'aprobado') => {
        try {
            await planningService.update(id, { status: newStatus });
            toast({
                title: newStatus === 'aprobado' ? "Planificación Aprobada" : newStatus === 'revisado' ? "Marcada como Revisada" : "En Borrador",
                description: `Estado actualizado a ${newStatus} correctamente.`,
            });
            loadPlannings();
        } catch (err: any) {
            toast({
                title: "Error al actualizar estado",
                description: err.response?.data?.error || "No se pudo actualizar el estado",
                variant: "destructive"
            });
        }
    };

    const filteredPlannings = plannings.filter((p) =>
        p.nombre_actividad.toLowerCase().includes(search.toLowerCase()) ||
        (p.tema_integrador || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.educator_name || "").toLowerCase().includes(search.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const opt = STATUS_OPTIONS.find((o) => o.value === status);
        return <Badge variant="outline" className={opt?.color}>{opt?.label || status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                        <Gamepad2 className="h-6 w-6 text-primary" />
                        Planificaciones Lúdicas
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Gestión de planificaciones de experiencias de aprendizaje
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link href="/informe-actividades">
                        <Button variant="outline" className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10">
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Informe Mensual de Actividades
                        </Button>
                    </Link>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Planificación
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por actividad, tema o educadora..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={filterAgeGroup} onValueChange={setFilterAgeGroup}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Grupo Etario" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {AGE_GROUPS.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredPlannings.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Gamepad2 className="mx-auto h-12 w-12 mb-4 opacity-30" />
                        <p>No hay planificaciones registradas.</p>
                        <p className="text-sm mt-1">Cree una nueva planificación o cargue varias desde CSV.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPlannings.map((p) => (
                        <Card key={p.id} className="hover:border-primary/30 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">{p.nombre_actividad}</CardTitle>
                                        {p.tema_integrador && (
                                            <CardDescription className="truncate">
                                                Tema: {p.tema_integrador}
                                            </CardDescription>
                                        )}
                                    </div>
                                    {getStatusBadge(p.status)}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>{p.planning_date}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <User className="h-3.5 w-3.5" />
                                        <span className="truncate">{p.educator_name}</span>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-xs">{p.age_group}</Badge>
                                {p.objetivo && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{p.objetivo}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(p)}>
                                        <Pencil className="h-3 w-3 mr-1" /> Editar
                                    </Button>

                                    {/* Botones rápidos de Revisión y Aprobación */}
                                    {p.status !== 'aprobado' ? (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-8 text-xs bg-green-500/10 text-green-700 hover:bg-green-500/20 border border-green-300"
                                            onClick={() => handleUpdateStatus(p.id, 'aprobado')}
                                            title="Aprobar Planificación"
                                        >
                                            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Aprobar
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-8 text-xs bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20"
                                            onClick={() => handleUpdateStatus(p.id, 'revisado')}
                                            title="Pasar a Revisado"
                                        >
                                            <Check className="h-3.5 w-3.5 mr-1" /> Revisado
                                        </Button>
                                    )}

                                    {p.status === 'borrador' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs text-blue-700 hover:bg-blue-50"
                                            onClick={() => handleUpdateStatus(p.id, 'revisado')}
                                        >
                                            Marcar Revisado
                                        </Button>
                                    )}

                                    <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? "Editar Planificación" : "Nueva Planificación Lúdica"}
                        </DialogTitle>
                        <DialogDescription>
                            Complete los datos de la experiencia de aprendizaje.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Row 1: Date, Age Group, Week */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>Fecha *</Label>
                                <Input type="date" value={formData.planning_date}
                                    onChange={(e) => setFormData({ ...formData, planning_date: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Grupo Etario *</Label>
                                <Select value={formData.age_group}
                                    onValueChange={(v) => setFormData({ ...formData, age_group: v })}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                                    <SelectContent>
                                        {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Semana #</Label>
                                <Input type="number" min={1} max={52} value={formData.week_number || ""}
                                    onChange={(e) => setFormData({ ...formData, week_number: e.target.value ? parseInt(e.target.value) : undefined })} />
                            </div>
                        </div>

                        {/* Row 2: Month, Year */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Mes</Label>
                                <Select value={formData.month}
                                    onValueChange={(v) => setFormData({ ...formData, month: v })}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Año</Label>
                                <Input type="number" value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        {/* Row 3: Tema Integrador */}
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-sm">Tema Integrador de la Semana *</Label>
                            <Input value={formData.tema_integrador}
                                onChange={(e) => setFormData({ ...formData, tema_integrador: e.target.value })}
                                placeholder="Ej: Conociendo los animales, Mi Familia, Descubriendo los colores..." />
                        </div>

                        {/* ACTIVIDAD 1 / PRIMERA JORNADA */}
                        <div className="border border-sky-300 rounded-lg p-4 space-y-3 bg-sky-50/40">
                            <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                                <h4 className="text-sm font-bold text-sky-900 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-sky-600" />
                                    Actividad 1 · Primera Jornada
                                </h4>
                                <Badge variant="secondary" className="bg-sky-100 text-sky-800 text-[10px]">
                                    Juego Intencionado
                                </Badge>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Nombre de la Actividad 1 *</Label>
                                <Input value={formData.actividad_1_nombre}
                                    onChange={(e) => setFormData({ ...formData, actividad_1_nombre: e.target.value, nombre_actividad: e.target.value })}
                                    placeholder="Ej: Reconozco los animales y los nombro" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Ámbito a Trabajar</Label>
                                    <Select value={formData.actividad_1_ambito}
                                        onValueChange={(v) => setFormData({ ...formData, actividad_1_ambito: v })}>
                                        <SelectTrigger><SelectValue placeholder="Seleccione ámbito..." /></SelectTrigger>
                                        <SelectContent>
                                            {AMBITOS_OPTIONS.map((a) => (
                                                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Indicador de Evaluación (Actividad 1)</Label>
                                    <Input value={formData.actividad_1_indicador}
                                        onChange={(e) => setFormData({ ...formData, actividad_1_indicador: e.target.value })}
                                        placeholder="Ej: Cumple consignas sencillas, imita sonidos..." />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Objetivo de Aprendizaje (Actividad 1)</Label>
                                <Textarea rows={2} value={formData.actividad_1_objetivo}
                                    onChange={(e) => setFormData({ ...formData, actividad_1_objetivo: e.target.value })}
                                    placeholder="Ej: Incrementar su capacidad de relacionarse positivamente con otras personas..." />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Descripción de la Destreza / Desarrollo del Juego</Label>
                                <Textarea rows={2} value={formData.actividad_1_destreza}
                                    onChange={(e) => setFormData({ ...formData, actividad_1_destreza: e.target.value })}
                                    placeholder="Inicio y exploración: Saludo con canción. Demostración y desarrollo: Espacios con animales..." />
                            </div>
                        </div>

                        {/* ACTIVIDAD 2 / SEGUNDA JORNADA */}
                        <div className="border border-emerald-300 rounded-lg p-4 space-y-3 bg-emerald-50/40">
                            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-emerald-600" />
                                    Actividad 2 · Segunda Jornada
                                </h4>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">
                                    Juego Libre / Lenguaje
                                </Badge>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Nombre de la Actividad 2</Label>
                                <Input value={formData.actividad_2_nombre}
                                    onChange={(e) => setFormData({ ...formData, actividad_2_nombre: e.target.value })}
                                    placeholder="Ej: Juego de lenguaje con títeres y cuentos" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Ámbito a Trabajar</Label>
                                    <Select value={formData.actividad_2_ambito}
                                        onValueChange={(v) => setFormData({ ...formData, actividad_2_ambito: v })}>
                                        <SelectTrigger><SelectValue placeholder="Seleccione ámbito..." /></SelectTrigger>
                                        <SelectContent>
                                            {AMBITOS_OPTIONS.map((a) => (
                                                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Indicador de Evaluación (Actividad 2)</Label>
                                    <Input value={formData.actividad_2_indicador}
                                        onChange={(e) => setFormData({ ...formData, actividad_2_indicador: e.target.value })}
                                        placeholder="Ej: Demuestra interés por imágenes y nombra animales..." />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Objetivo de Aprendizaje (Actividad 2)</Label>
                                <Textarea rows={2} value={formData.actividad_2_objetivo}
                                    onChange={(e) => setFormData({ ...formData, actividad_2_objetivo: e.target.value })}
                                    placeholder="Ej: Disfrutar de las imágenes y gráficos como medio de expresión..." />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Descripción de la Destreza / Desarrollo del Juego</Label>
                                <Textarea rows={2} value={formData.actividad_2_destreza}
                                    onChange={(e) => setFormData({ ...formData, actividad_2_destreza: e.target.value })}
                                    placeholder="Demostrar interés por las imágenes de cuentos y títeres. Rincón de lectura..." />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Observaciones Generales</Label>
                            <Textarea rows={2} value={formData.observaciones}
                                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                                placeholder="Notas adicionales sobre la jornada, adaptaciones o recursos especiales..." />
                        </div>

                        {/* Estado / Revisión y Aprobación */}
                        <div className="border border-border/80 rounded-lg p-3 bg-muted/30 flex items-center justify-between">
                            <div>
                                <Label className="text-xs font-semibold">Estado de la Planificación</Label>
                                <p className="text-[11px] text-muted-foreground">Define si está en borrador, revisada o aprobada para el centro.</p>
                            </div>
                            <Select
                                value={formData.status}
                                onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                            >
                                <SelectTrigger className="w-[160px] h-9">
                                    <SelectValue placeholder="Estado..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="borrador">Borrador</SelectItem>
                                    <SelectItem value="revisado">Revisado</SelectItem>
                                    <SelectItem value="aprobado">Aprobado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingId ? "Guardar Cambios" : "Crear Planificación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
