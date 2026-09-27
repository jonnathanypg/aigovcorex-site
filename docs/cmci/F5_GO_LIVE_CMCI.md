# F5 · GO-LIVE CMCI — Endurecimiento multicentro + corte día 24

**Plan:** `PLAN_IMPLEMENTACION_CMCI_FICHAS_ML_IMPRESION.md` §Fase 5 + §10.7 (sin
firma electrónica: la aprobación es **firma física sobre papel impreso**,
fuera del sistema) + alcance global. **Fecha:** 2026-09-27.

## 1. Qué cambió en código (F5)

| # | Cambio | Archivo |
|---|---|---|
| 1 | JWT con `cmci_code`/`site_code` + `country_iso` + `role` (login y refresh) | `auth/authentication.py::_jwt_claims_for` |
| 2 | `tenant_required` lee claims y expone `g.cmci_code/g.site_code/g.country_iso` (fallback a tenant DB) | `middleware/tenant_context.py` |
| 3 | Filtro site forzado + IDOR `tenant==site` → **404** si cruza (listas, detalle, priorización, dashboard, ml-explain, reports, intake, wizard, cron) | `api/cmci.py::_enforce_site`, `api/cmci_ml.py`, `api/cmci_reports.py::_ensure_site_access` |
| 4 | RBAC §10.7: Central global (lectura) / Coordinadora revisa en **papel** (no crea, 403) / Educadora crea / Auxiliar apoya (crea) / Catering **solo** menú+ingesta (403 resto) | `utils/role_helpers.py`, guards en `api/cmci*.py` |
| 5 | Rate-limit auth **5/min/IP** → 429 (stdlib, sin deps) | `auth/rate_limit.py` + `@rate_limit_auth` en login |
| 6 | Reportes pesados async: `POST /export/<matriz>/async` → **202** `{task_id}` → `GET /tasks/<id>` (poll) / `/stream` (SSE vía `sse_manager`) / `/download` (xlsx) | `services/cmci_tasks.py` (thread fallback, sin Redis/Celery) |
| 7 | Teléfonos E.164 por país: `09…` → `+593…` (EC), país_dummy XX → `+999…` (cero hardcodes) | `utils/phone_utils.py` + normalización en `POST /api/cmci/*` |
| 8 | `.env.example` unificado: `BACKEND_URL` canónico + `POST ${BACKEND_URL}/webhooks/whatsapp` (ruta real; el legacy `/api/whatsapp-webhook` no existe) | `.env.example` |
| 9 | Verificado, **no duplicado**: TLS termina en nginx (`ssl_certificate`, §2); `cryptography` ya en `requirements.txt`; SSE ya existía (`sse_manager.py`) | `nginx/aigovcorex.conf`, `config.py` |
| 10 | Print routes existen (worker F3 en curso — solo verificación, sin tocar): `registro/[id]/print`, `admision/[id]/print`, `reportes/print` | frontend dashboard |

## 2. Checklist corte día 24 (próximo: 24-oct, primer pago)

```bash
# 1) Backup DB (MySQL prod) — ANTES de cualquier freeze
mysqldump -h $DB_HOST -u $DB_USER -p $DB_NAME | gzip > backup_cmci_2026-10-24.sql.gz
ls -lh backup_cmci_*.gz   # verificar tamaño > 0

# 2) Snapshot periodo solo-lectura (día 24 23:59 America/Guayaquil o tz del país)
curl -X POST https://app.aigovcorex.com/api/cmci/cron/tick \
  -H "Authorization: Bearer $TOKEN_COORD" \
  -H 'Content-Type: application/json' \
  -d '{"center_id": <ID>, "from": "2026-09-25", "to": "2026-10-24", "country_iso": "EC"}'
# Esperado: {"actions": {"freeze_snapshot": true, ...}, "frozen": N, ...}

# 3) Freeze: verificar estados congelados (no editar lo congelado)
# MonthlyReport.status='congelado', FoodIntakeReception.is_snapshot=1

# 4) Imprimir expedientes con diseño oficial (fichas + informe mensual)
# Rutas print: /registro/[id]/print, /admision/[id]/print, /reportes/print
# → window.print() → PDF A4 → firma física educadora+coordinadora en papel.

# 5) Métrica eficiencia nutricional catering (pago): ver §6.
```

