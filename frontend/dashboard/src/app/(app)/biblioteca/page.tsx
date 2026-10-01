"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Upload, Trash2, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { BIBLIOTECA_CATEGORIAS } from "@/lib/cmci/params";
import { documentTemplatesService, type DocumentTemplate } from "@/services/document-templates.service";
import { authService } from "@/services/auth.service";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";

export default function BibliotecaPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, DocumentTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [isLicenseAdmin, setIsLicenseAdmin] = useState(false);

  // Modal para carga / reemplazo de plantilla
  const [selectedCategory, setSelectedCategory] = useState<typeof BIBLIOTECA_CATEGORIAS[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [versionInput, setVersionInput] = useState("v1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const role = typeof user.role === "string" ? user.role : (user.role as any)?.name;
      setIsLicenseAdmin(role === "license_admin" || role === "super_admin");
    }
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await documentTemplatesService.list();
      const map: Record<string, DocumentTemplate> = {};
      for (const t of res.templates || []) {
        map[t.category] = t;
      }
      setTemplates(map);
    } catch (e) {
      console.error("Error al cargar plantillas:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpload = (cat: typeof BIBLIOTECA_CATEGORIAS[0]) => {
    setSelectedCategory(cat);
    setFileToUpload(null);
    const existing = templates[cat.slug];
    setVersionInput(existing?.version || "v1");
    setModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !fileToUpload) {
      toast({
        title: "Archivo requerido",
        description: "Por favor selecciona un archivo para cargar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("title", selectedCategory.title);
      formData.append("category", selectedCategory.slug);
      formData.append("version", versionInput.trim() || "v1");
      formData.append("file", fileToUpload);

      const res = await documentTemplatesService.upload(formData);
      toast({
        title: "Plantilla actualizada",
        description: `${selectedCategory.title} se cargó exitosamente.`,
      });
      setTemplates((prev) => ({
        ...prev,
        [selectedCategory.slug]: res.template,
      }));
      setModalOpen(false);
    } catch (e: any) {
      toast({
        title: "Error al cargar",
        description: e?.response?.data?.error || e.message || "Error al subir la plantilla.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (cat: typeof BIBLIOTECA_CATEGORIAS[0], tId: number) => {
    if (!confirm(`¿Eliminar la plantilla de "${cat.title}"? Los demás usuarios no podrán descargarla hasta que se vuelva a cargar.`)) {
      return;
    }

    try {
      await documentTemplatesService.remove(tId);
      toast({
        title: "Plantilla eliminada",
        description: `Se eliminó la plantilla de ${cat.title}.`,
      });
      setTemplates((prev) => {
        const next = { ...prev };
        delete next[cat.slug];
        return next;
      });
    } catch (e: any) {
      toast({
        title: "Error al eliminar",
        description: e?.response?.data?.error || e.message || "No se pudo eliminar la plantilla.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (cat: typeof BIBLIOTECA_CATEGORIAS[0], template: DocumentTemplate) => {
    try {
      const response = await api.get(`/api/document-templates/${template.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const ext = template.file_url?.split(".").pop() || "pdf";
      link.setAttribute("download", `${cat.slug}_${template.version || "v1"}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: "Error en descarga",
        description: "No se pudo descargar la plantilla en este momento.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Biblioteca Documental CMCI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plantillas oficiales CMCI por categoría para impresión, descarga o actualización institucional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLicenseAdmin && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 py-1 px-3 text-xs">
              Modo Administrador: Carga y Reemplazo Activos
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={loadTemplates} disabled={loading} title="Actualizar lista">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BIBLIOTECA_CATEGORIAS.map((c) => {
          const template = templates[c.slug];
          const hasFile = !!template?.file_url;

          return (
            <Card key={c.slug} className="flex flex-col justify-between hover:shadow-sm transition-all border-border/80">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    N° {c.n}
                  </Badge>
                  {hasFile ? (
                    <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-600 border-green-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {template.version || "v1"} Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Sin plantilla
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-semibold mt-2">{c.title}</CardTitle>
                <CardDescription className="text-xs">
                  {hasFile
                    ? `Actualizado el ${template.updated_at ? String(template.updated_at).slice(0, 10) : "recientemente"}`
                    : "Formato oficial pendiente de carga institucional"}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 border-t flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {/* Botón de Descarga para todos los usuarios */}
                  <Button
                    variant={hasFile ? "default" : "outline"}
                    size="sm"
                    className="flex-1 justify-center gap-2 text-xs"
                    disabled={!hasFile}
                    onClick={() => template && handleDownload(c, template)}
                  >
                    <Download className="w-4 h-4" />
                    {hasFile ? "Descargar documento" : "No disponible"}
                  </Button>

                  {/* Acciones exclusivas para Administrador de Licencia */}
                  {isLicenseAdmin && hasFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 px-2"
                      title="Eliminar plantilla"
                      onClick={() => handleDelete(c, template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {isLicenseAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 border-dashed hover:border-primary hover:text-primary"
                    onClick={() => handleOpenUpload(c)}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {hasFile ? "Reemplazar documento" : "Cargar documento"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Carga para Administrador */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUploadSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Vincular documento oficial
              </DialogTitle>
              <DialogDescription>
                {selectedCategory?.n}. {selectedCategory?.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="version" className="text-xs">Versión o Vigencia</Label>
                <Input
                  id="version"
                  className="mt-1"
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                  placeholder="Ej: v1, 2026-A, etc."
                />
              </div>

              <div>
                <Label htmlFor="file" className="text-xs">Archivo de plantilla (PDF, DOCX, XLSX)</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  className="mt-1"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFileToUpload(f);
                  }}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Formatos permitidos: PDF, Word (.docx), Excel (.xlsx, .csv).
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || !fileToUpload}>
                {uploading ? "Subiendo..." : "Guardar y Vincular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
