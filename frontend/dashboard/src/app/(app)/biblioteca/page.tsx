import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BIBLIOTECA_CATEGORIAS } from "@/lib/cmci/params";

/** Biblioteca §10.6: grid 15 categorías fijas, Descargar en blanco. */
export default function BibliotecaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Biblioteca documental CMCI</h1>
      <p className="text-sm text-muted-foreground">
        15 plantillas oficiales — descarga en blanco para impresión y llenado a mano.
        No se suben expedientes completos al sistema (espacio Hostinger). Cada plantilla: versión + vigencia + centro aplicable.
        {/* TODO(F4-backend): tabla document_templates + file_url por categoría */}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {BIBLIOTECA_CATEGORIAS.map((c) => (
          <Card key={c.slug}>
            <CardHeader><CardTitle className="text-base">{c.n}. {c.title}</CardTitle>
              <CardDescription>v1 · vigente 2026 · todos los centros</CardDescription></CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled title="TODO(F4): conectar document_templates.file_url">
                <Download className="mr-2 h-4 w-4" /> Descargar en blanco
              </Button>
              <p className="text-xs text-muted-foreground mt-2">TODO(F4): plantilla pendiente de carga.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