Recordatorio automático día 22 08:00 (tz por país): `due_actions()` en
`services/cmci_scheduler.py` → avisa cierre a coordinadoras+educadoras+doctores.

## 3. Guía de capacitación (videos de pantalla, grabar antes del miércoles)

1. **Acceso por correo:** abrir link → login con correo institucional → cambiar contraseña (`/api/auth/change-password`).
2. **Link de acceso:** guardar `https://app.aigovcorex.com` + verificar `/health` OK.
3. **Crear usuarios** ( Coordinadora/Central): alta masiva pre-miércoles (script §4) → cada educadora entra y verifica su centro (BH/GU/OR) en el JWT.
4. **Imprimir informe mensual:** educadora → su módulo → periodo editable → campo 500 palabras → conclusiones auto → **Imprimir informe mensual** → PDF A4 → firmas físicas.
5. **Biblioteca:** descargar plantilla en blanco → imprimir → llenar a mano → NO subir escaneos pesados (Hostinger).

## 4. Alta masiva de educadoras (pre-miércoles)

```bash
# CSV: email,first_name,last_name,tenant_id(cmci),phone(E.164)
# Normalizar teléfonos primero: 09XXXXXXXX → +593XXXXXXXX (§5).
# Crear con rol 'educadora' + tenant del centro (BH/GU/OR); cobertura 9 niños/educadora, 72/centro.
# Verificar: login → JWT contiene cmci_code del centro → GET /api/cmci/vulnerability lista solo su site.
```

## 5. Depuración teléfonos 09 → 593 (E.164 por país)

```python
from utils.phone_utils import normalize_phone_e164
normalize_phone_e164("0991234567", "EC")   # → +593991234567
normalize_phone_e164("0991234567", "XX")   # → +999991234567 (país dummy)
```

Regla: todo teléfono que entra por `POST /api/cmci/*` se normaliza solo; el
prefijo sale de `CountryConfig.phone_prefix` (EC=593 default). Revisar
`IdentityResolver` si hay LIKEs con formato antiguo antes del corte.

## 6. Mensajes WA a padres (código/link — plantilla, SIN spam)

> Hola {nombre}, su ficha CMCI {codigo} está lista. Ver/imprimir: {link} —
> Centro {cmci}. Responda STOP para no recibir más avisos. (1 mensaje por
> evento: ficha lista / cierre día 24 / cita. Sin cadenas ni reenvíos.)

Enviar solo a teléfonos E.164 verificados vía `POST ${BACKEND_URL}/webhooks/whatsapp`
(canónico, ver §1.8). Respetar STOP/opt-out en `notifications`.

## 7. Métrica eficiencia nutricional (catering / pago DASE)

`Eficiencia = (ingesta_real / cobertura_total) × 100` — ej. 68/72 = **94.44%**.
Diaria por `meal_time` (desayuno/refrigerio/almuerzo/lunch, aporte CMCI 75% +
hogar 25%) y consolidada mensual:

```bash
curl "https://app.aigovcorex.com/api/cmci/nutrition/intake?center_id=<ID>" \
  -H "Authorization: Bearer $TOKEN"   # → {intakes[], eficiencia_consolidada}
```

Test en verde: `test_intake_eficiencia` (94.44) + `tests/test_cmci_f5.py` (8 passed)
+ regresión params/engines/ml_shadow/f4 → **46 passed**.

## 8. pm2 + health (salida a producción)

```bash
pm2 start ecosystem.config.js
pm2 status   # 4 apps: portal(3002) dashboard(9002) backend(5000) whatsapp(3001)
curl -s https://app.aigovcorex.com/health        # → {"status":"healthy"}
curl -s https://app.aigovcorex.com/api/cmci/params -H "Authorization: Bearer $TOKEN"
```

## 9. Documentos listos para imprimir/descargar (sin firma electrónica)

