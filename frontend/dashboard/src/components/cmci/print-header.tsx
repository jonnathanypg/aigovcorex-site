"use client";
/** Encabezado oficial imprimible: logos CMCI + título + código/fecha + convenio + periodo + semáforo. */
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

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
  convenio: "Convenio de cooperación interinstitucional — Centros de cuidado infantil",
  finalidad: "Atención integral a niñas y niños de 12 a 42 meses en situación de vulnerabilidad",
  poblacion: "Niñas y niños de 12 a 42 meses y sus familias (centros GU / BH / OR)",
  objetivo: "Garantizar cuidado, nutrición, salud y desarrollo infantil integral con priorización por vulnerabilidad",
  servicios: "Cuidado diario · Alimentación (4 tiempos) · Salud y crecimiento · Desarrollo infantil · Acompañamiento familiar",
};

export const SEMAFORO_LEYENDA = [
  { nombre: "VERDE", color: "#63BE7B", rango: "0–40 · vulnerabilidad baja / muy baja" },
  { nombre: "AMARILLO", color: "#FFEB84", rango: "40–60 · vulnerabilidad moderada" },
  { nombre: "NARANJA", color: "#F8A354", rango: "60–80 · vulnerabilidad alta" },
  { nombre: "ROJO", color: "#F8696B", rango: "80–100 · vulnerabilidad crítica" },
];

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
  periodo?: Periodo;
  showConvenio?: boolean;
  showSemaforo?: boolean;
}

export function PrintHeader({
  title,
  codigo,
  fecha,
  periodo,
  convenio = CMCI_CONVENIO_DEFAULTS.convenio,
  finalidad = CMCI_CONVENIO_DEFAULTS.finalidad,
  poblacion = CMCI_CONVENIO_DEFAULTS.poblacion,
  objetivo = CMCI_CONVENIO_DEFAULTS.objetivo,
  servicios = CMCI_CONVENIO_DEFAULTS.servicios,
  showConvenio = true,
  showSemaforo = true,
}: PrintHeaderProps) {
  return (
    <div className="print-header">
      <div className="flex items-center justify-between gap-4 border-b-2 border-black pb-2">
        <img src="/logos/cmci-logo-1.png" alt="Logo 1" className="h-14 object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase">{title}</h1>
          <p className="text-xs">
            Código: {codigo} · Fecha: {fecha}
            {periodo ? ` · Período: ${periodo.inicio} al ${periodo.fin}` : ""}
          </p>
        </div>
        <img src="/logos/cmci-logo-2.png" alt="Logo 2" className="h-14 object-contain" />
      </div>
      {showConvenio && (
        <div className="mt-2 border border-black p-2 text-[11px] leading-snug">
          <p><b>Convenio:</b> {convenio}</p>
          <p><b>Finalidad:</b> {finalidad}</p>
          <p><b>Población:</b> {poblacion}</p>
          <p><b>Objetivo:</b> {objetivo}</p>
          <p><b>Servicios:</b> {servicios}</p>
        </div>
      )}
      {showSemaforo && <SemaforoLegend />}
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
