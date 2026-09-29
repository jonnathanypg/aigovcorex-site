# CMCI — bitácora de desarrollo

## 2026-09-27 — Fix "orden por WhatsApp falla en bucle hasta recursion_limit"

Causa: el agente reintentaba el mismo tool con mismos args tras
`success==False` (permiso/licencia/centro sin destinatario claro) hasta agotar
`recursion_limit=15`; además `resolve_from_phone` no normalizaba E.164 y los
aliases de rol ES/EN estaban incompletos. Se conservaron los edits sin
commitear en `langgraph_orchestrator.py` (REGLA #2/#3) y `messaging_tools.py`.

### 1. `agents/tools/messaging_tools.py` — `check_messaging_permission`
- `allowed_roles` suma aliases `'educadora'` y `'coordinator'` (ambas ramas
  try/except intactas).

### 2. `agents/langgraph_orchestrator.py` — filtro por rol + guarda anti-bucle
- `_filter_tools_by_role()`: `public_citizen`/`padre`/`parent` pierden
  `send_whatsapp*`, `send_email` y `manage_*`; conservan lectura.
- `_is_repeated_tool_failure()`: mismo tool+mismos args con success==False
  `max_tool_retries=2` veces → `_agent_node` responde pregunta aclaratoria
  (centro/destinatario/contenido) sin re-invocar; `_should_use_tools` → END.
- `recursion_limit=15` intacto como última red.

### 3. `services/identity_resolver.py` + `services/context_service.py` — aliases y E.164
- `_normalize_phone()` usa `utils/phone_utils.normalize_phone_e164` (existe)
  con fallback (quita +,00,espacios; antepone 593 si empieza con 09);
  aplica a búsqueda, teléfono admin y clave de caché.
- Aliases unificados sin quitar existentes: `padre==parent`,
  `coordinator==center_coordinator`, `educator==educadora` en
  `_build_identity_response`, `_get_permissions_for_role`,
  `check_messaging_permission`, `ContextService.get_data_scope` /
  `build_agent_context` y `_build_context_for_role` (`api/whatsapp_webhook.py`).

### 4. `api/whatsapp_webhook.py` — propaga success/error
- `_process_ai_message` retorna `{'text','success','error'}` (texto de usuario
  idéntico); log + JSON distinguen `recursion_limit_reached`
  (`status: handled_recursion_limit`). Ruta public_citizen loguea igual.

### Tests
- `pytest tests/test_cmci_engines.py tests/test_cmci_f4.py tests/test_cmci_f5.py
  tests/test_cmci_params.py tests/test_ml_shadow.py` → **46 passed**.
  `py_compile` OK. Guarda y filtro validados con stubs (mismo tool+args ×2
  fallos → END con aclaratoria sin invocar LLM; roles restringidos ven 3/7
  tools; `0987654321`/`+593…`/`00593…` → `+593…`).

## 2026-09-27 — Persistencia DB-first + fusión ml-explain + params en DB

Corrige 3 inconsistencias del módulo (estándar integral, sin cinta).
No se tocó frontend ni otros blueprints.

### 1. `api/cmci.py` cableado a `models/cmci.py` (adiós memoria como vía principal)
- POST `/vulnerability` y `/socioeconomic` crean fila histórica en
  `vulnerability_assessments` / `socioeconomic_assessments` (nunca overwrite).
- GET lista con filtros `center` (join a `tenants.cmci_code`), `desde/hasta`
  (`assessed_at`), `child_id`/`status`, + paginación con COUNT SQL.
- `GET /priorizacion` ordena en SQL `(prioridad, alerta, total)` replicando
  Y/Z (`Y = priNum*100000 + alerta*1000 + total`; los literales
  `PRIORIDAD 1/2/3` ordenan ASC igual que su rango).
- `GET /dashboard` agrega con COUNT/AVG/GROUP BY SQL (E5/I5/D9-D13/D17-D19/
  E22/D25-D28).
- Metadatos del contrato sin columna nativa (`center`, `child_name`,
  `observations`, `params_version`, `source`, payload íntegro) viajan en el
  JSON bajo clave reservada `__meta__`; columnas nativas para filtro/orden.
- `_VULN_DB/_SOC_DB/_SEQ` quedan SOLO como fallback si la DB no está
  disponible (try/except + rollback + warning). TODO F0-resto eliminado.

### 2. Fusión `api/cmci_ml.py` → `api/cmci.py`
- `GET /vulnerability/<id>/ml-explain` vive ahora en `cmci_bp` (mismo
  contrato shadow: delta siempre 0.0, IDOR por tenant, recálculo al vuelo).
- Eliminado registro separado en `app.py` (import + `register_blueprint`) y
  borrado `api/cmci_ml.py`. Verificado: 26 rutas `/api/cmci/*` sin
  duplicados ni doble `/api/api`.

### 3. `services/scoring/params_store.py` persiste en `ScoringParams`
- PUT `/params` hace upsert por `(scope, key)` + bump `v1 → v1.1-<fecha>`
  (`bump_version()`); GET mezcla seed + rows DB + overrides memoria, con
  fallback a seed JSON si no hay DB. TODO eliminado.
- Solo `license_admin` escribe (403 existente intacto, verificado en smoke).

### Tests
- `pytest tests/test_cmci_params.py tests/test_cmci_engines.py
  tests/test_ml_shadow.py tests/test_cmci_f4.py tests/test_cmci_f5.py` →
  **46 passed**. `py_compile` OK.
- Único ajuste de test (contrato cambiado): `test_cmci_f5.py::
  test_idor_cruza_sitio_404` inserta el row en DB en vez de manipular
  `_VULN_DB`, porque la persistencia primaria ya no es memoria. Sin cambios
  de assertions (IDOR 404 / RBAC 403 / rate-limit / E.164 intactos).
- Bug hallado por smoke (no por suite): `_db_overrides` mezclaba el valor
  sin su `key`; un `ParamStore` fresco no veía la DB. Corregido
  (`{row.key: row.value}`) y verificado: POST→GET→PUT→GET + store fresco
  leen/escriben SQL; con DB caída, memoria responde igual.
