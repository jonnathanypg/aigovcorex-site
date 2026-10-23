"use client";
/**
 * Constancia de Inscripción y Valoración Inicial — Ficha Oficial para Expediente Físico.
 * Formato en 2 páginas A4 con membrete (cabecera y pie en flujo normal).
 *
 * Reglas de datos:
 * - Solo se imprime información que existe en la base de datos.
 * - Los campos sin dato quedan vacíos; no se usan guiones ni afirmaciones clínicas
 *   por defecto (vacunas completas, control al día, anemia negativa, IDII acorde, etc.).
 */
import { useEffect, useState } from "react";
import { PrintButton, PrintA4Page, semaforoBg } from "@/components/cmci/print-header";
import { childrenService } from "@/services/children.service";
import { licenseAdminService } from "@/services/license-admin.service";

type ChildRec = Record<string, any>;
type FamilyRec = Record<string, any>;
interface RepRec {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  relationship?: string;
  phone?: string;
  cedula?: string;
  occupation?: string;
  is_primary?: boolean;
}

interface IdiiDomain {
  key: string;
  label: string;
  level: string;
  percentage: number;
  counts?: Record<string, number>;
  total?: number;
  record_date?: string | null;
  notes?: string;
}

interface IdiiSummary {
  domains: IdiiDomain[];
  percentage: number;
  level: string;
  record_date?: string | null;
}

interface VaccineSummary {
  total: number;
  applied: number;
  pending: number;
  omitted: number;
  overdue: number;
  complete: boolean;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s === "—" || s.toLowerCase() === "n/a") return "";
  return s;
}

function joinList(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => text(x)).filter(Boolean).join(", ");
  return text(v);
}

