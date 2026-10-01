/** Código único del niño compartido por ficha de vulnerabilidad y socioeconómica.
 * Son parte de los mismos datos: al elegir un niño ambas fichas deben mostrar
 * el MISMO código. Si el niño ya tiene ficha previa (de cualquier tipo) se
 * reutiliza ese código; si no, se genera uno unificado FICHA-*. */

export function buildUnifiedChildCode(childId: number, centerName?: string | null): string {
  const year = new Date().getFullYear();
  const slug =
    (centerName || "CENTRO").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) ||
    "CENTRO";
  return `FICHA-${slug}-${year}-${String(childId).padStart(3, "0")}`;
}

/** Reutiliza el código existente del niño (de cualquier ficha) o el fallback. */
export function pickUnifiedCode(
  fullChild: { last_vulnerability?: { code?: string } | null; last_socioeconomic?: { code?: string } | null } | null | undefined,
  fallback: string,
): string {
  return (
    fullChild?.last_vulnerability?.code ||
    fullChild?.last_socioeconomic?.code ||
    fallback
  );
}

/** Normaliza string para comparación: minúsculas, sin acentos, sin espacios extra. */
function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Mapa de tenant_id -> nombre CMCI conocido (se completa en runtime desde CMCI_LIST). */
const TENANT_ID_TO_CMCI: Record<number, string> = {};

/** Registra un mapeo tenant_id -> CMCI para uso futuro. */
export function registerTenantCmciMapping(tenantId: number, cmciName: string): void {
  TENANT_ID_TO_CMCI[tenantId] = cmciName;
}

/** Encuentra el CMCI_LIST que corresponde al niño, usando center_name y/o tenant_id. */
export function findMatchingCmci(
  centerName: string | undefined | null,
  tenantId: number | undefined | null,
  cmciList: string[],
): string | null {
  // 1. Intentar por tenant_id (más confiable)
  if (tenantId && TENANT_ID_TO_CMCI[tenantId]) {
    return TENANT_ID_TO_CMCI[tenantId];
  }
  // 2. Intentar por center_name normalizado
  if (centerName) {
    const normalizedCenter = normalizeForMatch(centerName);
    for (const cmci of cmciList) {
      const normalizedCmci = normalizeForMatch(cmci);
      // Match bidireccional: el nombre del tenant está en el CMCI o viceversa
      if (normalizedCmci.includes(normalizedCenter) || normalizedCenter.includes(normalizedCmci)) {
        // Registrar para futuras búsquedas
        if (tenantId) TENANT_ID_TO_CMCI[tenantId] = cmci;
        return cmci;
      }
    }
  }
  return null;
}
