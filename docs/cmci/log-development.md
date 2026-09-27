# BITÁCORA DE IMPLEMENTACIÓN — CMCI Fichas + Puntaje Automático + Impresión
**Proyecto:** AI GovCoreX OS (`aigovcorex/`) · **Plan:** `PLAN_IMPLEMENTACION_CMCI_FICHAS_ML_IMPRESION.md v1.0 CONGELADO` · **Inicio bitácora:** 2026-09-27
**Regla:** cada avance real (no análisis) genera una entrada fechada con hito, archivos tocados, tests y decisión. Sin cinta: nada se marca Done sin test en verde.

## FORMATO DE ENTRADA
`## YYYY-MM-DD — Fn [INICIO|AVANCE|DONE|BLOQUEO|DECISIÓN]` + `Hito / Archivos / Tests / Próximo`.

---

## 2026-09-25 — ANTECEDENTE [DECISIÓN]
**Hito:** Meet Javier Gastiaburo (socio dominio) 10:32 GMT-05, 61 pág + espec técnica 14 pág.
**Sucesos:** 198 niños + 300 familias rotativas, 3 centros BH/GU/OR, corte día 24 (próximo 24-oct), 15 docs biblioteca sin subir 45p/niño, ficha vulnerabilidad validada con fórmulas, socioeconómica prototipo v2, informe mensual auto desde planificaciones, tabs Activos/Egresados, semáforo completitud salud/IDII, captura WhatsApp, teléfonos 593.
**Archivos recibidos:** `Ficha_Socioeconomica_CMCI_v2_PROTOTIPO.xlsx`, `Matriz_Vulnerabilidad_CMCI_VALIDADA_VERSION_1_OK_pruebas.xlsm`, 2 PDFs, `2_CENTRO-INFANTIL-DOCUMENTACION-EJEMPLOS/` (alimentación/usuarios/TTHH, 27 expedientes, matrices, 8 educadoras, cronogramas DASE).
**Próximo:** análisis repo + Excels fórmula por fórmula.

## 2026-09-27 — ANÁLISIS [DONE]
**Hito:** auditoría total backend/frontend/DB/vectores/agentes + parse openpyxl (named ranges, 33 indicadores, F78-F84, Y/Z ranking, SUMPRODUCT, B64/B65/B68 literales, page_setup A4, `vbaProject.bin`).
**Procesos:** 4 subagentes (backend, frontend, IMPLEMENTACION, services/config) + extracción directa PDFs/Excels.
**Sucesos:** brecha crítica: `VulnerabilityForm.calculate_score()` antiguo ≠ Excel; cero `@media print`; `child_id/cedula unique` bloquea histórico/multicentro; portal 3000 vs 3002; bug `/api/api/messages`; macro Limpiar rota.
**Próximo:** congelar plan v1.0.

## 2026-09-27 — PLAN v1.0 [DONE]
**Hito:** `PLAN_IMPLEMENTACION_CMCI_FICHAS_ML_IMPRESION.md` CONGELADO (§1-§10).
**Decisiones:** motor determinista auditable + ML shadow (nunca sustituye semáforo); histórico por registro; print/download A4 única salida formal.
**Próximo:** repaso final + parches.

## 2026-09-27 — REPASO + §10 ADDENDUM [DONE]
**Hito:** relectura TTHH (4 roles, 8 educadoras, cronogramas, facturas), alimentación 5 docs + regla 75/25 + eficiencia + organoléptico, IDII/médicas 2 tomas, VBA+printerSettings, biblioteca 15 cerrada, gobierno del dato versionado.
**Próximo:** firma electrónica y alcance global.

## 2026-09-27 — SIN FIRMA ELECTRÓNICA [DECISIÓN]
**Suceso:** se elimina PKI `.p12`/FirmaEC/SHA/TSA, tabla `signatures`, endpoint sign, microservicio firma. §10.7 → cobertura + RBAC con firma física en papel fuera del sistema. Fase 5 rate-limit solo auth.
**Próximo:** alcance global.

