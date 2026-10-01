"use client";
/** Ficha socioeconómica: B64/B65/B68 literales §10.1, E62 SUMPRODUCT, E63. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CMCI_LIST, SOCIO_WEIGHTS } from "@/lib/cmci/params";
import { computeSocioeconomic, ageMonths, type SocioInputs } from "@/lib/cmci/engine";
import { cmciService } from "@/services/cmci.service";

const ING_LABELS = ["Sueldos", "Jornales", "Independiente", "Negocios", "Pensiones", "Bonos", "Ayudas", "Otros"];
const EGR_LABELS = ["Alimentación", "Arriendo", "Básicos", "Transporte", "Educación", "Salud", "Cuidado", "Deudas", "Vestimenta", "Otros"];
const SERV_LABELS = ["Agua", "Luz", "Alcantarillado", "Internet", "Recolección", "Gas"];

export function SocioeconomicForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [codigo, setCodigo] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nino, setNino] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [cmci, setCmci] = useState(CMCI_LIST[0]);
  const [representante, setRepresentante] = useState("");
  const [telefono, setTelefono] = useState("");
  const [integrantes, setIntegrantes] = useState(6);
  const [menores5, setMenores5] = useState(2);
  const [de5a17, setDe5a17] = useState(2);
  const [adultos, setAdultos] = useState(2);
  const [mayores, setMayores] = useState(0);
  const [discapacidad, setDiscapacidad] = useState(0);
  const [enfermedad, setEnfermedad] = useState(0);
  const [trabajan, setTrabajan] = useState(1);
  const [generanIngreso, setGeneranIngreso] = useState(2);
  const [dormitorios, setDormitorios] = useState(3);
  const [ingresos, setIngresos] = useState<number[]>([1000, 0, 500, 40, 0, 50, 0, 0]);
  const [egresos, setEgresos] = useState<number[]>([200, 250, 50, 25, 75, 50, 0, 0, 30, 0]);
  const [tenencia, setTenencia] = useState("Arrendada");
  const [tipoVivienda, setTipoVivienda] = useState("Casa");
  const [situacionLaboral, setSituacionLaboral] = useState("Empleo informal");
  const [educacion, setEducacion] = useState("Secundaria incompleta");
  const [servicios, setServicios] = useState<boolean[]>([true, true, false, true, true, true]);

  const inputs: SocioInputs = useMemo(() => ({
    integrantes, menores5, de5a17, adultos, mayores, discapacidad, enfermedad,
    trabajan, generanIngreso, dormitorios, ingresos, egresos, tenencia, tipoVivienda,
    situacionLaboral, educacion, servicios, bono: "Sí", ayuda: "No",
  }), [integrantes, menores5, de5a17, adultos, mayores, discapacidad, enfermedad, trabajan, generanIngreso, dormitorios, ingresos, egresos, tenencia, tipoVivienda, situacionLaboral, educacion, servicios]);

  const r = useMemo(() => computeSocioeconomic(inputs), [inputs]);
  const edad = nacimiento ? ageMonths(nacimiento, fecha) : 0;

  const setArr = (arr: number[], i: number, v: number, set: (x: number[]) => void) => {
    const c = [...arr]; c[i] = Number.isFinite(v) ? v : 0; set(c);
  };

  const handleSave = async () => {
    if (!codigo || !nino) {
      toast({ title: "Faltan datos", description: "Código y niño/a obligatorios.", variant: "destructive" });
      return;
    }
    try {
      const rec = await cmciService.createSocio({
        codigo, fecha, nino, nacimiento, cmci, representante, telefono,
        total: r.total, clasificacion: r.clasificacion, perCapita: r.E19,
        payload: { ...inputs, edadMeses: edad, resultado: r },
      });
      toast({ title: "Ficha guardada", description: `${codigo} — ${r.total.toFixed(1)} (${r.clasificacion})` });
      router.push(`/admision/ficha-socioeconomica/${rec.id}`);
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "Error backend (401/403/404).", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Identificación</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div><Label>Código *</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div><Label>Niño/a *</Label><Input value={nino} onChange={(e) => setNino(e.target.value)} /></div>
          <div><Label>Nacimiento</Label><Input type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} /></div>
          <div><Label>CMCI</Label><Select value={cmci} onValueChange={setCmci}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CMCI_LIST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Representante</Label><Input value={representante} onChange={(e) => setRepresentante(e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
          <div><Label>Edad meses (DATEDIF)</Label><Input value={nacimiento ? String(edad) : ""} readOnly /></div>
        </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Hogar</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3">
          {[["Integrantes", integrantes, setIntegrantes], ["<5a", menores5, setMenores5], ["5-17a", de5a17, setDe5a17], ["Adultos", adultos, setAdultos], ["Mayores", mayores, setMayores], ["Discapacidad", discapacidad, setDiscapacidad], ["Enfermedad", enfermedad, setEnfermedad], ["Trabajan", trabajan, setTrabajan], ["Generan ingreso", generanIngreso, setGeneranIngreso], ["Dormitorios", dormitorios, setDormitorios]].map(([l, v, s]) => (
            <div key={l as string}><Label>{l as string}</Label><Input type="number" value={v as number} onChange={(e) => (s as (n: number) => void)(Number(e.target.value))} /></div>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Vivienda / laboral / educación (B64-B68 literales)</CardTitle></CardHeader><CardContent className="grid gap-3">
          <div><Label>Tenencia (B42)</Label><Select value={tenencia} onValueChange={setTenencia}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Propia", "Arrendada", "Prestada/Cedida", "Anticresis", "Por servicios", "Inestable"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Tipo vivienda (B43)</Label><Select value={tipoVivienda} onValueChange={setTipoVivienda}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Casa", "Departamento", "Cuarto", "Media agua", "Rancho", "Otro"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Situación laboral (E42 → B64)</Label><Select value={situacionLaboral} onValueChange={setSituacionLaboral}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Empleo formal", "Jubilado/a", "Empleo informal", "Trabajo independiente", "Desempleo", "Otro"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Educación (E43 → B68)</Label><Select value={educacion} onValueChange={setEducacion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Sin escolaridad", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Bachillerato completo", "Técnico/tecnológico", "Universitario", "Posgrado"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Servicios (B55 = {Math.round(r.B55 * 100)}%)</Label>
            <div className="grid grid-cols-2 gap-1 text-sm">{SERV_LABELS.map((l, i) => (
              <label key={l} className="flex items-center gap-2"><input type="checkbox" checked={servicios[i]} onChange={() => setServicios((s) => s.map((v, j) => (j === i ? !v : v)))} />{l}</label>
            ))}</div></div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Ingresos (E18={r.E18} · per-cápita E19={r.E19.toFixed(1)})</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          {ING_LABELS.map((l, i) => (<div key={l}><Label>{l}</Label><Input type="number" value={ingresos[i]} onChange={(e) => setArr(ingresos, i, Number(e.target.value), setIngresos)} /></div>))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Egresos (E29={r.E29} · disponible E30={r.E30} · carga E31={(r.E31 * 100).toFixed(1)}%)</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          {EGR_LABELS.map((l, i) => (<div key={l}><Label>{l}</Label><Input type="number" value={egresos[i]} onChange={(e) => setArr(egresos, i, Number(e.target.value), setEgresos)} /></div>))}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Puntaje SUMPRODUCT (E62={r.total.toFixed(1)} · {r.clasificacion})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4 text-sm">
            {SOCIO_WEIGHTS.map((w) => (<div key={w.key} className="border rounded p-2">{w.key} {w.dim}: <b>{r.sub[w.key]}</b> × {w.w}</div>))}
          </div>
          <p className="text-sm mt-2">B54={r.B54.toFixed(2)} · B56={r.B56.toFixed(2)} · B57={r.B57} · B58={r.B58} · 100=mejor condición (invertido vs vulnerabilidad)</p>
          <Button className="mt-3" onClick={handleSave}>Guardar ficha</Button>
        </CardContent></Card>
    </div>
  );
}
