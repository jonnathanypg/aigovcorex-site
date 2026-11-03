"use client";

import { useEffect, useState, Suspense } from "react";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService, type CmciCronogramaData, type CmciCronogramaActividad } from "@/services/cmci.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { authService } from "@/services/auth.service";
import { resolvePrintBannerUrl } from "@/components/cmci/print-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, ShieldAlert, CheckCircle2, Lock } from "lucide-react";

export default function CmciCronogramaPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando cronograma…</p>}>
      <CmciCronogramaPrintInner />
    </Suspense>
  );
}

function CmciCronogramaPrintInner() {
  const [data, setData] = useState<CmciCronogramaData | null>(null);
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal de edición reservado para license_admin
  const [editingActividad, setEditingActividad] = useState<CmciCronogramaActividad | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    cmciService.getCronograma().then(setData).catch(() => setData(null));
    licenseAdminService.getPublicConfig().then(setOrgConfig).catch(() => setOrgConfig(null));
    authService.getCurrentUser().then(setCurrentUser).catch(() => {
      const stored = authService.getStoredUser();
      setCurrentUser(stored);
    });
  }, []);

  const role = (currentUser?.role || "").toLowerCase();
  // Solo license_admin y super_admin tienen permiso de edición
  const canEdit = role === "license_admin" || role === "super_admin";

  const headerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path) || "/membretes/membrete-gasiba-cabezera.png";
  const footerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path) || "/membretes/membrete-gasiba-pie.png";

  const totalActividades = data?.actividades.length || 0;
  const ejecutadas = data?.actividades.filter(a => a.estado.toUpperCase() === "EJECUTADA").length || 0;
  const enProceso = data?.actividades.filter(a => a.estado.toUpperCase() === "EN PROCESO").length || 0;
  const pendientes = data?.actividades.filter(a => a.estado.toUpperCase() === "PENDIENTE").length || 0;
  const noEjecutadas = data?.actividades.filter(a => a.estado.toUpperCase() === "NO EJECUTADA").length || 0;
  const pctCumplimiento = totalActividades > 0 ? Math.round((ejecutadas / totalActividades) * 100) : 0;

  const handleSaveActivity = async () => {
    if (!editingActividad || !data || !canEdit) return;
    setIsSaving(true);
    try {
      const updatedActividades = data.actividades.map(a =>
        a.id === editingActividad.id ? editingActividad : a
      );
      const updatedData: CmciCronogramaData = {
        ...data,
        actividades: updatedActividades,
      };
      await cmciService.updateCronograma(updatedData);
      setData(updatedData);
      toast.success("Actividad actualizada correctamente");
      setEditingActividad(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar actividad");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="print-letterhead-document bg-white text-black min-h-screen">
      {/* Barra de Herramientas y Control de Rol (Oculta al imprimir) */}
      <div className="print:hidden p-4 bg-slate-900 text-white border-b flex flex-wrap justify-between items-center max-w-5xl mx-auto w-full gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm tracking-wide">Cronograma y Control de Ejecución (Mes 1)</h2>
            {canEdit ? (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Modo Edición (Administrador de Licencia)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                <Lock className="w-3 h-3" /> Solo Lectura ({currentUser?.role || "Personal Autorizado"})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {canEdit
              ? "Usted tiene permisos de Administrador de Licencia para modificar estados, fechas y evidencias."
              : "Vista institucional con formato oficial de impresión A4 con membrete. Edición restringida a Administrador de Licencia."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {/* Cabecera membretada fija por CSS */}
      {headerUrl && (
        <div className="print-letterhead-header" aria-hidden="true">
          <img src={headerUrl} alt="Cabecera oficial" />
        </div>
      )}

      {/* Estructura semántica thead / tfoot: reserva márgenes exactos de membrete en CADA hoja impresa sin límite de páginas */}
      <table className="print-letterhead-table w-full">
        <thead>
          <tr>
            <td className="print-letterhead-top-spacer h-[28mm]" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="print-letterhead-content px-8 py-2">
              {/* Título y Datos Principales */}
              <div className="border-b border-black pb-2 mb-4 text-center">
                <span className="text-[10px] tracking-widest font-semibold uppercase text-slate-600">
                  DASE-EP · GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DE GUAYAQUIL
                </span>
                <h1 className="text-sm font-black uppercase text-slate-900 mt-1">
                  CRONOGRAMA DE TRABAJO Y CONTROL DE EJECUCIÓN OPERATIVA — MES 1
                </h1>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  Centros Municipales de Cuidado Infantil: CMCI Bahía | CMCI Guasmo | CMCI Orquídeas
                </p>
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-2 pt-1 border-t border-slate-200">
                  <span><strong>Período:</strong> {data?.periodo || "29 de septiembre al 29 de octubre de 2026"}</span>
                  <span><strong>Corte:</strong> {new Date().toISOString().slice(0, 10)}</span>
                  <span><strong>Avance General:</strong> {pctCumplimiento}%</span>
                </div>
              </div>

              {/* Resumen Ejecutivo de Avance */}
              <div className="mb-4 bg-slate-50 border border-slate-300 rounded p-2 text-xs">
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="p-1 border-r border-slate-200">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Total Tareas</span>
                    <span className="text-sm font-black">{totalActividades}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-emerald-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Ejecutadas</span>
                    <span className="text-sm font-black">{ejecutadas}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-amber-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">En Proceso</span>
                    <span className="text-sm font-black">{enProceso}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-slate-700">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Pendientes</span>
                    <span className="text-sm font-black">{pendientes}</span>
                  </div>
                  <div className="p-1 text-blue-900">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">% Cumplimiento</span>
                    <span className="text-sm font-black">{pctCumplimiento}%</span>
                  </div>
                </div>
              </div>

              {/* Hitos Clave del Período */}
              {data?.hitos && data.hitos.length > 0 && (
                <div className="mb-4 break-inside-avoid">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-400 pb-0.5 mb-2">
                    Hitos Principales del Primer Período
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                    {data.hitos.map((h, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                          {h.fecha}
                        </span>
                        <span className="text-slate-700 leading-tight">{h.descripcion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matriz Completa de Actividades (18 Tareas) */}
              <div className="mb-6">
                <div className="flex justify-between items-center border-b border-slate-400 pb-0.5 mb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                    Matriz de Actividades y Productos Esperados
                  </h3>
                  {canEdit && (
                    <span className="print:hidden text-[10px] text-blue-600 font-medium">
                      (Haga clic en el lápiz para editar cada actividad)
                    </span>
                  )}
                </div>
                <table className="w-full text-[9px] border-collapse border border-slate-300 leading-tight">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400 text-left">
                      <th className="p-1.5 border-r border-slate-300 w-6 text-center">Nº</th>
                      <th className="p-1.5 border-r border-slate-300 w-16">Fecha</th>
                      <th className="p-1.5 border-r border-slate-300">Actividad / Tarea</th>
                      <th className="p-1.5 border-r border-slate-300 w-24">Responsable</th>
                      <th className="p-1.5 border-r border-slate-300 w-36">Producto Esperado</th>
                      <th className="p-1.5 border-r border-slate-300 w-28">Medio Verificación / Evidencia</th>
                      <th className="p-1.5 w-16 text-center">Estado</th>
                      {canEdit && <th className="print:hidden p-1.5 w-8 text-center">Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.actividades.map((a, idx) => {
                      const isEjecutada = a.estado.toUpperCase() === "EJECUTADA";
                      const isEnProceso = a.estado.toUpperCase() === "EN PROCESO";
                      const isNoEjecutada = a.estado.toUpperCase() === "NO EJECUTADA";
                      return (
                        <tr
                          key={a.id}
                          className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                        >
                          <td className="p-1.5 border-r border-slate-300 text-center font-bold">{a.id}</td>
                          <td className="p-1.5 border-r border-slate-300 whitespace-nowrap font-medium text-slate-700">{a.periodo}</td>
                          <td className="p-1.5 border-r border-slate-300 font-medium text-slate-900">{a.tarea}</td>
                          <td className="p-1.5 border-r border-slate-300 text-slate-700">{a.responsable}</td>
                          <td className="p-1.5 border-r border-slate-300 text-slate-700">{a.producto}</td>
                          <td className="p-1.5 border-r border-slate-300 text-slate-600">
                            <div>{a.medio_verificacion}</div>
                            {a.evidencia_observaciones && (
                              <div className="mt-0.5 font-sans text-blue-800 text-[8px] bg-blue-50/80 p-0.5 rounded border border-blue-200">
                                <strong>Obs:</strong> {a.evidencia_observaciones}
                              </div>
                            )}
                          </td>
                          <td className="p-1.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                isEjecutada
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isEnProceso
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : isNoEjecutada
                                  ? "bg-red-100 text-red-800 border border-red-300"
                                  : "bg-slate-100 text-slate-600 border border-slate-300"
                              }`}
                            >
                              {a.estado}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="print:hidden p-1.5 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-slate-200"
                                onClick={() => setEditingActividad({ ...a })}
                              >
                                <Pencil className="h-3 w-3 text-slate-600" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Firmas Responsables - Con salto evitado para permanecer juntas */}
              <div className="mt-8 pt-4 border-t border-black break-inside-avoid print:break-inside-avoid">
                <div className="grid grid-cols-3 gap-8 text-center text-xs">
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Coordinador/a General</p>
                      <p className="text-[8px] text-gray-600">CMCI DASE-EP</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Técnico/a Administrativo/a</p>
                      <p className="text-[8px] text-gray-600">Verificación y Control Documental</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Supervisor/a Delegado/a</p>
                      <p className="text-[8px] text-gray-600">Dirección de Acción Social y Educación</p>
                    </div>
                  </div>
                </div>
                <p className="text-[8px] mt-4 text-center text-slate-400">
                  Documento oficial emitido conforme a las directrices técnicas del Modelo de Gestión de los Centros Municipales de Cuidado Infantil (CMCI).
                </p>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="print-letterhead-bottom-spacer h-[36mm]" />
          </tr>
        </tfoot>
      </table>

      {/* Pie membretado fijo por CSS */}
      {footerUrl && (
        <div className="print-letterhead-footer" aria-hidden="true">
          <img src={footerUrl} alt="Pie oficial" />
        </div>
      )}

      {/* Dialog de Edición Exclusivo para License Admin */}
      {canEdit && editingActividad && (
        <Dialog open={!!editingActividad} onOpenChange={(open) => !open && setEditingActividad(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Editar Actividad #{editingActividad.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <div>
                <Label className="text-xs">Actividad / Tarea</Label>
                <Input
                  className="text-xs mt-1"
                  value={editingActividad.tarea}
                  onChange={(e) => setEditingActividad({ ...editingActividad, tarea: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
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
              <div className="grid grid-cols-2 gap-2">
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
                <Label className="text-xs">Evidencia / Observaciones</Label>
                <Input
                  className="text-xs mt-1"
                  placeholder="Ej. Registro fotográfico, acta firmada..."
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
