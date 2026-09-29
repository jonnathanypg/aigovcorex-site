"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService, type SocioRecord } from "@/services/cmci.service";
import { normalizeCenterLabel } from "@/lib/cmci/params";

export default function FichaSocioeconomicaDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rec, setRec] = useState<SocioRecord | undefined>();
  useEffect(() => { cmciService.getSocio(id).then(setRec).catch(() => setRec(undefined)); }, [id]);
  if (!rec) return <p className="text-muted-foreground">Registro no encontrado.</p>;
  const p = rec.payload as { resultado: { sub: Record<string, number>; E18: number; E19: number; E29: number; E30: number; E31: number; B54: number; B55: number; B56: number; B57: string; B58: string } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{rec.codigo} — {rec.nino}</h1>
        <PrintButton />
      </div>
      <Card><CardHeader><CardTitle>Resumen</CardTitle></CardHeader><CardContent className="text-sm grid gap-1 md:grid-cols-3">
        <div>Total: <b>{rec.total.toFixed(1)}</b></div>
        <div>Clasificación: <b>{rec.clasificacion}</b></div>
        <div>Per-cápita: <b>${rec.perCapita.toFixed(2)}</b></div>
        <div>Centro: {normalizeCenterLabel(rec.cmci)}</div><div>Fecha: {rec.fecha}</div><div>Representante: {rec.representante}</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Subpuntajes B62-B68</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-4 text-sm">
        {Object.entries(p.resultado.sub).map(([k, v]) => (<div key={k} className="border rounded p-2">{k}: <b>{v}</b></div>))}
      </CardContent></Card>
    </div>
  );
}
