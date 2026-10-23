# Ficha de Registro — Corrección de Impresión A4
**Fecha:** 2026-10-23 · **Módulo:** CMCI / Registro de Niños · **Alcance:** backend `early-childhood` + dashboard operativo
**Estado:** implementado, verificado y desplegado en el VPS.

---

## 1. Problema reportado

La ficha `/registro/[id]/print` presentaba:

1. Un bloque blanco del pie de membrete que tapaba la sección 8 (observaciones) y las firmas.
2. Campos vacíos rellenados con `____________` o textos como “Registrada en legajo”.
3. Datos clínicos y de desarrollo mostrados con valores por defecto sin respaldo en la base:
   - vacunas “completas”,
   - control del niño sano “al día”,
   - anemia “negativa”,
   - IDII “acorde” aunque no existiera evaluación.
4. Peso/talla tomados del registro de salud equivocado (podía ser un control sin antropometría).
5. IDII con 6 filas artificiales en lugar de los 4 ámbitos reales de la aplicación.
6. Educadora mostrada por un “fallback” del centro aunque el niño no tuviera educadora asignada.

---

## 2. Causas raíz

### 2.1 Pie de membrete superpuesto
`PrintLetterheadFrame` renderizaba el pie como `position: fixed; bottom: 0` con una altura fija de 40 mm. El contenido se maquetaba en una sola fila/celda y el `tfoot` spacer de 44 mm no reservaba espacio de forma fiable, por lo que la sección 8 y las firmas quedaban debajo del PNG del pie (`membrete-gasiba-pie.png`, 2172×642, mayormente blanco y opaco).

### 2.2 Valores por defecto sin fuente
La ficha usaba cadenas fijas y condicionales optimistas para campos sin dato. El objetivo del expediente físico es que un campo no registrado se imprima vacío, no con una afirmación clínica.

### 2.3 IDII mal agregado
`milestones` guarda un registro por indicador, no por dominio. La ficha tomaba un indicador suelto con `getDomainLevel()` y construía 6 filas, cuando la aplicación define 4 ámbitos.

### 2.4 Registro de salud equivocado
`last_health` ordena por `record_date DESC, id DESC` y puede devolver un control de nutrición sin peso/talla. La antropometría debe salir del último registro que sí tenga medidas.

### 2.5 Error SQL en MariaDB
La consulta de vacunas usaba `.nullslast()`. MariaDB no soporta `NULLS LAST`, la excepción se capturaba y dejaba `last_health`, `last_growth` y vacunas en `None`.

---

## 3. Cambios realizados

### 3.1 Backend — `backend/modules/early-childhood/api/children.py`

- **`last_growth`:** nuevo campo en `GET /api/children/:id`. Devuelve el último `HealthRecord` con `weight` o `height` no nulos, ordenado por `record_date DESC, id DESC`. No usa el peso/talla al nacer.
- **`vaccine_summary`:** resumen calculado (`total`, `applied`, `pending`, `omitted`, `overdue`, `complete`). Devuelve `null` si no existe ningún registro; no equivale a “completo”.
- **`idii_summary`:**
  - Agrupa todos los hitos del niño por dominio.
  - Toma la fecha de evaluación más reciente de cada ámbito.
  - Calcula porcentaje y nivel (`adquirido`, `en_proceso`, `no_iniciado`).
  - Devuelve los 4 ámbitos reales: vinculación emocional y social, exploración del cuerpo y motricidad, lenguaje verbal y no verbal, descubrimiento del medio natural y cultural.
  - Resultado global: `acorde`, `en_riesgo` o `requiere_derivacion`.
  - Se calcula con todos los hitos del niño; la respuesta `milestones` conserva el límite de 60 para clientes existentes.
- **Educadora:** se eliminó el fallback que tomaba la primera educadora activa del centro. Solo se usa `assigned_educator_id`; si no hay asignación, nombre y cédula quedan vacíos.
- **Vacunas:** se eliminó `.nullslast()` y se ordena con `Vaccine.date_applied.desc()` (MariaDB ordena NULL al final en DESC).
- **Manejo de errores:** el `except` de salud ahora también deja `last_growth` y `vaccine_summary` en `None`.

### 3.2 Frontend — componente de impresión

**Archivo:** `frontend/dashboard/src/components/cmci/print-header.tsx`

- Nuevo `PrintA4Page`:
  - `<section class="print-a4-page">` con `display: flex; flex-direction: column`.
  - Cabecera, cuerpo y pie en flujo normal.
  - El pie ya no es `fixed` y nunca se superpone al contenido.
  - Acepta `headerUrl` y `footerUrl`; si no hay configurados, no renderiza imágenes.

