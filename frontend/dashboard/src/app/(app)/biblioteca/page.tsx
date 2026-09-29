"use client";
/** Biblioteca §10.6: 15 plantillas fijas. Subida solo propietario/coordinador
 * principal; resto de roles solo ve Descargar (descarga lo que él cargó). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Trash2, Loader2 } from "lucide-react";
import { BIBLIOTECA_CATEGORIAS } from "@/lib/cmci/params";
import { cmciService, type BibliotecaTemplate } from "@/services/cmci.service";
import { authService } from "@/services/auth.service";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function currentRole(): string {
  try {
    const user = authService.getStoredUser() as { role?: string | { name?: string } } | null;
    if (!user) return "";
    return typeof user.role === "string" ? user.role : (user.role?.name ?? "");
  } catch {
    return "";
  }
}

/** Solo propietario (license_admin/super_admin/admin) o coordinador principal
 * (coordinator/coordinadora) ven la opción de cargar. Todos pueden descargar. */
function canUploadRole(role: string): boolean {
  const r = (role || "").toLowerCase();
  return ["license_admin", "super_admin", "admin", "supervisor",
    "coordinator", "coordinadora", "coordinadora_centro",
    "coordinador_general", "central", "central_dase", "central_mdh"].includes(r);
}

export default function BibliotecaPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BibliotecaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(BIBLIOTECA_CATEGORIAS[0]?.slug ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = canUploadRole(role);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRole(currentRole());
      const list = await cmciService.listBiblioteca();
      setTemplates(list);
    } catch (e) {
      toast({ title: "No se pudo cargar la biblioteca", description: e instanceof Error ? e.message : "Error de red", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const byCategory = (slug: string) => templates.filter((t) => {
    const c = (t.category || "").replace(/_/g, "-");
    // mapeo inverso backend(enum) -> slug frontend
    const rev: Record<string, string> = {
      "protocolo-requisitos-ingreso": "protocolo-ingreso",
      "informe-tecnico-visita": "informe-visita",
      "acta-compromiso-corresponsabilidad": "acta-compromiso",
      "consentimiento-informado": "consentimiento",
      "autorizacion-imagen": "autorizacion-imagen",
      "monitoreo-nutricional-curvas": "monitoreo-nutricional",
      "ficha-diaria-alimentacion": "ficha-alimentacion",
      "menu-semanal": "menu-semanal",
      "informe-mensual": "informe-mensual",
    };
    return c === slug || (rev[c] ?? "") === slug || t.category === slug;
  });

  const handleDownload = async (tpl: BibliotecaTemplate) => {
    try {
      const blob = await cmciService.downloadBiblioteca(tpl.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.category}_${tpl.title}`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "No se pudo descargar", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!title.trim() || !file) {
      toast({ title: "Faltan datos", description: "Título y archivo son obligatorios.", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      await cmciService.uploadBiblioteca({ title: title.trim(), category, file });
      toast({ title: "Plantilla cargada", description: title.trim() });
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast({ title: "No se pudo cargar", description: e instanceof Error ? e.message : "Error (requiere propietario/coordinador)", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (tpl: BibliotecaTemplate) => {
    if (!confirm(`¿Eliminar "${tpl.title}"?`)) return;
    try {
      await cmciService.deleteBiblioteca(tpl.id);
      toast({ title: "Plantilla eliminada", description: tpl.title });
      load();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Biblioteca documental</h1>
      <p className="text-sm text-muted-foreground">
        15 plantillas oficiales — descarga en blanco para impresión y llenado a mano.
        No se suben expedientes completos al sistema (espacio Hostinger). Cada plantilla: versión + vigencia + centro aplicable.
        {canUpload
          ? " Usted puede cargar y descargar documentos."
          : " Usted puede descargar los documentos que cargó el propietario/coordinador."}
      </p>

      {canUpload && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cargar documento (solo propietario / coordinador principal)</CardTitle>
            <CardDescription className="text-xs">El archivo queda disponible para descarga de todos los roles inferiores.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-1"><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ficha vulnerabilidad en blanco" /></div>
            <div className="md:col-span-1"><Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BIBLIOTECA_CATEGORIAS.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.n}. {c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1"><Label>Archivo *</Label><Input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.png,.jpg,.jpeg" /></div>
            <div className="flex items-end"><Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Cargar</Button></div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BIBLIOTECA_CATEGORIAS.map((c) => {
            const items = byCategory(c.slug);
            return (
              <Card key={c.slug} className="flex flex-col justify-between hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold leading-snug">{c.n}. {c.title}</CardTitle>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground shrink-0">v1.0</span>
                  </div>
                  <CardDescription className="text-xs">
                    Vigencia 2026 · Todos los centros{items.length ? ` · ${items.length} archivo(s)` : " · Formato oficial para llenado físico"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="pt-2 border-t flex flex-col gap-2">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/80 text-center">Aún sin archivo — el propietario/coordinador debe cargarlo</p>
                    ) : items.map((tpl) => (
                      <div key={tpl.id} className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1 justify-center text-xs" onClick={() => handleDownload(tpl)}>
                          <Download className="mr-2 h-3.5 w-3.5" /> {tpl.title}
                        </Button>
                        {canUpload && (
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDelete(tpl)} title="Eliminar (solo propietario/coordinador)">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
