/**
 * CMCI F3 — cmci.service.ts (frontend temporal).
 * TODO(F1-backend): reemplazar localStorage por endpoints:
 *   POST /api/cmci/vulnerability/compute (preview) · POST /api/cmci/vulnerability (guardar)
 *   GET /api/cmci/vulnerability?child_id&center_id&status · GET /api/cmci/vulnerability/<id>
 *   GET /api/cmci/priorizacion · GET /api/cmci/dashboard · POST /api/cmci/socioeconomic/*
 *   GET/PUT /api/cmci/params (license_admin) · POST /api/cmci/import-excels
 * Cada valoración guardada = nuevo registro histórico (nunca sobreescribir).
 */
import { rankRows } from "@/lib/cmci/engine";

const VKEY = "cmci:vulnerability:v1";
const SKEY = "cmci:socioeconomic:v1";

export interface VulnRecord {
  id: string; codigo: string; fecha: string; nino: string; nacimiento: string;
  edadMeses: number; enRango: boolean; sexo: string; cmci: string; sector: string;
  representante: string; parentesco: string; telefono: string; estado: string;
  hogar: { ingresoTotal: number; integrantes: number; perceptores: number; nna: number; dormitorios: number };
  scores: Record<string, number>; subtotals: Record<string, number>;
  total: number; nivel: string; semaforo: string; color: string;
  alerta: boolean; prioridad: string; necesidad: string; observaciones?: string;
  createdAt: string;
}
export interface SocioRecord {
  id: string; codigo: string; fecha: string; nino: string; nacimiento: string; cmci: string;
  representante: string; telefono: string;
  total: number; clasificacion: string; perCapita: number; payload: unknown; createdAt: string;
}

function load<T>(k: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) ?? "[]") as T[]; } catch { return []; }
}
function save(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
}
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const cmciService = {
  // — Vulnerabilidad —
  listVuln(): VulnRecord[] { return load<VulnRecord>(VKEY); },
  getVuln(id: string): VulnRecord | undefined { return load<VulnRecord>(VKEY).find((r) => r.id === id); },
  createVuln(r: Omit<VulnRecord, "id" | "createdAt">): VulnRecord {
    const all = load<VulnRecord>(VKEY);
    const rec = { ...r, id: uid(), createdAt: new Date().toISOString() };
    all.push(rec); save(VKEY, all); return rec;
  },
  updateEstado(id: string, estado: string) {
    const all = load<VulnRecord>(VKEY).map((r) => (r.id === id ? { ...r, estado } : r));
    save(VKEY, all);
  },
  // — Socioeconómica —
  listSocio(): SocioRecord[] { return load<SocioRecord>(SKEY); },
  getSocio(id: string): SocioRecord | undefined { return load<SocioRecord>(SKEY).find((r) => r.id === id); },
  createSocio(r: Omit<SocioRecord, "id" | "createdAt">): SocioRecord {
    const all = load<SocioRecord>(SKEY);
    const rec = { ...r, id: uid(), createdAt: new Date().toISOString() };
    all.push(rec); save(SKEY, all); return rec;
  },
  // — Priorización orden Z (Código/Niño/Edad/CMCI/Fecha/Total/Nivel/Prioridad/Alerta/Estado) —
  priorizacion(): (VulnRecord & { Y: number; Z: number })[] {
    const rows = load<VulnRecord>(VKEY);
    const ranked = rankRows(rows.map((r) => ({ id: r.id, priority: r.prioridad, protectionAlert: r.alerta, total: r.total })));
    const z = new Map(ranked.map((x) => [x.id, x]));
    return rows
      .map((r) => ({ ...r, Y: z.get(r.id)!.Y, Z: z.get(r.id)!.Z }))
      .sort((a, b) => a.Z - b.Z);
  },
  // — Dashboard CMCI: conteos por nivel / prioridad / CMCI + alertas —
  dashboard() {
    const rows = load<VulnRecord>(VKEY);
    const byNivel: Record<string, number> = {};
    const byPrio: Record<string, number> = {};
    const byCmci: Record<string, number> = {};
    let alertas = 0; let suma = 0;
    for (const r of rows) {
      byNivel[r.nivel] = (byNivel[r.nivel] ?? 0) + 1;
      byPrio[r.prioridad] = (byPrio[r.prioridad] ?? 0) + 1;
      byCmci[r.cmci] = (byCmci[r.cmci] ?? 0) + 1;
      if (r.alerta) alertas += 1;
      suma += r.total;
    }
    return { total: rows.length, promedio: rows.length ? suma / rows.length : 0, byNivel, byPrio, byCmci, alertas };
  },
  exportPriorizacionCSV(): string {
    const rows = this.priorizacion();
    const head = "Z;Codigo;Nino;EdadMeses;CMCI;Fecha;Total;Nivel;Prioridad;Alerta;Estado";
    const lines = rows.map((r) =>
      [r.Z, r.codigo, r.nino, r.edadMeses, r.cmci, r.fecha, r.total.toFixed(2), r.nivel, r.prioridad, r.alerta ? "Sí" : "No", r.estado].join(";"),
    );
    return [head, ...lines].join("\n");
  },
};
