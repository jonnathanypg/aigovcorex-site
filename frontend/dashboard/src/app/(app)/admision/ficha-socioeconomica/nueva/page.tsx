import { SocioeconomicForm } from "@/components/cmci/socioeconomic-form";

export default function NuevaFichaSocioeconomicaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ficha Socioeconómica — Nuevo registro</h1>
      <p className="text-sm text-muted-foreground">B64/B65/B68 literales §10.1 · E62 SUMPRODUCT · E63 clasificación.</p>
      <SocioeconomicForm />
    </div>
  );
}
