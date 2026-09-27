/**
 * CMCI F3 — Parámetros congelados v1_validada_2026-09-25 (§3 + §10.1 plan).
 * Fuente: backend/modules/early-childhood/seeds/cmci/cmci_params_v1.json (solo lectura).
 * Sin hardcodes EC: country_config default EC; resto por params con scope.
 */

export interface DimWeight { code: string; name: string; weight: number; }
export interface Indicator { id: string; dim: string; variable: string; weight_in_dim: number; weight_global: number; }
export interface Option { indicator: string; text: string; score: number; }

export const VULN_VERSION = "v1_validada_2026-09-25";

export const VULN_DIMS: DimWeight[] = [
  { code: "D1", name: "Situación económica del hogar", weight: 20 },
  { code: "D2", name: "Composición y estructura familiar", weight: 10 },
  { code: "D3", name: "Situación laboral y educativa de los cuidadores", weight: 15 },
  { code: "D4", name: "Condiciones de cuidado infantil", weight: 20 },
  { code: "D5", name: "Condiciones de vivienda", weight: 10 },
  { code: "D6", name: "Salud y discapacidad", weight: 10 },
  { code: "D7", name: "Protección y riesgos sociales", weight: 10 },
  { code: "D8", name: "Redes de apoyo familiar y comunitario", weight: 5 },
];

