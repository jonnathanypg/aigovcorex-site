/**
 * CMCI F3 — Motores deterministas réplica exacta Excel (§3.1 + §3.2 + §10.1).
 * Vulnerabilidad: Total = Σ(score_i/4 × peso_global_i); Nivel=INDEX/MATCH rangos;
 * Alerta = ANY(I7.1..I7.5 >= 3); Prioridad = alerta ? P1 : MATCH; Y/Z ranking.
 * Socioeconómica: E18/E19/E29-E31, B54-B58, B62-B68 literales §10.1, E62 SUMPRODUCT, E63.
 */
import {
  VULN_INDICATORS, VULN_OPTIONS, VULN_RANGES, VULN_PRIOS, VULN_THRESHOLDS,
  SOCIO_WEIGHTS, SOCIO_THRESHOLDS, SOCIO_RANGES, COUNTRY_CONFIGS, DEFAULT_COUNTRY,
} from "./params";

export type Answers = Record<string, number>; // indicatorId -> score 0-4
export interface Hogar { ingresoTotal: number; integrantes: number; perceptores: number; nna: number; dormitorios: number; }

export function optionScore(indicatorId: string, text: string): number {
  const o = VULN_OPTIONS.find((x) => x.indicator === indicatorId && x.text === text);
  return o ? o.score : 0;
}

/** Auto-indicadores: I1.1 per-cápita vs CanastaRef; I1.4 dependencia; I2.2 NNA (máx 3); I5.2 hacinamiento. */
export function autoScores(h: Hogar, canastaRef = VULN_THRESHOLDS.CanastaRef): Answers {
  const t = VULN_THRESHOLDS;
  const perCapita = h.ingresoTotal / Math.max(h.integrantes, 1);
  const ratio = canastaRef > 0 ? perCapita / canastaRef : 0;
  const i11 = ratio >= t.RatioT_100 ? 0 : ratio >= t.RatioT_075 ? 1 : ratio >= t.RatioT_050 ? 2 : ratio >= t.RatioT_025 ? 3 : 4;
  const dep = h.integrantes / Math.max(h.perceptores, 1);
  const i14 = dep <= t.DepT_1 ? 0 : dep <= t.DepT_2 ? 1 : dep <= t.DepT_3 ? 2 : dep <= t.DepT_4 ? 3 : 4;
  const i22 = h.nna <= t.NnaT_2 ? 0 : h.nna === t.NnaT_3 ? 1 : h.nna === t.NnaT_4 ? 2 : 3; // máx 3
  const hac = h.integrantes / Math.max(h.dormitorios, 1);
  const i52 = hac <= t.HacT_2 ? 0 : hac <= t.HacT_3 ? 2 : 4;
  return { "I1.1": i11, "I1.4": i14, "I2.2": i22, "I5.2": i52 };
}

export interface VulnResult {
  subtotals: Record<string, number>; total: number; ratio: number; level: string;
  semaphore: string; color: string; protectionAlert: boolean; priority: string;
  childcareNeed: string; alerts: { key: string; label: string; active: boolean }[];
  perCapita: number; dependencia: number; hacinamiento: number;
  contributions: { id: string; score: number; weight: number; aporte: number }[];
}

