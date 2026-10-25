"use client";
/**
 * Vista de Solo Lectura y Consulta de Ficha Socioeconómica CMCI.
 * Replica fielmente el diseño, tarjetas y métricas de la creación con botón de Vista Impresión / PDF.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService, type SocioRecord } from "@/services/cmci.service";
import { ArrowLeft, Loader2, AlertCircle, Printer, FileText, CheckCircle2 } from "lucide-react";
import { SOCIO_WEIGHTS } from "@/lib/cmci/params";

const ING_LABELS = ["Sueldos", "Jornales", "Independiente", "Negocios", "Pensiones", "Bonos", "Ayudas", "Otros"];
const EGR_LABELS = ["Alimentación", "Arriendo", "Básicos", "Transporte", "Educación", "Salud", "Cuidado", "Deudas", "Vestimenta", "Otros"];
const SERV_LABELS = ["Agua", "Luz", "Alcantarillado", "Internet", "Recolección", "Gas"];

export default function FichaSocioeconomicaDetailPage({ params }: { params?: { id: string } }) {
  const router = useRouter();
  const routeParams = useParams();
  const id = (params?.id ?? routeParams?.id) as string;

  const [rec, setRec] = useState<SocioRecord | undefined>();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    cmciService
      .getSocio(id)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setErrorMsg("Ficha socioeconómica no encontrada.");
        } else {
          setRec(data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err instanceof Error ? err.message : "Error al cargar la ficha socioeconómica.");
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
        <p className="text-sm text-muted-foreground">Cargando ficha socioeconómica #{id}...</p>
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
              No se pudo obtener la ficha socioeconómica solicitada (ID: {id}). Verifique sus permisos o si el registro fue eliminado.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                Reintentar
              </Button>
              <Link href="/admision/ficha-socioeconomica/nueva">
                <Button size="sm">Crear nueva ficha</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extracción exhaustiva y defensiva de la información almacenada
  const rawPayload = (rec.payload ?? {}) as Record<string, unknown>;
  const rawResultado = (rawPayload.resultado ?? {}) as Record<string, unknown>;

  const integrantes = Number(rawPayload.integrantes ?? 1);
  const menores5 = Number(rawPayload.menores5 ?? 0);
  const de5a17 = Number(rawPayload.de5a17 ?? 0);
  const adultos = Number(rawPayload.adultos ?? 0);
  const mayores = Number(rawPayload.mayores ?? 0);
  const discapacidad = Number(rawPayload.discapacidad ?? 0);
  const enfermedad = Number(rawPayload.enfermedad ?? 0);
  const trabajan = Number(rawPayload.trabajan ?? 0);
  const generanIngreso = Number(rawPayload.generanIngreso ?? 1);
  const dormitorios = Number(rawPayload.dormitorios ?? 1);

  const tenencia = String(rawPayload.tenencia ?? "No especificada");
  const tipoVivienda = String(rawPayload.tipoVivienda ?? "No especificado");
  const situacionLaboral = String(rawPayload.situacionLaboral ?? "No especificada");
  const educacion = String(rawPayload.educacion ?? "No especificada");

  const ingresosArr = Array.isArray(rawPayload.ingresos) ? (rawPayload.ingresos as number[]) : [];
  const egresosArr = Array.isArray(rawPayload.egresos) ? (rawPayload.egresos as number[]) : [];
  const serviciosArr = Array.isArray(rawPayload.servicios) ? (rawPayload.servicios as boolean[]) : [];

  const totalIngresos = Number(rawResultado.ingreso_total ?? rawResultado.E18 ?? ingresosArr.reduce((a, b) => a + (b || 0), 0));
  const totalEgresos = Number(rawResultado.gasto_total ?? rawResultado.E29 ?? egresosArr.reduce((a, b) => a + (b || 0), 0));
  const ratioGasto = Number(rawResultado.ratio_gasto ?? rawResultado.E31 ?? (totalIngresos > 0 ? totalEgresos / totalIngresos : 0));
  const perCapita = Number(rec.perCapita ?? rawResultado.per_capita ?? rawResultado.E19 ?? (integrantes > 0 ? totalIngresos / integrantes : 0));
  const coberturaServicios = Number(rawResultado.cobertura_servicios ?? rawResultado.B55 ?? (serviciosArr.length ? serviciosArr.filter(Boolean).length / serviciosArr.length : 0));

  const subscoresMap =
    (rawResultado.subscores as Record<string, number> | undefined) ??
    (rawResultado.sub as Record<string, number> | undefined) ??
    (rawPayload.subscores as Record<string, number> | undefined) ??
    (rawPayload.sub as Record<string, number> | undefined) ??
    {};

  return (
    <div className="space-y-4">
      {/* Barra superior de navegación y botones de acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/admision">
              <Button variant="ghost" size="sm" className="gap-1 p-0 h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                Admisión
              </Button>
            </Link>
            <span className="text-muted-foreground text-sm">/ Ficha Socioeconómica #{id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {rec.codigo || `Ficha #${rec.id}`} — {rec.nino || "Sin nombre registrado"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Expediente guardado · Modalidad Solo Lectura · Clasificación: <b className="uppercase">{rec.clasificacion}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admision/ficha-socioeconomica/${id}/print`}>
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
            <span className="text-xs text-muted-foreground block font-medium">Fecha de Valoración</span>
            <span className="font-medium text-sm">{rec.fecha || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Niño / Niña</span>
            <span className="font-bold text-sm">{rec.nino || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Nacimiento</span>
            <span className="font-medium text-sm">{rec.nacimiento || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Centro (CMCI)</span>
            <span className="font-semibold text-sm">{rec.cmci || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Representante</span>
            <span className="font-medium text-sm">{rec.representante || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Teléfono de Contacto</span>
            <span className="font-mono text-sm">{rec.telefono || "—"}</span>
          </div>
          <div className="bg-muted/20 p-2.5 rounded-lg border">
            <span className="text-xs text-muted-foreground block font-medium">Clasificación Obtenida</span>
            <span className="font-bold text-sm uppercase text-amber-700">{rec.clasificacion || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Composición y Vivienda/Empleo */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Composición del Hogar</CardTitle>
            <p className="text-xs text-muted-foreground">Estructura demográfica y miembros dependientes</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              ["Integrantes", integrantes],
              ["< 5 años", menores5],
              ["5 a 17 años", de5a17],
              ["Adultos", adultos],
              ["Adultos mayores", mayores],
              ["Discapacidad", discapacidad],
              ["Enfermedad grave", enfermedad],
              ["Trabajan", trabajan],
              ["Generan ingreso", generanIngreso],
              ["Dormitorios", dormitorios],
            ].map(([label, val]) => (
              <div key={label as string} className="bg-muted/30 p-2 rounded-lg border">
                <span className="text-[11px] text-muted-foreground block">{label as string}</span>
                <span className="font-bold text-base">{val as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vivienda, Empleo y Educación</CardTitle>
            <p className="text-xs text-muted-foreground">Condiciones estructurales y del entorno</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 p-2 rounded-lg border">
                <span className="text-[11px] text-muted-foreground block">Tenencia</span>
                <span className="font-semibold text-sm">{tenencia}</span>
              </div>
              <div className="bg-muted/30 p-2 rounded-lg border">
                <span className="text-[11px] text-muted-foreground block">Tipo de Vivienda</span>
                <span className="font-semibold text-sm">{tipoVivienda}</span>
              </div>
            </div>
            <div className="bg-muted/30 p-2 rounded-lg border">
              <span className="text-[11px] text-muted-foreground block">Situación Laboral</span>
              <span className="font-semibold text-sm">{situacionLaboral}</span>
            </div>
            <div className="bg-muted/30 p-2 rounded-lg border">
              <span className="text-[11px] text-muted-foreground block">Nivel Educativo Principal</span>
              <span className="font-semibold text-sm">{educacion}</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Servicios Básicos Disponibles</span>
                <span className="text-xs font-bold text-primary">{Math.round(coberturaServicios * 100)}% cobertura</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs bg-muted/20 p-2 rounded-lg border">
                {SERV_LABELS.map((lbl, idx) => {
                  const active = serviciosArr[idx] === true;
                  return (
                    <span key={lbl} className={`inline-flex items-center gap-1 ${active ? "font-semibold text-foreground" : "text-muted-foreground line-through opacity-60"}`}>
                      {active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <span className="h-3.5 w-3.5 text-center text-xs">✕</span>}
                      {lbl}
                    </span>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Ingresos y Egresos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Ingresos Mensuales</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: <b>${totalIngresos.toFixed(2)}</b> · Per-cápita: <b>${perCapita.toFixed(2)}</b>
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {ING_LABELS.map((lbl, idx) => (
                <div key={lbl} className="flex justify-between p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground">{lbl}:</span>
                  <b className="font-mono">${(ingresosArr[idx] || 0).toFixed(2)}</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Egresos Mensuales</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: <b>${totalEgresos.toFixed(2)}</b> · Carga: <b>{(ratioGasto * 100).toFixed(1)}%</b>
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {EGR_LABELS.map((lbl, idx) => (
                <div key={lbl} className="flex justify-between p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground">{lbl}:</span>
                  <b className="font-mono">${(egresosArr[idx] || 0).toFixed(2)}</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Puntaje Socioeconómico Consolidado y Dimensiones */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-lg">Puntaje Socioeconómico Consolidado</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Puntaje ponderado (100 = mejor condición socioeconómica)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-primary font-mono">{rec.total.toFixed(1)} pts</span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              Vulnerabilidad {rec.clasificacion}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {SOCIO_WEIGHTS.map((w) => {
              const score =
                subscoresMap[w.key] ??
                subscoresMap[w.dim.toLowerCase()] ??
                subscoresMap[w.key.toLowerCase()] ??
                subscoresMap[
                  w.key === "B62" ? "ingreso" :
                  w.key === "B63" ? "composicion" :
                  w.key === "B64" ? "laboral" :
                  w.key === "B65" ? "vivienda" :
                  w.key === "B66" ? "servicios" :
                  w.key === "B67" ? "gastos" : "educacion"
                ] ?? 0;
              return (
                <div key={w.key} className="border rounded-lg p-3 bg-muted/20 space-y-1">
                  <div className="text-muted-foreground font-semibold flex justify-between">
                    <span>{w.dim}</span>
                    <span className="font-mono font-normal">({Math.round(w.w * 100)}%)</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {score} <span className="text-xs font-normal text-muted-foreground">pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link href={`/admision/ficha-socioeconomica/${id}/print`}>
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
