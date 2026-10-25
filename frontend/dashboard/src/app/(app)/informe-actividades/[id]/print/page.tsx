"use client";
/**
 * Informe Mensual de Actividades CMCI — Formato Oficial de Impresión A4.
 * Flujo continuo natural (estilo Google Docs / Word):
 * - Aprovecha todo el espacio útil de cada página A4 dentro de la zona segura (entre cabecera y pie membretado).
 * - La Sección 3 arranca inmediatamente después de la Nómina de Niños en la Página 1, llenando hasta ~15-18 filas por hoja.
 * - Funciona dinámicamente sin importar si el corte es semanal, quincenal, mensual o trimestral.
 * - Incluye espacio amplio de firma física reglamentaria al cierre del documento.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PrintButton,
  PrintLetterheadDocument,
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
              Expediente Oficial A4 · Flujo Continuo con Membrete · {reportCode}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-[210mm] mx-auto text-black text-[9.5px] leading-snug print:max-w-none print:m-0">
        <PrintLetterheadDocument
          headerUrl={headerBannerUrl}
          footerUrl={footerBannerUrl}
        >
          <div className="relative z-10 space-y-2">
            {/* Encabezado Superior: Instituciones Cooperantes */}
            <div className="border-b-2 border-black pb-1">
              {institutionsHeader && (
                <div className="text-center font-bold text-[10px] uppercase tracking-wider text-slate-900">
                  {institutionsHeader}
                </div>
              )}
              <div className="flex justify-between items-center text-[8.5px] text-slate-600 mt-0.5 font-mono">
                <span>
                  Código: <b>{reportCode}</b> · Fecha de corte:{" "}
                  <b>{emissionDate}</b>
                </span>
                <span>
                  Período: <b>{report.period_start}</b> al{" "}
                  <b>{report.period_end}</b>
                </span>
              </div>
            </div>

            {/* Título Oficial del Proyecto y del Informe */}
            <div className="text-center py-0.5">
              {projectName && (
                <p className="text-[9px] font-bold uppercase tracking-tight text-slate-700 leading-tight">
                  {projectName}
                </p>
              )}
              <h1 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-950 mt-0.5">
                {reportTitle}
              </h1>
            </div>

            {/* Metadatos del Convenio Interinstitucional (compacto) */}
            {hasConvenioData && (
              <div className="border border-slate-400 p-1.5 text-[8px] leading-tight space-y-0.5 bg-slate-50/70 break-inside-avoid">
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
            <div className="break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide">
                1 · DATOS GENERALES DEL SERVICIO Y RESPONSABLE
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[9px]">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Centro Infantil
                    </td>
                    <td className="w-1/4 py-0.5 px-2 font-bold border-r border-slate-200">
                      {pv.centro || "Centro Comunitario CMCI"}
                    </td>
                    <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Rol / Formato
                    </td>
                    <td className="w-1/4 py-0.5 px-2 font-semibold uppercase">
                      {report.report_type || "EDUCADORA"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Responsable / Autora
                    </td>
                    <td className="py-0.5 px-2 font-bold border-r border-slate-200">
                      {pv.autora || "Sin asignar"}
                    </td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">
                      Período Reportado
                    </td>
                    <td className="py-0.5 px-2 font-mono">
                      {report.period_start} al {report.period_end}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Resumen Operativo y Cobertura del Período */}
            <div className="break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide">
                2 · RESUMEN OPERATIVO Y COBERTURA DEL PERÍODO
              </div>
              <div className="grid grid-cols-4 gap-2 p-1.5 border border-t-0 border-slate-300 bg-slate-50/50 text-center">
                <div className="border border-slate-300 bg-white py-1 px-1.5">
                  <p className="text-[8px] text-slate-600 uppercase font-semibold">
                    Usuarios Atendidos
                  </p>
                  <p className="text-xs font-extrabold text-[#1e3a5f] font-mono">
                    {pv.resumen?.usuarios ?? children.length ?? 0}
                  </p>
                </div>
                <div className="border border-slate-300 bg-white py-1 px-1.5">
                  <p className="text-[8px] text-slate-600 uppercase font-semibold">
                    Planificaciones Lúdicas
                  </p>
                  <p className="text-xs font-extrabold text-[#1e3a5f] font-mono">
                    {pv.resumen?.planificaciones ?? plannings.length ?? 0}
                  </p>
                </div>
                <div className="border border-slate-300 bg-white py-1 px-1.5">
                  <p className="text-[8px] text-slate-600 uppercase font-semibold">
                    Tasa de Asistencia
                  </p>
                  <p className="text-xs font-extrabold text-emerald-700 font-mono">
                    {pv.resumen?.tasa_asistencia ?? 0}%
                  </p>
                </div>
                <div className="border border-slate-300 bg-white py-1 px-1.5">
                  <p className="text-[8px] text-slate-600 uppercase font-semibold">
                    Alertas / Casos Riesgo
                  </p>
                  <p className="text-xs font-extrabold text-amber-700 font-mono">
                    {effectiveRiskCount}
                  </p>
                </div>
              </div>

              {/* Trazabilidad de casos de riesgo (solo si existen motivos reales distintos de "ninguno") */}
              {validRiskDetails.length > 0 && (
                <div className="border border-t-0 border-slate-300 p-1.5 bg-amber-50/60 text-[8px]">
                  <p className="font-bold text-amber-950 uppercase mb-0.5">
                    ⚠️ Detalle de Casos de Riesgo Identificados (
                    {validRiskDetails.length}):
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-800">
                    {validRiskDetails.map((d: any, dIdx: number) => (
                      <li key={dIdx}>
                        <b>{d.origen}</b> ({d.referencia}): {d.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Nómina Oficial de Niñas y Niños bajo Cobertura */}
            <div className="break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide flex justify-between items-center">
                <span>
                  NÓMINA OFICIAL DE NIÑAS Y NIÑOS BAJO COBERTURA (
                  {children.length})
                </span>
                <span className="text-[7.5px] font-normal opacity-90">
                  1 REGISTRO POR FILA · FORMATO CMCI
                </span>
              </div>
              {children.length === 0 ? (
                <div className="border border-t-0 border-slate-300 p-2 text-[8.5px] text-slate-500 italic">
                  No se registran niños asignados directamente en este período.
                </div>
              ) : (
                <table className="w-full text-[8.5px] border-collapse border border-slate-300">
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

            {/* 3. Experiencias de Aprendizaje y Planificaciones Lúdicas — Flujo Continuo Natural */}
            <div className="pt-1">
              {plannings.length === 0 ? (
                <div className="break-inside-avoid">
                  <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide">
                    3 · EXPERIENCIAS DE APRENDIZAJE Y PLANIFICACIONES LÚDICAS (0)
                  </div>
                  <div className="border border-t-0 border-slate-300 p-2 text-[8.5px] text-slate-600 italic bg-white">
                    No se registraron planificaciones lúdicas en este rango de
                    fechas para el rol seleccionado.
                  </div>
                </div>
              ) : (
                <table className="w-full text-[8.5px] border-collapse border border-slate-300">
                  <thead>
                    {/* Fila de título integrada en thead para que se repita automáticamente al saltar de página */}
                    <tr>
                      <th
                        colSpan={7}
                        className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide text-left"
                      >
                        <div className="flex justify-between items-center">
                          <span>
                            3 · EXPERIENCIAS DE APRENDIZAJE Y PLANIFICACIONES
                            LÚDICAS ({plannings.length})
                          </span>
                          <span className="text-[7.5px] font-normal opacity-90">
                            {reportCode} · {pv.centro || "CMCI"}
                          </span>
                        </div>
                      </th>
                    </tr>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                      <th className="border border-slate-300 py-0.5 px-1 text-center w-6">
                        N°
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 text-left w-16">
                        Fecha
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 text-center w-9">
                        Sem.
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1 text-left w-20">
                        Grupo Etario
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left w-40">
                        Experiencia / Actividad Lúdica
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left">
                        Objetivo de Aprendizaje / Eje de Desarrollo
                      </th>
                      <th className="border border-slate-300 py-0.5 px-1.5 text-left w-28">
                        Indicador / Logro
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plannings.map((p: any, idx: number) => {
                      const rawIndicador =
                        p.indicadores_logro &&
                        Array.isArray(p.indicadores_logro)
                          ? p.indicadores_logro.join(", ")
                          : typeof p.indicadores_logro === "string"
                          ? p.indicadores_logro
                          : p.indicador || p.ambito || "En proceso / Ejecutado";

                      return (
                        <tr
                          key={p.id || idx}
                          className={`break-inside-avoid ${
                            idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                          }`}
                        >
                          <td className="border border-slate-300 py-0.5 px-1 text-center font-bold text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1 font-mono whitespace-nowrap">
                            {p.planning_date}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1 text-center font-mono">
                            #{p.week_number || "-"}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1">
                            {p.age_group || "-"}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5">
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
                                <div className="text-[7.8px] text-slate-700 leading-tight">
                                  {p.nombre_actividad}
                                </div>
                              )}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-slate-800 leading-tight">
                            {p.objetivo || "-"}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-[7.8px] text-slate-700 leading-tight">
                            {rawIndicador}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 4. Conclusiones y Logros del Período (Automático / LLM) */}
            <div className="pt-1 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide">
                4 · CONCLUSIONES, LOGROS Y DESARROLLO INTEGRAL DEL PERÍODO
              </div>
              <div className="border border-t-0 border-slate-300 p-2 text-[9.5px] text-justify leading-relaxed whitespace-pre-line bg-white text-slate-900">
                {report.conclusions_auto ||
                  pv.conclusions_auto ||
                  "Sin conclusiones registradas para este período."}
              </div>
            </div>

            {/* 5. Observaciones de la Educadora */}
            <div className="break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9px] tracking-wide">
                5 · OBSERVACIONES, NOVEDADES Y RECOMENDACIONES TÉCNICAS
              </div>
              <div className="border border-t-0 border-slate-300 p-2 text-[9.5px] text-justify leading-relaxed whitespace-pre-line bg-white text-slate-900 min-h-[32px]">
                {report.educator_notes && report.educator_notes.trim()
                  ? report.educator_notes
                  : "Sin observaciones adicionales registradas por la responsable en el período."}
              </div>
            </div>

            {/* 6. Firmas Físicas Reglamentarias en Papel (con espacio amplio para firma manuscrita y sello) */}
            <div className="pt-4 mt-2 break-inside-avoid print:break-inside-avoid">
              <div className="grid grid-cols-2 gap-16 px-10 text-center">
                <div>
                  {/* Espacio en blanco de ~22mm sobre la línea para firma manuscrita cómoda */}
                  <div className="h-20" />
                  <div className="pt-2 border-t border-black">
                    <p className="font-bold text-[10px] uppercase text-slate-950">
                      {pv.autora || "Educadora / Responsable"}
                    </p>
                    <p className="text-[8.5px] text-slate-700 font-medium">
                      Educadora de Atención / Cuidado Infantil
                    </p>
                    <p className="text-[8px] text-slate-500 mt-0.5">
                      Elaboración · Firma y Fecha
                    </p>
                  </div>
                </div>
                <div>
                  <div className="h-20" />
                  <div className="pt-2 border-t border-black">
                    <p className="font-bold text-[10px] uppercase text-slate-950">
                      Coordinación de Centro Infantil
                    </p>
                    <p className="text-[8.5px] text-slate-700 font-medium">
                      Revisión Técnica, Validación y Aprobación
                    </p>
                    <p className="text-[8px] text-slate-500 mt-0.5">
                      Aprobación · Firma, Sello y Fecha
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[8px] text-center text-slate-500 mt-4">
                {pv.nota ||
                  "Documento oficial CMCI firmable en papel fuera del sistema. Sin firma electrónica."}
              </p>
            </div>
          </div>
        </PrintLetterheadDocument>
      </div>
    </div>
  );
}