**Archivo:** `frontend/dashboard/src/app/globals.css`

- Nuevas clases:
  - `.print-a4-page` (210 mm, mínimo 296 mm, flex column).
  - `.print-a4-header`, `.print-a4-body`, `.print-a4-footer`.
  - `.print-a4-footer` con `margin-top: auto`.
- Reglas de impresión:
  - `break-after: page` por página, sin salto extra en la última.
  - `@page A4 portrait; margin: 0` ya existente.
  - Imágenes de membrete con `print-color-adjust: exact`.

### 3.3 Frontend — ficha de registro

**Archivo:** `frontend/dashboard/src/app/(app)/registro/[id]/print/page.tsx`

Reescritura completa en 2 páginas A4 explícitas:

- **Página 1:** título, convenio, párrafo formal, secciones 1–4.
- **Página 2:** secciones 5–8, observaciones y firmas.

Reglas de datos aplicadas:

- **Sin datos → vacío:** no se imprimen `____________`, “Registrada en legajo” ni afirmaciones por defecto.
- **Antropometría:** `last_growth`; peso/talla al nacer salen de `child.birth_weight`/`birth_height`.
- **IMC:** se calcula solo si hay peso y talla.
- **Z-scores:** se muestran solo si existen; el diagnóstico nutricional se marca con ellos.
- **Vacunas:** solo se muestra completo/incompleto si `vaccine_summary.total > 0`.
- **Control del niño sano, anemia, hemoglobina, desparasitación y suplementación:** vacíos si no hay fuente.
- **IDII:** 4 filas reales desde `idii_summary.domains`; sin evaluación, la tabla queda vacía.
- **Semáforo de vulnerabilidad:** puntaje, nivel y priorización solo si hay evaluación.
- **Completitud del expediente:** se mantiene como indicador calculado de la ficha.
- **Firmas:** educadora y coordinadora con nombre real o vacío; sin firma electrónica.
- **Educadora:** nombre y cédula solo si están asignados/registrados.

### 3.4 Tipado del servicio

**Archivo:** `frontend/dashboard/src/services/children.service.ts`

- `getById` declara los nuevos campos opcionales: `last_health`, `last_growth`, `medical_profile`, `vaccines`, `vaccine_summary`, `milestones`, `idii_summary`, `license`.

---

## 4. Verificación realizada

### API

- `GET /api/children/480` → `last_growth` con peso/talla y z-scores; `idii_summary` con 4 ámbitos.
- `GET /api/children/438` → salud y IDII correctos.
- `GET /api/children/227` → niño sin educadora asignada: `educator_name: null`, sin fallback.
- `GET /api/children/566` → sin crecimiento/IDII/vacunas: campos vacíos, sin valores inventados.

### Impresión

- PDF generado con Chromium (A4, `printBackground`): **2 páginas exactas**.
- Texto extraído del PDF: sin `Registrada en legajo`, sin `____________`.
- Revisión visual:
  - sección 8 y firmas visibles,
  - pie de membrete al final de cada página,
  - sin solape blanco,
  - encabezado y pie repetidos en ambas páginas.
- `npm run build` → compilación correcta.
- `tsc --noEmit` → sin errores nuevos en los archivos modificados (los errores legacy del proyecto permanecen y no se tocaron).

### Despliegue

- `pm2 restart aigovcorex-backend aigovcorex-dashboard --update-env`
- Sin comandos globales ni afectación a otros proyectos del VPS.
- Health check: dashboard responde en `:9002`; backend responde en `:5000`.

---

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `backend/modules/early-childhood/api/children.py` | `last_growth`, `vaccine_summary`, `idii_summary`, sin fallback de educadora, fix MariaDB |
| `frontend/dashboard/src/components/cmci/print-header.tsx` | `PrintA4Page` |
| `frontend/dashboard/src/app/globals.css` | estilos A4 en flujo y reglas de salto |
| `frontend/dashboard/src/app/(app)/registro/[id]/print/page.tsx` | ficha en 2 páginas, datos reales y campos vacíos |
| `frontend/dashboard/src/services/children.service.ts` | tipado de nuevos campos |

---

## 6. Limitaciones / pendientes

- En la base actual no existen filas en `vaccines`, por lo que el esquema vacunal se imprime vacío. Es el comportamiento correcto: no se asume “completo”.
- `medical_profiles` está vacío en los casos revisados; alergias/condiciones solo se imprimen si existen en el niño o en el perfil médico.
- No se modificó el formulario de registro para añadir UI de `rep_cedula` o `special_needs`; la ficha los imprime si el dato existe.
- No se hizo commit de datos ni se alteró la base de producción.