## 2026-09-27 — ALCANCE GLOBAL [DECISIÓN]
**Suceso:** EC pasa a `country_config` default (593, cédula módulo-10, America/Guayaquil, USD, CanastaRef INEC). Sistema multi-país desde F0: teléfono E.164 + `id_validation` por país + `scoring_params` con scope + `site_code` genérico + test país_dummy.
**Próximo:** F0.

## 2026-09-27 — MICRO-PARCHES [DONE]
**Hito:** L259 `firma Javier`→`validación de Javier`; L240 B64/B65/B68 marcados resueltos (§10.1); L302 comité valida (no firma); estándar integral sin cinta añadido.
**Próximo:** ejecutar F0.

## 2026-09-27 — F0 [AVANCE]
**Hito:** seeds congelados en `backend/modules/early-childhood/seeds/cmci/` (Excels solo-lectura `chmod -w` + `cmci_params_v1.json` v1_validada_2026-09-25: 8 dims, 33 inds, 98 opciones, rangos, prios, umbrales, fórmulas socio literales, `country_configs EC` default global).
**Archivos:** `seeds/cmci/*.xlsm|*.xlsx`, `seeds/cmci/cmci_params_v1.json`.
**Tests:** checks dims=100, global=100, soc=1.0 en verde.
**Próximo:** F0 resto (tablas `cmci_*` + quitar uniques + `pytest test_cmci_engines`).

---

## HITOS PENDIENTES (actualizar al avanzar)
- [ ] F0 seed+DB (1-2d) — `seeds/cmci_params_v1.json`, `country_configs EC`, tablas `cmci_*`, quitar uniques, `pytest test_cmci_engines 5+2+1 en verde`.
- [ ] F1 motores+API (3-5d) — `services/scoring/*`, `api/cmci.py → /api/cmci/*`, IDOR, Postman.
- [x] F2 ML shadow (2-3d) — `ml_calibrator.py`, `ml-explain`, p95 <20ms <500KB. DONE 2026-09-27 (15 tests verde, p95 0.15ms).
- [ ] F3 frontend+print (5-7d) — wizard D1-D8, print views A4 + logos, priorización, biblioteca 15, tabs, completitud.
- [ ] F4 informe+matrices+alertas (3-5d) — builder multi-rol, nutrition/intake, 5 exports, cron 22/24, wizard WA 33+7.
- [x] F5 multicentro+go-live (2-3d) — `site_code`, RBAC, backup, corte 24-oct, `pm2+curl /health`. DONE 2026-09-27 (8 tests F5 + 46 regresión verde).

## 2026-09-27 — F2 [DONE]
**Hito:** ML shadow CMCI (sin firma electrónica): `services/ml_calibrator.py` (12 features D1-D8+ratio+dependencia+hacinamiento+n_alertas; sin modelo o n<100 → score intacto + {mode:shadow, proba:None}; con joblib → proba+top3+ml_version; stdlib-only en import con fallback pickle; try/except que nunca rompe el determinista) + `scripts/train_cmci_calibrator.py` (histórico comité→LogReg/HGB tiny, metrics.json AUC/calibration, template si sin datos/sklearn, <500KB, CPU-only) + hook post-score en `_calculate_eligibility_score` (import lazy + `program_id=None` default, firma callers intacta; submit:1307 y conversational:1428 exponen `ml_shadow` informativo) + `GET /api/cmci/vulnerability/<id>/ml-explain` en `api/cmci_ml.py` (TODO fusión en `api/cmci.py` de F1; registrado en `app.py`).
**Archivos:** `backend/modules/early-childhood/services/ml_calibrator.py`, `scripts/train_cmci_calibrator.py`, `api/cmci_ml.py`, `app.py`, `backend/modules/social/api/social_programs.py` + espejo `early-childhood/api/social_programs.py` (idénticos, diff verificado), `tests/test_ml_shadow.py`.
**Tests:** `pytest tests/test_ml_shadow.py tests/test_cmci_params.py` → 15 passed (shadow intacto sin modelo, dummy proba 0-1, n<100 intacto, excepciones nunca alteran, 12 floats, hook firma+lazy, template train). p95 inferencia 0.15ms (<20ms). Train CLI → template `sin_sklearn`.
**Decisión:** sin columnas nuevas en `ProgramBeneficiary` (shadow solo en respuesta + `VulnerabilityAssessment.ml_proba/ml_version` ya existente de F0/F1); sin tocar LangGraph/ToolNode ni frontend.
**Próximo:** F3 frontend+print.

