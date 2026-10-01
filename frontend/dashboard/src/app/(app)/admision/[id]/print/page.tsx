"use client";
/** Print ficha vulnerabilidad: bloques A-F idénticos al Excel + semáforo + firmas físicas. */
import { useEffect, useState } from "react";
import { PrintHeader, PrintButton } from "@/components/cmci/print-header";
import { VULN_INDICATORS, VULN_DIMS } from "@/lib/cmci/params";
import { computeVulnerability } from "@/lib/cmci/engine";
import { cmciService, type VulnRecord } from "@/services/cmci.service";

export default function AdmisionPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rec, setRec] = useState<VulnRecord | undefined>();
  useEffect(() => { cmciService.getVuln(id).then(setRec).catch(() => setRec(undefined)); }, [id]);
  if (!rec) return <div className="p-6"><p>No encontrado.</p><PrintButton /></div>;
  const res = computeVulnerability(rec.scores, rec.hogar);
  return (
    <div className="print-sheet bg-white text-black p-6 max-w-[210mm] mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      <PrintHeader title="Matriz de valoración de vulnerabilidad familiar — CMCI" codigo={rec.codigo} fecha={rec.fecha} />
      <section className="mt-3 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">A · Identificación</h2>
        <div className="grid grid-cols-3 gap-1">
          <div>Niño/a: <b>{rec.nino}</b></div><div>Edad: <b>{rec.edadMeses}m {rec.enRango ? "EN RANGO" : "FUERA DE RANGO"}</b></div><div>CMCI: <b>{rec.cmci}</b></div>
          <div>Sector: {rec.sector}</div><div>Representante: {rec.representante} ({rec.parentesco})</div><div>Tel: {rec.telefono}</div>
        </div>
      </section>
      <section className="mt-2 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">B · Hogar</h2>
        <p>Ingreso ${rec.hogar.ingresoTotal} · Integrantes {rec.hogar.integrantes} · Perceptores {rec.hogar.perceptores} · NNA {rec.hogar.nna} · Dormitorios {rec.hogar.dormitorios} · Per-cápita ${res.perCapita.toFixed(2)} · Dependencia {res.dependencia.toFixed(2)} · Hacinamiento {res.hacinamiento.toFixed(2)}</p>
      </section>
      <section className="mt-2 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">C · Matriz por dimensiones</h2>
        {VULN_DIMS.map((d) => (
          <div key={d.code} className="mb-1">
            <p className="font-semibold">{d.code} {d.name} — subtotal {res.subtotals[d.code]?.toFixed(2)}</p>
            <table className="w-full text-xs border-collapse"><tbody>
              {VULN_INDICATORS.filter((i) => i.dim === d.code).map((ind) => {
                const c = res.contributions.find((x) => x.id === ind.id)!;
                return (<tr key={ind.id} className="border-b"><td className="pr-2">{ind.id} {ind.variable}</td><td className="text-right">score {c.score}</td><td className="text-right">peso {c.weight}</td><td className="text-right">aporte {c.aporte.toFixed(2)}</td></tr>);
              })}
            </tbody></table>
          </div>
        ))}
      </section>
      <section className="mt-2 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">D · Consolidado</h2>
        <p>Total <b>{res.total.toFixed(2)}/100</b> ({(res.ratio * 100).toFixed(1)}%) · Nivel <b>{res.level}</b> · Semáforo <b style={{ background: `#${res.color}`, padding: "0 6px" }}>{res.semaphore}</b> · Prioridad <b>{res.priority}</b> · Alerta <b>{res.protectionAlert ? "SÍ — REQUIERE REVISIÓN PROFESIONAL / PROTECCIÓN" : "NO"}</b> · Necesidad cuidado <b>{res.childcareNeed}</b></p>
      </section>
      <section className="mt-2 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">E · Alertas</h2>
        <ul className="list-disc ml-5">{res.alerts.filter((a) => a.active).map((a) => <li key={a.key}>{a.label}: Sí</li>)}{!res.alerts.some((a) => a.active) && <li>Sin alertas activas.</li>}</ul>
      </section>
      <section className="mt-2 text-sm">
        <h2 className="font-bold uppercase text-xs mb-1">F · Resumen + observaciones</h2>
        <p>{rec.codigo} · {res.total.toFixed(2)}/100 · {(res.ratio * 100).toFixed(1)}% · {res.level} · {res.priority} · {res.protectionAlert ? "SÍ" : "NO"} · {res.childcareNeed}</p>
        <p className="mt-1">Observaciones: {rec.observaciones || "—"}</p>
      </section>
      <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
        <div className="border-t border-black pt-1 text-center">Educadora · fecha</div>
        <div className="border-t border-black pt-1 text-center">Coordinadora · fecha</div>
      </div>
      <p className="text-[10px] mt-2 text-center print-only">Firma física en papel fuera del sistema (sin firma electrónica).</p>
    </div>
  );
}
