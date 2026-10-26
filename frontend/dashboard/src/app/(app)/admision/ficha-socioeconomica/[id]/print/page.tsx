"use client";
/**
 * Ficha Socioeconómica Familiar CMCI — Constancia Oficial de Valoración Imprimible A4.
 * Formato oficial en 2 páginas A4 con membrete institucional en ambas, bloques A-D y firmas físicas amplias:
 * - Página 1: Identificación general, composición familiar y vivienda, balance de ingresos y egresos + ratios económicos.
 * - Página 2: Matriz completa de las 7 dimensiones socioeconómicas (B62-B68), puntaje global y firmas físicas con espacio reglamentario.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PrintButton, PrintA4Page, semaforoBg, resolvePrintBannerUrl } from "@/components/cmci/print-header";
import { cmciService, type SocioRecord } from "@/services/cmci.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { SOCIO_WEIGHTS } from "@/lib/cmci/params";

const ING_LABELS = ["Sueldos", "Jornales", "Independiente", "Negocios", "Pensiones", "Bonos", "Ayudas", "Otros"];
const EGR_LABELS = ["Alimentación", "Arriendo", "Básicos", "Transporte", "Educación", "Salud", "Cuidado", "Deudas", "Vestimenta", "Otros"];
const SERV_LABELS = ["Agua potable", "Energía eléctrica", "Alcantarillado", "Internet", "Recolección de basura", "Gas por tubería/cilindro"];

const DIM_DESCRIPTIONS: Record<string, string> = {
  B62: "Ingreso per cápita familiar",
  B63: "Composición etaria y tasa de dependencia",
  B64: "Situación e inserción laboral del hogar",
  B65: "Tenencia y condiciones de la vivienda",
  B66: "Cobertura de servicios básicos",
  B67: "Carga de gastos y capacidad de ahorro",
  B68: "Nivel de instrucción del cuidador principal",
  ingreso: "Ingreso per cápita familiar",
  composicion: "Composición etaria y tasa de dependencia",
  laboral: "Situación e inserción laboral del hogar",
  vivienda: "Tenencia y condiciones de la vivienda",
  servicios: "Cobertura de servicios básicos",
  gastos: "Carga de gastos y capacidad de ahorro",
  educacion: "Nivel de instrucción del cuidador principal",
};

export default function FichaSocioeconomicaPrintPage({ params }: { params?: { id: string } }) {
  const routeParams = useParams();
  const id = (params?.id ?? routeParams?.id) as string;

  const [rec, setRec] = useState<SocioRecord | undefined>();
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      cmciService.getSocio(id).catch(() => undefined),
      licenseAdminService.getPublicConfig().catch(() => null),
    ])
      .then(([socioData, config]) => {
        setRec(socioData);
        setOrgConfig(config);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-slate-500">Cargando ficha socioeconómica para impresión...</p>
      </div>
    );
  }

  if (!rec) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-slate-700 font-semibold">Ficha socioeconómica no encontrada</p>
        <Link href="/admision">
          <Button variant="outline" size="sm">Volver a Admisión</Button>
        </Link>
      </div>
    );
  }

  const headerBannerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path);
  const footerBannerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path);

  const rawPayload = (rec.payload ?? {}) as Record<string, unknown>;
  const rawResultado = (rawPayload.resultado ?? {}) as Record<string, unknown>;

  const integrantes = Number(rawPayload.integrantes ?? 1);
  const menores5 = Number(rawPayload.menores5 ?? 0);
  const de5a17 = Number(rawPayload.de5a17 ?? 0);
  const adultos = Number(rawPayload.adultos ?? 0);
  const mayores = Number(rawPayload.mayores ?? 0);
  const discapacidad = Number(rawPayload.discapacidad ?? 0);
  const enfermedad = Number(rawPayload.enfermedad ?? 0);
  const trabajan = Number(rawPayload.trabajan ?? 0);
  const generanIngreso = Number(rawPayload.generanIngreso ?? 1);
  const dormitorios = Number(rawPayload.dormitorios ?? 1);

  const tenencia = String(rawPayload.tenencia ?? "No especificada");
  const tipoVivienda = String(rawPayload.tipoVivienda ?? "No especificado");
  const situacionLaboral = String(rawPayload.situacionLaboral ?? "No especificada");
  const educacion = String(rawPayload.educacion ?? "No especificada");

  const ingresosArr = Array.isArray(rawPayload.ingresos) ? (rawPayload.ingresos as number[]) : [];
  const egresosArr = Array.isArray(rawPayload.egresos) ? (rawPayload.egresos as number[]) : [];
  const serviciosArr = Array.isArray(rawPayload.servicios) ? (rawPayload.servicios as boolean[]) : [];

  const totalIngresos = Number(rawResultado.ingreso_total ?? rawResultado.E18 ?? ingresosArr.reduce((a, b) => a + (b || 0), 0));
  const totalEgresos = Number(rawResultado.gasto_total ?? rawResultado.E29 ?? egresosArr.reduce((a, b) => a + (b || 0), 0));
  const saldoDisponible = Number(rawResultado.disponible ?? rawResultado.E30 ?? (totalIngresos - totalEgresos));
  const ratioGasto = Number(rawResultado.ratio_gasto ?? rawResultado.E31 ?? (totalIngresos > 0 ? (totalEgresos / totalIngresos) * 100 : 0));
  const perCapita = Number(rec.perCapita ?? rawResultado.per_capita ?? rawResultado.E19 ?? (integrantes > 0 ? totalIngresos / integrantes : 0));
  const clasificacion = (rec.clasificacion || String(rawResultado.classification || "media")).toLowerCase();

  const subscoresMap =
    (rawResultado.subscores as Record<string, number> | undefined) ??
    (rawResultado.sub as Record<string, number> | undefined) ??
    (rawPayload.subscores as Record<string, number> | undefined) ??
    (rawPayload.sub as Record<string, number> | undefined) ??
    {};

  const institutionsHeader = orgConfig?.institutions_header ?? orgConfig?.legal_name ?? orgConfig?.license_name ?? "GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL";
  const projectName = orgConfig?.project_name ?? "CENTRO MUNICIPAL DE CUIDADO INFANTIL (CMCI)";
  const todayStr = new Date().toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="print-sheet print-page bg-slate-100 min-h-screen py-6 print:bg-white print:py-0 print:p-0">
      {/* Barra de utilidades fuera de impresión */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href={`/admision/ficha-socioeconomica/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Ficha
            </Button>
          </Link>
          <div>
            <h2 className="font-bold text-sm text-slate-800">Vista de Impresión — Ficha Socioeconómica</h2>
            <p className="text-xs text-slate-500">Expediente Oficial A4 (2 Páginas) · {rec.codigo}</p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-[210mm] mx-auto text-black text-[10.5px] leading-tight print:max-w-none print:m-0 space-y-6 print:space-y-0">
        {/* ═══════════════════════════════════════════════════════════════
            PÁGINA 1 — Identificación, composición familiar y balance mensual
            ═══════════════════════════════════════════════════════════════ */}
        <PrintA4Page headerUrl={headerBannerUrl} footerUrl={footerBannerUrl}>
          <div className="relative z-10">
            {/* Encabezado Superior */}
            <div className="border-b-2 border-black pb-1 mb-1.5">
              {institutionsHeader && (
                <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                  {institutionsHeader}
                </div>
              )}
              <div className="flex justify-between items-center text-[10px] text-slate-600 mt-0.5 font-mono">
                <span>Centro: <b>{rec.cmci || "CMCI"}</b> · Ficha N.°: <b>{rec.codigo || id}</b></span>
                <span>Página <b>1</b> de <b>2</b></span>
              </div>
            </div>

            {/* Título Oficial */}
            <div className="text-center my-2 print:my-1.5">
              {projectName && (
                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-700 leading-snug">
                  {projectName}
                </p>
              )}
              <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-950 mt-0.5">
                FICHA DE VALORACIÓN SOCIOECONÓMICA FAMILIAR
              </h1>
              <p className="text-[9.5px] text-slate-600 mt-0.5">
                Instrumento de focalización socioeconómica · Fecha de registro: <b>{rec.fecha || "—"}</b> · Emisión: {todayStr}
              </p>
            </div>

            {/* 1. IDENTIFICACIÓN GENERAL */}
            <div className="mb-2 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                1. IDENTIFICACIÓN DEL USUARIO Y GRUPO FAMILIAR
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[10px]">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Niño / Niña</td>
                    <td className="w-1/4 py-1 px-2 font-bold border-r border-slate-200">{rec.nino}</td>
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Código único</td>
                    <td className="w-1/4 py-1 px-2 font-mono font-bold text-[#1e3a5f]">{rec.codigo || `CMCI-${id}`}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Fecha nacimiento</td>
                    <td className="py-1 px-2 border-r border-slate-200">{rec.nacimiento || "—"}</td>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Centro asignado</td>
                    <td className="py-1 px-2 font-semibold">{rec.cmci}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Representante legal</td>
                    <td className="py-1 px-2 font-medium border-r border-slate-200">{rec.representante || "—"}</td>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Teléfono contacto</td>
                    <td className="py-1 px-2 font-mono">{rec.telefono || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. COMPOSICIÓN FAMILIAR Y CONDICIONES DE VIDA */}
            <div className="mb-2 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                2. COMPOSICIÓN DEL HOGAR, VIVIENDA Y ENTORNO
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Total integrantes</td>
                    <td className="w-1/4 py-1 px-2 font-bold border-r border-slate-200">{integrantes} personas</td>
                    <td className="w-1/4 py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Generan ingreso</td>
                    <td className="w-1/4 py-1 px-2 font-semibold">{generanIngreso} perceptor(es)</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Distribución etaria</td>
                    <td colSpan={3} className="py-1 px-2">
                      <span className="inline-flex flex-wrap gap-x-4">
                        <span>Menores 5 años: <b>{menores5}</b></span>
                        <span>5 a 17 años: <b>{de5a17}</b></span>
                        <span>Adultos: <b>{adultos}</b></span>
                        <span>Adultos mayores: <b>{mayores}</b></span>
                        {discapacidad > 0 && <span className="text-amber-800 font-semibold">Discapacidad: {discapacidad}</span>}
                        {enfermedad > 0 && <span className="text-amber-800 font-semibold">Enfermedad grave: {enfermedad}</span>}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Tenencia vivienda</td>
                    <td className="py-1 px-2 border-r border-slate-200">{tenencia}</td>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Tipo de vivienda</td>
                    <td className="py-1 px-2">{tipoVivienda} ({dormitorios} dormitorio(s))</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Situación laboral</td>
                    <td className="py-1 px-2 border-r border-slate-200">{situacionLaboral}</td>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Nivel de instrucción</td>
                    <td className="py-1 px-2">{educacion}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold bg-slate-50 border-r border-slate-200">Servicios básicos</td>
                    <td colSpan={3} className="py-1 px-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {SERV_LABELS.map((label, idx) => {
                          const active = serviciosArr[idx] === true;
                          return (
                            <span key={label} className={active ? "font-semibold text-slate-900" : "text-slate-400 line-through"}>
                              {active ? "☑" : "☐"} {label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. BALANCE DE INGRESOS Y EGRESOS MENSUALES */}
            <div className="mb-2 break-inside-avoid">
              <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-0.5 font-bold uppercase text-[9.5px] tracking-wide">
                3. BALANCE ECONÓMICO MENSUAL DEL NÚCLEO FAMILIAR
              </div>
              <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2 bg-slate-50/50">
                {/* Tabla Ingresos */}
                <div>
                  <div className="font-bold text-[9px] uppercase border-b border-slate-300 pb-0.5 mb-1 text-slate-800 flex justify-between">
                    <span>Rubros de Ingreso</span>
                    <span>Monto ($)</span>
                  </div>
                  <table className="w-full text-[9px]">
                    <tbody>
                      {ING_LABELS.map((lbl, idx) => {
                        const val = ingresosArr[idx] || 0;
                        return (
                          <tr key={lbl} className="border-b border-slate-100">
                            <td className="py-0.5 text-slate-700">{lbl}</td>
                            <td className="py-0.5 text-right font-mono font-medium">${val.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-slate-400 font-bold bg-white">
                        <td className="py-1">TOTAL INGRESOS</td>
                        <td className="py-1 text-right font-mono text-emerald-800">${totalIngresos.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabla Egresos */}
                <div>
                  <div className="font-bold text-[9px] uppercase border-b border-slate-300 pb-0.5 mb-1 text-slate-800 flex justify-between">
                    <span>Rubros de Egreso</span>
                    <span>Monto ($)</span>
                  </div>
                  <table className="w-full text-[9px]">
                    <tbody>
                      {EGR_LABELS.map((lbl, idx) => {
                        const val = egresosArr[idx] || 0;
                        return (
                          <tr key={lbl} className="border-b border-slate-100">
                            <td className="py-0.5 text-slate-700">{lbl}</td>
                            <td className="py-0.5 text-right font-mono font-medium">${val.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-slate-400 font-bold bg-white">
                        <td className="py-1">TOTAL EGRESOS</td>
                        <td className="py-1 text-right font-mono text-rose-800">${totalEgresos.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Indicadores Clave de Economía */}
              <div className="grid grid-cols-4 gap-2 border border-t-0 border-slate-300 p-2 bg-white text-center text-[9.5px]">
                <div>
                  <span className="text-slate-500 block text-[8.5px]">Ingreso Per-Cápita:</span>
                  <b className="font-mono text-[11px] text-[#1e3a5f]">${perCapita.toFixed(2)}</b>
                </div>
                <div>
                  <span className="text-slate-500 block text-[8.5px]">Saldo Disponible:</span>
                  <b className={`font-mono text-[11px] ${saldoDisponible >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    ${saldoDisponible.toFixed(2)}
                  </b>
                </div>
                <div>
                  <span className="text-slate-500 block text-[8.5px]">Carga de Gastos:</span>
                  <b className="font-mono text-[11px]">{ratioGasto.toFixed(1)}%</b>
                </div>
                <div>
                  <span className="text-slate-500 block text-[8.5px]">Dependencia:</span>
                  <b className="font-mono text-[11px]">{(integrantes / Math.max(generanIngreso, 1)).toFixed(1)} hab/p</b>
                </div>
              </div>
            </div>
          </div>
        </PrintA4Page>

        {/* ═══════════════════════════════════════════════════════════════
            PÁGINA 2 — Matriz de dimensiones B62-B68, clasificación y firmas
            ═══════════════════════════════════════════════════════════════ */}
        <PrintA4Page headerUrl={headerBannerUrl} footerUrl={footerBannerUrl}>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              {/* Encabezado Continuación Página 2 */}
              <div className="border-b-2 border-black pb-1 mb-2">
                {institutionsHeader && (
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-900">
                    {institutionsHeader}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-0.5 font-mono">
                  <span>Código: <b>{rec.codigo || id}</b> · Niño/a: <b>{rec.nino}</b></span>
                  <span>Página <b>2</b> de <b>2</b></span>
                </div>
              </div>

              {/* 4. CONSOLIDADO DE PUNTAJES Y CLASIFICACIÓN SOCIOECONÓMICA */}
              <div className="mb-4 break-inside-avoid">
                <div className="bg-[#1e3a5f] text-white border border-[#1e3a5f] px-2 py-1 font-bold uppercase text-[10px] tracking-wide">
                  4. MATRIZ DE VALORACIÓN POR DIMENSIONES SOCIOECONÓMICAS (B62 - B68)
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 font-bold text-center">
                      <th className="text-left py-1 px-2 border-r border-slate-300">Dimensión Socioeconómica</th>
                      <th className="py-1 px-2 w-28 border-r border-slate-300">Ponderación</th>
                      <th className="py-1 px-2 w-28 border-r border-slate-300">Puntaje Base</th>
                      <th className="text-right py-1 px-2 w-32">Puntaje Ponderado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOCIO_WEIGHTS.map((w) => {
                      const score =
                        subscoresMap[w.key] ??
                        subscoresMap[w.dim.toLowerCase()] ??
                        subscoresMap[w.key.toLowerCase()] ??
                        subscoresMap[
                          w.key === "B62" ? "ingreso" :
                          w.key === "B63" ? "composicion" :
                          w.key === "B64" ? "laboral" :
                          w.key === "B65" ? "vivienda" :
                          w.key === "B66" ? "servicios" :
                          w.key === "B67" ? "gastos" : "educacion"
                        ] ?? 0;
                      const weighted = score * w.w;
                      return (
                        <tr key={w.key} className="border-b border-slate-200">
                          <td className="py-1 px-2 border-r border-slate-200">
                            <span className="font-semibold text-slate-900">{w.dim}</span>
                            <span className="text-[9px] text-slate-500 block">
                              {DIM_DESCRIPTIONS[w.key] || ""}
                            </span>
                          </td>
                          <td className="py-1 px-2 text-center border-r border-slate-200 font-mono">
                            {Math.round(w.w * 100)}%
                          </td>
                          <td className="py-1 px-2 text-center border-r border-slate-200 font-mono font-bold">
                            {score} pts
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-semibold">
                            {weighted.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
                      <td colSpan={2} className="py-1.5 px-2 uppercase text-slate-900 border-r border-slate-200">
                        Puntaje Global Socioeconómico
                      </td>
                      <td colSpan={2} className="py-1.5 px-2 text-right">
                        <span className="text-sm font-extrabold text-[#1e3a5f] font-mono mr-2">
                          {rec.total.toFixed(1)} / 100
                        </span>
                        <span
                          className="inline-block px-2.5 py-0.5 text-xs font-bold uppercase rounded border border-black/20"
                          style={{
                            background:
                              clasificacion.includes("alta") ? "#F8A354" :
                              clasificacion.includes("media") ? "#FFEB84" : "#63BE7B",
                            color: "#000",
                          }}
                        >
                          Vulnerabilidad {rec.clasificacion || "Media"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. FIRMAS FÍSICAS REGLAMENTARIAS EN PAPEL (Con amplio espacio h-20) */}
            <div className="pt-6 mb-4 break-inside-avoid print:break-inside-avoid">
              <div className="grid grid-cols-2 gap-16 px-12">
                <div className="text-center">
                  {/* Espacio en blanco amplio de ~22mm sobre la línea para firma manuscrita */}
                  <div className="h-20" />
                  <div className="border-t border-black pt-2">
                    <p className="font-bold text-[10.5px] uppercase text-slate-900">Trabajadora Social / Evaluadora</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">Responsable de aplicación y entrevista</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Firma y Fecha</p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="h-20" />
                  <div className="border-t border-black pt-2">
                    <p className="font-bold text-[10.5px] uppercase text-slate-900">Coordinadora del Centro</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">Revisión, validación de expediente y sello</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Firma, Sello y Fecha</p>
                  </div>
                </div>
              </div>
              <p className="text-[8.5px] text-center text-slate-500 mt-6 print-only">
                Firma física en papel fuera del sistema · Documento oficial CMCI
              </p>
            </div>
          </div>
        </PrintA4Page>
      </div>
    </div>
  );
}
