import { VulnerabilityWizard } from "@/components/cmci/vulnerability-wizard";

export default function NuevaFichaVulnerabilidadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ficha de Vulnerabilidad — Nueva valoración</h1>
      <p className="text-sm text-muted-foreground">Wizard D1-D8 · Guardar crea un registro nuevo (sin bug macro) · Borrador auto “En proceso”.</p>
      <VulnerabilityWizard />
    </div>
  );
}
