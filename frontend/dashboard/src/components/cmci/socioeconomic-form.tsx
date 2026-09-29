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
import { ChildSearchSelect, type ChildOption, type ChildFull } from "@/components/cmci/child-search-select";

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
  const [childId, setChildId] = useState<number | null>(null);

  /** Al seleccionar un niño: precarga datos previos guardados (familia, representante, última ficha). */
  const handleChildSelect = (opt: ChildOption | null, full: ChildFull | null) => {
    if (!opt) {
      setChildId(null);
      return;
    }
    setChildId(opt.id);
    const reps = full?.representatives ?? [];
    const mainRep = reps[0] ?? opt.representative;
    const birth = (full?.child?.birth_date ?? opt.birth_date ?? "") as string;
    setNino(opt.full_name);
    if (birth) setNacimiento(String(birth).slice(0, 10));
    if (mainRep) {
      setRepresentante(mainRep.full_name || representante);
      if (mainRep.phone) setTelefono(mainRep.phone);
    }
    const fam = (full?.family ?? {}) as Record<string, unknown>;
    if (typeof fam.phone_primary === "string" && fam.phone_primary && !telefono) setTelefono(fam.phone_primary as string);
    toast({ title: "Niño/a vinculado", description: `${opt.full_name} — datos previos precargados.` });
  };

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
        codigo, fecha, nino, nacimiento, cmci, child_id: childId ?? undefined, representante, telefono,
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
          <div className="md:col-span-4"><ChildSearchSelect onSelect={handleChildSelect} /></div>
          <div><Label>Código *</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div><Label>Niño/a *</Label><Input value={nino} onChange={(e) => setNino(e.target.value)} /></div>
          <div><Label>Nacimiento</Label><Input type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} /></div>
          <div><Label>Centro</Label><Select value={cmci} onValueChange={setCmci}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CMCI_LIST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Representante</Label><Input value={representante} onChange={(e) => setRepresentante(e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
          <div><Label>Edad meses (DATEDIF)</Label><Input value={nacimiento ? String(edad) : ""} readOnly /></div>
        </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Composición del Hogar</CardTitle>
            <p className="text-xs text-muted-foreground">Distribución etaria y económica de los miembros</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[["Integrantes", integrantes, setIntegrantes], ["< 5 años", menores5, setMenores5], ["5 a 17 años", de5a17, setDe5a17], ["Adultos", adultos, setAdultos], ["Adultos mayores", mayores, setMayores], ["Discapacidad", discapacidad, setDiscapacidad], ["Enfermedad grave", enfermedad, setEnfermedad], ["Trabajan", trabajan, setTrabajan], ["Generan ingreso", generanIngreso, setGeneranIngreso], ["Dormitorios", dormitorios, setDormitorios]].map(([l, v, s]) => (
              <div key={l as string}><Label className="text-xs">{l as string}</Label><Input type="number" className="h-9" value={v as number} onChange={(e) => (s as (n: number) => void)(Number(e.target.value))} /></div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vivienda, Empleo y Educación</CardTitle>
            <p className="text-xs text-muted-foreground">Condiciones estructurales y laborales del núcleo</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Tenencia</Label><Select value={tenencia} onValueChange={setTenencia}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["Propia", "Arrendada", "Prestada/Cedida", "Anticresis", "Por servicios", "Inestable"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Tipo de Vivienda</Label><Select value={tipoVivienda} onValueChange={setTipoVivienda}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["Casa", "Departamento", "Cuarto", "Media agua", "Rancho", "Otro"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label className="text-xs">Situación Laboral</Label><Select value={situacionLaboral} onValueChange={setSituacionLaboral}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["Empleo formal", "Jubilado/a", "Empleo informal", "Trabajo independiente", "Desempleo", "Otro"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Nivel Educativo Principal</Label><Select value={educacion} onValueChange={setEducacion}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["Sin escolaridad", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Bachillerato completo", "Técnico/tecnológico", "Universitario", "Posgrado"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Servicios Básicos Disponibles</Label>
                <span className="text-xs font-semibold text-primary">{Math.round(r.B55 * 100)}% cobertura</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
                {SERV_LABELS.map((l, i) => (
                  <label key={l} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={servicios[i]} onChange={() => setServicios((s) => s.map((v, j) => (j === i ? !v : v)))} />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Ingresos Mensuales</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Total: <b>${r.E18.toFixed(2)}</b> · Per-cápita: <b>${r.E19.toFixed(2)}</b></p>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 pt-2">
            {ING_LABELS.map((l, i) => (
              <div key={l}><Label className="text-xs">{l}</Label><Input type="number" className="h-9" value={ingresos[i]} onChange={(e) => setArr(ingresos, i, Number(e.target.value), setIngresos)} /></div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Egresos Mensuales</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Total: <b>${r.E29.toFixed(2)}</b> · Carga: <b>{(r.E31 * 100).toFixed(1)}%</b></p>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 pt-2">
            {EGR_LABELS.map((l, i) => (
              <div key={l}><Label className="text-xs">{l}</Label><Input type="number" className="h-9" value={egresos[i]} onChange={(e) => setArr(egresos, i, Number(e.target.value), setEgresos)} /></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Puntaje Socioeconómico Consolidado</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Puntaje ponderado (100 = mejor condición socioeconómica)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-primary">{r.total.toFixed(1)} pts</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              {r.clasificacion}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {SOCIO_WEIGHTS.map((w) => (
              <div key={w.key} className="border rounded-lg p-2.5 bg-muted/20">
                <div className="text-muted-foreground font-medium">{w.dim}</div>
                <div className="text-sm font-bold mt-1">Score {r.sub[w.key]} <span className="text-xs font-normal text-muted-foreground">(×{w.w})</span></div>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full sm:w-auto" onClick={handleSave}>Guardar ficha socioeconómica</Button>
        </CardContent>
      </Card>
    </div>
  );
}
