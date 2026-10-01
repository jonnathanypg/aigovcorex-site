/**
 * CMCI F3 — cmci.service.ts.
 * Fetch real a /api/cmci/* con fallback localStorage SOLO si backend inalcanzable.
 * Endpoints (backend/modules/early-childhood/api/cmci.py):
 *   POST /api/cmci/vulnerability/compute (preview) · POST /api/cmci/vulnerability (guardar)
 *   GET  /api/cmci/vulnerability?child_id&center&status&from&to&page&per_page
 *   GET  /api/cmci/vulnerability/<id>
 *   GET  /api/cmci/priorizacion · GET /api/cmci/dashboard
 *   POST /api/cmci/socioeconomic/compute · POST /api/cmci/socioeconomic
 *   GET  /api/cmci/socioeconomic · GET /api/cmci/socioeconomic/<id>
 *   GET/PUT /api/cmci/params (PUT solo license_admin) · POST /api/cmci/import-excels
 * Cada valoración guardada = nuevo registro histórico (nunca sobreescribir).
 * Fallback: SOLO ante error de red (sin respuesta: backend inalcanzable).
 * 401/403/404/422 NO usan fallback: se propagan como CmciApiError.
 */
import api from "./api";
import { AxiosError } from "axios";
import { rankRows, computeVulnerability } from "@/lib/cmci/engine";

const VKEY = "cmci:vulnerability:v1";
const SKEY = "cmci:socioeconomic:v1";

// ─── Tipos frontend (compat UI existente) ───
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
export interface DashboardSummary {
  total: number; promedio: number;
  byNivel: Record<string, number>; byPrio: Record<string, number>;
  byCmci: Record<string, number>; alertas: number;
}
export type PriorizacionRow = VulnRecord & { Y: number; Z: number };

// ─── Tipos backend (contrato api/cmci.py) ───
export interface BackendVulnResult {
  total: number; level?: string; priority?: string;
  protection_alert?: boolean | string; protection_flag?: boolean;
  semaphore?: string; color?: string; childcare_need?: string;
  subtotals?: Record<string, number>; order_y?: number;
  [k: string]: unknown;
}
export interface BackendVulnRecord {
  id: number | string; code?: string; child_name?: string; child_id?: string | number;
  center?: string; status?: string; assessed_at?: string; observations?: string;
  answers?: Record<string, number>; result?: BackendVulnResult;
  [k: string]: unknown;
}
export interface BackendSocioRecord {
  id: number | string; code?: string; child_name?: string; child_id?: string | number;
  center?: string; assessed_at?: string;
  data?: Record<string, unknown>; result?: Record<string, unknown>;
  [k: string]: unknown;
}
export interface Paginated<T> { data: T[]; page: number; per_page: number; total: number; }
export interface ParamsResponse { scope: string; version: string; params: unknown; }
export interface ImportResponse { imported: { vulnerability: number; socioeconomic: number }; params_version: string; }
export interface VulnFilters {
  child_id?: string; center?: string; status?: string;
  from?: string; to?: string; page?: number; per_page?: number;
}

// ─── Error tipado 401/403/404/422 ───
export class CmciApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CmciApiError";
    this.status = status;
    this.code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 422 ? "VALIDATION" : "API_ERROR";
  }
}

/** Backend inalcanzable = axios sin response (red caída, DNS, timeout, CORS-red). */
export function isBackendUnreachable(err: unknown): boolean {
  return err instanceof AxiosError && err.response === undefined;
}

function toApiError(err: unknown, fallbackMsg: string): CmciApiError {
  if (err instanceof CmciApiError) return err;
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 0;
    const data = err.response?.data as { error?: string } | undefined;
    const msg = (data?.error && String(data.error)) || err.message || fallbackMsg;
    if (status === 401) return new CmciApiError(401, "Sesión expirada o sin autenticación (401). Inicie sesión de nuevo.");
    if (status === 403) return new CmciApiError(403, `Acceso denegado (403): ${msg}`);
    if (status === 404) return new CmciApiError(404, `Registro no encontrado (404): ${msg}`);
    if (status === 422) return new CmciApiError(422, `Validación backend (422): ${msg}`);
    if (status > 0) return new CmciApiError(status, msg);
  }
  return new CmciApiError(0, fallbackMsg);
}

