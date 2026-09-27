"use client";
/** Encabezado oficial imprimible: logos CMCI + título + código/fecha. */
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintHeader({ title, codigo, fecha }: { title: string; codigo: string; fecha: string }) {
  return (
    <div className="print-header">
      <div className="flex items-center justify-between gap-4 border-b-2 border-black pb-2">
        <img src="/logos/cmci-logo-1.png" alt="Logo 1" className="h-14 object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase">{title}</h1>
          <p className="text-xs">Código: {codigo} · Fecha: {fecha}</p>
        </div>
        <img src="/logos/cmci-logo-2.png" alt="Logo 2" className="h-14 object-contain" />
      </div>
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
