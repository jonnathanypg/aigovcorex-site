"use client";
import { VulnerabilityWizard } from "@/components/cmci/vulnerability-wizard";
import { PrintButton } from "@/components/cmci/print-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FichaVulnerabilidadDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ficha de Vulnerabilidad</h1>
        <div className="flex gap-2">
          <Link href={`/admision/${id}/print`}><Button variant="outline">Vista impresión</Button></Link>
          <PrintButton />
        </div>
      </div>
      <VulnerabilityWizard recordId={id} />
    </div>
  );
}
