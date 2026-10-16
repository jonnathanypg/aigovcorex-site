"use client";
/** Encabezado oficial imprimible dinámico por licencia: membrete opcional + título + código/fecha + convenio + periodo + semáforo. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { licenseAdminService } from "@/services/license-admin.service";

export interface Periodo {
  inicio: string;
  fin: string;
}

export interface ConvenioInfo {
  convenio?: string;
  finalidad?: string;
  poblacion?: string;
  objetivo?: string;
  servicios?: string;
}

export const CMCI_CONVENIO_DEFAULTS: Required<ConvenioInfo> = {
  convenio: "",
  finalidad: "",
  poblacion: "",
  objetivo: "",
  servicios: "",
};

export const SEMAFORO_LEYENDA = [
  { nombre: "VERDE", color: "#63BE7B", rango: "0–40 · vulnerabilidad baja / muy baja" },
  { nombre: "AMARILLO", color: "#FFEB84", rango: "40–60 · vulnerabilidad moderada" },
  { nombre: "NARANJA", color: "#F8A354", rango: "60–80 · vulnerabilidad alta" },
  { nombre: "ROJO", color: "#F8696B", rango: "80–100 · vulnerabilidad crítica" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function resolvePrintBannerUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  if (path.startsWith("/static/") || path.startsWith("/uploads/")) {
    return `${API_URL}${path}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

/** Color de fondo para un semáforo/nivel (útil en celdas impresas). */
export function semaforoBg(semaforo?: string, nivel?: string): string {
  const s = (semaforo ?? "").toUpperCase();
  if (s.includes("ROJO") || s.includes("CR")) return "#F8696B";
  if (s.includes("NARANJA") || (nivel ?? "").toLowerCase().includes("alta")) return "#F8A354";
  if (s.includes("AMARILLO") || (nivel ?? "").toLowerCase().includes("moderada")) return "#FFEB84";
  return "#63BE7B";
}

export function SemaforoLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
      <span className="font-semibold uppercase">Semáforo:</span>
      {SEMAFORO_LEYENDA.map((s) => (
        <span key={s.nombre} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 border border-black"
            style={{ background: s.color }}
            aria-hidden
          />
          {s.nombre} ({s.rango})
        </span>
      ))}
    </div>
  );
}

interface PrintHeaderProps extends ConvenioInfo {
  title: string;
  codigo: string;
  fecha: string;
  institutionsHeader?: string;
  projectName?: string;
  periodo?: Periodo;
  showConvenio?: boolean;
  showSemaforo?: boolean;
  showFooterBanner?: boolean;
}

export function PrintHeader({
  title,
  codigo,
  fecha,
  institutionsHeader,
  projectName,
  periodo,
  convenio,
  finalidad,
  poblacion,
  objetivo,
  servicios,
  showConvenio = true,
  showSemaforo = true,
  showFooterBanner = false,
}: PrintHeaderProps) {
  const [orgConfig, setOrgConfig] = useState<any>(null);

  useEffect(() => {
    licenseAdminService.getPublicConfig().then(setOrgConfig).catch(() => setOrgConfig(null));
  }, []);

  const headerBannerUrl = resolvePrintBannerUrl(orgConfig?.header_banner_path);
  const footerBannerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path);

  const effInstitutionsHeader = institutionsHeader ?? orgConfig?.institutions_header ?? orgConfig?.legal_name ?? orgConfig?.license_name ?? "";
  const effProjectName = projectName ?? orgConfig?.project_name ?? "";
  const effConvenio = convenio ?? orgConfig?.convenio_text ?? "";
  const effFinalidad = finalidad ?? orgConfig?.finalidad_text ?? "";
  const effPoblacion = poblacion ?? orgConfig?.poblacion_text ?? "";
  const effObjetivo = objetivo ?? orgConfig?.objetivo_text ?? "";
  const effServicios = servicios ?? orgConfig?.servicios_text ?? "";
  const hasConvenioData = Boolean(effConvenio || effFinalidad || effPoblacion || effObjetivo || effServicios);

  return (
    <div className="print-header relative z-10">
      {showFooterBanner && footerBannerUrl && (
        <div
          className="pointer-events-none select-none z-0 overflow-hidden flex items-end justify-center mt-12 mb-2 print:fixed print:inset-x-0 print:bottom-0 print:m-0 opacity-40 print:opacity-90"
          style={{ maxHeight: "110mm" }}
        >
          <img
            src={footerBannerUrl}
            alt="Pie de membrete"
            className="w-full max-w-[210mm] h-auto object-contain object-bottom"
          />
        </div>
      )}
      {headerBannerUrl && (
        <div className="-mx-6 -mt-6 print:-mx-6 print:-mt-6 mb-3 w-[calc(100%+3rem)]">
          <img
            src={headerBannerUrl}
            alt="Cabecera Membrete"
            className="w-full h-auto block m-0 p-0"
          />
        </div>
      )}
      {effInstitutionsHeader && (
        <div className="text-center font-bold text-xs uppercase tracking-wider border-b pb-1 mb-2">
          {effInstitutionsHeader}
        </div>
      )}
      <div className="flex items-center justify-center gap-4 border-b-2 border-black pb-2">
        <div className="text-center flex-1">
          {effProjectName && (
            <p className="text-[10px] font-bold uppercase tracking-tight text-gray-700 leading-tight mb-1">
              {effProjectName}
            </p>
          )}
          <h1 className="text-base font-bold uppercase">{title}</h1>
          <p className="text-xs">
            Código: {codigo} · Fecha: {fecha}
            {periodo ? ` · Período: ${periodo.inicio} al ${periodo.fin}` : ""}
          </p>
        </div>
      </div>
      {showConvenio && hasConvenioData && (
        <div className="mt-2 border border-black p-2 text-[11px] leading-snug">
          {effConvenio && <p><b>Convenio:</b> {effConvenio}</p>}
          {effFinalidad && <p><b>Finalidad:</b> {effFinalidad}</p>}
          {effPoblacion && <p><b>Población:</b> {effPoblacion}</p>}
          {effObjetivo && <p><b>Objetivo:</b> {effObjetivo}</p>}
          {effServicios && <p><b>Servicios:</b> {effServicios}</p>}
        </div>
      )}
      {showSemaforo && <SemaforoLegend />}
    </div>
  );
}

export function PrintFooterBanner() {
  const [orgConfig, setOrgConfig] = useState<any>(null);

  useEffect(() => {
    licenseAdminService.getPublicConfig().then(setOrgConfig).catch(() => setOrgConfig(null));
  }, []);

  const footerBannerUrl = resolvePrintBannerUrl(orgConfig?.footer_banner_path);
  if (!footerBannerUrl) return null;

  return (
    <div
      className="pointer-events-none select-none overflow-hidden flex items-end justify-center mt-8 print:fixed print:inset-x-0 print:bottom-0 print:m-0 z-0 opacity-40 print:opacity-95"
      style={{ maxHeight: "90mm" }}
    >
      <img
        src={footerBannerUrl}
        alt="Pie de membrete"
        className="w-full max-w-[210mm] h-auto object-contain object-bottom"
      />
    </div>
  );
}

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
    </Button>
  );
}
