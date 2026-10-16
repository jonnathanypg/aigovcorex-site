"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PrintHeader, PrintButton } from "@/components/cmci/print-header";
import { cmciService, type MonthlyReportDetail } from "@/services/cmci.service";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InformeActividadesPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [report, setReport] = useState<MonthlyReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    cmciService
      .getMonthlyReport(Number(id))
      .then((data) => {
        setReport(data);
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
        <p className="text-sm text-muted-foreground">Preparando formato de impresión A4...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-destructive font-medium">{error || "Informe no encontrado."}</p>
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
  const plannings = payload.planificaciones || [];
  const children = payload.ninos || [];
  const periodo = {
    inicio: report.period_start || "",
    fin: report.period_end || "",
  };

  return (
    <div className="print-sheet bg-white text-black p-8 max-w-[210mm] mx-auto min-h-screen text-xs leading-normal">
      {/* Non-printed action bar */}
      <div className="print:hidden mb-6 flex items-center justify-between border-b pb-3">
        <Link href="/informe-actividades">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Informes
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {/* Official Header */}
      <PrintHeader
        title={pv.titulo || "INFORME MENSUAL DE ACTIVIDADES — EDUCADORA"}
        codigo={`INF-MENSUAL-${report.id}`}
        fecha={report.period_end || new Date().toISOString().slice(0, 10)}
        periodo={periodo}
        showSemaforo={false}
      />

      {/* 1. Datos de Identificación y Centro */}
      <section className="mt-4 border border-black p-3 rounded-none">
        <h2 className="font-bold uppercase text-[11px] border-b border-black pb-1 mb-2">
          1 · Datos Generales del Servicio
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <strong>Centro Infantil:</strong> {pv.centro || "Centro Comunitario"}
          </div>
          <div>
            <strong>Educadora / Responsable:</strong> {pv.autora || "Sin asignar"}
          </div>
          <div>
            <strong>Período Reportado:</strong> {report.period_start} al {report.period_end}
          </div>
          <div>
            <strong>Rol / Formato:</strong> {report.report_type?.toUpperCase()}
          </div>
        </div>
      </section>

      {/* 2. Cuadro Resumen de Cobertura y Operatividad */}
      <section className="mt-3 border border-black p-3 rounded-none">
        <h2 className="font-bold uppercase text-[11px] border-b border-black pb-1 mb-2">
          2 · Resumen Operativo y Cobertura del Período
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="border border-gray-400 p-2">
            <p className="text-[10px] text-gray-700 uppercase">Usuarios Atendidos</p>
            <p className="text-sm font-bold mt-0.5">{pv.resumen?.usuarios || children.length || 0}</p>
          </div>
          <div className="border border-gray-400 p-2">
            <p className="text-[10px] text-gray-700 uppercase">Planificaciones</p>
            <p className="text-sm font-bold mt-0.5">{pv.resumen?.planificaciones || plannings.length || 0}</p>
          </div>
          <div className="border border-gray-400 p-2">
            <p className="text-[10px] text-gray-700 uppercase">Tasa de Asistencia</p>
            <p className="text-sm font-bold mt-0.5">{pv.resumen?.tasa_asistencia || 0}%</p>
          </div>
          <div className="border border-gray-400 p-2">
            <p className="text-[10px] text-gray-700 uppercase">Casos de Riesgo</p>
            <p className="text-sm font-bold mt-0.5">{pv.resumen?.casos_riesgo || 0}</p>
          </div>
        </div>

        {/* Niños a cargo */}
        {children.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-gray-300">
            <p className="font-semibold text-[10px] uppercase mb-1">
              Nómina de Niños Bajo Cobertura ({children.length}):
            </p>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              {children.map((c: any, i: number) => (
                <div key={c.id || i} className="truncate">
                  {i + 1}. {c.nombre} {c.edad ? `(${c.edad})` : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Detalle de Planificaciones Lúdicas Ejecutadas */}
      <section className="mt-3">
        <h2 className="font-bold uppercase text-[11px] border-b-2 border-black pb-1 mb-2">
          3 · Experiencias de Aprendizaje y Planificaciones Lúdicas ({plannings.length})
        </h2>
        {plannings.length === 0 ? (
          <p className="text-gray-600 italic py-2">No se registraron planificaciones lúdicas en este rango de fechas.</p>
        ) : (
          <table className="w-full text-[10px] border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black p-1 text-left w-16">Fecha</th>
                <th className="border border-black p-1 text-left w-14">Semana</th>
                <th className="border border-black p-1 text-left w-20">Grupo</th>
                <th className="border border-black p-1 text-left">Tema / Ámbito / Actividad</th>
                <th className="border border-black p-1 text-left">Objetivo de Aprendizaje</th>
              </tr>
            </thead>
            <tbody>
              {plannings.map((p: any, idx: number) => (
                <tr key={p.id || idx} className="border-b border-gray-400">
                  <td className="border border-black p-1 whitespace-nowrap">{p.planning_date}</td>
                  <td className="border border-black p-1 text-center">#{p.week_number || "-"}</td>
                  <td className="border border-black p-1">{p.age_group}</td>
                  <td className="border border-black p-1">
                    <strong>{p.tema || p.title || "Sin título"}</strong>
                    {p.actividad_principal && (
                      <p className="text-[9px] text-gray-700 mt-0.5 line-clamp-2">{p.actividad_principal}</p>
                    )}
                  </td>
                  <td className="border border-black p-1">{p.objetivo || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 4. Conclusiones y Logros del Período (Automático / LLM) */}
      <section className="mt-4 border border-black p-3 rounded-none">
        <h2 className="font-bold uppercase text-[11px] border-b border-black pb-1 mb-1.5">
          4 · Conclusiones, Logros y Desarrollo Integral (Generación Asistida)
        </h2>
        <p className="text-[11px] text-justify leading-relaxed whitespace-pre-line">
          {report.conclusions_auto || pv.conclusions_auto || "Sin conclusiones registradas."}
        </p>
      </section>

      {/* 5. Observaciones de la Educadora */}
      {report.educator_notes && (
        <section className="mt-3 border border-black p-3 rounded-none">
          <h2 className="font-bold uppercase text-[11px] border-b border-black pb-1 mb-1.5">
            5 · Observaciones y Novedades de la Educadora
          </h2>
          <p className="text-[11px] text-justify leading-relaxed whitespace-pre-line">
            {report.educator_notes}
          </p>
        </section>
      )}

      {/* 6. Firmas Físicas en Papel */}
      <section className="mt-8 pt-4">
        <div className="grid grid-cols-2 gap-12 text-center text-xs">
          <div className="pt-8 border-t border-black">
            <p className="font-bold">{pv.autora || "Educadora / Responsable"}</p>
            <p className="text-[10px] text-gray-700">Educadora de Atención / Cuidado</p>
            <p className="text-[9px] text-gray-500 mt-1">Firma y Fecha</p>
          </div>
          <div className="pt-8 border-t border-black">
            <p className="font-bold">Coordinación de Centro Infantil</p>
            <p className="text-[10px] text-gray-700">Revisión y Aprobación</p>
            <p className="text-[9px] text-gray-500 mt-1">Firma y Fecha</p>
          </div>
        </div>
        <p className="text-[9px] text-center text-gray-600 mt-6 print-only">
          {pv.nota || "Documento oficial CMCI firmable en papel fuera del sistema. Sin firma electrónica."}
        </p>
      </section>
    </div>
  );
}
