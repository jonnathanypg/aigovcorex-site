"use client";
/**
 * Constancia de Inscripción y Valoración Inicial — Ficha Oficial para Expediente Físico.
 * Réplica idéntica en estructura, tablas y diseño del formato oficial:
 * Constancia_Expediente_DASE_CMCI_0967553801.pdf
 *
 * Características:
 * - Datos dinámicos de licencia (cooperantes, proyecto, convenio) tomados de configuración pública de la organización.
 * - Formato en 2 páginas con tablas numeradas del 1 al 8.
 * - Sin firma de la representante legal (solo Educadora Responsable y Coordinadora del Centro).
 */
import { useEffect, useState } from "react";
import { PrintButton, semaforoBg, CMCI_CONVENIO_DEFAULTS } from "@/components/cmci/print-header";
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

function cell(v: unknown, fallback: string = "____________"): string {
  if (v === null || v === undefined || v === "" || v === "—") return fallback;
  return String(v);
}

function formatDE(val: number | null | undefined): string {
  if (val === null || val === undefined) return "____________";
  const n = Number(val);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)} DE`;
}

export default function RegistroPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<{
    child: unknown;
    family: unknown;
    representatives: unknown[];
    last_vulnerability?: any;
    last_socioeconomic?: any;
    last_health?: any;
    milestones?: any[];
  } | null>(null);

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
  const milestones = data?.milestones ?? [];

  // Metadatos institucionales y de proyecto (dinámicos por la licencia específica del centro del niño)
  const childLicense = (data as any)?.license || {};
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

  // Semáforo de completitud de expediente
  const checks: Array<[string, unknown]> = [
    ["Nombre", c.full_name],
    ["Cédula", c.cedula],
    ["Nacimiento", c.birth_date],
    ["Estado", c.status],
    ["Grupo", c.assigned_group],
    ["Representante", primaryRep.first_name || primaryRep.full_name],
    ["Alergias", c.allergies],
    ["Condiciones médicas", c.medical_conditions],
    ["Familia", f.address ?? f.phone_primary ?? f.name],
  ];
  const filled = checks.filter(([, v]) => v !== undefined && v !== null && v !== "").length;
  const pct = Math.round((filled / checks.length) * 100);
  const sem = pct >= 80 ? "VERDE" : pct >= 50 ? "AMARILLO" : "ROJO";

  // Fecha actual formateada
  const todayStr = new Date().toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Antropometría calculada
  const pesoKg = lastHealth?.weight ?? c.birth_weight;
  const tallaCm = lastHealth?.height ?? c.birth_height;
  const perimetroCefalico = lastHealth?.head_circumference;
  const imc = pesoKg && tallaCm ? (pesoKg / Math.pow(tallaCm / 100, 2)).toFixed(2) : null;

  // Diagnóstico nutricional por Z-Score
  const zWeight = lastHealth?.z_score_weight;
  const zHeight = lastHealth?.z_score_height;

  // IDII Ámbitos por dominio
  const getDomainLevel = (domainPrefix: string) => {
    const m = milestones.find((x: any) => x.domain?.toLowerCase().includes(domainPrefix.toLowerCase()));
    return m?.achievement_level;
  };

  const domainObservations = (domainPrefix: string) => {
    const m = milestones.find((x: any) => x.domain?.toLowerCase().includes(domainPrefix.toLowerCase()));
    return m?.notes || "";
  };

  const idiiDomains = [
    { key: "motricidad_gruesa", label: "Motricidad gruesa", prefix: "corporal" },
    { key: "motricidad_fina", label: "Motricidad fina", prefix: "corporal" },
    { key: "lenguaje", label: "Lenguaje y comunicación", prefix: "lenguaje" },
    { key: "cognitivo", label: "Cognitivo / exploración del entorno", prefix: "descubrimiento" },
    { key: "socio_afectivo", label: "Socio-afectivo / vínculo", prefix: "vinculacion" },
    { key: "autonomia", label: "Autonomía y hábitos", prefix: "vinculacion" },
  ];

  const childFullNameUpper = (c.full_name || `${c.last_name || ""}, ${c.first_name || ""}`).toUpperCase();

  // Helper para inferir grupo de edad automáticamente si no está asignado
  const resolveAssignedGroup = () => {
    if (c.assigned_group && String(c.assigned_group).trim()) return c.assigned_group;
    const months = c.age_months != null ? Number(c.age_months) : null;
    if (months != null) {
      if (months < 12) return "Lactantes (0 a 11m)";
      if (months <= 18) return "12 a 18 meses";
      if (months <= 24) return "19 a 24 meses";
      if (months <= 30) return "25 a 30 meses";
      if (months <= 36) return "31 a 36 meses";
      return "37 a 42 meses";
    }
    return null;
  };
  const effectiveAssignedGroup = resolveAssignedGroup();

  return (
    <div className="bg-slate-100 min-h-screen py-6 print:bg-white print:py-0 print:p-0">
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="font-bold text-sm text-slate-800">Vista Previa de Impresión Oficial</h2>
          <p className="text-xs text-slate-500">Documento de 2 páginas con diseño fiel a la Constancia de Expediente.</p>
        </div>
        <PrintButton />
      </div>

      {!data ? (
        <div className="bg-white p-12 max-w-[210mm] mx-auto text-center rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">Cargando constancia de expediente…</p>
        </div>
      ) : (
        <div className="max-w-[210mm] mx-auto bg-white text-black text-[11px] leading-tight print:max-w-none print:m-0 print:shadow-none shadow-md">
          {/* ═══════════════════════════════════════════════════════════════
              PÁGINA 1
              ═══════════════════════════════════════════════════════════════ */}
          <div className="relative p-8 print:p-6 print:py-4 min-h-[297mm] print:min-h-0 print:h-[285mm] flex flex-col justify-between print:break-after-page overflow-hidden">
            {/* Pie de membrete en el fondo detrás del contenido (Watermark) */}
            {footerBannerUrl && (
              <div 
                className="absolute inset-x-0 bottom-0 pointer-events-none select-none z-0 opacity-90 overflow-hidden flex items-end justify-center"
                style={{ height: '140mm' }}
              >
                <img
                  src={footerBannerUrl}
                  alt="Pie de membrete"
                  className="w-full h-auto object-contain object-bottom opacity-95"
                />
              </div>
            )}

            <div className="relative z-10">
              {/* Cabecera Gráfica de Membrete Oficial (Ancho total pegada al borde superior sin espaciado) */}
              {headerBannerUrl && (
                <div className="-mx-8 -mt-8 print:-mx-8 print:-mt-8 mb-3 w-[calc(100%+4rem)]">
                  <img
                    src={headerBannerUrl}
                    alt="Cabecera Membrete"
                    className="w-full h-auto block m-0 p-0"
                  />
                </div>
              )}

              {/* Encabezado Superior: Instituciones Cooperantes Dinámicas */}
              <div className="border-b-2 border-black pb-1 mb-2">
                {institutionsHeader && (
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                    {institutionsHeader}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-1">
                  <span>Expediente {activeConfig.license_name} · Código <b>{id}</b> · C.I. <b>{cell(c.cedula, "S/C")}</b></span>
                  <span className="font-semibold">Página 1</span>
                </div>
              </div>

              {/* Título Oficial del Proyecto y Documento */}
              <div className="text-center my-3">
                {projectName && (
                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-700 leading-snug">
                    {projectName}
                  </p>
                )}
                <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-950 mt-1">
                  CONSTANCIA DE INSCRIPCIÓN Y VALORACIÓN INICIAL
                </h1>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Documento para expediente {activeConfig.license_name} · Código de registro: <b>{id}</b> · Fecha de emisión: {todayStr}
                </p>
              </div>

              {/* Metadatos de Convenio (solo si la licencia los tiene configurados) */}
              {hasConvenioData && (
                <div className="border border-black p-2 mb-3 text-[10px] leading-snug space-y-0.5 bg-slate-50/50">
                  {convenio && <p><b>Convenio:</b> {convenio}</p>}
                  {finalidad && <p><b>Finalidad:</b> {finalidad}</p>}
                  {poblacion && <p><b>Población:</b> {poblacion}</p>}
                  {objetivo && <p><b>Objetivo:</b> {objetivo}</p>}
                  {servicios && <p><b>Servicios:</b> {servicios}</p>}
                </div>
              )}

              {/* Párrafo Formal de Certificación */}
              <div className="border-l-4 border-slate-900 bg-slate-50 p-2.5 mb-3 text-[10.5px] leading-relaxed text-slate-800">
                Por medio del presente se hace constar que el niño/a <b>{childFullNameUpper}</b>, con cédula de identidad N.° <b>{cell(c.cedula, "S/C")}</b>, se encuentra inscrito/a y en estado <b className="uppercase">{cell(c.status, "ACTIVO")}</b>{projectName ? <> en el <b>{projectName}</b></> : null}, asignado al centro <b>{cell(c.tenant_name || c.center_name, "Centro")}</b> desde el {cell(c.enrollment_date, "____________")}.
              </div>

              {/* 1. IDENTIFICACIÓN DEL NIÑO / NIÑA */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  1. IDENTIFICACIÓN DEL NIÑO / NIÑA
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Nombres y apellidos</td>
                      <td className="w-1/4 py-1 px-2 font-bold border-r border-slate-200">{cell(c.full_name)}</td>
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Cédula de identidad</td>
                      <td className="w-1/4 py-1 px-2 font-mono font-medium">{cell(c.cedula, "S/C")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de nacimiento</td>
                      <td className="py-1 px-2 border-r border-slate-200">{cell(c.birth_date)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Edad actual</td>
                      <td className="py-1 px-2 font-semibold">{cell(c.age_display)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Género</td>
                      <td className="py-1 px-2 capitalize border-r border-slate-200">{cell(c.gender)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Tipo de sangre</td>
                      <td className="py-1 px-2">{cell(c.blood_type)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de ingreso</td>
                      <td className="py-1 px-2 border-r border-slate-200">{cell(c.enrollment_date)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Estado en programa</td>
                      <td className="py-1 px-2 uppercase font-bold text-slate-900">{cell(c.status, "ACTIVO")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. ASIGNACIÓN EN EL CENTRO */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  2. ASIGNACIÓN EN EL CENTRO
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Centro</td>
                      <td className="w-1/4 py-1 px-2 font-semibold border-r border-slate-200">{cell(c.tenant_name || c.center_name)}</td>
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Grupo asignado</td>
                      <td className="w-1/4 py-1 px-2 font-medium">{cell(effectiveAssignedGroup)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Educadora asignada</td>
                      <td className="py-1 px-2 font-medium border-r border-slate-200">{cell(c.educator_name || c.assigned_educator_name)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">C.I. educadora</td>
                      <td className="py-1 px-2 font-mono">{cell(c.educator_cedula, c.educator_name || c.assigned_educator_name ? "Registrada en legajo" : "____________")}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Coordinadora del centro</td>
                      <td className="py-1 px-2 font-medium border-r border-slate-200">{cell(c.coordinator_name)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Jornada</td>
                      <td className="py-1 px-2">
                        <span className="inline-flex items-center gap-3">
                          <span>☐ Matutina</span>
                          <span>☑ Completa</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. DATOS FAMILIARES Y REPRESENTANTE LEGAL */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  3. DATOS FAMILIARES Y REPRESENTANTE LEGAL
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Domicilio</td>
                      <td colSpan={3} className="py-1 px-2">{cell(f.address)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Sector / Parroquia</td>
                      <td className="py-1 px-2 border-r border-slate-200">{cell(f.sector || f.neighborhood || f.city)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Representante</td>
                      <td className="py-1 px-2 font-semibold">{cell(primaryRep.full_name || `${primaryRep.first_name || ""} ${primaryRep.last_name || ""}`.trim())}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Parentesco</td>
                      <td className="py-1 px-2 capitalize border-r border-slate-200">{cell(primaryRep.relationship, "Madre")}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Teléfono / Emergencia</td>
                      <td className="py-1 px-2 font-mono">{cell(primaryRep.phone || f.phone_primary || f.emergency_contact_phone)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. VALORACIÓN INICIAL — NUTRICIÓN Y CRECIMIENTO */}
              <div className="mb-2">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  4. VALORACIÓN INICIAL — NUTRICIÓN Y CRECIMIENTO
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha de valoración</td>
                      <td className="py-1 px-2 border-r border-slate-200">{cell(lastHealth?.record_date)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Responsable</td>
                      <td className="py-1 px-2">{cell(lastHealth?.registered_by || lastHealth?.medical_professional || c.educator_name)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso (kg)</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{pesoKg ? `${pesoKg} kg` : "____________"}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla / Longitud (cm)</td>
                      <td className="py-1 px-2 font-mono">{tallaCm ? `${tallaCm} cm` : "____________"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Perímetro cefálico (cm)</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{perimetroCefalico ? `${perimetroCefalico} cm` : "____________"}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">IMC (kg/m²)</td>
                      <td className="py-1 px-2 font-mono">{imc ? `${imc} kg/m²` : "____________"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso al nacer (g)</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{c.birth_weight ? `${c.birth_weight} kg` : "____________"}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla al nacer (cm)</td>
                      <td className="py-1 px-2 font-mono">{c.birth_height ? `${c.birth_height} cm` : "____________"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso / Edad (DE)</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{formatDE(zWeight)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Talla / Edad (DE)</td>
                      <td className="py-1 px-2 font-mono">{formatDE(zHeight)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Peso / Talla (DE)</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{formatDE(zWeight)}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Hemoglobina (g/dL)</td>
                      <td className="py-1 px-2 font-mono">____________</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Diagnóstico nutricional</td>
                      <td colSpan={3} className="py-1 px-2">
                        <span className="inline-flex flex-wrap gap-x-4 gap-y-1">
                          <span>{zWeight !== undefined && zWeight !== null && zWeight >= -2 && zWeight <= 2 ? "☑" : "☐"} Normal</span>
                          <span>{zWeight !== undefined && zWeight !== null && zWeight < -2 ? "☑" : "☐"} Desnutrición aguda</span>
                          <span>{zHeight !== undefined && zHeight !== null && zHeight < -2 ? "☑" : "☐"} Desnutrición crónica</span>
                          <span>{zWeight !== undefined && zWeight !== null && zWeight > 2 && zWeight <= 3 ? "☑" : "☐"} Sobrepeso</span>
                          <span>{zWeight !== undefined && zWeight !== null && zWeight > 3 ? "☑" : "☐"} Obesidad</span>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Anemia</td>
                      <td colSpan={3} className="py-1 px-2">
                        <span className="inline-flex gap-4">
                          <span>☑ No</span>
                          <span>☐ Leve</span>
                          <span>☐ Moderada</span>
                          <span>☐ Severa</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie de página 1 */}
            <div className="pt-2 border-t border-slate-200 text-center text-[9px] text-slate-500">
              Expediente físico confidencial · Constancia Oficial de Inscripción · Continúa en Página 2
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              PÁGINA 2
              ═══════════════════════════════════════════════════════════════ */}
          <div className="relative p-8 print:p-6 print:py-4 min-h-[297mm] print:min-h-0 print:h-[285mm] flex flex-col justify-between border-t print:border-none overflow-hidden">
            {/* Pie de membrete en el fondo detrás del contenido (Watermark) */}
            {footerBannerUrl && (
              <div 
                className="absolute inset-x-0 bottom-0 pointer-events-none select-none z-0 opacity-90 overflow-hidden flex items-end justify-center"
                style={{ height: '140mm' }}
              >
                <img
                  src={footerBannerUrl}
                  alt="Pie de membrete"
                  className="w-full h-auto object-contain object-bottom opacity-95"
                />
              </div>
            )}

            <div className="relative z-10">
              {/* Cabecera Gráfica de Membrete Oficial (Ancho total pegada al borde superior sin espaciado) */}
              {headerBannerUrl && (
                <div className="-mx-8 -mt-8 print:-mx-8 print:-mt-8 mb-3 w-[calc(100%+4rem)]">
                  <img
                    src={headerBannerUrl}
                    alt="Cabecera Membrete"
                    className="w-full h-auto block m-0 p-0"
                  />
                </div>
              )}

              {/* Encabezado Superior Página 2 */}
              <div className="border-b-2 border-black pb-1 mb-3">
                {institutionsHeader && (
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                    {institutionsHeader}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-1">
                  <span>Expediente {activeConfig.license_name} · Código <b>{id}</b> · C.I. <b>{cell(c.cedula, "S/C")}</b></span>
                  <span className="font-semibold">Página 2</span>
                </div>
              </div>

              {/* 5. VALORACIÓN INICIAL — SALUD */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  5. VALORACIÓN INICIAL — SALUD
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Esquema de vacunación</td>
                      <td className="w-1/4 py-1 px-2 border-r border-slate-200">
                        <span className="inline-flex gap-3">
                          <span>☑ Completo</span>
                          <span>☐ Incompleto</span>
                        </span>
                      </td>
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Control niño sano</td>
                      <td className="w-1/4 py-1 px-2">
                        <span className="inline-flex gap-3">
                          <span>☑ Al día</span>
                          <span>☐ Pendiente</span>
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Alergias</td>
                      <td className="py-1 px-2 border-r border-slate-200">{cell(c.allergies, "Ninguna registrada")}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Condiciones médicas</td>
                      <td className="py-1 px-2">{cell(c.medical_conditions, "Ninguna registrada")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Discapacidad registrada</td>
                      <td className="py-1 px-2 border-r border-slate-200 font-semibold">{f.has_disability ? `SÍ (${cell(f.disability_detail)})` : "NO"}</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Necesidades especiales</td>
                      <td className="py-1 px-2">{cell(c.special_needs, "Ninguna registrada")}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Desparasitación</td>
                      <td className="py-1 px-2 border-r border-slate-200">☐ Sí ☐ No Fecha: ______</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Suplementación (Fe / Vit. A)</td>
                      <td className="py-1 px-2">☐ Sí ☐ No</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Establecimiento de salud</td>
                      <td className="py-1 px-2 border-r border-slate-200">____________</td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Observaciones</td>
                      <td className="py-1 px-2">____________</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 6. VALORACIÓN INICIAL — INDICADORES DE DESARROLLO INFANTIL INTEGRAL (IDII) */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  6. VALORACIÓN INICIAL — INDICADORES DE DESARROLLO INFANTIL INTEGRAL (IDII)
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 font-bold text-center">
                      <th className="text-left py-1 px-2 w-2/5 border-r border-slate-300">Ámbito de desarrollo</th>
                      <th className="py-1 px-2 w-[15%] border-r border-slate-300">Adquirido (A)</th>
                      <th className="py-1 px-2 w-[15%] border-r border-slate-300">En proceso (EP)</th>
                      <th className="py-1 px-2 w-[15%] border-r border-slate-300">Inicio (I)</th>
                      <th className="text-left py-1 px-2 w-[15%]">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idiiDomains.map((dom) => {
                      const lvl = getDomainLevel(dom.prefix);
                      return (
                        <tr key={dom.key} className="border-b border-slate-200 text-center">
                          <td className="text-left py-1 px-2 font-medium bg-slate-50 border-r border-slate-200">{dom.label}</td>
                          <td className="py-1 px-2 font-bold border-r border-slate-200">{lvl === "adquirido" || lvl === "consolidado" ? "☑" : "☐"}</td>
                          <td className="py-1 px-2 font-bold border-r border-slate-200">{lvl === "en_proceso" ? "☑" : "☐"}</td>
                          <td className="py-1 px-2 font-bold border-r border-slate-200">{lvl === "no_iniciado" ? "☑" : "☐"}</td>
                          <td className="text-left py-1 px-2 text-[9px] text-slate-600">{domainObservations(dom.prefix) || "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50">
                      <td className="py-1.5 px-2 font-semibold text-left border-r border-slate-200">Resultado global IDII</td>
                      <td colSpan={2} className="py-1.5 px-2 text-left border-r border-slate-200">
                        <span className="inline-flex gap-3">
                          <span>☑ Acorde a la edad</span>
                          <span>☐ En riesgo</span>
                          <span>☐ Requiere derivación</span>
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-semibold border-r border-slate-200">Fecha de aplicación</td>
                      <td className="py-1.5 px-2 font-mono text-left">{cell(milestones[0]?.record_date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 7. SEMÁFORO DE VULNERABILIDAD Y COMPLETITUD DEL EXPEDIENTE */}
              <div className="mb-3">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[10px] tracking-wide">
                  7. SEMÁFORO DE VULNERABILIDAD Y COMPLETITUD DEL EXPEDIENTE
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Completitud de expediente</td>
                      <td className="w-1/4 py-1 px-2 border-r border-slate-200 font-semibold">
                        {filled}/{checks.length} ({pct}%) — <span style={{ background: semaforoBg(sem), padding: "0 4px", fontWeight: "bold" }}>{sem}</span>
                      </td>
                      <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Puntaje vulnerabilidad</td>
                      <td className="w-1/4 py-1 px-2 font-bold font-mono">
                        {lastVuln ? `${lastVuln.total}/100` : "____________"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Nivel de semáforo</td>
                      <td className="py-1 px-2 border-r border-slate-200">
                        <span className="inline-flex flex-wrap gap-2 text-[9.5px]">
                          <span>{lastVuln?.semaphore?.toUpperCase().includes("VERDE") || (lastVuln?.total && lastVuln.total <= 40) ? "☑" : "☐"} Verde (0–40)</span>
                          <span>{lastVuln?.semaphore?.toUpperCase().includes("AMARILLO") || (lastVuln?.total && lastVuln.total > 40 && lastVuln.total <= 60) ? "☑" : "☐"} Amarillo (40–60)</span>
                          <span>{lastVuln?.semaphore?.toUpperCase().includes("NARANJA") || (lastVuln?.total && lastVuln.total > 60 && lastVuln.total <= 80) ? "☑" : "☐"} Naranja (60–80)</span>
                          <span>{lastVuln?.semaphore?.toUpperCase().includes("ROJO") || (lastVuln?.total && lastVuln.total > 80) ? "☑" : "☐"} Rojo (80–100)</span>
                        </span>
                      </td>
                      <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Priorización</td>
                      <td className="py-1 px-2">
                        <span className="inline-flex gap-3">
                          <span>{lastVuln?.priority ? "☑ Sí" : "☐ Sí"}</span>
                          <span>{!lastVuln?.priority ? "☑ No" : "☐ No"}</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 8. OBSERVACIONES Y NOTAS DE SEGUIMIENTO */}
              <div className="mb-4">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2.5 py-1 font-bold uppercase text-[10px] tracking-wide">
                  8. OBSERVACIONES Y NOTAS DE SEGUIMIENTO
                </div>
                <div className="border border-t-0 border-slate-300 p-2 print:p-1.5 text-[10px] min-h-[36px] print:min-h-0 text-slate-800 leading-normal">
                  {c.notes ? <p className="mb-1">{c.notes}</p> : null}
                  <p>{footerNote}</p>
                </div>
              </div>

              {/* SECCIÓN DE FIRMAS FÍSICAS (SOLO EDUCADORA Y COORDINADORA SEGÚN DIRECTIVA OFICIAL) */}
              <div className="mt-6 print:mt-4 pt-2">
                <div className="grid grid-cols-2 gap-16 px-12">
                  {/* Firma 1: Educadora Responsable */}
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="font-semibold text-[10.5px] text-slate-600">Educadora Responsable</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{cell(c.educator_name || c.assigned_educator_name, "Firma y fecha")}</p>
                    </div>
                  </div>

                  {/* Firma 2: Coordinadora del Centro */}
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="font-semibold text-[10.5px] text-slate-600">Coordinadora del Centro</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Firma, sello y fecha</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de página 2 */}
            <div className="pt-2 text-slate-400 flex justify-between items-center text-[9px]">
              <span>Expediente {activeConfig.license_name} · Código {id} · C.I. {cell(c.cedula, "S/C")}</span>
              <span>Página 2</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
