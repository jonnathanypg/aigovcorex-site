"use client"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, CalendarCheck, Baby, Stethoscope, Loader2, Plus, FileSpreadsheet, Table2, Trash2, Globe } from "lucide-react";
import { reportsService, type Report } from "@/services/reports.service";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const iconMap: { [key: string]: React.ElementType } = {
  Asistencia: CalendarCheck,
  asistencia: CalendarCheck,
  asistencia_matriz: CalendarCheck,
  Desarrollo: Baby,
  desarrollo: Baby,
  Salud: Stethoscope,
  salud: Stethoscope,
  General: FileText,
  general: FileText
};

const formatIcons: { [key: string]: React.ElementType } = {
  pdf: FileText,
  csv: Table2,
  excel: FileSpreadsheet
};

const formatLabels: { [key: string]: string } = {
  pdf: 'PDF',
  csv: 'CSV',
  excel: 'Excel'
};

interface ReportsClientProps {
  tenantId?: number;
}

export function ReportsClient({ tenantId }: ReportsClientProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState("asistencia");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);

  const fetchReports = async () => {
    try {
      const data = await reportsService.getAll(tenantId);
      setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // Set default dates
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstOfMonth.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, [tenantId]);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate || !reportType) return;

    // If no tenantId (global mode), show confirmation first
    if (!tenantId) {
      setShowGlobalConfirm(true);
      return;
    }

    await executeGeneration();
  };

  const executeGeneration = async () => {
    setIsGenerating(true);
    try {
      const result = await reportsService.generate({
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
        export_format: exportFormat
      }, tenantId);

      toast.success("Reporte generado correctamente");

      // Refresh reports list
      await fetchReports();

      // Auto-download the generated report
      if (result.report?.id) {
        handleDownload(result.report.id, result.report.format);
      }
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error(error.response?.data?.error || "Error al generar el reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (reportId: number, format: string) => {
    try {
      const blob = await reportsService.download(reportId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${reportId}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Descarga iniciada");
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Error al descargar el reporte");
    }
  };

  const handleDelete = async (reportId: number) => {
    try {
      await reportsService.delete(reportId);
      setReports(reports.filter(r => r.id !== reportId));
      toast.success("Reporte eliminado correctamente");
    } catch (error: any) {
      console.error("Error deleting report:", error);
      toast.error(error.response?.data?.error || "Error al eliminar el reporte");
    } finally {
      setReportToDelete(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Global Report Confirmation Dialog */}
      <AlertDialog open={showGlobalConfirm} onOpenChange={setShowGlobalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Reporte Global Consolidado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Está a punto de generar un reporte que incluirá datos de <strong>todos sus centros</strong>.
              El reporte incluirá una columna adicional &quot;Centro&quot; para identificar el origen de cada registro.
              ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowGlobalConfirm(false); executeGeneration(); }}>
              Generar Reporte Global
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generar Nuevo Reporte
          </CardTitle>
          <CardDescription>
            Seleccione el tipo de reporte, rango de fechas y formato de exportación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="reportType">Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asistencia">Asistencia (Detallado)</SelectItem>
                  <SelectItem value="asistencia_matriz">Asistencia (Matriz/Mes)</SelectItem>
                  <SelectItem value="desarrollo">Desarrollo Infantil</SelectItem>
                  <SelectItem value="salud">Salud y Nutrición</SelectItem>
                  <SelectItem value="general">General del Centro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportFormat">Formato</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      CSV
                    </div>
                  </SelectItem>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || !startDate || !endDate}
                className="flex-1"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" /> Generar</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Reportes Generados (Mis Reportes)</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.length === 0 ? (
            <div className="col-span-3 text-center text-muted-foreground py-10 border rounded-md border-dashed">
              No hay reportes generados. Use el formulario anterior para crear uno.
            </div>
          ) : (
            reports.map((report) => {
              const Icon = iconMap[report.type] || FileText;
              const FormatIcon = formatIcons[report.format] || FileText;
              return (
                <Card key={report.id} className="flex flex-col relative group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{report.type}</span>
                          <span>•</span>
                          <span>{report.date}</span>
                        </CardDescription>
                        {(report.start_date && report.end_date) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Período: {report.start_date} al {report.end_date}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Icon className="h-8 w-8 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">
                          <FormatIcon className="h-3 w-3 mr-1" />
                          {formatLabels[report.format] || report.format?.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex items-end gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleDownload(report.id, report.format)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Descargar
                    </Button>

                    <AlertDialog open={reportToDelete === report.id} onOpenChange={(open) => open ? setReportToDelete(report.id) : setReportToDelete(null)}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente el reporte de la base de datos y del sistema de archivos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(report.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              );
            }))}
        </div>
      </div>
    </div>
  );
}