export function computeVulnerability(selectScores: Answers, hogar: Hogar): VulnResult {
  const auto = autoScores(hogar);
  const all: Answers = { ...selectScores, ...auto };
  const perCapita = hogar.ingresoTotal / Math.max(hogar.integrantes, 1);
  const dependencia = hogar.integrantes / Math.max(hogar.perceptores, 1);
  const hacinamiento = hogar.integrantes / Math.max(hogar.dormitorios, 1);
  const contributions = VULN_INDICATORS.map((ind) => {
    const s = all[ind.id] ?? 0;
    return { id: ind.id, score: s, weight: ind.weight_global, aporte: (s / 4) * ind.weight_global };
  });
  const subtotals: Record<string, number> = {};
  for (const c of contributions) {
    const dim = VULN_INDICATORS.find((i) => i.id === c.id)!.dim;
    subtotals[dim] = (subtotals[dim] ?? 0) + c.aporte;
  }
  const total = contributions.reduce((a, c) => a + c.aporte, 0);
  const ratio = total / 100;
  const range = VULN_RANGES.find((r) => total >= r.from && total <= r.to) ?? VULN_RANGES[0];
  // F82: ANY(I7.1..I7.5 >= 3)
  const protectionAlert = ["I7.1", "I7.2", "I7.3", "I7.4", "I7.5"].some((id) => (all[id] ?? 0) >= 3);
  const prio = VULN_PRIOS.find((p) => total >= p.from && (total < p.to || (p.to === 100 && total <= 100))) ?? VULN_PRIOS[0];
  const priority = protectionAlert ? "PRIORIDAD 1" : prio.name;
  const d4pct = ((subtotals["D4"] ?? 0) / 20) * 100;
  const childcareNeed = d4pct >= 60 ? "ALTA" : d4pct >= 30 ? "MEDIA" : "BAJA";
  const g = (id: string) => all[id] ?? 0;
  const alerts = [
    { key: "proteccion", label: "Alerta de protección — requiere revisión profesional", active: protectionAlert },
    { key: "sin_cuidador", label: "Sin cuidador permanente", active: g("I4.1") >= 4 },
    { key: "monoparental", label: "Monoparental sin apoyo", active: g("I2.1") >= 3 },
    { key: "desempleo", label: "Desempleo en el hogar", active: g("I1.2") >= 3 || g("I3.1") === 3 },
    { key: "hacinamiento", label: "Hacinamiento crítico", active: g("I5.2") >= 4 },
    { key: "sin_servicios", label: "Sin servicios básicos", active: g("I5.3") >= 4 },
    { key: "cuidado_urgente", label: "Necesidad urgente de cuidado", active: g("I4.4") >= 3 || g("I4.5") >= 4 },
    { key: "discapacidad", label: "Discapacidad / barrera de cuidado", active: g("I6.1") >= 4 || g("I6.2") >= 4 },
    { key: "sin_red", label: "Sin red de apoyo", active: g("I8.1") >= 4 },
    { key: "otro_riesgo", label: "Otro riesgo social", active: g("I7.5") >= 4 },
  ];
  return { subtotals, total, ratio, level: range.level, semaphore: range.semaphore, color: range.color, protectionAlert, priority, childcareNeed, alerts, perCapita, dependencia, hacinamiento, contributions };
}

/** Ranking BASE Y/Z: Y = priNum*100000 + alerta*1000 + total; Z = RANK sin empates. */
export function rankRows(rows: { id: string; priority: string; protectionAlert: boolean; total: number }[]) {
  const priNum = (p: string) => (p === "PRIORIDAD 1" ? 3 : p === "PRIORIDAD 2" ? 2 : 1);
  const withY = rows.map((r) => ({ ...r, Y: priNum(r.priority) * 100000 + (r.protectionAlert ? 1000 : 0) + r.total }));
  const sorted = [...withY].sort((a, b) => b.Y - a.Y || (a.id < b.id ? -1 : 1));
  const zOf = new Map(sorted.map((r, i) => [r.id, i + 1]));
  return withY.map((r) => ({ ...r, Z: zOf.get(r.id)! })).sort((a, b) => a.Z - b.Z);
}

/** Edad DATEDIF en meses + rango configurable por país (EC default 12-42). */
export function ageMonths(birthISO: string, refISO?: string): number {
  if (!birthISO) return 0;
  const b = new Date(birthISO); const r = refISO ? new Date(refISO) : new Date();
  let m = (r.getFullYear() - b.getFullYear()) * 12 + (r.getMonth() - b.getMonth());
  if (r.getDate() < b.getDate()) m -= 1;
  return Math.max(0, m);
}
export function ageInRange(months: number, countryIso = DEFAULT_COUNTRY): boolean {
  const c = COUNTRY_CONFIGS[countryIso] ?? COUNTRY_CONFIGS[DEFAULT_COUNTRY];
  return months >= c.age_min && months <= c.age_max;
}

/** Validación ID por country_config (EC default cédula módulo-10, sin hardcode en UI). */
export function validateId(value: string, countryIso = DEFAULT_COUNTRY): { valid: boolean; message: string } {
  const c = COUNTRY_CONFIGS[countryIso] ?? COUNTRY_CONFIGS[DEFAULT_COUNTRY];
  const v = (value ?? "").trim();
  if (!v) return { valid: true, message: "" }; // opcional
  if (c.id_validation === "modulo-10") {
    if (!/^\d{10}$/.test(v)) return { valid: false, message: `${c.id_type} debe tener 10 dígitos` };
    const digits = v.split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let d = digits[i] * (i % 2 === 0 ? 2 : 1);
      if (d > 9) d -= 9;
      sum += d;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === digits[9]
      ? { valid: true, message: "" }
      : { valid: false, message: `${c.id_type} inválida (módulo-10)` };
  }
  return { valid: v.length >= 5, message: v.length >= 5 ? "" : "Documento inválido" }; // TODO: estrategia por país
}