export const VULN_INDICATORS: Indicator[] = [
  { id: "I1.1", dim: "D1", variable: "Ingreso per cápita del hogar", weight_in_dim: 20, weight_global: 4 },
  { id: "I1.2", dim: "D1", variable: "Tipo de inserción laboral de los cuidadores", weight_in_dim: 20, weight_global: 4 },
  { id: "I1.3", dim: "D1", variable: "Estabilidad de los ingresos familiares", weight_in_dim: 20, weight_global: 4 },
  { id: "I1.4", dim: "D1", variable: "Relación de dependencia económica", weight_in_dim: 20, weight_global: 4 },
  { id: "I1.5", dim: "D1", variable: "Situación de pobreza según registro social u otra fuente verificable", weight_in_dim: 20, weight_global: 4 },
  { id: "I2.1", dim: "D2", variable: "Estructura y jefatura del hogar", weight_in_dim: 33.33, weight_global: 3.333 },
  { id: "I2.2", dim: "D2", variable: "Número de NNA dependientes en el hogar", weight_in_dim: 33.33, weight_global: 3.333 },
  { id: "I2.3", dim: "D2", variable: "Personas adicionales dependientes en el hogar", weight_in_dim: 33.33, weight_global: 3.333 },
  { id: "I3.1", dim: "D3", variable: "Situación laboral del cuidador/a principal", weight_in_dim: 25, weight_global: 3.75 },
  { id: "I3.2", dim: "D3", variable: "Situación laboral del segundo cuidador/a (si existe)", weight_in_dim: 25, weight_global: 3.75 },
  { id: "I3.3", dim: "D3", variable: "Compatibilidad del horario laboral/educativo con el cuidado", weight_in_dim: 25, weight_global: 3.75 },
  { id: "I3.4", dim: "D3", variable: "Condición de estudios del cuidador/a principal", weight_in_dim: 25, weight_global: 3.75 },
  { id: "I4.1", dim: "D4", variable: "Existencia de cuidador/a permanente durante la jornada", weight_in_dim: 20, weight_global: 4 },
  { id: "I4.2", dim: "D4", variable: "Fragilidad del arreglo de cuidado actual", weight_in_dim: 20, weight_global: 4 },
  { id: "I4.3", dim: "D4", variable: "Horas diarias sin cuidador/a adulto responsable", weight_in_dim: 20, weight_global: 4 },
  { id: "I4.4", dim: "D4", variable: "Riesgo de interrupción del cuidado actual", weight_in_dim: 20, weight_global: 4 },
  { id: "I4.5", dim: "D4", variable: "Acceso actual a un servicio de cuidado infantil", weight_in_dim: 20, weight_global: 4 },
  { id: "I5.1", dim: "D5", variable: "Tenencia de la vivienda", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I5.2", dim: "D5", variable: "Hacinamiento (personas por dormitorio)", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I5.3", dim: "D5", variable: "Acceso a servicios básicos", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I5.4", dim: "D5", variable: "Condiciones de riesgo físico o ambiental", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I6.1", dim: "D6", variable: "Necesidades de cuidado especial del niño/a", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I6.2", dim: "D6", variable: "Barreras de cuidado por discapacidad/enfermedad del cuidador/a", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I6.3", dim: "D6", variable: "Enfermedad crónica o catastrófica en el hogar", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I6.4", dim: "D6", variable: "Acceso a servicios de salud", weight_in_dim: 25, weight_global: 2.5 },
  { id: "I7.1", dim: "D7", variable: "Indicios de violencia intrafamiliar", weight_in_dim: 20, weight_global: 2 },
  { id: "I7.2", dim: "D7", variable: "Indicios de negligencia o abandono", weight_in_dim: 20, weight_global: 2 },
  { id: "I7.3", dim: "D7", variable: "Ausencia de redes de protección familiar o comunitaria", weight_in_dim: 20, weight_global: 2 },
  { id: "I7.4", dim: "D7", variable: "Situación de movilidad humana o desplazamiento reciente", weight_in_dim: 20, weight_global: 2 },
  { id: "I7.5", dim: "D7", variable: "Otras condiciones de riesgo social o comunitario", weight_in_dim: 20, weight_global: 2 },
  { id: "I8.1", dim: "D8", variable: "Disponibilidad de familiares cercanos que apoyen", weight_in_dim: 33.33, weight_global: 1.6665 },
  { id: "I8.2", dim: "D8", variable: "Frecuencia y consistencia del apoyo disponible", weight_in_dim: 33.33, weight_global: 1.6665 },
  { id: "I8.3", dim: "D8", variable: "Apoyo comunitario o institucional disponible", weight_in_dim: 33.33, weight_global: 1.6665 },
];

/** 33 selects exactos PARÁMETROS. I1.1/I1.4/I2.2/I5.2 son auto-calculados (sin opciones). */
export const VULN_OPTIONS: Option[] = [
  { indicator: "I1.2", text: "Ambos/el único cuidador con empleo formal", score: 0 },
  { indicator: "I1.2", text: "Un cuidador con empleo formal", score: 1 },
  { indicator: "I1.2", text: "Otro informal o sin empleo", score: 1 },
  { indicator: "I1.2", text: "Ambos/el único cuidador con empleo informal", score: 2 },
  { indicator: "I1.2", text: "Un cuidador desempleado", score: 3 },
  { indicator: "I1.2", text: "Busca empleo activamente", score: 3 },
  { indicator: "I1.2", text: "Ambos cuidadores desempleados o sin fuente de ingreso propia", score: 4 },
  { indicator: "I1.3", text: "Ingresos estables y permanentes", score: 0 },
  { indicator: "I1.3", text: "Ingresos variables pero frecuentes", score: 2 },
  { indicator: "I1.3", text: "Ingresos ocasionales o esporádicos", score: 3 },
  { indicator: "I1.3", text: "Sin ingresos fijos ni ocasionales", score: 4 },
  { indicator: "I1.5", text: "No consta clasificación de pobreza / sin dato disponible", score: 0 },
  { indicator: "I1.5", text: "Clasificado como en situación de vulnerabilidad", score: 1 },
  { indicator: "I1.5", text: "Clasificado en situación de pobreza", score: 3 },
  { indicator: "I1.5", text: "Clasificado en situación de pobreza extrema", score: 4 },
  { indicator: "I2.1", text: "Hogar biparental (ambos progenitores presentes y a cargo)", score: 0 },
  { indicator: "I2.1", text: "Hogar monoparental con apoyo familiar cercano disponible", score: 2 },
  { indicator: "I2.1", text: "Hogar monoparental sin apoyo familiar cercano disponible", score: 3 },
  { indicator: "I2.1", text: "Niño/a bajo cuidado de terceros (sin ninguno de los progenitores)", score: 4 },
  { indicator: "I2.3", text: "Ninguna persona adicional dependiente", score: 0 },
  { indicator: "I2.3", text: "1 persona adicional dependiente", score: 2 },
  { indicator: "I2.3", text: "2 o más personas adicionales dependientes", score: 4 },
  { indicator: "I3.1", text: "Empleo formal estable", score: 0 },
  { indicator: "I3.1", text: "Empleo informal o actividad independiente", score: 2 },
  { indicator: "I3.1", text: "Desempleado/a busca empleo activamente", score: 3 },
  { indicator: "I3.1", text: "Sin empleo sin búsqueda activa registrada", score: 1 },
  { indicator: "I3.2", text: "No aplica (hogar con un solo cuidador)", score: 0 },
  { indicator: "I3.2", text: "Empleo formal estable", score: 0 },
  { indicator: "I3.2", text: "Empleo informal o actividad independiente", score: 1 },
  { indicator: "I3.2", text: "Desempleado/a", score: 2 },
  { indicator: "I3.2", text: "Sin empleo sin búsqueda activa", score: 3 },
  { indicator: "I3.3", text: "Horario compatible con el cuidado del niño/a", score: 0 },
  { indicator: "I3.3", text: "Parcialmente compatible (requiere apoyo parcial)", score: 2 },
  { indicator: "I3.3", text: "Incompatible (jornada completa turnos rotativos o nocturnos)", score: 4 },
  { indicator: "I3.4", text: "No estudia actualmente", score: 0 },
  { indicator: "I3.4", text: "Estudia y cuenta con apoyo para el cuidado del niño/a", score: 1 },
  { indicator: "I3.4", text: "Estudia y NO cuenta con apoyo para el cuidado del niño/a", score: 3 },
  { indicator: "I4.1", text: "Sí cuenta con cuidador/a permanente y estable", score: 0 },
  { indicator: "I4.1", text: "Cuenta con cuidador/a pero de forma parcial o inestable", score: 2 },
  { indicator: "I4.1", text: "No cuenta con cuidador/a permanente", score: 4 },
  { indicator: "I4.2", text: "No depende de terceros; arreglo estable", score: 0 },
  { indicator: "I4.2", text: "Depende de familiares con disponibilidad limitada", score: 2 },
  { indicator: "I4.2", text: "Depende de familiares con alta probabilidad de discontinuidad", score: 4 },
  { indicator: "I4.3", text: "Ninguna hora", score: 0 },
  { indicator: "I4.3", text: "1 a 2 horas", score: 1 },
  { indicator: "I4.3", text: "3 a 4 horas", score: 3 },
  { indicator: "I4.3", text: "5 horas o más", score: 4 },
  { indicator: "I4.4", text: "Sin riesgo identificado", score: 0 },
  { indicator: "I4.4", text: "Riesgo posible", score: 2 },
  { indicator: "I4.4", text: "Riesgo alto o inminente", score: 4 },
  { indicator: "I4.5", text: "Ya accede a un servicio formal de cuidado infantil", score: 0 },
  { indicator: "I4.5", text: "Accede parcialmente o a un servicio informal", score: 2 },
  { indicator: "I4.5", text: "No accede a ningún servicio de cuidado infantil", score: 4 },
  { indicator: "I5.1", text: "Propia", score: 0 },
  { indicator: "I5.1", text: "Arrendada", score: 1 },
  { indicator: "I5.1", text: "Prestada o cedida", score: 2 },
  { indicator: "I5.1", text: "Situación de alojamiento inestable", score: 4 },
  { indicator: "I5.3", text: "Cuenta con los 3 servicios básicos", score: 0 },
  { indicator: "I5.3", text: "Cuenta con 2 de los 3 servicios básicos", score: 2 },
  { indicator: "I5.3", text: "Cuenta con 1 o ningún servicio básico", score: 4 },
  { indicator: "I5.4", text: "Sin riesgos identificados", score: 0 },
  { indicator: "I5.4", text: "Riesgo moderado (estado de la vivienda o ubicación)", score: 2 },
  { indicator: "I5.4", text: "Riesgo alto (zona de deslaves ríos inseguridad vivienda en mal estado)", score: 4 },
  { indicator: "I6.1", text: "Sin condición que requiera cuidado especial", score: 0 },
  { indicator: "I6.1", text: "Condición que requiere cuidados adicionales actualmente cubiertos", score: 1 },
  { indicator: "I6.1", text: "Condición que requiere cuidados adicionales NO cubiertos", score: 4 },
  { indicator: "I6.2", text: "Sin limitación", score: 0 },
  { indicator: "I6.2", text: "Limitación parcial para el cuidado", score: 2 },
  { indicator: "I6.2", text: "Limitación severa para el cuidado", score: 4 },
  { indicator: "I6.3", text: "No aplica", score: 0 },
  { indicator: "I6.3", text: "Sí con impacto moderado en el cuidado", score: 2 },
  { indicator: "I6.3", text: "Sí con impacto severo en el cuidado", score: 4 },
  { indicator: "I6.4", text: "Acceso regular (afiliación/atención garantizada)", score: 0 },
  { indicator: "I6.4", text: "Acceso limitado o intermitente", score: 2 },
  { indicator: "I6.4", text: "Sin acceso a servicios de salud", score: 4 },
  { indicator: "I7.1", text: "No se identifican indicios", score: 0 },
  { indicator: "I7.1", text: "Indicios que ameritan observación", score: 2 },
  { indicator: "I7.1", text: "Indicios claros que ameritan derivación", score: 4 },
  { indicator: "I7.2", text: "No se identifican indicios", score: 0 },
  { indicator: "I7.2", text: "Indicios que ameritan observación", score: 2 },
  { indicator: "I7.2", text: "Indicios claros que ameritan derivación", score: 4 },
  { indicator: "I7.3", text: "Cuenta con redes de protección activas", score: 0 },
  { indicator: "I7.3", text: "Redes de protección limitadas", score: 2 },
  { indicator: "I7.3", text: "Sin ninguna red de protección", score: 4 },
  { indicator: "I7.4", text: "No aplica", score: 0 },
  { indicator: "I7.4", text: "Sí con proceso de regularización/adaptación en curso", score: 1 },
  { indicator: "I7.4", text: "Sí en situación de alta vulnerabilidad", score: 3 },
  { indicator: "I7.5", text: "No se identifican", score: 0 },
  { indicator: "I7.5", text: "Se identifican requieren seguimiento", score: 2 },
  { indicator: "I7.5", text: "Se identifican requieren derivación inmediata", score: 4 },
  { indicator: "I8.1", text: "Sí disponibilidad amplia", score: 0 },
  { indicator: "I8.1", text: "Disponibilidad limitada", score: 2 },
  { indicator: "I8.1", text: "Sin disponibilidad", score: 4 },
  { indicator: "I8.2", text: "Apoyo frecuente y confiable", score: 0 },
  { indicator: "I8.2", text: "Apoyo ocasional", score: 2 },
  { indicator: "I8.2", text: "Apoyo inexistente o poco confiable", score: 4 },
  { indicator: "I8.3", text: "Cuenta con apoyo comunitario/institucional activo", score: 0 },
  { indicator: "I8.3", text: "Apoyo comunitario/institucional limitado", score: 2 },
  { indicator: "I8.3", text: "Sin apoyo comunitario/institucional", score: 4 },
];

export const AUTO_INDICATORS = ["I1.1", "I1.4", "I2.2", "I5.2"];
export const SELECT_INDICATORS = VULN_INDICATORS.filter((i) => !AUTO_INDICATORS.includes(i.id));

export interface RangeDef { level: string; from: number; to: number; semaphore: string; color: string; }
export const VULN_RANGES: RangeDef[] = [
  { level: "Vulnerabilidad muy baja", from: 0, to: 20, semaphore: "VERDE", color: "63BE7B" },
  { level: "Vulnerabilidad baja", from: 20.0001, to: 40, semaphore: "VERDE", color: "9BD16E" },
  { level: "Vulnerabilidad moderada", from: 40.0001, to: 60, semaphore: "AMARILLO", color: "FFEB84" },
  { level: "Vulnerabilidad alta", from: 60.0001, to: 80, semaphore: "NARANJA", color: "F8A354" },
  { level: "Vulnerabilidad crítica", from: 80.0001, to: 100, semaphore: "ROJO", color: "F8696B" },
];

export const VULN_PRIOS = [
  { name: "PRIORIDAD 3", from: 0, to: 40 },
  { name: "PRIORIDAD 2", from: 40, to: 60 },
  { name: "PRIORIDAD 1", from: 60, to: 100 },
];

export const VULN_THRESHOLDS = {
  CanastaRef: 220, RatioT_100: 1, RatioT_075: 0.75, RatioT_050: 0.5, RatioT_025: 0.25,
  DepT_1: 1, DepT_2: 2, DepT_3: 3, DepT_4: 4, NnaT_2: 2, NnaT_3: 3, NnaT_4: 4, HacT_2: 2, HacT_3: 3,
};

export const CMCI_LIST = ["CMCI Guasmo", "CMCI Bahía", "CMCI Orquídeas", "Otro Centro"];
export const CMCI_CODES: Record<string, string> = { "CMCI Guasmo": "GU", "CMCI Bahía": "BH", "CMCI Orquídeas": "OR", "Otro Centro": "XX" };
export const VULN_ESTADOS = ["En proceso", "Completa", "Pendiente de revisión", "Validada", "Admitida", "No admitida", "Lista de espera"];
export const AGE_MIN = 12; export const AGE_MAX = 42;

/** Socioeconómica §10.1 — pesos suman 1.0, 100=mejor condición (invertido vs vulnerabilidad). */
export const SOCIO_WEIGHTS = [
  { key: "B62", dim: "Ingreso y capacidad económica", w: 0.30 },
  { key: "B63", dim: "Composición y dependencia", w: 0.15 },
  { key: "B64", dim: "Situación laboral", w: 0.15 },
  { key: "B65", dim: "Condiciones de vivienda", w: 0.15 },
  { key: "B66", dim: "Servicios básicos", w: 0.10 },
  { key: "B67", dim: "Gastos y carga económica", w: 0.10 },
  { key: "B68", dim: "Educación y complementarias", w: 0.05 },
];
export const SOCIO_THRESHOLDS = {
  hacinamiento_moderado: 3, hacinamiento_elevado: 4, carga_alta: 0.7, carga_media: 0.5,
  corte_ingreso_alto: 600, corte_ingreso_medio: 300,
};
export const SOCIO_RANGES = [
  { level: "alta", from: 0, to: 49.999 },
  { level: "media", from: 50, to: 74.999 },
  { level: "baja", from: 75, to: 100 },
];

/** country_config default EC — otros países agregan config sin tocar código. */
export interface CountryConfig {
  country_iso: string; phone_prefix: string; id_type: string; id_validation: string;
  timezone: string; currency: string; canasta_ref: number; age_min: number; age_max: number;
}
export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  EC: { country_iso: "EC", phone_prefix: "593", id_type: "cedula", id_validation: "modulo-10", timezone: "America/Guayaquil", currency: "USD", canasta_ref: 220, age_min: 12, age_max: 42 },
};
export const DEFAULT_COUNTRY = "EC";

