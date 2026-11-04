"use client";

import { useEffect, useState } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cmciService, type CmciCronogramaData, type CmciCronogramaActividad } from "@/services/cmci.service";
import { authService } from "@/services/auth.service";
import Link from "next/link";
import {
  CalendarDays,
  Printer,
  Pencil,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Lock,
  Sparkles,
  Building2,
  Calendar,
  FileCheck2,
} from "lucide-react";

export default function CronogramaPage() {
  const [data, setData] = useState<CmciCronogramaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterResponsable, setFilterResponsable] = useState("all");
  const { toast } = useToast();

  // Edición para license_admin
  const [editingActividad, setEditingActividad] = useState<CmciCronogramaActividad | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const crono = await cmciService.getCronograma();
      setData(crono);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar el cronograma.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    authService.getCurrentUser().then(setCurrentUser).catch(() => {
      setCurrentUser(authService.getStoredUser());
    });
  }, []);

  const role = (currentUser?.role || "").toLowerCase();
  const canEdit = role === "license_admin" || role === "super_admin";

  const totalActividades = data?.actividades.length || 0;
  const ejecutadas = data?.actividades.filter((a) => a.estado.toUpperCase() === "EJECUTADA").length || 0;
  const enProceso = data?.actividades.filter((a) => a.estado.toUpperCase() === "EN PROCESO").length || 0;
  const pendientes = data?.actividades.filter((a) => a.estado.toUpperCase() === "PENDIENTE").length || 0;
  const noEjecutadas = data?.actividades.filter((a) => a.estado.toUpperCase() === "NO EJECUTADA").length || 0;
  const pctCumplimiento = totalActividades > 0 ? Math.round((ejecutadas / totalActividades) * 100) : 0;

  const handleSaveActivity = async () => {
    if (!editingActividad || !data || !canEdit) return;
    setIsSaving(true);
    try {
      const updatedActividades = data.actividades.map((a) =>
        a.id === editingActividad.id ? editingActividad : a
      );
      const updatedData: CmciCronogramaData = {
        ...data,
        actividades: updatedActividades,
      };
      await cmciService.updateCronograma(updatedData);
      setData(updatedData);
      toast({
        title: "Actividad Actualizada",
        description: `Se guardaron los cambios de la actividad #${editingActividad.id}.`,
      });
      setEditingActividad(null);
    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err?.message || "No se pudo actualizar la actividad.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado
  const filteredActividades = (data?.actividades || []).filter((a) => {
    const matchSearch =
      a.tarea.toLowerCase().includes(search.toLowerCase()) ||
      a.responsable.toLowerCase().includes(search.toLowerCase()) ||
      a.producto.toLowerCase().includes(search.toLowerCase()) ||
      (a.evidencia_observaciones || "").toLowerCase().includes(search.toLowerCase());

    const matchEstado =
      filterEstado === "all" ||
      a.estado.toUpperCase() === filterEstado.toUpperCase();

    const matchResponsable =
      filterResponsable === "all" ||
      a.responsable.toLowerCase().includes(filterResponsable.toLowerCase());

    return matchSearch && matchEstado && matchResponsable;
  });

  const getStatusBadge = (estado: string) => {
    const st = estado.toUpperCase();
    if (st === "EJECUTADA") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Ejecutada
        </Badge>
      );
    }
    if (st === "EN PROCESO") {
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-medium">
          <Clock className="w-3 h-3 mr-1" /> En Proceso
        </Badge>
      );
    }
    if (st === "NO EJECUTADA") {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/30 font-medium">
          <XCircle className="w-3 h-3 mr-1" /> No Ejecutada
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground border-slate-700">
        <AlertCircle className="w-3 h-3 mr-1" /> Pendiente
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Cronograma Operativo CMCI
            </h1>
            {canEdit ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs py-0.5">
                <Sparkles className="w-3 h-3 mr-1" /> Edición Habilitada (Admin Licencia)
              </Badge>
            ) : (
              <Badge variant="outline" className="border-slate-700 text-muted-foreground text-xs py-0.5">
                <Lock className="w-3 h-3 mr-1" /> Solo Lectura ({currentUser?.role || "Personal"})
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Matriz de seguimiento técnico-administrativo y control de ejecución — Primer Período (29 sep – 29 oct)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/planificaciones/cronograma-print" target="_blank">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <Printer className="mr-2 h-4 w-4" /> Imprimir / Descargar PDF (A4 Membretado)
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards de Avance */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Tareas</p>
            <div className="text-2xl font-bold mt-1 text-foreground">{totalActividades}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Mes 1 Operativo</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Ejecutadas</p>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{ejecutadas}</div>
            <p className="text-[11px] text-emerald-500/70 mt-0.5">Con evidencias OK</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">En Proceso</p>
            <div className="text-2xl font-bold mt-1 text-amber-400">{enProceso}</div>
            <p className="text-[11px] text-amber-500/70 mt-0.5">En despliegue activo</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pendientes</p>
            <div className="text-2xl font-bold mt-1 text-foreground">{pendientes}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Por iniciar</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider">% Cumplimiento</p>
            <div className="text-2xl font-bold mt-1 text-blue-400">{pctCumplimiento}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pctCumplimiento}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hitos Principales */}
      {data?.hitos && data.hitos.length > 0 && (
        <Card className="bg-card/40 border-border">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-primary" /> Hitos Clave del Período Operativo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.hitos.map((h, idx) => (
              <div key={idx} className="bg-secondary/20 p-3 rounded-lg border border-border/50 text-xs">
                <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px] mb-1">
                  {h.fecha}
                </span>
                <p className="text-muted-foreground leading-snug">{h.descripcion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filtros de Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por actividad, responsable o producto esperado..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Estados</SelectItem>
            <SelectItem value="EJECUTADA">Ejecutada</SelectItem>
            <SelectItem value="EN PROCESO">En Proceso</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="NO EJECUTADA">No Ejecutada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResponsable} onValueChange={setFilterResponsable}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Responsables</SelectItem>
            <SelectItem value="Coordinador/a General">Coordinador/a General</SelectItem>
            <SelectItem value="Coordinadores/as CMCI">Coordinadores/as CMCI</SelectItem>
            <SelectItem value="Médicos/as">Médicos/as</SelectItem>
            <SelectItem value="Nutricionista">Nutricionista</SelectItem>
            <SelectItem value="Psicólogo">Equipo Psicosocial</SelectItem>
            <SelectItem value="Técnico/a Administrativo">Técnico/a Administrativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de Actividades de la Interfaz Estándar */}
      <Card className="border-border">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Matriz de Ejecución y Productos ({filteredActividades.length} actividades)
            </CardTitle>
            <CardDescription className="text-xs">
              Centros adscritos: CMCI Bahía · CMCI Guasmo · CMCI Orquídeas
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-semibold">
                <tr>
                  <th className="p-3 w-10 text-center">Nº</th>
                  <th className="p-3 w-28">Fecha / Período</th>
                  <th className="p-3">Actividad / Tarea</th>
                  <th className="p-3 w-40">Responsable</th>
                  <th className="p-3 w-56">Producto Esperado</th>
                  <th className="p-3 w-48">Medio de Verificación / Evidencias</th>
                  <th className="p-3 w-28 text-center">Estado</th>
                  {canEdit && <th className="p-3 w-16 text-center">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredActividades.map((act) => (
                  <tr key={act.id} className="hover:bg-secondary/15 transition-colors">
                    <td className="p-3 text-center font-bold text-muted-foreground">{act.id}</td>
                    <td className="p-3 font-medium whitespace-nowrap text-foreground">{act.periodo}</td>
                    <td className="p-3 font-medium text-foreground">
                      <div>{act.tarea}</div>
                      {act.apoyo && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          <span className="font-semibold">Apoyo:</span> {act.apoyo}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{act.responsable}</td>
                    <td className="p-3 text-muted-foreground">{act.producto}</td>
                    <td className="p-3 text-muted-foreground">
                      <div>{act.medio_verificacion}</div>
                      {act.evidencia_observaciones && (
                        <div className="mt-1 text-[10px] bg-primary/5 text-primary border border-primary/20 p-1.5 rounded">
                          <strong>Observaciones:</strong> {act.evidencia_observaciones}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">{getStatusBadge(act.estado)}</td>
                    {canEdit && (
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-primary/20 hover:text-primary"
                          onClick={() => setEditingActividad({ ...act })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edición Directa Exclusiva para License Admin */}
      {canEdit && editingActividad && (
        <Dialog open={!!editingActividad} onOpenChange={(open) => !open && setEditingActividad(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Editar Actividad #{editingActividad.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="text-xs">Actividad / Tarea</Label>
                <Textarea
                  className="text-xs mt-1"
                  rows={2}
                  value={editingActividad.tarea}
                  onChange={(e) => setEditingActividad({ ...editingActividad, tarea: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fecha / Período</Label>
                  <Input
                    className="text-xs mt-1"
                    value={editingActividad.periodo}
                    onChange={(e) => setEditingActividad({ ...editingActividad, periodo: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Estado de Ejecución</Label>
                  <Select
                    value={editingActividad.estado}
                    onValueChange={(val) => setEditingActividad({ ...editingActividad, estado: val })}
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                      <SelectItem value="EN PROCESO">EN PROCESO</SelectItem>
                      <SelectItem value="EJECUTADA">EJECUTADA</SelectItem>
                      <SelectItem value="NO EJECUTADA">NO EJECUTADA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Responsable Principal</Label>
                  <Input
                    className="text-xs mt-1"
                    value={editingActividad.responsable}
                    onChange={(e) => setEditingActividad({ ...editingActividad, responsable: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Apoyo / Coordinación</Label>
                  <Input
                    className="text-xs mt-1"
                    value={editingActividad.apoyo}
                    onChange={(e) => setEditingActividad({ ...editingActividad, apoyo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Producto / Resultado Esperado</Label>
                <Input
                  className="text-xs mt-1"
                  value={editingActividad.producto}
                  onChange={(e) => setEditingActividad({ ...editingActividad, producto: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Medio de Verificación</Label>
                <Input
                  className="text-xs mt-1"
                  value={editingActividad.medio_verificacion}
                  onChange={(e) => setEditingActividad({ ...editingActividad, medio_verificacion: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Evidencias u Observaciones</Label>
                <Textarea
                  className="text-xs mt-1"
                  rows={2}
                  placeholder="Registre avances, número de acta, firmas o justificación..."
                  value={editingActividad.evidencia_observaciones}
                  onChange={(e) => setEditingActividad({ ...editingActividad, evidencia_observaciones: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingActividad(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveActivity} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
