"use client";
/**
 * Vista de Solo Lectura y Consulta de Ficha de Vulnerabilidad Familiar CMCI.
 * Replica fielmente el diseño, tarjetas y métricas de la valoración con botón de Vista Impresión / PDF Oficial.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cmciService, type VulnRecord } from "@/services/cmci.service";
import { ArrowLeft, Loader2, AlertCircle, Printer, FileText, ShieldAlert, CheckCircle2 } from "lucide-react";
import { VULN_DIMS, VULN_INDICATORS } from "@/lib/cmci/params";
import { computeVulnerability } from "@/lib/cmci/engine";

export default function FichaVulnerabilidadDetailPage({ params }: { params?: { id: string } }) {
  const router = useRouter();
  const routeParams = useParams();
  const id = (params?.id ?? routeParams?.id) as string;

  const [rec, setRec] = useState<VulnRecord | undefined>();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    cmciService
      .getVuln(id)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setErrorMsg("Ficha de vulnerabilidad no encontrada.");
        } else {
          setRec(data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err instanceof Error ? err.message : "Error al cargar la ficha de vulnerabilidad.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando ficha de vulnerabilidad #{id}...</p>
      </div>
    );
  }

  if (errorMsg || !rec) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-8">
        <div className="flex items-center gap-2">
          <Link href="/admision">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Admisión
            </Button>
          </Link>
        </div>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" />
              {errorMsg || "Registro no encontrado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              No se pudo obtener la ficha de vulnerabilidad solicitada (ID: {id}). Verifique sus permisos o si el registro fue eliminado.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                Reintentar
              </Button>
              <Link href="/admision/ficha-vulnerabilidad/nueva">
                <Button size="sm">Crear nueva ficha</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const res = computeVulnerability(rec.scores, rec.hogar);

  return (
    <div className="space-y-4">
      {/* Barra superior de navegación y acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/admision">
              <Button variant="ghost" size="sm" className="gap-1 p-0 h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                Admisión
              </Button>
            </Link>
            <span className="text-muted-foreground text-sm">/ Ficha de Vulnerabilidad #{id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {rec.codigo || `Ficha #${rec.id}`} — {rec.nino || "Sin nombre registrado"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Expediente guardado · Modalidad Solo Lectura · Nivel: <b className="uppercase">{res.level}</b> · Prioridad: <b className="uppercase">{res.priority}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admision/ficha-vulnerabilidad/${id}/print`}>
            <Button variant="default" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow">
              <Printer className="h-4 w-4" />
              Vista Impresión / PDF Oficial
            </Button>
          </Link>
        </div>
      </div>

      {/* 1. Identificación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Identificación General
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Código Único</span>
            <span className="font-mono font-bold text-base text-primary">{rec.codigo || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Niño/a</span>
            <span className="font-semibold text-sm block truncate">{rec.nino || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Edad / Rango</span>
            <span className="font-semibold text-sm">
              {rec.edadMeses} meses {rec.enRango ? <span className="text-emerald-600 text-xs">(En rango)</span> : <span className="text-amber-600 text-xs">(Fuera de rango)</span>}
            </span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Centro Asignado</span>
            <span className="font-semibold text-sm">{rec.cmci || "—"}</span>
          </div>

          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Representante Legal</span>
            <span className="font-semibold text-sm">{rec.representante || "—"}</span>
            <span className="text-xs text-muted-foreground block">({rec.parentesco || "Parentesco no especificado"})</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Teléfono de Contacto</span>
            <span className="font-mono font-semibold text-sm">{rec.telefono || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Sector / Ubicación</span>
            <span className="font-semibold text-sm">{rec.sector || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Fecha de Evaluación</span>
            <span className="font-mono text-sm">{rec.fecha || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Condiciones del Hogar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Condiciones del Hogar y Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 text-xs">
            <div className="p-2.5 rounded border bg-muted/20">
              <span className="text-muted-foreground block">Ingreso Total:</span>
              <b className="text-sm font-mono text-foreground">${rec.hogar.ingresoTotal}</b>
            </div>
            <div className="p-2.5 rounded border bg-muted/20">
              <span className="text-muted-foreground block">Per-cápita:</span>
              <b className="text-sm font-mono text-foreground">${res.perCapita.toFixed(2)}</b>
            </div>
            <div className="p-2.5 rounded border bg-muted/20">
              <span className="text-muted-foreground block">Integrantes:</span>
              <b className="text-sm font-mono text-foreground">{rec.hogar.integrantes} pers.</b>
            </div>
            <div className="p-2.5 rounded border bg-muted/20">
              <span className="text-muted-foreground block">Perceptores:</span>
              <b className="text-sm font-mono text-foreground">{rec.hogar.perceptores}</b>
            </div>
            <div className="p-2.5 rounded border bg-muted/20">
              <span className="text-muted-foreground block">Hacinamiento:</span>
              <b className="text-sm font-mono text-foreground">{res.hacinamiento.toFixed(2)} p/dorm</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Alertas de Protección */}
      {res.alerts.some((a) => a.active) && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Alertas de Protección y Vulnerabilidad Activas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="grid gap-2 sm:grid-cols-2 text-xs">
              {res.alerts.filter((a) => a.active).map((a) => (
                <li key={a.key} className="flex items-center gap-2 text-amber-900 bg-white/80 p-2 rounded border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-600 shrink-0" />
                  <span>{a.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 4. Puntaje Consolidado y Dimensiones */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-lg">Consolidado de Vulnerabilidad Familiar</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Escala de 0 a 100 puntos (mayor puntaje = mayor vulnerabilidad)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-primary font-mono">{res.total.toFixed(2)} pts</span>
            <span
              className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border"
              style={{
                backgroundColor: `#${res.color}25`,
                color: `#${res.color}`,
                borderColor: `#${res.color}50`,
              }}
            >
              {res.level} · {res.priority}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {VULN_DIMS.map((d) => {
              const subtotal = res.subtotals[d.code] ?? 0;
              return (
                <div key={d.code} className="border rounded-lg p-3 bg-muted/20 space-y-1">
                  <div className="text-muted-foreground font-semibold flex justify-between">
                    <span>{d.code} · {d.name}</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {subtotal.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link href={`/admision/ficha-vulnerabilidad/${id}/print`}>
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <Printer className="h-4 w-4" />
                Vista Impresión / PDF Oficial
              </Button>
            </Link>
            <Link href="/admision">
              <Button variant="outline">Volver al listado de Admisión</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
