"use client";
/** Dashboard CMCI: conteos por nivel / prioridad / CMCI + semáforo + alertas. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cmciService } from "@/services/cmci.service";
import { VULN_RANGES } from "@/lib/cmci/params";

export default function DashboardCmciPage() {
  const [d, setD] = useState<Awaited<ReturnType<typeof cmciService.dashboard>> | null>(null);
  useEffect(() => { cmciService.dashboard().then(setD).catch(() => setD(null)); }, []);
  if (!d) return <p className="text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard CMCI</h1>
        <div className="flex gap-2">
          <Link href="/admision/priorizacion"><Button variant="outline">Priorización</Button></Link>
          <Link href="/admision/ficha-vulnerabilidad/nueva"><Button>Nueva valoración</Button></Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Valoraciones</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{d.total}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Promedio</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{d.promedio.toFixed(1)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Alertas protección</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-red-600">{d.alertas}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Centros</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{Object.keys(d.byCmci).length}</CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Por nivel (semáforo)</CardTitle></CardHeader><CardContent className="space-y-2">
          {VULN_RANGES.map((r) => (
            <div key={r.level} className="flex items-center justify-between text-sm">
              <span><span className="inline-block w-3 h-3 rounded mr-2" style={{ background: `#${r.color}` }} />{r.level}</span>
              <b>{d.byNivel[r.level] ?? 0}</b>
            </div>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Por prioridad</CardTitle></CardHeader><CardContent className="space-y-2">
          {["PRIORIDAD 1", "PRIORIDAD 2", "PRIORIDAD 3"].map((p) => (
            <div key={p} className="flex items-center justify-between text-sm"><span>{p}</span><b>{d.byPrio[p] ?? 0}</b></div>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Por CMCI</CardTitle></CardHeader><CardContent className="space-y-2">
          {Object.entries(d.byCmci).map(([c, n]) => (
            <div key={c} className="flex items-center justify-between text-sm"><span>{c}</span><b>{n}</b></div>
          ))}
          {!Object.keys(d.byCmci).length && <p className="text-sm text-muted-foreground">Sin datos.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}
