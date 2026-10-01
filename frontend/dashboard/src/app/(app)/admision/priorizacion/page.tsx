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
    a.href = url; a.download = `Priorizacion_CMCI_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${rows.length} filas ordenadas por Z.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Priorización CMCI (orden Z)</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>Exportar</Button>
          <PrintButton />
        </div>
      </div>
      <Card><CardHeader><CardTitle>{rows.length} valoraciones</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><TableHeader><TableRow>
            <TableHead>Z</TableHead><TableHead>Código</TableHead><TableHead>Niño</TableHead>
            <TableHead>Edad</TableHead><TableHead>CMCI</TableHead><TableHead>Fecha</TableHead>
            <TableHead>Total</TableHead><TableHead>Nivel</TableHead><TableHead>Prioridad</TableHead>
            <TableHead>Alerta</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader><TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.Z}</TableCell>
                <TableCell><Link className="underline" href={`/admision/ficha-vulnerabilidad/${r.id}`}>{r.codigo}</Link></TableCell>
                <TableCell>{r.nino}</TableCell><TableCell>{r.edadMeses}m</TableCell>
                <TableCell>{r.cmci}</TableCell><TableCell>{r.fecha}</TableCell>
                <TableCell><b>{r.total.toFixed(2)}</b></TableCell>
                <TableCell><span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `#${r.color}` }}>{r.nivel}</span></TableCell>
                <TableCell>{r.prioridad}</TableCell>
                <TableCell>{r.alerta ? <Badge variant="destructive">SÍ</Badge> : <Badge variant="outline">NO</Badge>}</TableCell>
                <TableCell>{r.estado}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">Sin valoraciones — cree una en Ficha vulnerabilidad / Nueva.</TableCell></TableRow>}
          </TableBody></Table>
        </CardContent></Card>
    </div>
  );
}
