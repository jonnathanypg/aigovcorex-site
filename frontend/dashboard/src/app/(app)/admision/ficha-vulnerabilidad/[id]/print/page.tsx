"use client";
/**
 * Ficha de Vulnerabilidad Familiar CMCI — Formato Oficial de Impresión A4 con Membrete.
 * Usa PrintLetterheadDocumentAuto para paginación dinámica multipágina robusta.
 * Incluye: identificación, ratios, matriz de dimensiones (D1-D8), semáforo, prioridad, firmas.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PrintButton, PrintLetterheadDocumentAuto, semaforoBg, resolvePrintBannerUrl } from "@/components/cmci/print-header";
import { cmciService, type VulnRecord } from "@/services/cmci.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { VULN_DIMS, VULN_INDICATORS } from "@/lib/cmci/params";
import { computeVulnerability } from "@/lib/cmci/engine";
import { Loader2, ArrowLeft, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FichaVulnerabilidadPrintPage({ params }: { params?: { id: string } }) {
  const routeParams = useParams();
  const id = (params?.id ?? routeParams?.id) as string;

  const [rec, setRec] = useState<VulnRecord | undefined>();
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      cmciService.getVuln(id).catch(() => undefined),
      licenseAdminService.getPublicConfig().catch(() => null),
    ]).then(([vulnData, config]) => {
      setRec(vulnData);
      setOrgConfig(config);
      setLoading(false);
      if (!vulnData) setErrorMsg("Ficha de vulnerabilidad no encontrada.");
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-muted-foreground">Preparando formato de impresión A4...</p>
      </div>
    );
  }

  if (errorMsg || !rec) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{errorMsg || "Ficha no encontrada."}</p>
        <Link href="/admision">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Admisión
          </Button>
        </Link>
      </div>
    );
  }

  const res = computeVulnerability(rec.scores, rec.hogar);
  const headerBannerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path);
  const footerBannerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path);

  const institutionsHeader = orgConfig?.institutions_header ?? orgConfig?.legal_name ?? orgConfig?.license_name ?? "GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL";
  const projectName = orgConfig?.project_name ?? "CENTRO MUNICIPAL DE CUIDADO INFANTIL (CMCI)";

  return (
    <div className="print-sheet print-page bg-slate-100 min-h-screen py-6 print:bg-white print:py-0 print:p-0">
      {/* Barra de utilidades fuera de impresión */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href={`/admision/ficha-vulnerabilidad/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Ficha
            </Button>
          </Link>
          <div>
            <h2 className="font-bold text-sm text-slate-800">Vista de Impresión — Ficha de Vulnerabilidad</h2>
            <p className="text-xs text-slate-500">Expediente Oficial A4 · {rec.codigo}</p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-[210mm] mx-auto text-black text-[10.5px] leading-tight print:max-w-none print:m-0">
        <PrintLetterheadDocumentAuto>
          <div className="relative z-10">
            {/* Encabezado Superior Institucional */}
            <div className="border-b-2 border-black pb-1 mb-1.5">
              {institutionsHeader && (
                <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                  {institutionsHeader}
                </div>
              )}
              <div className="text-center font-extrabold text-[12.5px] uppercase tracking-wide text-primary">
                {projectName}
              </div>
              <div className="text-center text-[10px] text-slate-600 font-medium">
                MATRIZ DE VALORACIÓN DE VULNERABILIDAD FAMILIAR — EXPEDIENTE DE ADMISIÓN
              </div>
            </div>

            {/* Metadatos Rápidos */}
            <div className="flex flex-wrap justify-between items-center gap-2 text-[9px] text-slate-600 mb-2 font-mono">
              <span>Código: <b>{rec.codigo}</b></span>
              <span>Centro: <b>{rec.cmci}</b></span>
              <span>Fecha Evaluación: <b>{rec.fecha}</b></span>
              <span>Niño/a: <b>{rec.nino}</b></span>
            </div>

            {/* A. IDENTIFICACIÓN Y ENTORNO FAMILIAR */}
            <div className="mb-2">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wider">
                A. IDENTIFICACIÓN Y ENTORNO FAMILIAR
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[10px]">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Niño / Niña</td>
                    <td className="w-1/4 py-0.5 px-2 font-bold border-r border-slate-200">{rec.nino}</td>
                    <td className="w-1/4 py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha Nacimiento</td>
                    <td className="w-1/4 py-0.5 px-2">{rec.nacimiento || "—"}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Edad</td>
                    <td className="py-0.5 px-2 font-bold border-r border-slate-200">{rec.edadMeses} meses</td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">En Rango</td>
                    <td className="py-0.5 px-2">{rec.enRango ? "SÍ" : "NO"}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Género</td>
                    <td className="py-0.5 px-2 border-r border-slate-200">{rec.sexo}</td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Centro Asignado</td>
                    <td className="py-0.5 px-2 font-semibold">{rec.cmci}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Representante Legal</td>
                    <td className="py-0.5 px-2 font-medium border-r border-slate-200">{rec.representante || "—"}</td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Parentesco</td>
                    <td className="py-0.5 px-2">{rec.parentesco || "—"}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Teléfono Contacto</td>
                    <td className="py-0.5 px-2 font-mono border-r border-slate-200">{rec.telefono || "—"}</td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Sector</td>
                    <td className="py-0.5 px-2">{rec.sector || "—"}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha Evaluación</td>
                    <td className="py-0.5 px-2 border-r border-slate-200">{rec.fecha || "—"}</td>
                    <td className="py-0.5 px-2 font-semibold bg-slate-50 border-r border-slate-200">Código Ficha</td>
                    <td className="py-0.5 px-2 font-mono font-bold text-[#1e3a5f]">{rec.codigo || `CMCI-${id}`}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* B. CONDICIONES DEL HOGAR Y RATIOS ECONÓMICOS */}
            <div className="mb-2">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wider">
                B. CONDICIONES DEL HOGAR Y RATIOS ECONÓMICOS
              </div>
              <div className="grid grid-cols-3 gap-2 p-2 border border-slate-300 bg-slate-50">
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Ingreso Total:</span>
                  <b className="font-mono text-[9.5px] text-primary">${rec.hogar.ingresoTotal}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Per Cápita:</span>
                  <b className="font-mono text-[9.5px] text-primary">${res.perCapita.toFixed(2)}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Integrantes:</span>
                  <b className="font-mono text-[9.5px]">{rec.hogar.integrantes}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Perceptores:</span>
                  <b className="font-mono text-[9.5px]">{rec.hogar.perceptores}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Dependencia:</span>
                  <b className="font-mono text-[9.5px]">{res.dependencia.toFixed(2)}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Hacinamiento:</span>
                  <b className="font-mono text-[9.5px]">{res.hacinamiento.toFixed(2)}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Dormitorios:</span>
                  <b className="font-mono text-[9.5px]">{rec.hogar.dormitorios}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Niñas/os (NNA):</span>
                  <b className="font-mono text-[9.5px]">{rec.hogar.nna}</b>
                </div>
                <div className="p-1 rounded border border-slate-200 bg-white">
                  <span className="text-slate-500 block text-[8px]">Vivienda:</span>
                  <b className="font-mono text-[9.5px]">{rec.hogar.tipo_vivienda || "—"}</b>
                </div>
              </div>
            </div>

            {/* C. MATRIZ DE DIMENSIONES (D1-D8) - PARTE 1: D1-D4 */}
            <div className="mb-2">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wider rounded-t flex justify-between items-center">
                <span>C. MATRIZ DE VALORACIÓN POR DIMENSIONES (D1 - D4)</span>
              </div>
              <div className="border border-slate-300 border-t-0 p-1.5 space-y-2">
                {VULN_DIMS.slice(0, 4).map((d) => {
                  const indicators = VULN_INDICATORS.filter((i) => i.dim === d.code);
                  const subtotal = res.subtotals[d.code] ?? 0;
                  return (
                    <div key={d.code} className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-100 px-2 py-0.5 font-bold text-[9px] flex justify-between text-slate-800 border-b border-slate-200">
                        <span>{d.code} · {d.name} (Ponderación: {d.weight}%)</span>
                        <span className="font-mono text-primary">Subtotal: {subtotal.toFixed(2)} pts</span>
                      </div>
                      <table className="w-full text-[8.5px] border-collapse">
                        <tbody>
                          {indicators.map((ind) => {
                            const c = res.contributions.find((x) => x.id === ind.id);
                            return (
                              <tr key={ind.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                <td className="w-10 px-1 py-0.5 font-mono font-semibold text-slate-500 border-r border-slate-100">{ind.id}</td>
                                <td className="px-1.5 py-0.5 text-slate-800">{ind.variable}</td>
                                <td className="w-16 px-1 py-0.5 text-center font-mono border-l border-slate-100 text-slate-600">Score {c?.score ?? 0}</td>
                                <td className="w-16 px-1 py-0.5 text-right font-mono font-bold text-slate-900 border-l border-slate-100 pr-1.5">
                                  {c ? c.aporte.toFixed(2) : "0.00"} pts
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Page break for D5-D8 */}
            <div className="page-break-before mb-4">
              {/* Encabezado continuación */}
              <div className="border-b-2 border-black pb-1 mb-2 flex justify-between items-end">
                <div>
                  <div className="font-bold text-[11px] uppercase tracking-wide text-primary">
                    {projectName}
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium">
                    MATRIZ DE VALORACIÓN DE VULNERABILIDAD FAMILIAR
                  </div>
                </div>
                <div className="text-right text-[9px] font-mono text-slate-700">
                  <b>CÓDIGO:</b> {rec.codigo} · <b>NIÑO/A:</b> {rec.nino}
                </div>
              </div>

              {/* C. MATRIZ DE DIMENSIONES (D5-D8) - PARTE 2 */}
              <div className="mb-2">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wider rounded-t flex justify-between items-center">
                  <span>C. MATRIZ DE VALORACIÓN POR DIMENSIONES (D5 - D8)</span>
                </div>
                <div className="border border-slate-300 border-t-0 p-1.5 space-y-2">
                  {VULN_DIMS.slice(4).map((d) => {
                    const indicators = VULN_INDICATORS.filter((i) => i.dim === d.code);
                    const subtotal = res.subtotals[d.code] ?? 0;
                    return (
                      <div key={d.code} className="border border-slate-200 rounded overflow-hidden">
                        <div className="bg-slate-100 px-2 py-0.5 font-bold text-[9px] flex justify-between text-slate-800 border-b border-slate-200">
                          <span>{d.code} · {d.name} (Ponderación: {d.weight}%)</span>
                          <span className="font-mono text-primary">Subtotal: {subtotal.toFixed(2)} pts</span>
                        </div>
                        <table className="w-full text-[8.5px] border-collapse">
                          <tbody>
                            {indicators.map((ind) => {
                              const c = res.contributions.find((x) => x.id === ind.id);
                              return (
                                <tr key={ind.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                  <td className="w-10 px-1 py-0.5 font-mono font-semibold text-slate-500 border-r border-slate-100">{ind.id}</td>
                                  <td className="px-1.5 py-0.5 text-slate-800">{ind.variable}</td>
                                  <td className="w-16 px-1 py-0.5 text-center font-mono border-l border-slate-100 text-slate-600">Score {c?.score ?? 0}</td>
                                  <td className="w-16 px-1 py-0.5 text-right font-mono font-bold text-slate-900 border-l border-slate-100 pr-1.5">
                                    {c ? c.aporte.toFixed(2) : "0.00"} pts
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* D. RESULTADO FINAL, SEMÁFORO Y PRIORIDAD */}
              <div className="mb-4">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wider rounded-t">
                  D. RESULTADO FINAL, SEMÁFORO Y PRIORIDAD
                </div>
                <div className="grid grid-cols-3 gap-3 p-3 border border-slate-300 bg-slate-50">
                  <div className="p-2 rounded border border-slate-200 bg-white text-center">
                    <span className="text-slate-500 block text-[8px]">Total Puntos:</span>
                    <b className="font-mono text-[16px] text-primary">{res.total.toFixed(2)} / 100</b>
                  </div>
                  <div className="p-2 rounded border border-slate-200 bg-white text-center">
                    <span className="text-slate-500 block text-[8px]">Nivel de Vulnerabilidad:</span>
                    <b className="font-mono text-[14px]" style={{color: semaforoBg(res.semaphore)}}>
                      {res.level}
                    </b>
                  </div>
                  <div className="p-2 rounded border border-slate-200 bg-white text-center">
                    <span className="text-slate-500 block text-[8px]">Semáforo:</span>
                    <div className="flex items-center justify-center gap-1">
                      <span className="inline-block h-3 w-3 border border-black" style={{background: semaforoBg(res.semaphore)}} />
                      <b className="font-mono text-[12px]" style={{color: semaforoBg(res.semaphore)}}>
                        {res.semaphore.toUpperCase()}
                      </b>
                    </div>
                  </div>
                  <div className="col-span-3 p-2 rounded border border-slate-200 bg-white text-center">
                    <span className="text-slate-500 block text-[8px]">Prioridad de Atención:</span>
                    <b className="font-mono text-[14px] text-slate-900">{res.priority}</b>
                  </div>
                  <div className="col-span-3 p-2 rounded border border-slate-200 bg-white text-center">
                    <span className="text-slate-500 block text-[8px]">Necesidad de Cuidado:</span>
                    <b className="font-mono text-[14px] text-slate-900">{res.childcare_need || "—"}</b>
                  </div>
                </div>
              </div>

              {/* E. ALERTAS DE PROTECCIÓN */}
              {res.alerts && Object.keys(res.alerts).length > 0 && (
                <div className="mb-4 p-3 border border-amber-300 bg-amber-50">
                  <div className="font-bold text-amber-900 uppercase text-[9px] flex items-center gap-1 mb-1">
                    <ShieldAlert className="h-3 w-3" /> Alertas de Protección Detectadas
                  </div>
                  <ul className="list-disc list-inside text-[9px] text-amber-800 space-y-0.5">
                    {Object.entries(res.alerts).map(([key, val]) => val && (
                      <li key={key}><b>{key}:</b> {typeof val === 'string' ? val : 'Activada'}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* F. FIRMAS FÍSICAS */}
              <div className="mt-12 pt-4 break-inside-avoid print:break-inside-avoid">
                <div className="grid grid-cols-2 gap-16 px-12">
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-semibold text-[10px] text-slate-800">Trabajadora Social / Evaluadora</p>
                      <p className="text-[8.5px] text-slate-500 mt-0.5">Responsable de aplicación y entrevista</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="font-semibold text-[10px] text-slate-800">Coordinadora del Centro</p>
                      <p className="text-[8.5px] text-slate-500 mt-0.5">Revisión, validación de expediente y sello</p>
                    </div>
                  </div>
                </div>
                <p className="text-[8px] text-center text-slate-400 mt-6 print-only">
                  Firma física en papel fuera del sistema · Documento oficial CMCI
                </p>
              </div>
            </div>
          </div>
        </PrintLetterheadDocumentAuto>
      </div>
    </div>
  );
}

