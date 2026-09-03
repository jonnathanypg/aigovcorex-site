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
} from "lucide-react";

const AGE_GROUPS = ["12-18 meses", "18-24 meses", "24-36 meses"];
const STATUS_OPTIONS = [
    { value: "borrador", label: "Borrador", color: "bg-yellow-500/10 text-yellow-700" },
    { value: "aprobado", label: "Aprobado", color: "bg-green-500/10 text-green-700" },
    { value: "revisado", label: "Revisado", color: "bg-blue-500/10 text-blue-700" },
];

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
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
    ambito_vinculacion: "",
    ambito_descubrimiento: "",
    ambito_expresion: "",
    ambito_exploracion: "",
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
        setFormData({
            planning_date: p.planning_date,
            age_group: p.age_group,
            week_number: p.week_number,
            month: p.month || "",
            year: p.year || new Date().getFullYear(),
            tema_integrador: p.tema_integrador || "",
            nombre_actividad: p.nombre_actividad,
            objetivo: p.objetivo || "",
            ambito_vinculacion: p.ambito_vinculacion || "",
            ambito_descubrimiento: p.ambito_descubrimiento || "",
            ambito_expresion: p.ambito_expresion || "",
            ambito_exploracion: p.ambito_exploracion || "",
            observaciones: p.observaciones || "",
            status: p.status,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.nombre_actividad || !formData.age_group) {
            toast({ title: "Campos requeridos", description: "Nombre de actividad y grupo etario son obligatorios", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            if (editingId) {
                await planningService.update(editingId, formData);
                toast({ title: "Actualizado", description: "Planificación actualizada exitosamente" });
            } else {
                await planningService.create(formData);
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
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Planificación
                </Button>
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
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
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

                        {/* Row 3: Tema, Actividad */}
                        <div className="space-y-1.5">
                            <Label>Tema Integrador</Label>
                            <Input value={formData.tema_integrador}
                                onChange={(e) => setFormData({ ...formData, tema_integrador: e.target.value })}
                                placeholder="Ej: Mi Familia, Los Animales..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nombre de la Actividad *</Label>
                            <Input value={formData.nombre_actividad}
                                onChange={(e) => setFormData({ ...formData, nombre_actividad: e.target.value })}
                                placeholder="Ej: Descubriendo los colores" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Objetivo de Aprendizaje</Label>
                            <Textarea rows={2} value={formData.objetivo}
                                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                                placeholder="Ej: Identificar colores primarios mediante el juego" />
                        </div>

                        {/* Ámbitos */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                Ámbitos de Desarrollo
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Vinculación Emocional</Label>
                                    <Textarea rows={2} value={formData.ambito_vinculacion}
                                        onChange={(e) => setFormData({ ...formData, ambito_vinculacion: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Descubrimiento Natural</Label>
                                    <Textarea rows={2} value={formData.ambito_descubrimiento}
                                        onChange={(e) => setFormData({ ...formData, ambito_descubrimiento: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Expresión/Lenguaje</Label>
                                    <Textarea rows={2} value={formData.ambito_expresion}
                                        onChange={(e) => setFormData({ ...formData, ambito_expresion: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Exploración Corporal</Label>
                                    <Textarea rows={2} value={formData.ambito_exploracion}
                                        onChange={(e) => setFormData({ ...formData, ambito_exploracion: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Observaciones</Label>
                            <Textarea rows={2} value={formData.observaciones}
                                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} />
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
