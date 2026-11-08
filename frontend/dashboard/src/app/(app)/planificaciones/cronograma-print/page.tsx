"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PrintButton } from "@/components/cmci/print-header";
import { cmciService, type CmciCronogramaData } from "@/services/cmci.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { resolvePrintBannerUrl } from "@/components/cmci/print-header";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

export default function CmciCronogramaPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando cronograma…</p>}>
      <CmciCronogramaPrintInner />
    </Suspense>
  );
}

function CmciCronogramaPrintInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CmciCronogramaData | null>(null);
  const [orgConfig, setOrgConfig] = useState<any>(null);

  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  const monthIndex = monthParam !== null ? parseInt(monthParam, 10) : null;
  const year = yearParam !== null ? parseInt(yearParam, 10) : 2026;

  const isMonthFiltered = monthIndex !== null && !isNaN(monthIndex) && monthIndex >= 0 && monthIndex <= 11;
  const currentMonthLabel = isMonthFiltered ? `${MONTH_NAMES[monthIndex]} ${year}` : null;
  const currentMonthShort = isMonthFiltered ? MONTH_SHORT[monthIndex] : null;

  useEffect(() => {
    cmciService.getCronograma().then(setData).catch(() => setData(null));
    licenseAdminService.getPublicConfig().then(setOrgConfig).catch(() => setOrgConfig(null));
  }, []);

  const headerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path) || "/membretes/membrete-gasiba-cabezera.png";
  const footerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path) || "/membretes/membrete-gasiba-pie.png";

  // Filtrar actividades por mes seleccionado si se especificó el parámetro
  const filteredActividades = useMemo(() => {
    if (!data?.actividades) return [];
    if (!isMonthFiltered || !currentMonthShort || monthIndex === null) {
      return data.actividades;
    }
    return data.actividades.filter((a) => {
      const p = (a.periodo || "").toLowerCase();
      return (
        p.includes(currentMonthShort) ||
        p.includes(MONTH_NAMES[monthIndex].toLowerCase()) ||
        p.includes(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)
      );
    });
  }, [data?.actividades, isMonthFiltered, currentMonthShort, monthIndex, year]);

  // Filtrar hitos si aplica
  const filteredHitos = useMemo(() => {
    if (!data?.hitos) return [];
    if (!isMonthFiltered || !currentMonthShort || monthIndex === null) {
      return data.hitos;
    }
    return data.hitos.filter((h) => {
      const f = (h.fecha || "").toLowerCase();
      return f.includes(currentMonthShort) || f.includes(MONTH_NAMES[monthIndex].toLowerCase());
    });
  }, [data?.hitos, isMonthFiltered, currentMonthShort, monthIndex]);

  const totalActividades = filteredActividades.length;
  const ejecutadas = filteredActividades.filter(a => a.estado.toUpperCase() === "EJECUTADA").length;
  const enProceso = filteredActividades.filter(a => a.estado.toUpperCase() === "EN PROCESO").length;
  const pendientes = filteredActividades.filter(a => a.estado.toUpperCase() === "PENDIENTE").length;
  const pctCumplimiento = totalActividades > 0 ? Math.round((ejecutadas / totalActividades) * 100) : 0;

  // Título dinámico del período
  const periodoDisplay = isMonthFiltered
    ? `Período Operativo: ${currentMonthLabel}`
    : (data?.periodo || "Período Operativo General 2026");

  const subtitleDisplay = isMonthFiltered
    ? `CRONOGRAMA DE TRABAJO Y CONTROL DE EJECUCIÓN OPERATIVA — ${currentMonthLabel?.toUpperCase()}`
    : `CRONOGRAMA DE TRABAJO Y CONTROL DE EJECUCIÓN OPERATIVA — GENERAL`;

  return (
    <div className="print-letterhead-document bg-white text-black min-h-screen">
      {/* Botón flotante para vista previa en pantalla */}
      <div className="print:hidden p-4 bg-slate-100 border-b flex justify-between items-center max-w-5xl mx-auto w-full">
        <div>
          <h2 className="font-bold text-sm text-slate-800">Vista Oficial Imprimible A4</h2>
          <p className="text-xs text-slate-500">Cronograma de Trabajo y Control de Ejecución — {currentMonthLabel || "CMCI"}</p>
        </div>
        <PrintButton />
      </div>

      {/* Cabecera membretada fija por CSS */}
      {headerUrl && (
        <div className="print-letterhead-header" aria-hidden="true">
          <img src={headerUrl} alt="Cabecera oficial" />
        </div>
      )}

      {/* Estructura semántica thead / tfoot para respetar encabezado y pie membretado en CADA página sin límite */}
      <table className="print-letterhead-table w-full">
        <thead>
          <tr>
            <td className="print-letterhead-top-spacer h-[28mm]" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="print-letterhead-content px-8 py-2">
              {/* Título y Datos Principales */}
              <div className="border-b border-black pb-2 mb-4 text-center">
                <span className="text-[10px] tracking-widest font-semibold uppercase text-slate-600">
                  DASE-EP · GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DE GUAYAQUIL
                </span>
                <h1 className="text-sm font-black uppercase text-slate-900 mt-1">
                  {subtitleDisplay}
                </h1>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  Centros Municipales de Cuidado Infantil: CMCI Bahía | CMCI Guasmo | CMCI Orquídeas
                </p>
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-2 pt-1 border-t border-slate-200">
                  <span><strong>Período:</strong> {periodoDisplay}</span>
                  <span><strong>Corte:</strong> {new Date().toISOString().slice(0, 10)}</span>
                  <span><strong>Avance del Período:</strong> {pctCumplimiento}%</span>
                </div>
              </div>

              {/* Resumen Ejecutivo de Avance */}
              <div className="mb-4 bg-slate-50 border border-slate-300 rounded p-2 text-xs">
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="p-1 border-r border-slate-200">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Total Tareas</span>
                    <span className="text-sm font-black">{totalActividades}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-emerald-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Ejecutadas</span>
                    <span className="text-sm font-black">{ejecutadas}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-amber-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">En Proceso</span>
                    <span className="text-sm font-black">{enProceso}</span>
                  </div>
                  <div className="p-1 border-r border-slate-200 text-slate-700">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Pendientes</span>
                    <span className="text-sm font-black">{pendientes}</span>
                  </div>
                  <div className="p-1 text-blue-900">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">% Cumplimiento</span>
                    <span className="text-sm font-black">{pctCumplimiento}%</span>
                  </div>
                </div>
              </div>

              {/* Hitos Clave del Período */}
              {filteredHitos && filteredHitos.length > 0 && (
                <div className="mb-4 break-inside-avoid">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-400 pb-0.5 mb-2">
                    Hitos Principales {currentMonthLabel ? `(${currentMonthLabel})` : ""}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                    {filteredHitos.map((h, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                          {h.fecha}
                        </span>
                        <span className="text-slate-700 leading-tight">{h.descripcion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matriz Completa de Actividades */}
              <div className="mb-6">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-400 pb-0.5 mb-2">
                  Matriz de Actividades y Productos Esperados {currentMonthLabel ? `— ${currentMonthLabel}` : ""}
                </h3>
                {filteredActividades.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded">
                    No hay actividades registradas para este período.
                  </div>
                ) : (
                  <table className="w-full text-[9px] border-collapse border border-slate-300 leading-tight">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400 text-left">
                        <th className="p-1.5 border-r border-slate-300 w-6 text-center">Nº</th>
                        <th className="p-1.5 border-r border-slate-300 w-16">Fecha</th>
                        <th className="p-1.5 border-r border-slate-300">Actividad / Tarea</th>
                        <th className="p-1.5 border-r border-slate-300 w-24">Responsable</th>
                        <th className="p-1.5 border-r border-slate-300 w-36">Producto Esperado</th>
                        <th className="p-1.5 border-r border-slate-300 w-28">Medio Verificación / Evidencia</th>
                        <th className="p-1.5 w-16 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActividades.map((a, idx) => {
                        const isEjecutada = a.estado.toUpperCase() === "EJECUTADA";
                        const isEnProceso = a.estado.toUpperCase() === "EN PROCESO";
                        const isNoEjecutada = a.estado.toUpperCase() === "NO EJECUTADA";
                        return (
                          <tr
                            key={a.id}
                            className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                          >
                            <td className="p-1.5 border-r border-slate-300 text-center font-bold">{a.id}</td>
                            <td className="p-1.5 border-r border-slate-300 whitespace-nowrap font-medium text-slate-700">{a.periodo}</td>
                            <td className="p-1.5 border-r border-slate-300 font-medium text-slate-900">{a.tarea}</td>
                            <td className="p-1.5 border-r border-slate-300 text-slate-700">{a.responsable}</td>
                            <td className="p-1.5 border-r border-slate-300 text-slate-700">{a.producto}</td>
                            <td className="p-1.5 border-r border-slate-300 text-slate-600">
                              <div>{a.medio_verificacion}</div>
                              {a.evidencia_observaciones && (
                                <div className="mt-0.5 font-sans text-blue-800 text-[8px] bg-blue-50/80 p-0.5 rounded border border-blue-200">
                                  <strong>Obs:</strong> {a.evidencia_observaciones}
                                </div>
                              )}
                            </td>
                            <td className="p-1.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  isEjecutada
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : isEnProceso
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : isNoEjecutada
                                    ? "bg-red-100 text-red-800 border border-red-300"
                                    : "bg-slate-100 text-slate-600 border border-slate-300"
                                }`}
                              >
                                {a.estado}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Firmas Responsables - Con salto evitado para permanecer juntas */}
              <div className="mt-8 pt-4 border-t border-black break-inside-avoid print:break-inside-avoid">
                <div className="grid grid-cols-3 gap-8 text-center text-xs">
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Coordinador/a General</p>
                      <p className="text-[8px] text-gray-600">CMCI DASE-EP</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Técnico/a Administrativo/a</p>
                      <p className="text-[8px] text-gray-600">Verificación y Control Documental</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-14" />
                    <div className="border-t border-black pt-1">
                      <p className="font-bold text-[10px] uppercase">Supervisor/a Delegado/a</p>
                      <p className="text-[8px] text-gray-600">Dirección de Acción Social y Educación</p>
                    </div>
                  </div>
                </div>
                <p className="text-[8px] mt-4 text-center text-slate-400">
                  Documento oficial emitido conforme a las directrices técnicas del Modelo de Gestión de los Centros Municipales de Cuidado Infantil (CMCI).
                </p>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="print-letterhead-bottom-spacer h-[36mm]" />
          </tr>
        </tfoot>
      </table>

      {/* Pie membretado fijo por CSS */}
      {footerUrl && (
        <div className="print-letterhead-footer" aria-hidden="true">
          <img src={footerUrl} alt="Pie oficial" />
        </div>
      )}
    </div>
  );
}
