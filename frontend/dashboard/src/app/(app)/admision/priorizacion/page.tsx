"use client";
/** Priorización: tabla orden Z + export. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService } from "@/services/cmci.service";
import { normalizeCenterLabel } from "@/lib/cmci/params";
import { useToast } from "@/hooks/use-toast";

export default function PriorizacionPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof cmciService.priorizacion>>>([]);
  useEffect(() => { cmciService.priorizacion().then(setRows).catch(() => setRows([])); }, []);

  const handleExport = async () => {
    const csv = await cmciService.exportPriorizacionCSV(rows);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Priorizacion_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${rows.length} filas ordenadas por Z.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Priorización (orden Z)</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>Exportar</Button>
          <PrintButton />
        </div>
      </div>
      <Card><CardHeader><CardTitle>{rows.length} valoraciones</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12 text-center font-bold">Z</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Código</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Niño / Niña</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Edad</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Centro</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Fecha</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-right">Total</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Nivel</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Prioridad</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-center">Alerta</TableHead>
                <TableHead className="whitespace-nowrap font-bold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="text-center font-bold text-muted-foreground">{r.Z}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    <Link className="underline font-semibold hover:text-primary" href={`/admision/ficha-vulnerabilidad/${r.id}`}>
                      {r.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.nino}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.edadMeses}m</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className="text-xs">{normalizeCenterLabel(r.cmci)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.fecha}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-bold">{r.total.toFixed(2)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `#${r.color}` }}>
                      {r.nivel}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-semibold">{r.prioridad}</TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    {r.alerta ? <Badge variant="destructive" className="text-[11px] font-bold">SÍ</Badge> : <Badge variant="secondary" className="text-[11px]">NO</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={r.estado === 'Completa' ? 'default' : 'outline'} className="text-xs">
                      {r.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Sin valoraciones registradas — cree una nueva en Ficha Vulnerabilidad.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
    </div>
  );
}
