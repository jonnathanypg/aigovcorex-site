"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
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
import {
  FileText,
  Printer,
  Sparkles,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Plus,
  ArrowRight,
  ShieldAlert,
  Users,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import {
  cmciService,
  type MonthlyReportListItem,
  type MonthlyReportDetail,
} from "@/services/cmci.service";
import { isEducatorRole } from "@/lib/os-modules";

export default function InformeActividadesPage() {
  const [reports, setReports] = useState<MonthlyReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  // Delete state
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState("educadora");
  const [educatorNotes, setEducatorNotes] = useState("");
  const [redactWithLLM, setRedactWithLLM] = useState(true);

  // Preview dialog state
  const [previewReport, setPreviewReport] = useState<MonthlyReportDetail | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Initialize dates and user role
  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === "string" ? user.role : (user.role as any)?.name;
      setUserRole(roleName || "");
      if (isEducatorRole(roleName)) {
        setReportType("educadora");
      }
    }

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
  }, []);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await cmciService.listMonthlyReports();
      setReports(data);
    } catch (err: any) {
      console.error("Error loading monthly reports:", err);
      toast.error("No se pudieron cargar los informes mensuales.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Word counter for educator notes (max 500 words per CMCI spec)
  const wordCount = educatorNotes.trim() ? educatorNotes.trim().split(/\s+/).length : 0;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Por favor seleccione fecha de inicio y fin del período.");
      return;
    }
    if (startDate > endDate) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    if (wordCount > 500) {
      toast.error(`Las observaciones no deben superar 500 palabras (actual: ${wordCount}).`);
      return;
    }

    setIsGenerating(true);
    try {
      const result = await cmciService.composeMonthlyReport({
        report_type: reportType,
        period_start: startDate,
        period_end: endDate,
        educator_notes: educatorNotes.trim(),
        redact_with_llm: redactWithLLM,
      });

      toast.success(result.message || "Informe mensual de actividades generado con éxito.");
      await loadReports();

      // Open preview of the generated report
      if (result.report_id) {
        handleOpenPreview(result.report_id);
      }
    } catch (err: any) {
      console.error("Error generating monthly report:", err);
      toast.error(err.message || "Error al componer el informe mensual.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenPreview = async (reportId: number) => {
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);
    try {
      const detail = await cmciService.getMonthlyReport(reportId);
      setPreviewReport(detail);
    } catch (err: any) {
      console.error("Error fetching report detail:", err);
      toast.error("Error al cargar la vista previa del informe.");
      setIsPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await cmciService.deleteMonthlyReport(reportToDelete);
      toast.success("Informe mensual eliminado con éxito.");
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete));
    } catch (err: any) {
      console.error("Error deleting report:", err);
      toast.error(err.message || "No se pudo eliminar el informe.");
    } finally {
      setIsDeleting(false);
      setReportToDelete(null);
    }
  };

  const isEducator = isEducatorRole(userRole);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-headline flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-amber-500" />
            Informe Mensual de Actividades
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consolidación oficial de experiencias de aprendizaje, asistencia, desarrollo integral y firmas en papel (CMCI).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/planificaciones">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" /> Ver Planificaciones
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadReports}
            disabled={isLoading}
            title="Recargar informes"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Grid: Generator Form & Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Card */}
        <Card className="lg:col-span-5 shadow-sm border-border/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Generar Nuevo Informe
            </CardTitle>
            <CardDescription>
              Recopila automáticamente las planificaciones del mes, la cobertura y la asistencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Presets de Período según ciclo administrativo / CMCI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Período del Informe
                  </Label>
                  <span className="text-[10px] text-primary font-medium">Ciclo mensual / corte</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 py-0 border-border/60 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40"
                    onClick={() => {
                      const now = new Date();
                      // Si hoy es antes del 29, el periodo va del 29 del mes anterior al 29 de este mes
                      const currentMonth = now.getMonth();
                      const currentYear = now.getFullYear();
                      let startY = currentYear;
                      let startM = currentMonth - 1;
                      if (startM < 0) {
                        startM = 11;
                        startY -= 1;
                      }
                      const startD = new Date(startY, startM, 29);
                      const endD = new Date(currentYear, currentMonth, 29);
                      setStartDate(startD.toISOString().split("T")[0]);
                      setEndDate(endD.toISOString().split("T")[0]);
                    }}
                  >
                    Corte 29 al 29
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 py-0 border-border/60 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40"
                    onClick={() => {
                      const today = new Date();
                      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      setStartDate(firstDay.toISOString().split("T")[0]);
                      setEndDate(lastDay.toISOString().split("T")[0]);
                    }}
                  >
                    Mes Actual (1–30)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 py-0 border-border/60 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40"
                    onClick={() => {
                      const today = new Date();
                      const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
                      setStartDate(prevMonthFirst.toISOString().split("T")[0]);
                      setEndDate(prevMonthLast.toISOString().split("T")[0]);
                    }}
                  >
                    Mes Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 py-0 border-border/60 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 30);
                      setStartDate(start.toISOString().split("T")[0]);
                      setEndDate(end.toISOString().split("T")[0]);
                    }}
                  >
                    Últimos 30 días
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold">
                    Inicio del Período *
                  </Label>
                  <Input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold">
                    Fin del Período *
                  </Label>
                  <Input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {!isEducator && (
                <div className="space-y-1.5">
                  <Label htmlFor="reportType" className="text-xs font-semibold">
                    Rol / Formato de Informe
                  </Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger id="reportType">
                      <SelectValue placeholder="Seleccione rol..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educadora">Educadora (Planificaciones + Niños)</SelectItem>
                      <SelectItem value="auxiliar">Auxiliar de Párvulos (Cuidado & Higiene)</SelectItem>
                      <SelectItem value="trabajo_social">Trabajo Social (Visitas & Riesgos)</SelectItem>
                      <SelectItem value="coordinacion">Coordinación (Consolidado Centro)</SelectItem>
                      <SelectItem value="asistente">Asistente Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="educatorNotes" className="text-xs font-semibold">
                    Observaciones de la Educadora (Opcional)
                  </Label>
                  <span
                    className={`text-[11px] font-mono ${
                      wordCount > 500 ? "text-destructive font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {wordCount}/500 palabras
                  </span>
                </div>
                <Textarea
                  id="educatorNotes"
                  placeholder="Detalle aspectos destacados, logros del grupo, novedades o eventos relevantes del mes..."
                  rows={4}
                  value={educatorNotes}
                  onChange={(e) => setEducatorNotes(e.target.value)}
                  className="resize-none text-sm"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                <input
                  type="checkbox"
                  id="redactWithLLM"
                  checked={redactWithLLM}
                  onChange={(e) => setRedactWithLLM(e.target.checked)}
                  className="rounded border-amber-500/40 text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <label htmlFor="redactWithLLM" className="cursor-pointer select-none">
                  Redactar conclusiones y logros automáticamente con Inteligencia Artificial.
                </label>
              </div>

              <Button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Componiendo Informe con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Componer Informe Mensual
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Historical List Card */}
        <Card className="lg:col-span-7 shadow-sm border-border/80 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Historial de Informes Mensuales</span>
              <Badge variant="outline" className="text-xs font-normal">
                {reports.length} {reports.length === 1 ? "informe" : "informes"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Informes generados disponibles para previsualizar o imprimir en formato A4 con líneas de firma física.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-amber-500" />
                <p className="text-sm">Cargando informes...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium text-foreground">No hay informes mensuales registrados.</p>
                <p className="text-xs max-w-sm mt-1">
                  Seleccione el período en el formulario lateral y haga clic en &quot;Componer Informe Mensual&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border/60 hover:border-amber-500/40 bg-card hover:bg-muted/30 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          Informe Mensual #{r.id}
                        </span>
                        <Badge variant="secondary" className="text-[11px] capitalize">
                          {r.report_type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono tracking-wider border-emerald-500/40 text-emerald-500"
                        >
                          {r.status || "guardado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                        Período: <strong className="text-foreground">{r.period_start}</strong> al{" "}
                        <strong className="text-foreground">{r.period_end}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPreview(r.id)}
                        className="text-xs"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Ver Resumen
                      </Button>
                      <Link href={`/informe-actividades/${r.id}/print`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                        >
                          <Printer className="mr-1.5 h-3.5 w-3.5" />
                          Imprimir A4
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReportToDelete(r.id)}
                        className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2"
                        title="Eliminar informe"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-headline">
              <FileText className="h-5 w-5 text-amber-500" />
              Vista Previa — Informe Mensual #{previewReport?.id}
            </DialogTitle>
            <DialogDescription>
              {previewReport?.print_view?.titulo || "Informe Mensual de Actividades"}
            </DialogDescription>
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : previewReport ? (
            <div className="space-y-5 py-2 text-sm">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg border bg-muted/30 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Usuarios</p>
                  <p className="text-lg font-bold text-foreground">
                    {previewReport.print_view?.resumen?.usuarios || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/30 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Planificaciones</p>
                  <p className="text-lg font-bold text-foreground">
                    {previewReport.print_view?.resumen?.planificaciones || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/30 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Asistencia</p>
                  <p className="text-lg font-bold text-emerald-500">
                    {previewReport.print_view?.resumen?.tasa_asistencia || 0}%
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/30 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Casos Riesgo</p>
                  <p className="text-lg font-bold text-amber-500">
                    {(() => {
                      const rawDetails = previewReport.print_view?.resumen?.detalle_casos_riesgo || previewReport.payload?.detalle_casos_riesgo || [];
                      if (Array.isArray(rawDetails) && rawDetails.length > 0) {
                        return rawDetails.filter((d: any) => {
                          const m = String(d?.motivo ?? "").trim().toLowerCase();
                          return m && !["ninguno", "ninguna", "no", "n/a", "sin riesgo", "sin riesgos", "-"].includes(m);
                        }).length;
                      }
                      return previewReport.print_view?.resumen?.casos_riesgo || 0;
                    })()}
                  </p>
                </div>
              </div>

              {/* General Metadata */}
              <div className="p-3 rounded-lg border bg-card space-y-1 text-xs">
                <p>
                  <strong>Centro:</strong> {previewReport.print_view?.centro || "Centro Infantil"}
                </p>
                <p>
                  <strong>Educadora / Responsable:</strong> {previewReport.print_view?.autora || "Sin asignar"}
                </p>
                <p>
                  <strong>Período:</strong> {previewReport.period_start} al {previewReport.period_end}
                </p>
              </div>

              {/* Children Table in Preview */}
              {previewReport.payload?.ninos && previewReport.payload.ninos.length > 0 && (
                <div className="space-y-1.5 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-amber-500" />
                      Nómina de Niños Bajo Cobertura ({previewReport.payload.ninos.length})
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-medium">1 por línea en orden</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b text-muted-foreground text-[11px]">
                          <th className="py-1 px-1.5 w-8">#</th>
                          <th className="py-1 px-1.5">Cédula / ID</th>
                          <th className="py-1 px-1.5">Nombres y Apellidos</th>
                          <th className="py-1 px-1.5 text-center">Edad</th>
                          <th className="py-1 px-1.5">Sala / Grupo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {previewReport.payload.ninos.map((n: any, idx: number) => (
                          <tr key={n.id || idx} className="hover:bg-muted/40">
                            <td className="py-1 px-1.5 font-bold text-muted-foreground">{idx + 1}</td>
                            <td className="py-1 px-1.5 font-mono text-[11px]">{n.cedula || "S/C"}</td>
                            <td className="py-1 px-1.5 font-medium">{n.nombre}</td>
                            <td className="py-1 px-1.5 text-center text-muted-foreground">{n.edad}</td>
                            <td className="py-1 px-1.5 text-muted-foreground">{n.grupo_sala || "General"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Automatic Conclusions from LLM */}
              <div className="space-y-1.5">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Conclusiones y Logros Automáticos (IA)
                </h4>
                <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 text-xs leading-relaxed text-foreground whitespace-pre-line">
                  {previewReport.conclusions_auto || "Sin conclusiones registradas."}
                </div>
              </div>

              {/* Educator Notes */}
              {previewReport.educator_notes && (
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Observaciones Agregadas por la Educadora
                  </h4>
                  <div className="p-3 rounded-lg border bg-muted/30 text-xs leading-relaxed text-foreground whitespace-pre-line">
                    {previewReport.educator_notes}
                  </div>
                </div>
              )}

              {/* Paper Signatures Notice */}
              <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground text-center bg-muted/10">
                <p className="font-medium text-foreground">
                  {previewReport.print_view?.nota || "Documento firmable en papel fuera del sistema. Sin firma electrónica."}
                </p>
                <p className="text-[11px] mt-0.5">
                  El formato de impresión incluye las líneas reglamentarias para firma física de la Educadora y la Coordinadora.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                  Cerrar
                </Button>
                <Link href={`/informe-actividades/${previewReport.id}/print`}>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Printer className="mr-2 h-4 w-4" />
                    Abrir Formato para Imprimir (A4)
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Report */}
      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar informe mensual?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el informe de actividades #{reportToDelete} de la lista para evitar acumulación innecesaria de borradores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