/** Biblioteca §10.6 — 15 categorías fijas (enum, no libre). */
export const BIBLIOTECA_CATEGORIAS = [
  { n: 1, slug: "protocolo-ingreso", title: "Protocolo de requisitos de ingreso" },
  { n: 2, slug: "ficha-postulacion", title: "Ficha de postulación" },
  { n: 3, slug: "ficha-cdp", title: "Ficha CDP" },
  { n: 4, slug: "ficha-socioeconomica", title: "Ficha socioeconómica (blanco)" },
  { n: 5, slug: "ficha-vulnerabilidad", title: "Ficha de vulnerabilidad (blanco)" },
  { n: 6, slug: "informe-visita", title: "Informe técnico de visita" },
  { n: 7, slug: "acta-compromiso", title: "Acta de compromiso / corresponsabilidad" },
  { n: 8, slug: "consentimiento", title: "Consentimiento informado" },
  { n: 9, slug: "autorizacion-imagen", title: "Autorización de imagen" },
  { n: 10, slug: "ficha-idii", title: "Ficha IDII" },
  { n: 11, slug: "historia-clinica", title: "Historia clínica" },
  { n: 12, slug: "monitoreo-nutricional", title: "Monitoreo nutricional + curvas" },
  { n: 13, slug: "ficha-alimentacion", title: "Ficha diaria de alimentación" },
  { n: 14, slug: "menu-semanal", title: "Menú semanal" },
  { n: 15, slug: "informe-mensual", title: "Informe mensual (por rol)" },
];
