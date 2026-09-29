"use client";
/** Print registro: ficha del niño/a para expediente físico (tablas por sección + semáforo completitud). */
import { useEffect, useState } from "react";
import { PrintHeader, PrintButton, semaforoBg } from "@/components/cmci/print-header";
import { childrenService } from "@/services/children.service";

type ChildRec = Record<string, string | undefined>;
type FamilyRec = Record<string, string | undefined>;
interface RepRec { first_name: string; last_name: string; relationship?: string; phone?: string; }

function cell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function RegistroPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<{ child: unknown; family: unknown; representatives: unknown[] } | null>(null);
  useEffect(() => {
    childrenService.getById(Number(id)).then(setData).catch(() => setData(null));
  }, [id]);
  const c = (data?.child ?? {}) as ChildRec;
  const f = (data?.family ?? {}) as FamilyRec;
  const reps = ((data?.representatives ?? []) as RepRec[]);

  // Semáforo de completitud: campos clave de la ficha.
  const checks: Array<[string, unknown]> = [
    ["Nombre", c.full_name], ["Cédula", c.cedula], ["Nacimiento", c.birth_date],
    ["Estado", c.status], ["Grupo", c.assigned_group], ["Representante", reps[0]?.first_name],
    ["Alergias", c.allergies], ["Condiciones médicas", c.medical_conditions],
    ["Familia", f.address ?? f.phone ?? f.name],
  ];
  const filled = checks.filter(([, v]) => v !== undefined && v !== null && v !== "").length;
  const pct = Math.round((filled / checks.length) * 100);
  const sem = pct >= 80 ? "VERDE" : pct >= 50 ? "AMARILLO" : "ROJO";

  return (
    <div className="print-sheet bg-white text-black p-6 max-w-[210mm] mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      <PrintHeader title="Ficha integral del niño/a — del centro" codigo={String(id)} fecha={new Date().toISOString().slice(0, 10)} />
      {!data ? <p className="text-sm mt-4">Cargando…</p> : (
        <>
          <p className="mt-3 text-sm">
            Completitud: <b>{filled}/{checks.length} ({pct}%)</b>{" "}
            <span style={{ background: semaforoBg(sem), padding: "0 6px" }}>{sem}</span>
          </p>
          <table className="w-full text-sm border-collapse mt-2">
            <thead>
              <tr><th colSpan={2} className="text-left uppercase text-xs border-b-2 border-black pt-2">Identificación</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold">Nombre</td><td><b>{cell(c.full_name)}</b></td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold">Cédula</td><td>{cell(c.cedula)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold">Nacimiento</td><td>{cell(c.birth_date)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold">Edad</td><td>{cell(c.age_display)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold">Estado / Grupo</td><td>{cell(c.status)} · {cell(c.assigned_group)}</td></tr>
            </tbody>
            <thead>
              <tr><th colSpan={2} className="text-left uppercase text-xs border-b-2 border-black pt-3">Familia</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold">Domicilio / Contacto</td><td>{cell(f.address)} · {cell(f.phone ?? c.phone as string)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold">Representantes</td><td>{reps.map((r) => `${r.first_name} ${r.last_name}${r.relationship ? ` (${r.relationship})` : ""}${r.phone ? ` · ${r.phone}` : ""}`).join(" · ") || "—"}</td></tr>
            </tbody>
            <thead>
              <tr><th colSpan={2} className="text-left uppercase text-xs border-b-2 border-black pt-3">Salud</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold">Alergias</td><td>{cell(c.allergies)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold">Condiciones médicas</td><td>{cell(c.medical_conditions)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold">Necesidades especiales</td><td>{cell(c.special_needs)}</td></tr>
            </tbody>
            <thead>
              <tr><th colSpan={2} className="text-left uppercase text-xs border-b-2 border-black pt-3">Asistencia</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold">Matrícula / Grupo</td><td>{cell(c.enrollment_date)} · {cell(c.assigned_group)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold">Estado</td><td>{cell(c.status)}</td></tr>
            </tbody>
            <thead>
              <tr><th colSpan={2} className="text-left uppercase text-xs border-b-2 border-black pt-3">Observaciones</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td colSpan={2}>{cell(c.notes as string)}</td></tr>
            </tbody>
          </table>
        </>
      )}
      <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
        <div className="border-t border-black pt-1 text-center">Educadora · fecha</div>
        <div className="border-t border-black pt-1 text-center">Coordinadora · fecha</div>
      </div>
      <p className="text-[10px] mt-2 text-center print-only">Firma física en papel fuera del sistema (sin firma electrónica).</p>
    </div>
  );
}
