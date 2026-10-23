"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService, type SocioRecord } from "@/services/cmci.service";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

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
      <div className="space-y-4">
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

  // Extracción robusta y defensiva del payload
  const rawPayload = (rec.payload ?? {}) as Record<string, unknown>;
  const rawResultado = (rawPayload.resultado ?? {}) as Record<string, unknown>;
  const subscoresMap =
    (rawResultado.subscores as Record<string, number> | undefined) ??
    (rawResultado.sub as Record<string, number> | undefined) ??
    (rawPayload.subscores as Record<string, number> | undefined) ??
    (rawPayload.sub as Record<string, number> | undefined) ??
    {};

  const subentries = Object.entries(subscoresMap);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/admision">
              <Button variant="ghost" size="sm" className="gap-1 p-0 h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                Admisión
              </Button>
            </Link>
            <span className="text-muted-foreground text-sm">/ Ficha #{id}</span>
          </div>
          <h1 className="text-2xl font-bold">
            {rec.codigo || `Ficha #${rec.id}`} — {rec.nino || "Sin nombre registrado"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen Socioeconómico</CardTitle>
        </CardHeader>
        <CardContent className="text-sm grid gap-2 md:grid-cols-3">
          <div>
            Total: <b>{typeof rec.total === "number" ? rec.total.toFixed(1) : rec.total || 0}</b>
          </div>
          <div>
            Clasificación: <b>{rec.clasificacion || "Sin clasificación"}</b>
          </div>
          <div>
            Per-cápita: <b>${typeof rec.perCapita === "number" ? rec.perCapita.toFixed(2) : rec.perCapita || 0}</b>
          </div>
          <div>CMCI: <b>{rec.cmci || "No especificado"}</b></div>
          <div>Fecha: {rec.fecha || "No registrada"}</div>
          <div>Representante: {rec.representante || "No especificado"}</div>
          {rec.telefono && <div>Teléfono: {rec.telefono}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subpuntajes y Dimensiones</CardTitle>
        </CardHeader>
        <CardContent>
          {subentries.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-4 text-sm">
              {subentries.map(([k, v]) => (
                <div key={k} className="border rounded-md p-3 bg-muted/20">
                  <span className="text-xs uppercase text-muted-foreground font-semibold block">{k}</span>
                  <b className="text-base">{typeof v === "number" ? v.toFixed(1) : String(v)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se desglosaron subpuntajes detallados para este registro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
