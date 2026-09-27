"use client";
/** Print reportes: matriz general con encabezado distintivo. */
import { useEffect, useState } from "react";
import { PrintHeader, PrintButton } from "@/components/cmci/print-header";
import { cmciService } from "@/services/cmci.service";

export default function ReportesPrintPage() {
  const [rows, setRows] = useState<ReturnType<typeof cmciService.priorizacion>>([]);
  useEffect(() => { setRows(cmciService.priorizacion()); }, []);
  return (
    <div className="print-sheet print-landscape bg-white text-black p-6 mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      <PrintHeader title="Matriz general de usuarios — CMCI" codigo={`corte-${new Date().toISOString().slice(0, 10)}`} fecha={new Date().toISOString().slice(0, 10)} />
      <table className="w-full text-xs border-collapse mt-3">
        <thead><tr className="border-b-2 border-black">
          {["Z", "Código", "Niño", "Edad", "CMCI", "Fecha", "Total", "Nivel", "Prioridad", "Alerta", "Estado"].map((h) => <th key={h} className="text-left pr-2">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-b"><td>{r.Z}</td><td>{r.codigo}</td><td>{r.nino}</td><td>{r.edadMeses}m</td><td>{r.cmci}</td><td>{r.fecha}</td><td>{r.total.toFixed(2)}</td><td>{r.nivel}</td><td>{r.prioridad}</td><td>{r.alerta ? "Sí" : "No"}</td><td>{r.estado}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
