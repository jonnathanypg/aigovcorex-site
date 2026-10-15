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
  const [data, setData] = useState<{ child: unknown; family: unknown; representatives: unknown[]; last_vulnerability?: any; last_socioeconomic?: any } | null>(null);
  useEffect(() => {
    childrenService.getById(Number(id)).then(setData).catch(() => setData(null));
  }, [id]);
  const c = (data?.child ?? {}) as ChildRec;
  const f = (data?.family ?? {}) as FamilyRec;
  const reps = ((data?.representatives ?? []) as RepRec[]);
  const lastVuln = data?.last_vulnerability;
  const lastSocio = data?.last_socioeconomic;

  // Semáforo de completitud: campos clave de la ficha.
  const checks: Array<[string, unknown]> = [
    ["Nombre", c.full_name], ["Cédula", c.cedula], ["Nacimiento", c.birth_date],
    ["Estado", c.status], ["Grupo", c.assigned_group], ["Representante", reps[0]?.first_name],
    ["Alergias", c.allergies], ["Condiciones médicas", c.medical_conditions],
    ["Familia", f.address ?? f.phone_primary ?? f.name],
  ];
  const filled = checks.filter(([, v]) => v !== undefined && v !== null && v !== "").length;
  const pct = Math.round((filled / checks.length) * 100);
  const sem = pct >= 80 ? "VERDE" : pct >= 50 ? "AMARILLO" : "ROJO";

  return (
    <div className="print-sheet bg-white text-black p-6 max-w-[210mm] mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      <PrintHeader title="Ficha integral del niño/a — CMCI" codigo={String(id)} fecha={new Date().toISOString().slice(0, 10)} />
      {!data ? <p className="text-sm mt-4">Cargando…</p> : (
        <>
          <div className="mt-3 flex items-center justify-between text-sm border-b pb-2">
            <span>Completitud de Expediente: <b>{filled}/{checks.length} ({pct}%)</b>{" "}
              <span style={{ background: semaforoBg(sem), padding: "1px 8px", borderRadius: "3px", fontWeight: "bold" }}>{sem}</span>
            </span>
            <span className="text-xs text-gray-600">Centro: <b>{cell((c as any).center_name || (c as any).tenant_name)}</b></span>
          </div>

          <table className="w-full text-xs border-collapse mt-3">
            <thead>
              <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-2 bg-gray-100 px-2 py-1">1. Identificación del Niño / Niña</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold w-1/4 py-1">Nombres y Apellidos</td><td className="w-1/4 py-1"><b>{cell(c.full_name)}</b></td><td className="pr-2 font-semibold w-1/4 py-1">Cédula de Identidad</td><td className="w-1/4 py-1">{cell(c.cedula)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold py-1">Fecha de Nacimiento</td><td className="py-1">{cell(c.birth_date)}</td><td className="pr-2 font-semibold py-1">Edad Actual</td><td className="py-1"><b>{cell(c.age_display)}</b></td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Género</td><td className="py-1 capitalize">{cell(c.gender)}</td><td className="pr-2 font-semibold py-1">Tipo de Sangre</td><td className="py-1">{cell(c.blood_type)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold py-1">Fecha de Ingreso</td><td className="py-1">{cell(c.enrollment_date)}</td><td className="pr-2 font-semibold py-1">Estado en Programa</td><td className="py-1 uppercase font-semibold">{cell(c.status)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Grupo Asignado</td><td className="py-1">{cell(c.assigned_group)}</td><td className="pr-2 font-semibold py-1">Educadora Responsable</td><td className="py-1 font-semibold">{cell((c as any).educator_name || (c as any).assigned_educator_name)}</td></tr>
            </tbody>

            <thead>
              <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-3 bg-gray-100 px-2 py-1">2. Datos Familiares y Domicilio</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Domicilio</td><td colSpan={3} className="py-1">{cell(f.address)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold py-1">Sector / Parroquia</td><td className="py-1">{cell(f.sector)}</td><td className="pr-2 font-semibold py-1">Barrio / Localidad</td><td className="py-1">{cell(f.neighborhood || f.city)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Teléfono Principal</td><td className="py-1">{cell(f.phone_primary || c.phone)}</td><td className="pr-2 font-semibold py-1">Teléfono Secundario</td><td className="py-1">{cell(f.phone_secondary)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold py-1">Contacto Emergencia</td><td className="py-1">{cell(f.emergency_contact_name)} {f.emergency_contact_relationship ? `(${f.emergency_contact_relationship})` : ""}</td><td className="pr-2 font-semibold py-1">Tel. Emergencia</td><td className="py-1 font-semibold text-red-600">{cell(f.emergency_contact_phone)}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Tipo de Vivienda</td><td className="py-1">{cell(f.housing_type)}</td><td className="pr-2 font-semibold py-1">Condición Socioeconómica</td><td className="py-1">{cell(f.economic_condition || f.socioeconomic_level)}</td></tr>
            </tbody>

            <thead>
              <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-3 bg-gray-100 px-2 py-1">3. Representantes Legales / Cuidadores</th></tr>
            </thead>
            <tbody>
              {reps.length > 0 ? (
                reps.map((r, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "border-b" : "border-b print-row-alt"}>
                    <td className="pr-2 font-semibold py-1">{r.relationship ? r.relationship.toUpperCase() : `Representante ${idx + 1}`}</td>
                    <td className="py-1"><b>{r.first_name} {r.last_name}</b> {r.cedula ? `(CI: ${r.cedula})` : ""}</td>
                    <td className="pr-2 font-semibold py-1">Teléfono / Ocupación</td>
                    <td className="py-1">{r.phone || "—"} · {r.occupation || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b"><td colSpan={4} className="py-1 text-muted-foreground">Sin representantes registrados</td></tr>
              )}
            </tbody>

            <thead>
              <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-3 bg-gray-100 px-2 py-1">4. Salud, Nutrición y Requerimientos Especiales</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Alergias</td><td className="py-1 text-red-600 font-medium">{cell(c.allergies)}</td><td className="pr-2 font-semibold py-1">Condiciones Médicas</td><td className="py-1">{cell(c.medical_conditions)}</td></tr>
              <tr className="border-b print-row-alt"><td className="pr-2 font-semibold py-1">Necesidades Especiales</td><td className="py-1">{cell(c.special_needs)}</td><td className="pr-2 font-semibold py-1">Discapacidad Registrada</td><td className="py-1">{f.has_disability ? `SÍ (${cell(f.disability_detail)})` : "NO"}</td></tr>
              <tr className="border-b"><td className="pr-2 font-semibold py-1">Peso al Nacer</td><td className="py-1">{c.birth_weight ? `${c.birth_weight} kg` : "—"}</td><td className="pr-2 font-semibold py-1">Talla al Nacer</td><td className="py-1">{c.birth_height ? `${c.birth_height} cm` : "—"}</td></tr>
            </tbody>

            {(lastVuln || lastSocio) && (
              <>
                <thead>
                  <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-3 bg-gray-100 px-2 py-1">5. Valoración Social y Vulnerabilidad Familiar</th></tr>
                </thead>
                <tbody>
                  {lastVuln && (
                    <tr className="border-b">
                      <td className="pr-2 font-semibold py-1">Ficha Vulnerabilidad</td>
                      <td className="py-1">Código: <b>{lastVuln.code}</b> ({lastVuln.assessed_at ? lastVuln.assessed_at.slice(0, 10) : "—"})</td>
                      <td className="pr-2 font-semibold py-1">Puntaje / Semáforo</td>
                      <td className="py-1">
                        <b>{lastVuln.total}/100</b> · Nivel: <b style={{ background: semaforoBg(lastVuln.semaphore), padding: "0 4px" }}>{lastVuln.semaphore || lastVuln.level}</b> · {lastVuln.priority}
                      </td>
                    </tr>
                  )}
                  {lastSocio && (
                    <tr className="border-b print-row-alt">
                      <td className="pr-2 font-semibold py-1">Ficha Socioeconómica</td>
                      <td className="py-1">Código: <b>{lastSocio.code}</b> ({lastSocio.assessed_at ? lastSocio.assessed_at.slice(0, 10) : "—"})</td>
                      <td className="pr-2 font-semibold py-1">Ingreso Per-Cápita</td>
                      <td className="py-1"><b>${lastSocio.per_capita ? Number(lastSocio.per_capita).toFixed(2) : "—"}</b> · {lastSocio.classification || "—"}</td>
                    </tr>
                  )}
                </tbody>
              </>
            )}

            <thead>
              <tr><th colSpan={4} className="text-left uppercase text-xs border-b-2 border-black pt-3 bg-gray-100 px-2 py-1">6. Observaciones y Notas de Seguimiento</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td colSpan={4} className="py-2 text-xs">{cell(c.notes as string)}</td></tr>
            </tbody>
          </table>
        </>
      )}

      <div className="grid grid-cols-2 gap-8 mt-8 text-xs">
        <div className="border-t border-black pt-1 text-center font-medium">Educadora Responsable / Fecha</div>
        <div className="border-t border-black pt-1 text-center font-medium">Coordinadora del Centro / Fecha</div>
      </div>
      <p className="text-[10px] mt-3 text-center print-only text-gray-500">Expediente físico confidencial del CMCI · Ficha oficial de registro.</p>
    </div>
  );
}