function formatDE(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)} DE`;
}

function formatDate(val: unknown): string {
  const s = text(val);
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function measurement(val: unknown, unit: string): string {
  const s = text(val);
  return s ? `${s} ${unit}` : "";
}

export default function RegistroPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [orgConfig, setOrgConfig] = useState<any>(null);

  useEffect(() => {
    childrenService.getById(Number(id)).then(setData).catch(() => setData(null));
    licenseAdminService.getPublicConfig().then(setOrgConfig).catch(() => setOrgConfig(null));
  }, [id]);

  const c = (data?.child ?? {}) as ChildRec;
  const f = (data?.family ?? {}) as FamilyRec;
  const reps = ((data?.representatives ?? []) as RepRec[]);
  const primaryRep = reps.find((r) => r.is_primary) || reps[0] || {};
  const lastVuln = data?.last_vulnerability;
  const lastHealth = data?.last_health;
  const growth = data?.last_growth;
  const medProfile = data?.medical_profile ?? {};
  const vaccineSummary = (data?.vaccine_summary ?? null) as VaccineSummary | null;
  const idii = (data?.idii_summary ?? null) as IdiiSummary | null;
  const milestones = data?.milestones ?? [];

  // Educadora y coordinadora: solo datos realmente asignados/registrados.
  const educatorName = text(c.educator_name || c.assigned_educator_name);
  const educatorCedula = text(c.educator_cedula);
  const coordinatorName = text(c.coordinator_name);

  // Metadatos institucionales y de proyecto (dinámicos por la licencia del centro del niño)
  const childLicense = data?.license ?? {};
  const activeConfig = {
    institutions_header: childLicense.institutions_header ?? orgConfig?.institutions_header ?? null,
    project_name: childLicense.project_name ?? orgConfig?.project_name ?? null,
    convenio_text: childLicense.convenio_text ?? orgConfig?.convenio_text ?? null,
    finalidad_text: childLicense.finalidad_text ?? orgConfig?.finalidad_text ?? null,
    poblacion_text: childLicense.poblacion_text ?? orgConfig?.poblacion_text ?? null,
    objetivo_text: childLicense.objetivo_text ?? orgConfig?.objetivo_text ?? null,
    servicios_text: childLicense.servicios_text ?? orgConfig?.servicios_text ?? null,
    print_footer_note: childLicense.print_footer_note ?? orgConfig?.print_footer_note ?? null,
    license_name: childLicense.name || orgConfig?.license_name || c.tenant_name || "Institución",
    legal_name: childLicense.legal_name || orgConfig?.legal_name || null,
    header_banner_path: childLicense.header_banner_path ?? orgConfig?.header_banner_path ?? null,
    footer_banner_path: childLicense.footer_banner_path ?? orgConfig?.footer_banner_path ?? null,
  };

  const institutionsHeader = activeConfig.institutions_header || activeConfig.legal_name || activeConfig.license_name || "";
  const projectName = activeConfig.project_name || activeConfig.license_name || c.tenant_name || "";
  const convenio = activeConfig.convenio_text || "";
  const finalidad = activeConfig.finalidad_text || "";
  const poblacion = activeConfig.poblacion_text || "";
  const objetivo = activeConfig.objetivo_text || "";
  const servicios = activeConfig.servicios_text || "";
  const hasConvenioData = Boolean(convenio || finalidad || poblacion || objetivo || servicios);
  const footerNote = activeConfig.print_footer_note || "Se extiende la presente constancia para ser incorporada al expediente físico del niño/a.";

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const resolveBannerUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("blob:")) return path;
    if (path.startsWith("/static/") || path.startsWith("/uploads/")) {
      return `${API_URL}${path}`;
    }
    return path.startsWith("/") ? path : `/${path}`;
  };

  const headerBannerUrl = resolveBannerUrl(activeConfig.header_banner_path);
  const footerBannerUrl = resolveBannerUrl(activeConfig.footer_banner_path);

  const childName = text(c.full_name) || `${text(c.last_name)}, ${text(c.first_name)}`.replace(/^,\s*/, "");
  const childFullNameUpper = childName.toUpperCase();
  const centerName = text(c.tenant_name || c.center_name);
  const childCedula = text(c.cedula);
  const childStatus = text(c.status);
  const enrollmentDate = formatDate(c.enrollment_date);

  // Semáforo de completitud de expediente (solo para el indicador interno de la ficha)
  const checks: Array<[string, unknown]> = [
    ["Nombre", c.full_name],
    ["Cédula", c.cedula],
    ["Nacimiento", c.birth_date],
    ["Estado", c.status],
    ["Grupo", c.assigned_group],
    ["Representante", primaryRep.first_name || primaryRep.full_name],
    ["Alergias", c.allergies],
    ["Condiciones médicas", c.medical_conditions],
    ["Familia", f.address ?? f.phone_primary],
  ];
  const filled = checks.filter(([, v]) => text(v)).length;
  const pct = Math.round((filled / checks.length) * 100);
  const sem = pct >= 80 ? "VERDE" : pct >= 50 ? "AMARILLO" : "ROJO";

  const todayStr = new Date().toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Antropometría: solo del último registro con medidas reales. Nunca del peso/talla al nacer.
  const weight = growth?.weight ?? null;
  const height = growth?.height ?? null;
  const headCircumference = growth?.head_circumference ?? null;
  const imc = weight != null && height != null && Number(height) > 0
    ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(2)
    : null;
  const birthWeight = c.birth_weight ?? null;
  const birthHeight = c.birth_height ?? null;
  const zWeight = growth?.z_score_weight ?? null;
  const zHeight = growth?.z_score_height ?? null;
  const bloodType = text(c.blood_type) || text(medProfile.blood_type);

  // Salud: datos del niño + perfil médico (si existe).
  const allergies = text(c.allergies) || joinList(medProfile.allergies);
  const medicalConditions = text(c.medical_conditions) || joinList(medProfile.chronic_conditions);
  const currentMedications = joinList(medProfile.current_medications);
  const healthNotes = text(lastHealth?.notes);
  const healthResponsible = text(lastHealth?.registered_by || lastHealth?.medical_professional);
  const hospital = text(medProfile.hospital_preference);
  const hasDisability = f.has_disability === true || f.has_disability === false ? f.has_disability : null;

  const hasVaccineData = Boolean(vaccineSummary && vaccineSummary.total > 0);
  const vaccineComplete = hasVaccineData ? Boolean(vaccineSummary?.complete) : null;

  const hasNutritionData = zWeight !== null || zHeight !== null;
  const vulnerabilityTotal = lastVuln?.total != null ? Number(lastVuln.total) : null;
  const vulnerabilitySem = text(lastVuln?.semaphore).toUpperCase();
  const vulnerabilityPriority = text(lastVuln?.priority);

  return (
    <div className="print-sheet print-page bg-slate-100 min-h-screen py-6 print:bg-white print:py-0 print:p-0">
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="font-bold text-sm text-slate-800">Vista Previa de Impresión Oficial</h2>
          <p className="text-xs text-slate-500">Documento de 2 páginas A4. Los campos sin dato se imprimen vacíos.</p>
        </div>
        <PrintButton />
      </div>

      {!data ? (
        <div className="bg-white p-12 max-w-[210mm] mx-auto text-center rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">Cargando constancia de expediente…</p>
        </div>
      ) : (
        <div className="max-w-[210mm] mx-auto text-black text-[11px] leading-tight print:max-w-none print:m-0">
          {/* ═══════════════════════════════════════════════════════════════
              PÁGINA 1 — Identificación, centro, familia y nutrición
              ═══════════════════════════════════════════════════════════════ */}
          <PrintA4Page headerUrl={headerBannerUrl} footerUrl={footerBannerUrl}>
            <div className="relative z-10">
              {/* Encabezado Superior: Instituciones Cooperantes Dinámicas */}
              <div className="border-b-2 border-black pb-1 mb-1.5">
                {institutionsHeader && (
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                    {institutionsHeader}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-0.5">
                  <span>
                    Expediente {activeConfig.license_name} · Código <b>{id}</b>
                    {childCedula ? <> · C.I. <b>{childCedula}</b></> : null}
                  </span>
                </div>
              </div>

              {/* Título Oficial del Proyecto y Documento */}
              <div className="text-center my-2 print:my-1.5">
                {projectName && (
                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-700 leading-snug">
                    {projectName}
                  </p>
                )}
                <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-950 mt-0.5">
                  CONSTANCIA DE INSCRIPCIÓN Y VALORACIÓN INICIAL
                </h1>
                <p className="text-[9.5px] text-slate-600 mt-0.5">
                  Documento para expediente {activeConfig.license_name} · Código de registro: <b>{id}</b> · Fecha de emisión: {todayStr}
                </p>
              </div>

              {/* Metadatos de Convenio (solo si la licencia los tiene configurados) */}
              {hasConvenioData && (
                <div className="border border-black p-1.5 mb-2 text-[9.5px] leading-snug space-y-0.5 bg-slate-50/50">
                  {convenio && <p><b>Convenio:</b> {convenio}</p>}
                  {finalidad && <p><b>Finalidad:</b> {finalidad}</p>}
                  {poblacion && <p><b>Población:</b> {poblacion}</p>}
                  {objetivo && <p><b>Objetivo:</b> {objetivo}</p>}
                  {servicios && <p><b>Servicios:</b> {servicios}</p>}
                </div>
              )}

              {/* Párrafo Formal de Certificación */}
              <div className="border-l-4 border-slate-900 bg-slate-50 p-2 mb-2 text-[10px] leading-relaxed text-slate-800">
                Por medio del presente se hace constar que el niño/a <b>{childFullNameUpper}</b>
                {childCedula ? <>, con cédula de identidad N.° <b>{childCedula}</b></> : null}
                , se encuentra inscrito/a
                {childStatus ? <> y en estado <b className="uppercase">{childStatus}</b></> : null}
                {projectName ? <> en el <b>{projectName}</b></> : null}
                {centerName ? <>, asignado al centro <b>{centerName}</b></> : null}
                {enrollmentDate ? <> desde el {enrollmentDate}</> : null}.
              </div>

              {/* 1. IDENTIFICACIÓN DEL NIÑO / NIÑA */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  1. IDENTIFICACIÓN DEL NIÑO / NIÑA
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Nombres y apellidos</td>
                      <td className="w-1/4 py-0.5 px-2 font-bold border-r border-slate-200">{text(c.full_name)}</td>
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Cédula de identidad</td>
                      <td className="w-1/4 py-0.5 px-2 font-mono font-medium">{childCedula}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de nacimiento</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{formatDate(c.birth_date)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Edad actual</td>
                      <td className="py-0.5 px-2 font-semibold">{text(c.age_display)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Género</td>
                      <td className="py-0.5 px-2 capitalize border-r border-slate-200">{text(c.gender)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Tipo de sangre</td>
                      <td className="py-0.5 px-2">{bloodType}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de ingreso</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{enrollmentDate}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Estado en programa</td>
                      <td className="py-0.5 px-2 uppercase font-bold text-slate-900">{childStatus}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. ASIGNACIÓN EN EL CENTRO */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  2. ASIGNACIÓN EN EL CENTRO
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Centro</td>
                      <td className="w-1/4 py-0.5 px-2 font-semibold border-r border-slate-200">{centerName}</td>
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Grupo asignado</td>
                      <td className="w-1/4 py-0.5 px-2 font-medium">{text(c.assigned_group)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Educadora asignada</td>
                      <td className="py-0.5 px-2 font-medium border-r border-slate-200">{educatorName}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">C.I. educadora</td>
                      <td className="py-0.5 px-2 font-mono">{educatorCedula}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Coordinadora del centro</td>
                      <td className="py-0.5 px-2 font-medium border-r border-slate-200">{coordinatorName}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Jornada</td>
                      <td className="py-0.5 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. DATOS FAMILIARES Y REPRESENTANTE LEGAL */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  3. DATOS FAMILIARES Y REPRESENTANTE LEGAL
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Domicilio</td>
                      <td colSpan={3} className="py-0.5 px-2">{text(f.address)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Sector / Parroquia</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{text(f.sector || f.neighborhood || f.city)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Representante</td>
                      <td className="py-0.5 px-2 font-semibold">
                        {text(primaryRep.full_name) || `${text(primaryRep.first_name)} ${text(primaryRep.last_name)}`.trim()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Parentesco</td>
                      <td className="py-0.5 px-2 capitalize border-r border-slate-200">{text(primaryRep.relationship)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Teléfono / Emergencia</td>
                      <td className="py-0.5 px-2 font-mono">{text(primaryRep.phone || f.phone_primary || f.emergency_contact_phone)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. VALORACIÓN INICIAL — NUTRICIÓN Y CRECIMIENTO */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  4. VALORACIÓN INICIAL — NUTRICIÓN Y CRECIMIENTO
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de valoración</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{formatDate(lastHealth?.record_date)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Responsable</td>
                      <td className="py-0.5 px-2">{healthResponsible}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso (kg)</td>
                      <td className="py-0.5 px-2 font-mono border-r border-slate-200">{measurement(weight, "kg")}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla / Longitud (cm)</td>
                      <td className="py-0.5 px-2 font-mono">{measurement(height, "cm")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Perímetro cefálico (cm)</td>
                      <td className="py-0.5 px-2 font-mono border-r border-slate-200">{measurement(headCircumference, "cm")}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">IMC (kg/m²)</td>
                      <td className="py-0.5 px-2 font-mono">{imc ? `${imc} kg/m²` : ""}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso al nacer (kg)</td>
                      <td className="py-0.5 px-2 font-mono border-r border-slate-200">{measurement(birthWeight, "kg")}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla al nacer (cm)</td>
                      <td className="py-0.5 px-2 font-mono">{measurement(birthHeight, "cm")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso / Edad (DE)</td>
                      <td className="py-0.5 px-2 font-mono border-r border-slate-200">{formatDE(zWeight)}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla / Edad (DE)</td>
                      <td className="py-0.5 px-2 font-mono">{formatDE(zHeight)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso / Talla (DE)</td>
                      <td className="py-0.5 px-2 font-mono border-r border-slate-200"></td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Hemoglobina (g/dL)</td>
                      <td className="py-0.5 px-2 font-mono"></td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Diagnóstico nutricional</td>
                      <td colSpan={3} className="py-0.5 px-2">
                        {hasNutritionData ? (
                          <span className="inline-flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>{zWeight !== null && zWeight >= -2 && zWeight <= 2 ? "☑" : "☐"} Normal</span>
                            <span>{zWeight !== null && zWeight < -2 ? "☑" : "☐"} Desnutrición aguda</span>
                            <span>{zHeight !== null && zHeight < -2 ? "☑" : "☐"} Desnutrición crónica</span>
                            <span>{zWeight !== null && zWeight > 2 && zWeight <= 3 ? "☑" : "☐"} Sobrepeso</span>
                            <span>{zWeight !== null && zWeight > 3 ? "☑" : "☐"} Obesidad</span>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Anemia</td>
                      <td colSpan={3} className="py-0.5 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </PrintA4Page>

          {/* ═══════════════════════════════════════════════════════════════
              PÁGINA 2 — Salud, IDII, vulnerabilidad, observaciones y firmas
              ═══════════════════════════════════════════════════════════════ */}
          <PrintA4Page headerUrl={headerBannerUrl} footerUrl={footerBannerUrl}>
            <div className="relative z-10">
              {/* 5. VALORACIÓN INICIAL — SALUD */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  5. VALORACIÓN INICIAL — SALUD
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Esquema de vacunación</td>
                      <td className="w-1/4 py-0.5 px-2 border-r border-slate-200">
                        {hasVaccineData ? (
                          <span className="inline-flex gap-3">
                            <span>{vaccineComplete ? "☑" : "☐"} Completo</span>
                            <span>{!vaccineComplete ? "☑" : "☐"} Incompleto</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Control niño sano</td>
                      <td className="w-1/4 py-0.5 px-2"></td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Alergias</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{allergies}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Condiciones médicas</td>
                      <td className="py-0.5 px-2">{medicalConditions}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Discapacidad registrada</td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-semibold">
                        {hasDisability === null ? "" : hasDisability ? `SÍ${text(f.disability_detail) ? ` (${text(f.disability_detail)})` : ""}` : "NO"}
                      </td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Necesidades especiales</td>
                      <td className="py-0.5 px-2">{text(c.special_needs)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Desparasitación</td>
                      <td className="py-0.5 px-2 border-r border-slate-200"></td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Suplementación (Fe / Vit. A)</td>
                      <td className="py-0.5 px-2"></td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Establecimiento de salud</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">{hospital}</td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Observaciones</td>
                      <td className="py-0.5 px-2 whitespace-pre-wrap">{healthNotes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 6. VALORACIÓN INICIAL — INDICADORES DE DESARROLLO INFANTIL INTEGRAL (IDII) */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  6. VALORACIÓN INICIAL — INDICADORES DE DESARROLLO INFANTIL INTEGRAL (IDII)
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 font-bold text-center">
                      <th className="text-left py-0.5 px-2 w-[30%] border-r border-slate-300">Ámbito de desarrollo</th>
                      <th className="py-0.5 px-1 w-[10%] border-r border-slate-300">Adquirido (A)</th>
                      <th className="py-0.5 px-1 w-[10%] border-r border-slate-300">En proceso (EP)</th>
                      <th className="py-0.5 px-1 w-[10%] border-r border-slate-300">Inicio (I)</th>
                      <th className="text-left py-0.5 px-2 w-[40%]">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idii?.domains?.map((dom) => (
                      <tr key={dom.key} className="border-b border-slate-200 text-center">
                        <td className="text-left py-0.5 px-2 font-medium bg-slate-50 border-r border-slate-200">{dom.label}</td>
                        <td className="py-0.5 px-2 font-bold border-r border-slate-200">{dom.level === "adquirido" ? "☑" : "☐"}</td>
                        <td className="py-0.5 px-2 font-bold border-r border-slate-200">{dom.level === "en_proceso" ? "☑" : "☐"}</td>
                        <td className="py-0.5 px-2 font-bold border-r border-slate-200">{dom.level === "no_iniciado" ? "☑" : "☐"}</td>
                        <td className="text-left py-0.5 px-2 text-[8.5px] text-slate-600 leading-tight">
                          {text(dom.notes) ? <span>{text(dom.notes)} · </span> : null}
                          <span>{dom.percentage}% ({dom.counts?.adquirido ?? 0}/{dom.total ?? 0})</span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="py-1 px-2 font-semibold text-left border-r border-slate-200">Resultado global IDII</td>
                      <td colSpan={2} className="py-1 px-2 text-left border-r border-slate-200">
                        {idii ? (
                          <span className="inline-flex flex-wrap gap-3">
                            <span>{idii.level === "acorde" ? "☑" : "☐"} Acorde a la edad</span>
                            <span>{idii.level === "en_riesgo" ? "☑" : "☐"} En riesgo</span>
                            <span>{idii.level === "requiere_derivacion" ? "☑" : "☐"} Requiere derivación</span>
                            <span className="text-[8.5px] text-slate-600">({idii.percentage}%)</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 px-2 font-semibold border-r border-slate-200">Fecha de aplicación</td>
                      <td className="py-1 px-2 font-mono text-left">{formatDate(idii?.record_date ?? milestones[0]?.record_date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 7. SEMÁFORO DE VULNERABILIDAD Y COMPLETITUD DEL EXPEDIENTE */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  7. SEMÁFORO DE VULNERABILIDAD Y COMPLETITUD DEL EXPEDIENTE
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Completitud de expediente</td>
                      <td className="w-1/4 py-0.5 px-2 border-r border-slate-200 font-semibold">
                        {filled}/{checks.length} ({pct}%) — <span style={{ background: semaforoBg(sem), padding: "0 4px", fontWeight: "bold" }}>{sem}</span>
                      </td>
                      <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Puntaje vulnerabilidad</td>
                      <td className="w-1/4 py-0.5 px-2 font-bold font-mono">
                        {vulnerabilityTotal !== null ? `${vulnerabilityTotal}/100` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Nivel de semáforo</td>
                      <td className="py-0.5 px-2 border-r border-slate-200">
                        {vulnerabilityTotal !== null || vulnerabilitySem ? (
                          <span className="inline-flex flex-wrap gap-2 text-[9px]">
                            <span>{vulnerabilitySem.includes("VERDE") || (vulnerabilityTotal !== null && vulnerabilityTotal <= 40) ? "☑" : "☐"} Verde (0–40)</span>
                            <span>{vulnerabilitySem.includes("AMARILLO") || (vulnerabilityTotal !== null && vulnerabilityTotal > 40 && vulnerabilityTotal <= 60) ? "☑" : "☐"} Amarillo (40–60)</span>
                            <span>{vulnerabilitySem.includes("NARANJA") || (vulnerabilityTotal !== null && vulnerabilityTotal > 60 && vulnerabilityTotal <= 80) ? "☑" : "☐"} Naranja (60–80)</span>
                            <span>{vulnerabilitySem.includes("ROJO") || (vulnerabilityTotal !== null && vulnerabilityTotal > 80) ? "☑" : "☐"} Rojo (80–100)</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Priorización</td>
                      <td className="py-0.5 px-2">
                        {vulnerabilityPriority ? (
                          <span className="inline-flex gap-3">
                            <span>☑ {vulnerabilityPriority}</span>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 8. OBSERVACIONES Y NOTAS DE SEGUIMIENTO */}
              <div className="mb-2 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                  8. OBSERVACIONES Y NOTAS DE SEGUIMIENTO
                </div>
                <div className="border border-t-0 border-slate-300 p-1.5 text-[9.5px] min-h-[36px] text-slate-800 leading-normal">
                  {text(c.notes) ? <p className="mb-0.5 whitespace-pre-wrap">{text(c.notes)}</p> : null}
                  <p>{footerNote}</p>
                </div>
              </div>

              {/* SECCIÓN DE FIRMAS FÍSICAS (SOLO EDUCADORA Y COORDINADORA SEGÚN DIRECTIVA OFICIAL) */}
              <div className="mt-4 pt-2 mb-2 break-inside-avoid print:break-inside-avoid">
                <div className="grid grid-cols-2 gap-16 px-12">
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-semibold text-[10px] text-slate-600">Educadora Responsable</p>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">{educatorName}</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-semibold text-[10px] text-slate-600">Coordinadora del Centro</p>
                      <p className="text-[9.5px] text-slate-500 mt-0.5">{coordinatorName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PrintA4Page>
        </div>
      )}
    </div>
  );
}
