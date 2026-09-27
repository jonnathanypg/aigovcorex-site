"use client";
/** Print reportes: matriz general con encabezado distintivo + preview ?reportId= + firmas papel. */
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PrintHeader, PrintButton, semaforoBg } from "@/components/cmci/print-header";
import { cmciService } from "@/services/cmci.service";
import { reportsService, type Report } from "@/services/reports.service";

export default function ReportesPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando…</p>}>
      <ReportesPrintInner />
    </Suspense>
  );
}

function ReportesPrintInner() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof cmciService.priorizacion>>>([]);
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => { cmciService.priorizacion().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => {
    if (!reportId) return;
    reportsService.getAll().then((list) => {
      setReport(list.find((r) => String(r.id) === String(reportId)) ?? null);
    }).catch(() => setReport(null));
  }, [reportId]);
  const periodo = report?.start_date && report?.end_date
    ? { inicio: report.start_date, fin: report.end_date }
    : undefined;
  return (
    <div className="print-sheet print-landscape bg-white text-black p-6 mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      {reportId && (
        <p className="print:hidden text-xs mb-2 rounded border p-2">
          Vista previa del reporte #{reportId}{report ? ` — ${report.title} (${report.start_date} al ${report.end_date})` : " (cargando…)"} antes de descargar.
        </p>
      )}
      <PrintHeader
        title={report ? `Matriz general — ${report.title}` : "Matriz general de usuarios — CMCI"}
        codigo={reportId ? `reporte-${reportId}` : `corte-${new Date().toISOString().slice(0, 10)}`}
        fecha={new Date().toISOString().slice(0, 10)}
        periodo={periodo}
      />
      <table className="w-full text-xs border-collapse mt-3">
        <thead><tr className="border-b-2 border-black">
          {["Z", "Código", "Niño", "Edad", "CMCI", "Fecha", "Total", "Nivel", "Prioridad", "Alerta", "Estado"].map((h) => <th key={h} className="text-left pr-2">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.id} className={`border-b ${i % 2 === 1 ? "print-row-alt" : ""}`}>
            <td>{r.Z}</td><td>{r.codigo}</td><td>{r.nino}</td><td>{r.edadMeses}m</td><td>{r.cmci}</td><td>{r.fecha}</td>
            <td>{r.total.toFixed(2)}</td>
            <td><span style={{ background: semaforoBg(r.semaforo, r.nivel), padding: "0 6px" }}>{r.nivel}</span></td>
            <td>{r.prioridad}</td><td>{r.alerta ? "Sí" : "No"}</td><td>{r.estado}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
        <div className="border-t border-black pt-1 text-center">Educadora · fecha</div>
        <div className="border-t border-black pt-1 text-center">Coordinadora · fecha</div>
      </div>
      <p className="text-[10px] mt-2 text-center print-only">Firma física en papel fuera del sistema (sin firma electrónica).</p>
    </div>
  );
}
