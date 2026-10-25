"use client";
/**
 * Informe Mensual de Actividades CMCI — Formato Oficial de Impresión A4.
 * Estructura paginada explícitamente con PrintA4Page (cabecera y pie institucionales en cada hoja,
 * flujo determinista sin cortes de secciones ni desbordes de tablas).
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PrintButton,
  PrintA4Page,
  resolvePrintBannerUrl,
} from "@/components/cmci/print-header";
import { cmciService, type MonthlyReportDetail } from "@/services/cmci.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const IGNORE_RISK_MOTIVES = new Set([
  "ninguno",
  "ninguna",
  "no",
  "n/a",
  "sin riesgo",
  "sin riesgos",
  "-",
  "",
]);

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!arr || arr.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function InformeActividadesPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [report, setReport] = useState<MonthlyReportDetail | null>(null);
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      cmciService.getMonthlyReport(Number(id)),
      licenseAdminService.getPublicConfig().catch(() => null),
    ])
      .then(([reportData, configData]) => {
        setReport(reportData);
        setOrgConfig(configData);
        setError(null);
      })
      .catch((err) => {
        console.error("Error fetching report:", err);
        setError("No se pudo cargar el informe mensual solicitado.");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-muted-foreground">
          Preparando expediente oficial de impresión A4...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-destructive font-medium">
          {error || "Informe no encontrado."}
        </p>
        <Link href="/informe-actividades">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Informes
          </Button>
        </Link>
      </div>
    );
  }

  const pv = report.print_view || ({} as any);
  const payload = report.payload || {};
  const plannings: any[] = Array.isArray(payload.planificaciones)
    ? payload.planificaciones
    : [];
  const children: any[] = Array.isArray(payload.ninos) ? payload.ninos : [];

  // Filtrar casos de riesgo que digan "ninguno" (para informes antiguos ya guardados)
  const rawRiskDetails: any[] = Array.isArray(pv.resumen?.detalle_casos_riesgo)
    ? pv.resumen.detalle_casos_riesgo
    : Array.isArray(payload.detalle_casos_riesgo)
    ? payload.detalle_casos_riesgo
    : [];

  const validRiskDetails = rawRiskDetails.filter((d) => {
    const m = String(d?.motivo ?? "").trim().toLowerCase();
    return m && !IGNORE_RISK_MOTIVES.has(m);
  });

  const effectiveRiskCount =
    rawRiskDetails.length > 0
      ? validRiskDetails.length
      : Number(pv.resumen?.casos_riesgo || 0);

  const headerBannerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path);
  const footerBannerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path);

  const institutionsHeader =
    orgConfig?.institutions_header ??
    orgConfig?.legal_name ??
    orgConfig?.license_name ??
    "";
  const projectName = orgConfig?.project_name ?? "";
  const convenio = orgConfig?.convenio_text ?? "";
  const finalidad = orgConfig?.finalidad_text ?? "";
  const poblacion = orgConfig?.poblacion_text ?? "";
  const objetivo = orgConfig?.objetivo_text ?? "";
  const servicios = orgConfig?.servicios_text ?? "";
  const hasConvenioData = Boolean(
    convenio || finalidad || poblacion || objetivo || servicios
  );

  const reportTitle =
    pv.titulo || "INFORME MENSUAL DE ACTIVIDADES — EDUCADORA";
  const reportCode = `INF-MENSUAL-${report.id}`;
  const emissionDate =
    report.period_end || new Date().toISOString().slice(0, 10);

  // Paginación inteligente de las planificaciones lúdicas:
  // - Hasta 9 planificaciones por página A4 para evitar desbordes
  // - Si la última tanda tiene <= 5 registros, las secciones 4 (Conclusiones),
  //   5 (Observaciones) y 6 (Firmas) caben en la misma hoja final.
  // - Si la última tanda tiene > 5 registros (o no hay planificaciones y el bloque es muy alto),
  //   se genera una hoja dedicada de cierre para Conclusiones + Observaciones + Firmas.
  const PLANNINGS_PER_PAGE = 9;
  const planningChunks = chunkArray(plannings, PLANNINGS_PER_PAGE);
  const lastChunkSize =
    planningChunks.length > 0
      ? planningChunks[planningChunks.length - 1].length
      : 0;
  const canFitClosingInLastPlanningPage =
    planningChunks.length > 0 &&
    lastChunkSize <= 5 &&
    (!report.educator_notes || report.educator_notes.length < 350);

  const totalPages =
    1 +
    planningChunks.length +
    (planningChunks.length === 0 || !canFitClosingInLastPlanningPage ? 1 : 0);

  const renderContinuationHeader = (pageNumber: number) => (
    <div className="border-b-2 border-black pb-1 mb-2 flex justify-between items-end">
      <div>
        {institutionsHeader && (
          <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-700">
            {institutionsHeader}
          </p>
        )}
        <p className="font-extrabold text-[10.5px] uppercase tracking-wide text-slate-950">
          {reportTitle}
        </p>
      </div>
      <div className="text-right text-[8.5px] font-mono text-slate-700">
        <div>
          <b>CÓDIGO:</b> {reportCode} · <b>PÁGINA:</b> {pageNumber} de{" "}
          {totalPages}
        </div>
        <div>
          <b>CENTRO:</b> {pv.centro || "CMCI"} · <b>PERÍODO:</b>{" "}
          {report.period_start} al {report.period_end}
        </div>
      </div>
    </div>
  );

  const renderClosingSections = () => (
    <div className="space-y-2.5 mt-2">
      {/* 4. Conclusiones y Logros del Período (Automático / LLM) */}
      <div className="break-inside-avoid">
        <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
          4 · CONCLUSIONES, LOGROS Y DESARROLLO INTEGRAL DEL PERÍODO
        </div>
        <div className="border border-t-0 border-slate-300 p-2.5 text-[10px] text-justify leading-relaxed whitespace-pre-line bg-white text-slate-900">
          {report.conclusions_auto ||
            pv.conclusions_auto ||
            "Sin conclusiones registradas para este período."}
        </div>
      </div>

      {/* 5. Observaciones de la Educadora */}
      <div className="break-inside-avoid">
        <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
          5 · OBSERVACIONES, NOVEDADES Y RECOMENDACIONES TÉCNICAS
        </div>
        <div className="border border-t-0 border-slate-300 p-2.5 text-[10px] text-justify leading-relaxed whitespace-pre-line bg-white text-slate-900 min-h-[38px]">
          {report.educator_notes && report.educator_notes.trim()
            ? report.educator_notes
            : "Sin observaciones adicionales registradas por la responsable en el período."}
        </div>
      </div>

      {/* 6. Firmas Físicas Reglamentarias en Papel */}
      <div className="pt-6 mt-4 break-inside-avoid print:break-inside-avoid">
        <div className="grid grid-cols-2 gap-14 px-8 text-center">
          <div>
            <div className="pt-8 border-t border-black">
              <p className="font-bold text-[10px] uppercase text-slate-950">
                {pv.autora || "Educadora / Responsable"}
              </p>
              <p className="text-[9px] text-slate-700 font-medium">
                Educadora de Atención / Cuidado Infantil
              </p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">
                Elaboración · Firma y Fecha
              </p>
            </div>
          </div>
          <div>
            <div className="pt-8 border-t border-black">
              <p className="font-bold text-[10px] uppercase text-slate-950">
                Coordinación de Centro Infantil
              </p>
              <p className="text-[9px] text-slate-700 font-medium">
                Revisión Técnica, Validación y Aprobación
              </p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">
                Aprobación · Firma, Sello y Fecha
              </p>
            </div>
          </div>
        </div>
        <p className="text-[8.5px] text-center text-slate-500 mt-4">
          {pv.nota ||
            "Documento oficial CMCI firmable en papel fuera del sistema. Sin firma electrónica."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="print-sheet print-page bg-slate-100 min-h-screen py-6 print:bg-white print:py-0 print:p-0">
      {/* Barra de utilidades fuera de impresión */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/informe-actividades">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Informes
            </Button>
          </Link>
          <div>
            <h2 className="font-bold text-sm text-slate-800">
              Vista de Impresión — Informe Mensual de Actividades
            </h2>
            <p className="text-xs text-slate-500">
              Expediente Oficial A4 ({totalPages}{" "}
              {totalPages === 1 ? "página" : "páginas"}) · {reportCode}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-[210mm] mx-auto text-black text-[10px] leading-snug print:max-w-none print:m-0">
        {/* ═══════════════════════════════════════════════════════════════
            PÁGINA 1 — Encabezado, Convenio, Datos Generales, Resumen y Nómina
            ═══════════════════════════════════════════════════════════════ */}
        <PrintA4Page headerUrl={headerBannerUrl} footerUrl={footerBannerUrl}>
          <div className="relative z-10">
            {/* Encabezado Superior: Instituciones Cooperantes */}
            <div className="border-b-2 border-black pb-1 mb-1.5">
              {institutionsHeader && (
                <div className="text-center font-bold text-[10.5px] uppercase tracking-wider text-slate-900">
                  {institutionsHeader}
                </div>
              )}
              <div className="flex justify-between items-center text-[9px] text-slate-600 mt-0.5 font-mono">
                <span>
                  Código: <b>{reportCode}</b> · Fecha de corte:{" "}
                  <b>{emissionDate}</b>
                </span>
                <span>
                  Página <b>1</b> de <b>{totalPages}</b>
                </span>
              </div>
            </div>

            {/* Título Oficial del Proyecto y del Informe */}
            <div className="text-center my-1.5">
              {projectName && (
                <p className="text-[9.5px] font-bold uppercase tracking-tight text-slate-700 leading-tight">
                  {projectName}
                </p>
              )}
              <h1 className="text-sm font-extrabold uppercase tracking-wide text-slate-950 mt-0.5">
                {reportTitle}
              </h1>
              <p className="text-[9px] text-slate-600 mt-0.5">
                Período Evaluado: <b>{report.period_start}</b> al{" "}
                <b>{report.period_end}</b> · Estado:{" "}
                <b className="uppercase">{report.status || "Generado"}</b>
              </p>
            </div>

            {/* Metadatos del Convenio Interinstitucional */}
            {hasConvenioData && (
              <div className="border border-slate-400 p-1.5 mb-2 text-[8.5px] leading-tight space-y-0.5 bg-slate-50/70">
                {convenio && (
                  <p>
                    <b>Convenio:</b> {convenio}
                  </p>
                )}
                {finalidad && (
                  <p>
                    <b>Finalidad:</b> {finalidad}
                  </p>
                )}
                {poblacion && (
                  <p>
                    <b>Población:</b> {poblacion}
                  </p>
                )}
                {objetivo && (
                  <p>
                    <b>Objetivo:</b> {objetivo}
                  </p>
                )}
                {servicios && (
                  <p>
                    <b>Servicios:</b> {servicios}
                  </p>
                )}
              </div>
            )}

            {/* 1. Datos Generales del Servicio */}
            <div className="mb-2 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                1 · DATOS GENERALES DEL SERVICIO Y RESPONSABLE
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Centro Infantil
                    </td>
                    <td className="w-1/4 py-1 px-2 font-bold border-r border-slate-200">
                      {pv.centro || "Centro Comunitario CMCI"}
                    </td>
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Rol / Formato
                    </td>
                    <td className="w-1/4 py-1 px-2 font-semibold uppercase">
                      {report.report_type || "EDUCADORA"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Responsable / Autora
                    </td>
                    <td className="py-1 px-2 font-bold border-r border-slate-200">
                      {pv.autora || "Sin asignar"}
                    </td>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Período Reportado
                    </td>
                    <td className="py-1 px-2 font-mono">
                      {report.period_start} al {report.period_end}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Resumen Operativo y Cobertura del Período */}
            <div className="mb-2 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                2 · RESUMEN OPERATIVO Y COBERTURA DEL PERÍODO
              </div>
              <div className="grid grid-cols-4 gap-2 p-2 border border-t-0 border-slate-300 bg-slate-50/50 text-center">
                <div className="border border-slate-300 bg-white p-1.5">
                  <p className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    Usuarios Atendidos
                  </p>
                  <p className="text-sm font-extrabold text-[#1e3a5f] mt-0.5 font-mono">
                    {pv.resumen?.usuarios ?? children.length ?? 0}
                  </p>
                </div>
                <div className="border border-slate-300 bg-white p-1.5">
                  <p className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    Planificaciones Lúdicas
                  </p>
                  <p className="text-sm font-extrabold text-[#1e3a5f] mt-0.5 font-mono">
                    {pv.resumen?.planificaciones ?? plannings.length ?? 0}
                  </p>
                </div>
                <div className="border border-slate-300 bg-white p-1.5">
                  <p className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    Tasa de Asistencia
                  </p>
                  <p className="text-sm font-extrabold text-emerald-700 mt-0.5 font-mono">
                    {pv.resumen?.tasa_asistencia ?? 0}%
                  </p>
                </div>
                <div className="border border-slate-300 bg-white p-1.5">
                  <p className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    Alertas / Casos Riesgo
                  </p>
                  <p className="text-sm font-extrabold text-amber-700 mt-0.5 font-mono">
                    {effectiveRiskCount}
                  </p>
                </div>
              </div>

              {/* Trazabilidad de casos de riesgo (solo si existen motivos reales distintos de "ninguno") */}
              {validRiskDetails.length > 0 && (
                <div className="border border-t-0 border-slate-300 p-1.5 bg-amber-50/60 text-[8.5px]">
                  <p className="font-bold text-amber-950 uppercase mb-0.5">
                    ⚠️ Detalle de Casos de Riesgo Identificados (
                    {validRiskDetails.length}):
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-800">
                    {validRiskDetails.slice(0, 4).map((d: any, dIdx: number) => (
                      <li key={dIdx} className="truncate">
                        <b>{d.origen}</b> ({d.referencia}): {d.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Nómina Oficial de Niñas y Niños bajo Cobertura */}
            <div className="mb-1 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide flex justify-between items-center">
                <span>
                  NÓMINA OFICIAL DE NIÑAS Y NIÑOS BAJO COBERTURA (
                  {children.length})
                </span>
                <span className="text-[8px] font-normal opacity-90">
                  1 REGISTRO POR FILA · FORMATO CMCI
                </span>
              </div>
              {children.length === 0 ? (
                <div className="border border-t-0 border-slate-300 p-2 text-[9px] text-slate-500 italic">
                  No se registran niños asignados directamente en este período.
                </div>
              ) : (
                <table className="w-full text-[9px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-center font-bold text-slate-800">
                      <th className="border border-slate-300 py-0.5 px-1 w-7">
                        N°
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left w-24">
                        Cédula / ID
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left">
                        Apellidos y Nombres
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 w-16">
                        Género
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 w-20">
                        F. Nacimiento
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 w-24">
                        Edad
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left w-24">
                        Sala / Grupo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c: any, i: number) => (
                      <tr
                        key={c.id || i}
                        className={i % 2 === 1 ? "bg-slate-50/70" : "bg-white"}
                      >
                        <td className="border border-slate-300 py-0.5 px-1 text-center font-bold">
                          {i + 1}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1.5 font-mono">
                          {c.cedula || c.codigo || "S/C"}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1.5 font-semibold uppercase">
                          {c.nombre || c.nombres || "-"}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1 text-center">
                          {c.genero || c.sexo || "-"}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1 text-center font-mono whitespace-nowrap">
                          {c.fecha_nacimiento || c.nacimiento || "-"}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1 text-center">
                          {c.edad || "-"}
                        </td>
                        <td className="border border-slate-300 py-0.5 px-1.5">
                          {c.grupo_sala ||
                            c.sala ||
                            c.grupo ||
                            "Atención Directa"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </PrintA4Page>

        {/* ═══════════════════════════════════════════════════════════════
            PÁGINAS DE PLANIFICACIONES LÚDICAS (SECCIÓN 3)
            ═══════════════════════════════════════════════════════════════ */}
        {planningChunks.map((chunk, chunkIdx) => {
          const pageNumber = 2 + chunkIdx;
          const isLastChunk = chunkIdx === planningChunks.length - 1;
          const startItem = chunkIdx * PLANNINGS_PER_PAGE + 1;
          const endItem = startItem + chunk.length - 1;

          return (
            <PrintA4Page
              key={`plannings-page-${chunkIdx}`}
              headerUrl={headerBannerUrl}
              footerUrl={footerBannerUrl}
            >
              <div className="relative z-10">
                {renderContinuationHeader(pageNumber)}

                <div className="mb-2">
                  <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide flex justify-between items-center">
                    <span>
                      3 · EXPERIENCIAS DE APRENDIZAJE Y PLANIFICACIONES LÚDICAS
                      ({plannings.length})
                    </span>
                    <span className="text-[8px] font-normal opacity-90">
                      REGISTROS {startItem} AL {endItem} DE {plannings.length}
                    </span>
                  </div>

                  <table className="w-full text-[8.8px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                        <th className="border border-slate-300 py-1 px-1 text-center w-7">
                          N°
                        </th>
                        <th className="border border-slate-300 py-1 px-1.5 text-left w-16">
                          Fecha
                        </th>
                        <th className="border border-slate-300 py-1 px-1 text-center w-11">
                          Sem.
                        </th>
                        <th className="border border-slate-300 py-1 px-1.5 text-left w-20">
                          Grupo Etario
                        </th>
                        <th className="border border-slate-300 py-1 px-1.5 text-left w-44">
                          Experiencia / Actividad Lúdica
                        </th>
                        <th className="border border-slate-300 py-1 px-1.5 text-left">
                          Objetivo de Aprendizaje / Eje de Desarrollo
                        </th>
                        <th className="border border-slate-300 py-1 px-1.5 text-left w-28">
                          Indicador / Logro
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((p: any, idx: number) => {
                        const globalIdx = startItem + idx;
                        const rawIndicador =
                          p.indicadores_logro &&
                          Array.isArray(p.indicadores_logro)
                            ? p.indicadores_logro.join(", ")
                            : typeof p.indicadores_logro === "string"
                            ? p.indicadores_logro
                            : p.indicador || p.ambito || "En proceso / Ejecutado";

                        return (
                          <tr
                            key={p.id || globalIdx}
                            className={
                              idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                            }
                          >
                            <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-700">
                              {globalIdx}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 font-mono whitespace-nowrap">
                              {p.planning_date}
                            </td>
                            <td className="border border-slate-300 py-1 px-1 text-center font-mono">
                              #{p.week_number || "-"}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5">
                              {p.age_group || "-"}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5">
                              <div className="font-bold text-slate-900 leading-tight">
                                {p.tema_integrador ||
                                  p.nombre_actividad ||
                                  p.tema ||
                                  p.title ||
                                  "Experiencia lúdica"}
                              </div>
                              {p.nombre_actividad &&
                                p.tema_integrador &&
                                p.nombre_actividad !== p.tema_integrador && (
                                  <div className="text-[8px] text-slate-700 mt-0.5 leading-tight">
                                    {p.nombre_actividad}
                                  </div>
                                )}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 text-slate-800 leading-tight">
                              {p.objetivo || "-"}
                            </td>
                            <td className="border border-slate-300 py-1 px-1.5 text-[8px] text-slate-700 leading-tight">
                              {rawIndicador}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Si la última página de planificaciones tiene pocas filas, incluimos el cierre aquí mismo */}
                {isLastChunk &&
                  canFitClosingInLastPlanningPage &&
                  renderClosingSections()}
              </div>
            </PrintA4Page>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════
            PÁGINA DE CIERRE DEDICADA — Conclusiones, Observaciones y Firmas
            (Cuando no hay planificaciones o cuando la última página de planificaciones
            tiene más de 5 registros y requiere hoja propia para no cortar firmas)
            ═══════════════════════════════════════════════════════════════ */}
        {(planningChunks.length === 0 || !canFitClosingInLastPlanningPage) && (
          <PrintA4Page
            headerUrl={headerBannerUrl}
            footerUrl={footerBannerUrl}
          >
            <div className="relative z-10">
              {renderContinuationHeader(totalPages)}

              {planningChunks.length === 0 && (
                <div className="mb-3">
                  <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                    3 · EXPERIENCIAS DE APRENDIZAJE Y PLANIFICACIONES LÚDICAS (0)
                  </div>
                  <div className="border border-t-0 border-slate-300 p-2.5 text-[9.5px] text-slate-600 italic bg-white">
                    No se registraron planificaciones lúdicas en este rango de
                    fechas para el rol seleccionado.
                  </div>
                </div>
              )}

              {renderClosingSections()}
            </div>
          </PrintA4Page>
        )}
      </div>
    </div>
  );
}