// ─── localStorage (fallback offline únicamente) ───
function load<T>(k: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) ?? "[]") as T[]; } catch { return []; }
}
function save(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
}
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function mapVulnBackendToFront(b: BackendVulnRecord): VulnRecord {
  const r: BackendVulnResult = b.result ?? { total: 0 };
  const answers = b.answers ?? {};
  const alerta = r.protection_alert === true || r.protection_alert === "SÍ" || r.protection_flag === true;
  const total = Number(r.total ?? 0);
  return {
    id: String(b.id), codigo: String(b.code ?? ""), fecha: String(b.assessed_at ?? "").slice(0, 10),
    nino: String(b.child_name ?? ""), nacimiento: String((answers as Record<string, unknown>).nacimiento ?? ""),
    edadMeses: Number((r as Record<string, unknown>).age_months ?? 0), enRango: true,
    sexo: String((answers as Record<string, unknown>).sexo ?? ""),
    cmci: String(b.center ?? ""), sector: String((answers as Record<string, unknown>).sector ?? ""),
    representante: String((answers as Record<string, unknown>).representante ?? ""),
    parentesco: String((answers as Record<string, unknown>).parentesco ?? ""),
    telefono: String((answers as Record<string, unknown>).telefono ?? ""),
    estado: String(b.status ?? "En proceso"),
    hogar: (answers as Record<string, unknown>).hogar as VulnRecord["hogar"] ?? { ingresoTotal: 0, integrantes: 1, perceptores: 1, nna: 1, dormitorios: 1 },
    scores: Object.fromEntries(Object.entries(answers).filter(([, v]) => typeof v === "number")) as Record<string, number>,
    subtotals: (r.subtotals as Record<string, number>) ?? {},
    total, nivel: String(r.level ?? ""), semaforo: String(r.semaphore ?? ""), color: String((r as Record<string, unknown>).color ?? ""),
    alerta, prioridad: String(r.priority ?? ""), necesidad: String((r as Record<string, unknown>).childcare_need ?? ""),
    observaciones: b.observations ? String(b.observations) : undefined,
    createdAt: String(b.assessed_at ?? ""),
  };
}

function mapSocioBackendToFront(b: BackendSocioRecord): SocioRecord {
  const res = (b.result ?? {}) as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const total = Number(res.total ?? 0);
  return {
    id: String(b.id), codigo: String(b.code ?? ""), fecha: String(b.assessed_at ?? "").slice(0, 10),
    nino: String(b.child_name ?? ""), nacimiento: String(data.nacimiento ?? ""),
    cmci: String(b.center ?? ""), representante: String(data.representante ?? ""),
    telefono: String(data.telefono ?? ""), total,
    clasificacion: String(res.classification ?? res.clasificacion ?? ""),
    perCapita: Number(res.per_capita ?? res.perCapita ?? 0),
    payload: { ...data, resultado: res }, createdAt: String(b.assessed_at ?? ""),
  };
}

function localPriorizacion(): PriorizacionRow[] {
  const rows = load<VulnRecord>(VKEY);
  const ranked = rankRows(rows.map((r) => ({ id: r.id, priority: r.prioridad, protectionAlert: r.alerta, total: r.total })));
  const z = new Map(ranked.map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, Y: z.get(r.id)!.Y, Z: z.get(r.id)!.Z })).sort((a, b) => a.Z - b.Z);
}

function localDashboard(): DashboardSummary {
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
}

function buildCSV(rows: PriorizacionRow[]): string {
  const head = "Z;Codigo;Nino;EdadMeses;CMCI;Fecha;Total;Nivel;Prioridad;Alerta;Estado";
  const lines = rows.map((r) =>
    [r.Z, r.codigo, r.nino, r.edadMeses, r.cmci, r.fecha, r.total.toFixed(2), r.nivel, r.prioridad, r.alerta ? "Sí" : "No", r.estado].join(";"),
  );
  return [head, ...lines].join("\n");
}

