"use client";
/** Print registro: ficha del niño/a para expediente físico. */
import { useEffect, useState } from "react";
import { PrintHeader, PrintButton } from "@/components/cmci/print-header";
import { childrenService } from "@/services/children.service";

export default function RegistroPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<{ child: unknown; family: unknown; representatives: unknown[] } | null>(null);
  useEffect(() => {
    childrenService.getById(Number(id)).then(setData).catch(() => setData(null));
  }, [id]);
  const c = data?.child as Record<string, string> | undefined;
  return (
    <div className="print-sheet bg-white text-black p-6 max-w-[210mm] mx-auto">
      <div className="print:hidden mb-4"><PrintButton /></div>
      <PrintHeader title="Ficha integral del niño/a — CMCI" codigo={String(id)} fecha={new Date().toISOString().slice(0, 10)} />
      {!data ? <p className="text-sm mt-4">Cargando…</p> : (
        <section className="mt-3 text-sm grid grid-cols-2 gap-1">
          <div>Nombre: <b>{c?.full_name}</b></div><div>Cédula: {c?.cedula || "—"}</div>
          <div>Nacimiento: {c?.birth_date}</div><div>Edad: {c?.age_display}</div>
          <div>Estado: {c?.status}</div><div>Grupo: {c?.assigned_group || "—"}</div>
          <div className="col-span-2">Representantes: {(data.representatives as { first_name: string; last_name: string }[]).map((r) => `${r.first_name} ${r.last_name}`).join(" · ") || "—"}</div>
        </section>
      )}
      <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
        <div className="border-t border-black pt-1 text-center">Educadora · fecha</div>
        <div className="border-t border-black pt-1 text-center">Coordinadora · fecha</div>
      </div>
    </div>
  );
}