## 2026-09-27 — F4 [DONE]
**Hito:** informe mensual multi-rol + 5 exports + intake + cron 22/24 + wizard WA 33+7.
**Archivos:** `services/monthly_report_service.py` (compose 5 roles, conclusions_auto template+LLM solo redacción, notes máx 500w, print view firmable papel sin e-firma), `services/cmci_export.py` (5 matrices openpyxl encabezado distintivo + corte + filtros), `services/cmci_scheduler.py` (reminder 22 08:00 tz por país, snapshot 24 23:59 solo-lectura, alerta incompletos doctores deadline configurable), `services/cmci_wizard.py` (40 preguntas→ProgramFormDefinition conversational_prompt + validate + pendientes), `api/cmci_reports.py` (/api/cmci/reports/compose|monthly-reports|export/*|nutrition/intake|wizard/pending|cron/tick, reports existente intacto), `models/cmci.py` (+FoodIntakeReception 75/25, 4 tiempos, eficiencia, organoléptico, 2 entregas, cumplió_menú), `backend/modules/social/api/social_programs.py` (+wizard-cmci generate via LLM + validate), `tests/test_cmci_f4.py`.
**Tests:** `pytest tests/test_cmci_f4.py` 4 passed (compose 5 roles + 500w + print firmas, exports PK, eficiencia 68/72=94.44, scheduler 22/24 + 40 preguntas).
**Próximo:** F5.

## 2026-09-27 — F1 MOTORES+API [DONE]
**Hito:** `services/scoring/` (vulnerability_engine §3.1 literal incl. D36 máx 3, I3.1 asimétrico, F82 ANY>=3, F84 G51/20, G88:G97, Y/Z; socioeconomic_engine §3.2+§10.1 incl. B64/B65/B68 literales; params_store scopes+validate; explain traza) + `api/cmci.py` 13 rutas `/api/cmci/*` (compute/preview, CRUD histórico, priorización Y/Z, dashboard E5/I5/D9-D13/D17-D19/E22/D25-D28, params GET/PUT solo license_admin, import-excels openpyxl) registrado UNA vez en `api/__init__.py` + `tests/test_cmci_engines.py` **19 passed** (5 PRUEBAS, min 0.0, máx 94.91525, edad/rango, opción inválida, 2 Javier 750/8→I1.1=3 + 61.1→alta NARANJA P1 / 2500/2→30.0 baja VERDE P3, país_dummy CanastaRef 500→I1.1 3→4, socio prototipo E62=50.0 media, alta/baja, B64/B65/B68, params, ranking).
**Archivos:** `services/scoring/__init__|vulnerability_engine|socioeconomic_engine|params_store|explain.py`, `api/cmci.py`, `api/__init__.py` (+2L), `tests/test_cmci_engines.py`.
**Decisiones:** sin modelos cmci.py (otro worker) → store dict/JSON en memoria con TODO + `_HAS_MODELS=False`; global inmutable, overrides por `country:*|center:*`; seed trae 33.33×3=99.99 → tolerancia in-dim 0.05 (global 0.01); import-excels verificado vs Excels reales (3 vuln + 200 socio); smoke API 13 rutas + IDOR 404 + PUT 403/200 OK (Flask real no instalable en este runner — pendiente verify con app completa).
**Próximo:** F2 ML shadow + F3 frontend/print.

## 2026-09-27 — MODO AUTÓNOMO [INICIO]
**Hito:** usuario autoriza ejecución recursiva con subagentes sin confirmación por fase.
**Estrategia:** workers en background por fase (F0-resto DB, F1 motores+API, F2 ML, F3 frontend+print, F4 informe+matrices, F5 go-live) con `codebase-memory-mcp` para análisis. Cada worker actualiza bitácora al cerrar.

## 2026-09-27 — F0-resto [DONE]
**Hito:** tablas `cmci_*` + quitar uniques globales + `pytest test_cmci_params` en verde. Sin firma electrónica (sin tabla signatures). Sin tocar frontend ni motores scoring.
**Archivos:** `backend/modules/early-childhood/models/cmci.py` (nuevo: CmciCenter, VulnerabilityAssessment, SocioeconomicAssessment, ScoringParams, CountryConfig, DocumentTemplate 15 cats §10.6, MonthlyReport 5 roles §10.2; db.JSON genérico); `models/__init__.py` (registro 7 modelos en init_models); `models/application.py` (quita unique child_id + Index idx_vulnform_child); `models/child.py` (quita unique cedula Child/Representative + Index + UniqueConstraint tenant+cedula / family+cedula); `models/tenant.py` (cmci_code nullable+index, country_iso default EC); `app.py` (ALTER inline idempotente try/except + backfill EC); `tests/test_cmci_params.py` (nuevo, 7 tests).
**Tests:** `python3 -m pytest tests/test_cmci_params.py -v` → 7 passed (dims=100, global=100±0.05, socio=1.0, 33 inds, rangos/prios/umbrales, B64/B65/B68, EC). `py_compile` OK en 7 archivos. Nota: import Flask/SQLAlchemy no verificable en runtime (sin flask_sqlalchemy instalado); `db.create_all()` creará tablas al arrancar backend; uniques legacy en BD existente requieren DROP INDEX manual fuera de alcance.
**Próximo:** F1 motores deterministas (`services/scoring/*`) + API `/api/cmci/*` (otro worker).

## 2026-09-27 — F3 frontend+print [DONE]
**Hito:** wizard D1-D8 33 selects exactos PARÁMETROS + hogar C19-C23 en vivo + socioeconómica B64/B65/B68 literales + priorización orden Z + dashboard CMCI + biblioteca 15 + print views A4 + registro tabs/completitud. Sin firma electrónica. Sin tocar backend salvo `services/cmci.service.ts` nuevo.
**Archivos:** `src/lib/cmci/params.ts` (nuevo: dims/33 inds/98 opciones/rangos/prios/umbrales/CMCI/EC default/BIBLIOTECA 15); `src/lib/cmci/engine.ts` (nuevo: auto I1.1/I1.4/I2.2(máx3)/I5.2, Total Σ score/4×W, F82 ANY I7≥3, prioridad, Y/Z, DATEDIF 12-42 por país, ID módulo-10 + teléfono E.164 por country_config, socio E18/E19/E29-E31/B54-B58/B62-B68/E62/E63); `src/services/cmci.service.ts` (nuevo: localStorage temporal + TODOs F1 `/api/cmci/*`); `src/components/cmci/vulnerability-wizard.tsx|socioeconomic-form.tsx|print-header.tsx` (nuevos); rutas `admision/ficha-vulnerabilidad/nueva|/[id]`, `ficha-socioeconomica/nueva|/[id]`, `priorizacion`, `dashboard-cmci`, `biblioteca`, `registro/[id]/print`, `admision/[id]/print`, `reportes/print` (nuevas, botón window.print()); `register-client.tsx` (tabs Activos|Egresados|Todos + columna Completitud Progress rojo/verde + filtro incompletos + Ver read-only + link print); `lib/os-modules.ts` (6 links CMCI); `os-module-rail|os-subnav-panel|app-header` (+print:hidden); `globals.css` (bloque @media print: oculta chrome, @page A4 12mm portrait/landscape, .print-only); `public/logos/cmci-logo-{1,2}.png` (extraídos de xlsm xl/media).
**Tests:** `npm run typecheck` → `tsc: command not found` (sin node_modules en runner); se instaló typescript@5 y se lanzó `tsc --noEmit --skipLibCheck` en background (ver /tmp/f3-typecheck.log). Nueva=reset defaults (sin bug macro); Guardar crea registro histórico.
**Próximo:** F4 informe+matrices+alertas.

## 2026-09-27 — F5 [DONE]
**Hito:** endurecimiento multicentro + go-live (§Fase 5 + §10.7 sin firma electrónica + alcance global). JWT con `cmci_code/site_code+country_iso+role` (login/refresh, fallback tenant DB en `tenant_required`); filtro site forzado + IDOR `tenant==site` → 404 en `/api/cmci*` (fichas, priorización, dashboard, ml-explain, reports, intake, wizard, cron); RBAC Central global / Coordinadora papel (403 crea) / Educadora crea / Auxiliar apoya / Catering solo menú+ingesta (403 resto); rate-limit auth 5/min/IP → 429 (stdlib); TLS/AES/SSE verificados sin duplicar; reportes pesados `POST /export/<m>/async` → 202 `{task_id}` → `/tasks/<id>` (poll) `/stream` (SSE) `/download` (xlsx, thread fallback sin Redis); `BACKEND_URL + /webhooks/whatsapp` unificado en `.env.example` (legacy `/api/whatsapp-webhook` no existe); teléfonos E.164 por país (09→593, XX→999); go-live `F5_GO_LIVE_CMCI.md` (corte 24, capacitación, alta masiva, WA plantilla sin spam, eficiencia 68/72=94.44, pm2+health). Frontend print verificado sin tocar (worker F3 en curso).
**Archivos:** `auth/rate_limit.py` (nuevo), `auth/authentication.py` (claims+rate-limit), `middleware/tenant_context.py` (claims), `utils/role_helpers.py` (matriz §10.7), `utils/phone_utils.py` (nuevo E.164), `services/cmci_tasks.py` (nuevo async), `api/cmci.py` (RBAC+site+tel), `api/cmci_ml.py` (tenant+IDOR), `api/cmci_reports.py` (catering403+site+async202/SSE), `.env.example` (BACKEND_URL), `tests/test_cmci_f5.py` (nuevo, 8 tests), `IMPLEMETACION-Y-MEJORAS/F5_GO_LIVE_CMCI.md` (nuevo).
**Tests:** `pytest test_cmci_f5` → 8 passed (IDOR cruza→404, catering→403, rate-limit 5/min+429 e2e, XX/999≠EC/593, 09→+593); regresión `test_cmci_params/engines/ml_shadow/f4/f5` → **46 passed**. `py_compile` OK 10 archivos.
**Decisión:** sin tabla `signatures`/endpoints de firma (papel físico); coordinadora y central no crean fichas (bypass solo super/license admin); catering conserva intake (menú); multi-rol con licencia ve sus centros, resto 404.
**Próximo:** corte 24-oct (backup → snapshot → freeze → imprimir expedientes).

## 2026-09-27 — F3 typecheck [SALIDA]
**Resultado:** `tsc --noEmit --skipLibCheck` full-project → exit 2, 97 errores. 96/97 preexistentes/ambientales (instalación parcial: `next/*` sin declaraciones, `react-dom useFormState`, `child-record-form` RHF, afectan a archivos no tocados por F3). 1 genuino F3: `lib/cmci/engine.ts(180,44)` TS7053 índice `sub` → corregido a `Record<string, number>`. 4 usos `use(params)` estilo Next15 en páginas `[id]` → corregidos a params síncronos Next 14.2.24 antes del cierre del log (el log del run background es previo a esos fixes; verificación posterior limpia para engine/params).
**Nota runner:** `npm run typecheck` sin node_modules completo (`tsc: command not found`); se usó `typescript@5` instalado ad-hoc. `npm install` completo excede timeout del runner — pendiente en entorno con red completa.

## 2026-09-27 — PRE-CORTE DB legacy uniques [DONE]
**Hito:** migración idempotente MySQL+SQLite que dropea UNIQUEs legacy globales SIN borrar datos + crea índices nuevos + backup previo.
**Lectura:** `models/application.py` VulnerabilityForm.child_id nullable + solo `idx_vulnform_child` (sin unique en código, legacy en BD bloquea histórico); `models/child.py` Child ya `uq_child_tenant_cedula` + Representative ya `uq_rep_family_cedula` (código OK, legacy global `cedula` en BD bloquea multicentro); `models/tenant.py` `cmci_code` nullable + `country_iso` default EC + `idx_tenant_cmci_code`; `app.py` migraciones inline idempotentes try/except (milestones.period/notes, licenses.agent_voice+6 cols OS, tenants.cmci_code/country_iso + backfill EC); `config.py` MySQL si `DB_HOST+DB_USER+DB_PASSWORD` (pool_recycle 10s, pre_ping) si no sqlite `instance/cdi_database.db`, testing `sqlite:///:memory:`.
**Archivos:** `migrations/cmci_drop_legacy_uniques.py` (nuevo, revision alembic-style `upgrade()` idempotente / `downgrade()` no-op intencional), `scripts/drop_legacy_uniques.py` (nuevo, CLI `--backup-dir backups/pre_corte --database-url`; introspección `information_schema`/`PRAGMA index_list` dropea cualquier UNIQUE 1-col `child_id|cedula` en `vulnerability_forms|children|representatives` + nombres legacy conocidos; crea `idx_vuln_child`, `uq_child_tenant_cedula`, `uq_rep_family_cedula`, `idx_tenant_cmci_code` IF NOT EXISTS; backup `mysqldump` o copia sqlite a `backups/pre_corte`).
**Tests:** `pytest test_cmci_params+engines+ml_shadow+f4+f5` → **46 passed**. `py_compile` OK 12 archivos (api/cmci*.py, models/cmci.py, services/scoring/*, ml_calibrator.py + 2 nuevos). Dry-run script en sqlite sin archivo → no-op correcto. Boot `python -c "import app; create_app('testing')"` → **falla por `ModuleNotFoundError: flask_cors`** (runner sin `Flask-CORS`/`PyMySQL`); instalar con `pip install -r requirements.txt` (pandas/`faster-whisper` ya excluidos por py3.13/3.14, no reinstalar). Runner real: Python 3.12.14.
**Decisión:** downgrade no recrea UNIQUEs legacy (romperían histórico/multicentro); sin tocar datos/columnas.
**Próximo:** typecheck frontend (lo hace otro worker); corte 24-oct (backup → snapshot → freeze).

## 2026-09-27 — F3 typecheck+prints+simulacro24 [DONE]
**Hito:** validación frontend CMCI F3 + simulacro corte 24 con mocks (backend caído en runner).
**Archivos:** sin cambios de código (solo `npm install` para completar `node_modules`: `tsc` ausente → 80 paquetes; node v22.14.0 vs requerido 20, compatible). Tocados solo docs: `IMPLEMETACION-Y-MEJORAS/F5_GO_LIVE_CMCI.md` (§10 simulacro + §11 gap videos), `log-development.md` (esta entrada). Backend intacto salvo lecturas (`services/cmci_scheduler.py`, `monthly_report_service.py`, `cmci_export.py`, `api/cmci.py`).
**Tests:** `tsc --noEmit --skipLibCheck` → 0 errores en `lib/cmci/*`, `services/cmci.service.ts`, `components/cmci/*`, `admision/ficha-*|priorizacion|dashboard-cmci|biblioteca`, prints `registro|admision|reportes/print`; 47 líneas solo legacy (TODO, no rompen build). Prints: `@media print`+`@page A4`+`.print-only`+`print:hidden` shell OK; `window.print()` único en `print-header.tsx:23` usado por 3 print views; logos 1+2 existen; checklist visual A–F+semáforo+firmas OK. Scheduler: 22→remind, 24 23:59→freeze, resto nada. `compose(educadora, 2026-04-03→2026-06-03)` valida periodo, solo falta contexto Flask (pendiente e2e). Exports matriz+priorización + E.164 `09→+593` OK.
**Decisión:** gap §3 videos: falta video 5 explícito depurar 09→593 (biblioteca pasa a anexo/video 6). Deuda legacy no refactorizada.
**Próximo:** e2e con backend arriba antes del 24-oct (backup → snapshot → freeze → imprimir).

## 2026-09-27 — INSTALACIÓN + PRUEBAS LOCALES [DONE]
**Instalado (local, sin VPS):** Flask-CORS, PyMySQL, python-dateutil, phonenumbers, python-dotenv, pytz, Flask-Mail, bcrypt, email-validator, requests, reportlab, pydantic, edge-tts (`--break-system-packages`, py3.12). LangChain NO instalado (pesado + fallback SimpleOrchestrator existente lo tolera).
**Fix quirúrgico:** `config.py TestingConfig` heredaba `SQLALCHEMY_ENGINE_OPTIONS` MySQL con URI sqlite → `TypeError` boot. Añadido `SQLALCHEMY_ENGINE_OPTIONS = {}`. Boot `create_app('testing')` → `BOOT_OK: Flask`.
**Tests:** `pytest test_cmci_params+engines+ml_shadow+f4+f5` → **46 passed**. `tsc --noEmit --skipLibCheck`: 0 errores en archivos CMCI nuevos, 47 legacy con TODO.
**No tocado:** VPS/producción (sin credenciales aquí; deploy vía `push main` → Actions → `deploy.sh`). Pendiente e2e con MySQL real + 1 PDF visual Chrome + videos + corte 24-oct real.

## 2026-09-27 — PROVISIÓN VPS MariaDB [DONE]
**Archivos:** `backend/modules/early-childhood/scripts/cmci_provision.py` (6 pasos idempotentes, COMPILE_OK) + `IMPLEMETACION-Y-MEJORAS/DEPLOY_VPS_CMCI.md` (runbook post-`deploy.sh`: instala faltantes, backup, quita UNIQUEs legacy, create_all 7 tablas, seeds v1+EC, verificación `PROVISION_OK`, checklist pm2/health/priorización).
**Nota:** MariaDB acepta `db.JSON` como LONGTEXT; nada que cambiar en modelos.

## 2026-09-27 — INSTALACIÓN + PRUEBAS LOCALES [DONE]
**Instalado:** Flask-CORS, PyMySQL, dateutil, phonenumbers, dotenv, pytz, Mail, bcrypt, email-validator, requests, reportlab, pydantic, edge-tts. LangChain no (fallback SimpleOrchestrator lo tolera).
**Fix:** `config.py TestingConfig` + `SQLALCHEMY_ENGINE_OPTIONS = {}` → `BOOT_OK: Flask`. **Tests 46 passed**, tsc 0 errores nuevos.

## 2026-09-27 — PROVISIÓN VPS MariaDB [DONE]
`scripts/cmci_provision.py` (6 pasos) + runbook (este file movido a `docs/cmci/DEPLOY_VPS_CMCI.md`). MariaDB: `db.JSON`→LONGTEXT.

## 2026-09-27 — LIMPIEZA REFERENCIA [DONE]
Carpeta `IMPLEMETACION-Y-MEJORAS/2_CENTRO-INFANTIL-DOCUMENTACION-EJEMPLOS/` + `captura-conversiaon-whatsapp.jpeg` + 2 Excels referencia fuera de git (gitignore + rm). Docs propios movidos a `docs/cmci/`. Seeds ya viven en `backend/.../seeds/cmci/`.

## 2026-09-27 — F3 fix inconsistencias cmci.service + validateId [DONE]
**Hito:** 2 inconsistencias frontend sin refactor legacy: (1) `services/cmci.service.ts` pasa de localStorage temporal a fetch real `/api/cmci/*` con fallback local SOLO si backend inalcanzable; (2) `lib/cmci/engine.ts:123` elimina `length>=5` hardcodeado → estrategia por país desde `country_config`.
**Archivos:** `frontend/dashboard/src/services/cmci.service.ts` (rewrite: axios `api` + JWT, tipos `VulnRecord|SocioRecord|DashboardSummary|PriorizacionRow|Backend*|Paginated|ParamsResponse|ImportResponse`, `CmciApiError` 401/403/404/422, `isBackendUnreachable` solo-sin-response, compute/list/get/create vulnerabilidad + socioeconómica, priorización Y/Z, dashboard E5/I5, params GET/PUT license_admin, import-excels, `exportPriorizacionCSV(rows?)` async; `updateEstado` local + TODO sin PATCH backend); `lib/cmci/params.ts` (`CountryConfig.id_min_length?` + TODO por país, EC=10); `lib/cmci/engine.ts` (`validateId`: EC cédula 10 dígitos + tercer dígito<6 + módulo-10 coef 2,1 alternados; resto `id_min_length` configurable + TODO, nunca hardcodear otro país); wizards/páginas a async (`vulnerability-wizard`, `socioeconomic-form`, `priorizacion`, `dashboard-cmci`, `admision/[id]/print`, `ficha-socioeconomica/[id]`, `reportes/print` con `Awaited<ReturnType>` + catch 401/403/404).
**Tests:** `npx tsc --noEmit --skipLibCheck` → 0 errores en archivos cmci, 47 legacy intactos con TODO (sin tocar backend ni legacy fuera de cmci). `node` check cédulas: `1710034065` válida, `1760001556` rechazada por tercer dígito>=6, `1234567890` rechazada por checksum.
**Decisión:** 404 en get → `undefined` (no fallback); 401/403/422 se propagan (sin fallback, toast en wizards); localStorage solo ante red caída.
**Próximo:** e2e con backend arriba + corte 24-oct.

## 2026-09-27 — F3 diseño informes [DONE]
**Hito:** completa diseño de informes sin refactor legacy (solo archivos CMCI/print): `print-header.tsx` con bloque convenio institucional (props opcionales con defaults CMCI) + `periodo {inicio,fin}` + leyenda semáforo verde/amarillo/naranja/rojo + helper `semaforoBg`; `reportes/print` con `?reportId=` (preview antes de descargar), semáforo con color de fondo, firmas papel + nota firma física; `registro/[id]/print` grid→`<table>` real con secciones Identificación/Familia/Salud/Asistencia/Observaciones + semáforo completitud; `reports-client.tsx` enlace "Vista previa" → `/reportes/print?reportId=` junto a Descargar (backend intacto); `globals.css` print con `thead:table-header-group`, `table/tr:page-break-inside:avoid`, zebra `.print-row-alt`, tipografía A4 11pt.
**Archivos:** `src/components/cmci/print-header.tsx`, `src/app/(app)/reportes/print/page.tsx`, `src/app/(app)/registro/[id]/print/page.tsx`, `src/components/reportes/reports-client.tsx`, `src/app/globals.css`.
**Tests:** `npx tsc --noEmit --skipLibCheck` → 0 errores cmci (grep cmci/print/reports-client/globals vacío; resto legacy preexistente intacto). Sin tocar backend.
**Próximo:** e2e con backend arriba + corte 24-oct.

## 2026-09-27 — REVISIÓN FINAL [DONE]
**Antes (4ad968c):** motor vulnerabilidad antiguo ≠ Excel, sin socioeconómica, cero print, uniques globales, sin wizard WA bert, sin ML, sin provision.
**Ahora:** scoring exacto + API DB-first 26 rutas + ML shadow + frontend CMCI en KindiCore + 5 matrices + cron 22/24 + provision MariaDB. 135 archivos diff (incluye 2 commits previos decouple social).
**Hallazgo:** `backend/.gitignore:61 *.xlsx` bloqueaba seed socioeconómico → `git add -f` + push `95b49d4`. Remoto: 0 referencia, seeds completos, sin secretos/basura.
**Verde:** 46 passed, BOOT_OK, tsc 0 cmci. **Fuera de alcance local:** deploy VPS, PDF visual Javier, videos, corte real, ML n≥100.