export const cmciService = {
  // — Vulnerabilidad: preview compute —
  async computePreview(answers: Record<string, number>, scope = "global"): Promise<BackendVulnResult> {
    try {
      const { data } = await api.post<BackendVulnResult>("/api/cmci/vulnerability/compute", { answers, scope });
      return data;
    } catch (err) {
      if (isBackendUnreachable(err)) {
        // Fallback offline: réplica local determinista (engine).
        const local = computeVulnerability(answers, { ingresoTotal: 0, integrantes: 1, perceptores: 1, nna: 1, dormitorios: 1 });
        return { total: local.total, level: local.level, priority: local.priority } as BackendVulnResult;
      }
      throw toApiError(err, "Error en preview de vulnerabilidad");
    }
  },

  // — Vulnerabilidad: CRUD —
  async listVuln(filters: VulnFilters = {}): Promise<VulnRecord[]> {
    try {
      const { data } = await api.get<Paginated<BackendVulnRecord> | BackendVulnRecord[]>("/api/cmci/vulnerability", { params: filters });
      const items = Array.isArray(data) ? data : data.data;
      return items.map(mapVulnBackendToFront);
    } catch (err) {
      if (isBackendUnreachable(err)) return load<VulnRecord>(VKEY);
      throw toApiError(err, "Error listando valoraciones");
    }
  },

  async getVuln(id: string): Promise<VulnRecord | undefined> {
    try {
      const { data } = await api.get<BackendVulnRecord>(`/api/cmci/vulnerability/${encodeURIComponent(id)}`);
      return mapVulnBackendToFront(data);
    } catch (err) {
      if (isBackendUnreachable(err)) return load<VulnRecord>(VKEY).find((r) => r.id === id);
      if (err instanceof AxiosError && err.response?.status === 404) return undefined;
      throw toApiError(err, "Error obteniendo valoración");
    }
  },

  async createVuln(r: Omit<VulnRecord, "id" | "createdAt">): Promise<VulnRecord> {
    const payload = {
      code: r.codigo, child_name: r.nino, center: r.cmci, status: r.estado,
      assessed_at: r.fecha, observations: r.observaciones,
      answers: { ...r.scores, nacimiento: r.nacimiento, sexo: r.sexo, sector: r.sector, representante: r.representante, parentesco: r.parentesco, telefono: r.telefono, hogar: r.hogar },
    };
    try {
      const { data } = await api.post<BackendVulnRecord>("/api/cmci/vulnerability", payload);
      return mapVulnBackendToFront(data);
    } catch (err) {
      if (isBackendUnreachable(err)) {
        const all = load<VulnRecord>(VKEY);
        const rec = { ...r, id: uid(), createdAt: new Date().toISOString() };
        all.push(rec); save(VKEY, all); return rec;
      }
      throw toApiError(err, "Error guardando valoración");
    }
  },

  /** TODO(F1-backend): sin endpoint PATCH/PUT de vulnerabilidad en api/cmci.py; hoy solo persiste local (histórico). */
  async updateEstado(id: string, estado: string): Promise<void> {
    const all = load<VulnRecord>(VKEY).map((r) => (r.id === id ? { ...r, estado } : r));
    save(VKEY, all);
  },

  // — Socioeconómica —
  async computeSocioPreview(data: Record<string, unknown>, scope = "global"): Promise<Record<string, unknown>> {
    try {
      const { data: res } = await api.post<Record<string, unknown>>("/api/cmci/socioeconomic/compute", { data, scope });
      return res;
    } catch (err) {
      if (isBackendUnreachable(err)) return { offline: true };
      throw toApiError(err, "Error en preview socioeconómico");
    }
  },

  async listSocio(filters: VulnFilters = {}): Promise<SocioRecord[]> {
    try {
      const { data } = await api.get<Paginated<BackendSocioRecord> | BackendSocioRecord[]>("/api/cmci/socioeconomic", { params: filters });
      const items = Array.isArray(data) ? data : data.data;
      return items.map(mapSocioBackendToFront);
    } catch (err) {
      if (isBackendUnreachable(err)) return load<SocioRecord>(SKEY);
      throw toApiError(err, "Error listando fichas socioeconómicas");
    }
  },

  async getSocio(id: string): Promise<SocioRecord | undefined> {
    try {
      const { data } = await api.get<BackendSocioRecord>(`/api/cmci/socioeconomic/${encodeURIComponent(id)}`);
      return mapSocioBackendToFront(data);
    } catch (err) {
      if (isBackendUnreachable(err)) return load<SocioRecord>(SKEY).find((r) => r.id === id);
      if (err instanceof AxiosError && err.response?.status === 404) return undefined;
      throw toApiError(err, "Error obteniendo ficha socioeconómica");
    }
  },

  async createSocio(r: Omit<SocioRecord, "id" | "createdAt">): Promise<SocioRecord> {
    const payload = {
      code: r.codigo, child_name: r.nino, center: r.cmci, assessed_at: r.fecha,
      data: { ...(r.payload as Record<string, unknown> ?? {}), representante: r.representante, telefono: r.telefono, nacimiento: r.nacimiento },
    };
    try {
      const { data } = await api.post<BackendSocioRecord>("/api/cmci/socioeconomic", payload);
      return mapSocioBackendToFront(data);
    } catch (err) {
      if (isBackendUnreachable(err)) {
        const all = load<SocioRecord>(SKEY);
        const rec = { ...r, id: uid(), createdAt: new Date().toISOString() };
        all.push(rec); save(SKEY, all); return rec;
      }
      throw toApiError(err, "Error guardando ficha socioeconómica");
    }
  },

  // — Priorización orden Z —
  async priorizacion(filters: VulnFilters = {}): Promise<PriorizacionRow[]> {
    try {
      const { data } = await api.get<Paginated<Record<string, unknown>>>("/api/cmci/priorizacion", { params: filters });
      const items = Array.isArray((data as unknown as { data?: unknown }).data)
        ? (data as Paginated<Record<string, unknown>>).data : (data as unknown as Record<string, unknown>[]);
      return (items as Record<string, unknown>[]).map((b, i) => ({
        id: String(b.id ?? i), codigo: String(b.code ?? ""), fecha: String(b.assessed_at ?? "").slice(0, 10),
        nino: String(b.child_name ?? ""), nacimiento: "", edadMeses: Number(b.age_months ?? 0),
        enRango: true, sexo: "", cmci: String(b.center ?? ""), sector: "",
        representante: "", parentesco: "", telefono: "", estado: String(b.status ?? ""),
        hogar: { ingresoTotal: 0, integrantes: 1, perceptores: 1, nna: 1, dormitorios: 1 },
        scores: {}, subtotals: {},
        total: Number(b.total ?? 0), nivel: String(b.level ?? ""), semaforo: String(b.semaphore ?? ""),
        color: "", alerta: Boolean(b.protection_alert), prioridad: String(b.priority ?? ""),
        necesidad: "", observaciones: undefined, createdAt: String(b.assessed_at ?? ""),
        Y: Number(b.order_y ?? 0), Z: Number(b.rank_z ?? i + 1),
      }));
    } catch (err) {
      if (isBackendUnreachable(err)) return localPriorizacion();
      throw toApiError(err, "Error obteniendo priorización");
    }
  },

  // — Dashboard CMCI —
  async dashboard(filters: VulnFilters = {}): Promise<DashboardSummary> {
    try {
      const { data } = await api.get<{
        total_E5: number; avg_I5: number | null;
        by_level: Record<string, { count: number }>; by_priority_D17_D19: Record<string, number>;
        protection_alerts_E22: number; by_center: Record<string, number>;
      }>("/api/cmci/dashboard", { params: filters });
      const byNivel: Record<string, number> = {};
      for (const [k, v] of Object.entries(data.by_level ?? {})) byNivel[k] = v.count;
      return {
        total: data.total_E5 ?? 0, promedio: data.avg_I5 != null ? data.avg_I5 * 100 : 0,
        byNivel, byPrio: data.by_priority_D17_D19 ?? {},
        byCmci: data.by_center ?? {}, alertas: data.protection_alerts_E22 ?? 0,
      };
    } catch (err) {
      if (isBackendUnreachable(err)) return localDashboard();
      throw toApiError(err, "Error obteniendo dashboard");
    }
  },

  async exportPriorizacionCSV(rows?: PriorizacionRow[]): Promise<string> {
    const list = rows ?? await this.priorizacion();
    return buildCSV(list);
  },

  // — Params (GET abierto autenticado, PUT solo license_admin → 403 si otro rol) —
  async getParams(scope = "global"): Promise<ParamsResponse> {
    try {
      const { data } = await api.get<ParamsResponse>("/api/cmci/params", { params: { scope } });
      return data;
    } catch (err) {
      throw toApiError(err, "Error obteniendo parámetros");
    }
  },

  async updateParams(scope: string, patch: Record<string, unknown>): Promise<ParamsResponse> {
    try {
      const { data } = await api.put<ParamsResponse>("/api/cmci/params", { scope, patch });
      return data;
    } catch (err) {
      throw toApiError(err, "Error actualizando parámetros (requiere license_admin)");
    }
  },

  // — Import excels históricos —
  async importExcels(args: { vuln_path?: string; socio_path?: string } = {}): Promise<ImportResponse> {
    try {
      const { data } = await api.post<ImportResponse>("/api/cmci/import-excels", args);
      return data;
    } catch (err) {
      throw toApiError(err, "Error importando excels");
    }
  },
};