/** Teléfono E.164 por country_config (EC default 593). Acepta 09XXXXXXXX o 593XXXXXXXXX. */
export function normalizePhone(value: string, countryIso = DEFAULT_COUNTRY): { e164: string; valid: boolean } {
  const c = COUNTRY_CONFIGS[countryIso] ?? COUNTRY_CONFIGS[DEFAULT_COUNTRY];
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return { e164: "", valid: false };
  let e164 = digits;
  if (digits.length === 10 && digits.startsWith("0")) e164 = c.phone_prefix + digits.slice(1);
  else if (digits.length === 9 && c.phone_prefix === "593") e164 = c.phone_prefix + digits;
  else if (!digits.startsWith(c.phone_prefix)) e164 = c.phone_prefix + digits;
  return { e164: `+${e164}`, valid: e164.length >= 11 };
}

// ─── Socioeconómica (§10.1 literales) ───
export interface SocioInputs {
  integrantes: number; menores5: number; de5a17: number; adultos: number; mayores: number;
  discapacidad: number; enfermedad: number; trabajan: number; generanIngreso: number; dormitorios: number;
  ingresos: number[]; // 8 rubros B18:B25
  egresos: number[]; // 10 rubros B29:B38
  tenencia: string; tipoVivienda: string; situacionLaboral: string; educacion: string;
  servicios: boolean[]; // 6 B45:B50
  bono: string; ayuda: string;
}
export interface SocioResult {
  E18: number; E19: number; E29: number; E30: number; E31: number;
  B54: number; B55: number; B56: number; B57: string; B58: string;
  sub: Record<string, number>; total: number; clasificacion: string;
}
export function computeSocioeconomic(s: SocioInputs): SocioResult {
  const t = SOCIO_THRESHOLDS;
  const E18 = s.ingresos.reduce((a, b) => a + (b || 0), 0);
  const E19 = s.integrantes > 0 ? E18 / s.integrantes : 0;
  const E29 = s.egresos.reduce((a, b) => a + (b || 0), 0);
  const E30 = E18 - E29;
  const E31 = E18 > 0 ? E29 / E18 : 0;
  const B54 = s.generanIngreso > 0 ? s.integrantes / s.generanIngreso : 0;
  const B55 = s.servicios.length ? s.servicios.filter(Boolean).length / s.servicios.length : 0;
  const B56 = s.dormitorios > 0 ? s.integrantes / s.dormitorios : 0;
  const B57 = E31 >= t.carga_alta ? "Alta" : E31 >= t.carga_media ? "Media" : "Baja";
  const B58 = B54 >= 4 ? "Alta" : B54 >= 2 ? "Media" : "Baja";
  const B62 = E19 <= 0 ? 0 : E19 >= t.corte_ingreso_alto ? 100 : E19 >= t.corte_ingreso_medio ? 60 : 20;
  const B63 = B58 === "Baja" ? 100 : B58 === "Media" ? 60 : 20;
  // B64 literal §10.1
  const B64 = (s.situacionLaboral === "Empleo formal" || s.situacionLaboral === "Jubilado/a") ? 100
    : (s.situacionLaboral === "Empleo informal" || s.situacionLaboral === "Trabajo independiente") ? 60 : 20;
  // B65 literal §10.1
  const B65 = (s.tenencia === "Propia" || s.tipoVivienda === "Casa" || s.tipoVivienda === "Departamento") ? 100
    : (s.tenencia === "Arrendada" || s.tenencia === "Prestada/Cedida" || s.tenencia === "Anticresis") ? 60 : 20;
  const B66 = B55 >= 0.8 ? 100 : B55 >= 0.5 ? 60 : 20;
  const B67 = E31 < t.carga_media ? 100 : E31 < t.carga_alta ? 60 : 20;
  // B68 literal §10.1
  const B68 = (["Bachillerato completo", "Técnico/tecnológico", "Universitario", "Posgrado"].includes(s.educacion)) ? 100
    : s.educacion === "Sin escolaridad" ? 20 : 60;
  const sub: Record<string, number> = { B62, B63, B64, B65, B66, B67, B68 };
  let total = 0;
  for (const w of SOCIO_WEIGHTS) total += (sub[w.key] ?? 0) * w.w;
  const r = SOCIO_RANGES.find((x) => total >= x.from && total <= x.to) ?? SOCIO_RANGES[0];
  return { E18, E19, E29, E30, E31, B54, B55, B56, B57, B58, sub, total, clasificacion: r.level };
}

/** Completitud §10.4: salud + IDII + tomas vigentes + fichas. */
export function completeness(parts: { vuln: boolean; socio: boolean; idii: boolean; medica: boolean; postulacion: boolean }) {
  const keys = Object.keys(parts) as (keyof typeof parts)[];
  const done = keys.filter((k) => parts[k]).length;
  return { done, total: keys.length, pct: Math.round((done / keys.length) * 100), complete: done === keys.length };
}