- Fichas: print views A4 (`frontend/.../print`, F3) + `GET /api/cmci/vulnerability/<id>` (JSON fuente).
- 5 matrices + asistencia: `GET /api/cmci/export/<matriz>?center_id&from&to` (directo) o `/async` → 202 → `/download` (pesados).
- Biblioteca 15 plantillas (§10.6): `document_templates` — descarga en blanco, impresión, llenado a mano.
- Informe mensual por rol (5 tipos §10.2): `GET /api/cmci/monthly-reports/<id>` → `print_view` con firmas en papel.

## 10. Simulacro corte 24 — validación frontend F3 (2026-09-27)

Backend caído en runner (`curl :5000/health` sin respuesta) → simulacro con
mocks + verificación estática/determinista. Backend real pendiente antes del
24-oct.

| # | Prueba | Resultado |
|---|---|---|
| 1 | `typecheck` (`tsc --noEmit --skipLibCheck`, node v22.14.0 — requerido node 20, funciona igual) | **0 errores** en `lib/cmci/*`, `services/cmci.service.ts`, `components/cmci/*`, `admision/ficha-*\|priorizacion\|dashboard-cmci\|biblioteca`, prints `registro\|admision\|reportes/print`. 47 líneas de error solo legacy (`dashboard/development-chart`, `license-admin/SponsorLogoDisplay`, `monitoreo`, `registro/child-record-form`, `ui/form`) → TODO, no rompen build. Sin refactor legacy. |
| 2 | Prints: `globals.css` `@media print` + `@page A4 portrait 12mm` / `landscape-sheet` + `.print-only` + `print:hidden` en shell (`os-module-rail`, `os-subnav-panel`, `app-header` con clase `print:hidden`) | ✅ OK |
| 3 | 3 print views usan `PrintButton` → único `window.print()` en `components/cmci/print-header.tsx:23` (`admision/[id]/print`, `registro/[id]/print`, `reportes/print`, cada una con `<div className="print:hidden">`) | ✅ OK |
| 4 | Logos `public/logos/cmci-logo-1.png` + `cmci-logo-2.png` existen, referenciados en `PrintHeader` | ✅ OK |
| 5 | Checklist visual por niño: header logos + `Código·Fecha·Periodo` (`PrintHeader` código/fecha) + semáforo color (`background:#color` inline, `print-color-adjust:exact`) + bloques A–F en `admision/[id]/print` + firmas papel Educadora/Coordinadora + nota `.print-only` "sin firma electrónica" | ✅ OK |
| 6 | `due_actions()` scheduler: 21/06→nada, **22/06→`remind_closing:true`**, 23→nada, 24 12:00→sin freeze, **24 23:59→`freeze_snapshot:true`**, 25→nada | ✅ OK (tz por país, `America/Guayaquil` fallback) |
| 7 | `compose(report_type='educadora', period_start=2026-04-03, period_end=2026-06-03)` | Validación periodo+educadora pasa; solo falla en contexto Flask sin DB (`RuntimeError: Working outside of application context`) → pendiente verify e2e con backend arriba. Sin periodo → `ValueError` OK. |
| 8 | Export matriz única + priorización | Frontend `exportPriorizacionCSV()` (orden Z, `;`, BOM) + backend `GET /api/cmci/priorizacion` (`api/cmci.py:216`) + `build_matrix_workbook` / `build_attendance_matrix_workbook` + `/export/<m>/async`→202. ✅ |
| 9 | Teléfonos E.164 | `0991234567`→`+593991234567`, 9 dígitos→`+593…`, `XX`→`+999…`. ✅ Frontend `normalizePhone` replica regla por `country_config`. |

## 11. Gap guía capacitación (5 videos)

§3 actual: 1-acceso correo, 2-link, 3-crear usuarios, 4-imprimir informe,
5-biblioteca. **Falta como video 5 explícito: depurar 09→593 E.164**
(contenido existe en §5 pero no como video). Propuesta orden final:
1-acceso correo, 2-link+`/health`, 3-crear usuarios (alta masiva+JWT `cmci_code`),
4-imprimir informe mensual→PDF A4→firmas físicas,
**5-depurar teléfonos 09→+593 E.164** (`normalize_phone_e164`, verificar
`CountryConfig.phone_prefix`, revisar LIKEs legacy en `IdentityResolver`
antes del corte). Biblioteca pasa a anexo o video 6.
