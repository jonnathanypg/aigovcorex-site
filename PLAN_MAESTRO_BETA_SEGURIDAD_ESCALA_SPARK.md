# PLAN MAESTRO — AIGovCoreX: Beta Segura, Escalable y Lista para Spark / Big Data

> Fecha: 2026-09-29 · VPS compartido (23 GiB RAM / swap 11 GiB / disco 387 GiB, 64% usado) · DB local MariaDB `kindicore` + MySQL remota · Stack: Next.js 14 (portal :3002, dashboard :9002) + Flask + LangGraph (:5000, gunicorn 4 workers) + Baileys TS (:3001) · Nginx borde TLS.
> Evidencia verificada con `codebase-memory-mcp` proyecto `root-aigovcorex` (4060 nodos / 12126 aristas, estado `ready`): `receive_whatsapp_message` (complexity 19, tld 4), `receive_telegram_message` (complexity 35, tld 5), `Child.to_dict` expone PII en claro, 52 aristas `HTTP_CALLS`, hotspots `TenantContext.get_current_user` (fan-in 67), 35 coincidencias de secretos en backend + `.env.example` + `ecosystem.config.js`.

---

## 1. Cómo funciona el sistema hoy (verificado)

```
[Web portal :3002] ─┐
[Dashboard :9002] ───┼─> Nginx 443 ─> /api/ ─> Flask :5000 ─> MariaDB local (kindicore) ─┐
[WhatsApp Baileys :3001] ─> POST /webhooks/whatsapp (sin secreto) ─> VoiceService ─> LangGraph/OpenAI/Gemini/Pinecone ─> respuesta ─> borde (web/WhatsApp/Telegram/voz)
[Telegram webhook] ─> mismo pipeline (tld 5, el más complejo del grafo)
```

* **Backend `backend/modules/early-childhood/`** (~126 ficheros Python, ~35 blueprints, ~28 modelos, ~245 rutas): factory `create_app()`, `db.create_all()` + `ALTER TABLE` ad-hoc en cada arranque, JWT 1h/30d, `tenant_required` solo en parte de los blueprints, validación manual (`request.get_json()`), `pydantic` declarado pero no usado, uploads solo por extensión, `sql_executor.py` ejecuta SQL generado por LLM con `split(';')` y denylist por substring, RAG Pinecone `namespace=license_{id}`, logs con PII y `str(e)` al cliente.
* **Frontends**: Next 14 + React 18. Portal = institucional + `/api/register` leads VIP (sin rate-limit/CAPTCHA, loguea PII, reenvía a `LEADS_WEBHOOK_URL`). Dashboard = OS operativo con PII de menores (nombres, cédula, `birth_date`, salud, dirección, teléfonos). Auth JWT en `localStorage` + guards solo cliente + rol por defecto `admin` + `RoleSwitcher` en UI. Mismo `.env.local` maestro copiado en ambos frontends (incluye secretos de backend/IA/DB — rotar). URLs API inconsistentes (`aigovcorex.com` sin `/api`, fallbacks `127.0.0.1:5000`, `localhost:5010/5001`, dominio legacy `kindicore.com`). Dashboard con `ignoreBuildErrors + ignoreDuringBuilds` (build verde con bugs). Sin headers/CSP en `next.config.js`.
* **WhatsApp `services/whatsapp-voice/`** (TS, Baileys, `auth.get` fan-in 302 — el nodo más caliente del grafo): `express.json()` + `cors(*)` + `express.static('tmp')` sin `helmet`/rate-limit/`ADMIN_API_KEY` (definida pero nunca usada). `companyId` sin sanitizar → path-traversal en `qr_codes/<id>.svg`. `POST /lead/media` pasa `mediaUrl` directo al socket → SSRF. Sesiones Baileys persistidas en MySQL (`bailey_sessions.data` JSON en claro, sin TTL/GC). Reconexión sin lock (cada `GET /status` puede auto-arrancar sockets → leak). `axios@0.27.2` (EOL), `express@4.18.1`, `puppeteer + whatsapp-web.js + venom-bot + twilio` instalados sin usarse. `Dockerfile` divergente (no usado en VPS).
* **Ops**: `ecosystem.config.js` (4 apps), `deploy.sh` destructivo (`rm sites-enabled/default`, `cp nginx`, `systemctl reload/restart nginx`, `apt-get`, `certbot --nginx`, `pm2 reload + save` global), `nginx/aigovcorex.conf` (`/api/→:5000` con `proxy_read_timeout 300s + buffering off`, `/whatsapp/→:3001`, `client_max_body_size 100M`), puertos `:5000` y `:3001` en `0.0.0.0` (cualquiera inyecta al orquestador LLM). PM2 medido: backend 72 restarts/25h (25 MB — inestable), whatsapp 16 restarts/2d (136 MB, loop `408 QR/max attempts`), portal 14 restarts, dashboard 135 MB. Total 21 apps en el mismo daemon `God` (dump.pm2 global). Swap 7.9/11 GiB usado — presión de memoria.

---

## 2. Barrido: errores, bugs, inconsistencias y fallos críticos

### 2.1 CRÍTICO (corregir antes de la beta)

| # | Hallazgo | Evidencia grafo / archivo | Impacto | Fix |
|---|----------|---------------------------|---------|-----|
| C1 | Secretos prod en disco + copiados a frontends | 35 matches `SECRET_KEY/JWT_SECRET/OPENAI/DB_PASSWORD`; `.env.local` idéntico en portal+dashboard; `ecosystem.config.js` con `LANGFUSE_*` por defecto | Toma total (DB, OpenAI, Pinecone, JWT) | Rotar todo, sacar `.env.local` de frontends (solo `NEXT_PUBLIC_*` públicos), Vault/PM2 env cifrado, `chmod 600`, auditar git |
| C2 | Webhooks sin auth (WhatsApp/Telegram/`channels_os`) | `receive_whatsapp_message` solo dedupa `messageId`; `_find_channel_for_company_id` acepta `companyId/phone/message` arbitrarios | Spam, suplantación, abuso LLM/coste, envenenar `conversation_history` | `WEBHOOK_SECRET` HMAC Node→Python + `secret_token` Telegram + `X-Twilio-Signature`, allowlist IP `:3001`, dedupe + rate-limit |
| C3 | Chat público con privilegios excesivos | `public_chat` usa `User.query.first()` como fallback, rol `public_bot` no bloqueado por `_filter_tools_by_role` → `run_sql_analysis + consult_knowledge_base` | Exfiltración cross-tenant | Bloquear escritura para `public_bot`, scope `license_id`, allowlist programas, captcha/rate-limit por IP/slug |
| C4 | SQL de LLM sin enforcement | `sql_executor.py` denylist bypassable, sin `LIMIT/timeout/allowlist`, `commit` writes, sin `WHERE tenant_id` forzado | Lectura/escritura cross-tenant | Allowlist tablas/columnas, `SET TRANSACTION READ ONLY`, 1 statement, `LIMIT 100`, timeout, auditoría; jamás `UPDATE/DELETE` sin aprobación humana |
| C5 | PII menores/salud en claro + `to_dict()` sobreexpone | `Child.to_dict` devuelve `cedula/birth_date/blood_type/photo_url/alergias` a cualquier `tenant_required`; `cedula/teléfonos/salud/bot_token` en claro en MariaDB + Pinecone metadata | LOPDP/EC, kids-privacy | Cifrado a nivel campo (sec. 4), minimización, `@permission_required`, audit log |
| C6 | CORS `*` + `Access-Control-Allow-Origin:*` en chat/widget/download | `public_chat.py cross_origin('*')` vs `app.py CORS(origins=...)` | Exfiltración desde cualquier origen embebido | Restringir a `APP_URL + slug allowlist`, `Vary:Origin`, jamás `*` con PII |
| C7 | API WhatsApp sin auth + `express.static('tmp')` público | `app.ts: cors(), json(), static('tmp')`, `router/session,lead` sin key | Alta sesiones arbitrarias, descarga audios/documentos, baneo WA | Bearer `ADMIN_API_KEY`, `helmet`, `cors({origin})`, `json({limit:'200kb'})`, quitar `static` o URLs firmadas + purge 24h |
| C8 | Path-traversal `companyId` + SSRF `mediaUrl` | `path.join('qr_codes', companyId+'.svg')`, `sendMessage({url: mediaUrl})` | R/W fuera de `qr_codes`, fetch a metadata/intranet | Regex `^[a-zA-Z0-9_-]{1,64}$`, allowlist dominios http(s), `HEAD` + max 15 MB |
| C9 | Puertos internos en `0.0.0.0` | `ss: 0.0.0.0:5000 (gunicorn ×4), *:3001` | Bypass de Nginx, inyección directa | Bind `127.0.0.1`, `ufw deny 3001,5000`, Nginx único borde |

### 2.2 ALTO

* **Auth débil**: refresh 30d sin blacklist, logout fake, rate-limit en memoria por worker (×4 workers = ×4 cuota), `X-Forwarded-For` confiado sin `ProxyFix`, `change-password` solo `len>=6`. → `flask-limiter+Redis`, blacklist JTI, refresh 7d + rotación, `ProxyFix`, password ≥12 + breach-check.
* **IDOR/escalación roles**: `create_user` acepta `role_id` arbitrario (¿crear `super_admin`?), `user.role.name` sin null-check → 500, `download` filtra por `id` y luego chequea (oracle). → `tenant_required + role_required` central, matriz roles, 404 uniforme.
* **Uploads**: sin magic-bytes, `MAX_FILE_SIZE` definida nunca usada, `pypdf/python-docx` sin límites (zip-bomb/XXE), path absoluto en DB, `os.remove(file_path)` + `send_file` sin `mimetype`. → magic bytes, `MAX_CONTENT_LENGTH=10MB`, ClamAV, objectId no path, `realpath+commonpath`.
* **RAG roto/spoofeable**: filtro `{'license_id', '$or'}` inválido en Pinecone (requiere `$and`), `update(metadata)` permite sobrescribir `license_id/tenant_id/scope`, `PINECONE_INDEX_NAME=kindicore-` truncado, embeddings 512 vs 1536. → filtro `$and`, denylist keys, recrear índice, healthcheck RAG.
* **Migración en arranque + PM2 inestable**: `create_all()+8×ALTER` por worker con `except:pass` (race + oculta errores) → 72 restarts. → `alembic upgrade head` en deploy, quitar DDL runtime, `gunicorn -w 3 --threads 4 --timeout 120 --graceful 30 --max-requests 500`.
* **Frontend**: `localStorage` JWT + default `admin` + `RoleSwitcher` (escalado si backend confía), PII sin mascarar en `child-search-select` (`CI {cedula} · Nac. {birth_date}`), `/api/register` sin anti-abuso, URLs API a 3 backends distintos, `ignoreBuildErrors`, sin CSP, `firebase+genkit` instalados sin uso (`name: nextn`, typo `src.ai/dev.ts`).
* **WhatsApp**: reconexión sin lock (thundering herd), `bailey_sessions` sin cifrar ni GC, media en RAM sin límites (OOM), `router` dinámico con `readdir+import` (404 intermitente tras `listen`), `max_memory_restart 400M` insuficiente multi-tenant (10 tenants ≈ 300–450 MB → restart-loop).

### 2.3 MEDIO

Validación inconsistente (`int(child_id)` sin try, `data.get` sin schema, `email-validator` instalado sin usar, cédula EC solo en `social_programs`); logging PII + `str(e)` al cliente (enumeración schema/SQL); deuda config (`gpt-4o-mini` vs `gpt-5-nano`, `BCRYPT_LOG_ROUNDS` sin uso — usa `werkzeug scrypt`, `User.email` sin `unique=True`, `conversation_history.tenant_id=0` rompe aislamiento); `BACKEND_URL` vs legacy `WHATSAPP_BACKEND_URL` (`/api/whatsapp-webhook` inexistente, canónica `/webhooks/whatsapp`); accesibilidad (inputs solo `placeholder`, `motion.button` sin `role=radio`, errores sin `role=alert`); `PrivacyBanner` engañoso (`Cerrar` oculta sin consentir, cookie JS-borrable, `localStorage segura` falso).

---

## 3. Consumo actual y capacidad beta (cientos → miles)

**Medido hoy**: backend 25 MB (inestable), dashboard 135 MB, portal 123 MB, whatsapp 136 MB; VPS 6.0/23 GiB usados pero **swap 7.9/11 GiB (72%)** y disco 64% — el cuello es swap + restarts, no CPU (0% idle).

| Escenario | Carga estimada | Veredicto actual | Qué cambiar (sec. 6) |
|-----------|----------------|------------------|----------------------|
| 100 usuarios concurrentes (beta cerrada) | ~20 req/s API, ~5 STT concurrentes, ~10 sesiones WA | **Aguanta con fixes C + gunicorn 3×4 + Redis rate-limit** | C1–C9, `alembic`, bind localhost, Redis |
| 1 000 concurrentes | ~200 req/s, ~50 STT, ~100 sesiones WA | **No aguanta**: 4 workers × `proxy_read_timeout 300s` se cuelgan en streaming LLM, Whisper CPU 0.5–1 core/transcripción, WA >700 MB | Cola + workers separados (API vs IA vs voz), `max_memory 1G`/sharding WA, STT por lotes, caché |
| 10 000 (pico) | ~2k req/s | Requiere horizontal (2.º VPS o contenedores) + warehouse desacoplado | Sec. 5–6: Redpanda + Spark jobs + ClickHouse, réplicas lectura |

Regla de oro: **Nginx `300s` + `buffering off` mantiene workers colgados** — separar streaming SSE (endpoint dedicado, timeout largo, pocos workers) de API CRUD (timeout 30s, muchos workers).

---

## 4. Diseño bancario: identidad cifrada, olvido sin borrar transacciones, LLM ciego

### 4.1 Principios (estándar bancario)

* **Cifrado en reposo**: AES-256-GCM por campo sensible (`envelope encryption`: DEK por tabla/tenant, KEK en KMS/Vault, rotación 90d). **En tránsito**: TLS 1.2+ interno (Nginx→127.0.0.1 + mTLS Node→Python), HMAC webhooks. **En uso**: solo el borde re-identifica; LLM/analytics/Spark solo ven tokens.
* **Tokenización con vault**: PII real vive solo en `pii_vault` (DB separada/usuario SQL distinto, acceso por rol `pii_reader`). Todo lo demás (transacciones, mensajes, eventos Spark) referencia `uid_enc` / `subject_ref`.
* **Derecho al olvido (LOPDP)**: borrar = destruir DEK del sujeto + `NULL` vault + `tombstone`; **transacciones/procesos se conservan** con `subject_ref` irreversible (agregados, auditoría, facturación intactos).
* **Minimización en LLM**: al prompt solo viaja `{uid_enc, rol, tenant_scope, datos estrictamente necesarios ya seudonimizados}`. Jamás `nombre/cedula/dirección/salud` en claro. Pinecone metadata solo `uid_enc + license_id + scope` (denylist resto).

### 4.2 Identidad única cifrada (UID)

El usuario pide: *edad + fecha nacimiento + nombre completo + cédula + nacionalidad → identidad única cifrada y oculta para el LLM*.

```python
# Pseudocódigo — backend/common/identity.py
import unicodedata, hashlib, hmac
from cryptography.fernet import Fernet  # DEK desde KMS; en prod: AES-GCM + KMS (ej. Vault Transit)

def normalize(v): return unicodedata.normalize('NFKD', v.strip().upper()).encode('ascii','ignore').decode()
def identity_key(nombre, cedula, fecha_nac, nacionalidad):
    # edad se DERIVA de fecha_nac (no entra como input inmutable extra — evita drift)
    raw = "|".join([normalize(nombre), cedula.strip(), fecha_nac, normalize(nacionalidad)])
    pepper = KMS.get("IDENTITY_PEPPER")          # secreto servidor, rotativo
    return hmac.new(pepper, raw.encode(), hashlib.sha256).hexdigest()  # lookup determinista (índice)
def uid_enc(identity_key_hex):
    return Fernet(DEK_PII).encrypt(f"uid:{identity_key_hex}".encode()).decode()  # lo que ve el LLM
```

* **Por qué así**: cédula+nombre+fecha+nacionalidad son inmutables → `identity_key` estable y deduplicante (impide doble registro). `HMAC+pepper` (no hash plano) impide diccionario/arcoíris. `uid_enc` (Fernet/AES-GCM) es lo único que viaja a LLM/Spark-streaming — **opaco e irreversible sin KMS**.
* **Edad**: no forma parte del key (cambia cada año); se calcula `age_display` al vuelo y solo se muestra en borde autorizado.
* **Tablas**:
  `subjects(uid_enc PK, identity_key_hash UNIQUE, dek_ref, status, created_at)` · `pii_vault(subject_ref FK, nombre_enc, cedula_enc, fecha_nac_enc, nacionalidad_enc, dir_enc, tel_enc, salud_enc, ...)` · `subject_tombstones(subject_ref, deleted_at, reason)` · negocio (`children/families/messages/transactions`) solo guarda `subject_ref`, jamás PII en claro.

### 4.3 Flujo entrada → LLM → salida (todas las interfaces iguales)

```
Entrada (web/WhatsApp/Telegram/voz) → Auth + HMAC → IdentityResolver (vault, HMAC lookup) → normaliza a {uid_enc, scope}
  → PolicyFilter (¿qué campos necesita ESTE intent? minimiza) → Pseudonymizer → LLM (solo uid_enc + contexto mínimo)
  → Salida → De-identificador de borde (¿rol autorizado? → re-identifica nombre/edad desde vault : devuelve "***" / age_display) → canal (web/WhatsApp/Telegram/TTS)
```

* Voz: transcripción NO guarda audio crudo con PII (>24h purge, o solo embeddings); TTS en borde (no mandar PII al TTS externo salvo autorizado + TLS).
* Entrenamiento ML/DL: **jamás desde prod**. Job Spark batch anonimizado (`k-anonimato ≥5`, ruido DP en agregados) → dataset curado → feature store → entrenamiento. Consentimiento `training_opt_in` por sujeto; sujetos con `tombstone` excluidos automáticamente (su DEK ya no existe).

---

## 5. Datos masivos: streaming ligero open-source + Spark + warehouse

### 5.1 Decisión: no montar Kafka/Spark pesado en este VPS

Con swap al 72% y 21 apps conviviendo, **Spark standalone + Kafka en el mismo VPS = OOM y caída de todos**. Estrategia en 2 capas:

* **Capa caliente (en VPS, ligera)**: `Redpanda` (binario único, compatible Kafka, ~200 MB) **o** `NATS JetStream` (aún más ligero, ~50 MB) → buffer `ingest.*` / `transcribe.*` / `llm.*` / `events.*`. Productores: Flask (after-request), whatsapp-voice (post-persist). Consumidor inmediato: alertas, contadores, SSE.
* **Capa analítica (fuera del VPS o job nocturno)**: `Apache Spark 3.5 (PySpark)` en modo `local[*]` nocturno **o** contenedor aparte / 2.º VPS (equivalente open-source a Databricks); warehouse `ClickHouse` (open-source, columnar, ~300 MB, ideal agregados) **o** `DuckDB+Parquet` (cero-servidor, reportes) como paso previo. `MinIO` (S3 local) como data lake `s3://lake/{bronze,silver,gold}/`.

### 5.2 Contratos de eventos (estables para Spark)

```json
{"v":1,"event_id":"uuid","ts":"iso","tenant":"t_123","subject_ref":"uid_enc:...","channel":"whatsapp|web|telegram|voice","intent":"asistencia|cmci|...","lat_ms":123,"tokens":456,"model":"gpt-4o-mini","err":null}
```

Bronze (crudo inmutable, 90d TTL) → Silver (limpio + `subject_ref` validado, PII ya fuera) → Gold (agregados por tenant/día/intent, k≥5). Spark Structured Streaming lee Redpanda/NATS→Silver; batch nocturno MariaDB→Silver (JDBC, particionado por `tenant_id`/fecha).

### 5.3 Spark mínimo viable (Python, listo para copiar)

```python
# jobs/silver_events.py — pyspark 3.5, ejecutable nocturno sin tocar el VPS de día
from pyspark.sql import SparkSession, functions as F
spark = (SparkSession.builder.appName("aigovcorex-silver")
    .config("spark.sql.shuffle.partitions","8")
    .config("spark.driver.memory","1g").getOrCreate())
bronze = spark.read.json("s3a://lake/bronze/dt=2026-09-*/")
silver = (bronze.filter("subject_ref IS NOT NULL AND tenant IS NOT NULL")
    .drop("nombre","cedula","telefono","direccion")  # defensa en profundidad: PII nunca debió llegar
    .withColumn("day", F.to_date("ts")))
silver.write.mode("overwrite").partitionBy("day","tenant").parquet("s3a://lake/silver/events/")
(silver.groupBy("day","tenant","intent").agg(F.count("*").alias("n"),
 F.expr("percentile(lat_ms,0.95)").alias("p95")).filter("n>=5")
 .write.mode("overwrite").parquet("s3a://lake/gold/daily_intent/"))
```

Doble fuente local/remota: **MariaDB local = escritura operativa**; **MySQL remota = réplica lectura/reportes** (replicación async o CDC `Debezium→Redpanda→Silver`; jamás doble-escritura). `DB_HOST` actual `127.0.0.1:3306` se mantiene; remota solo como `READ_REPLICA_URL` para Spark/reportes.

---

## 6. Plan de implementación (qué hay vs qué falta)

### Fase 0 — Blindaje beta (días 1–3, sin downtime) ✅ previo a cualquier carga

* [ ] Rotar secretos (OpenAI, Pinecone, LangSmith, DB, JWT, Langfuse), eliminar `.env.local` de frontends, `chmod 600` backend `.env`.
* [ ] `bind 127.0.0.1:5000,3001` + `ufw deny 3001,5000` + `nginx -t` (Nginx único borde).
* [ ] `WEBHOOK_SECRET` HMAC + `ADMIN_API_KEY` en whatsapp-voice (`helmet`, `cors` cerrado, `json limit`, quitar `express.static('tmp')`).
* [ ] `alembic upgrade head` en deploy; eliminar `create_all()+ALTER` de `app.py`; `gunicorn -w 3 --threads 4 --timeout 120 --max-requests 500`.
* [ ] Rate-limit Redis + `ProxyFix` + refresh rotation; `NEXT_PUBLIC_API_URL` unificado; `ignoreBuildErrors:false`.
* Criterio: 0 restarts/h backend, `/health` 200, `pm2 list` estable, swap no crece en deploy.

### Fase 1 — Privacidad bancaria (semanas 1–2)

* [ ] `subjects + pii_vault + tombstones`, `identity_key (HMAC+pepper)` + `uid_enc (AES-GCM/KMS)`, migración PII existente (backfill + verificación + borrado claro).
* [ ] `PolicyFilter + Pseudonymizer` en `whatsapp_webhook/telegram_webhook/chat/public_chat` (verificado por `trace_path`: todos confluyen en `AgentOrchestrator.process_message` → punto único de intercepción).
* [ ] De-identificación de borde por rol (mascarar `cedula → ***4567`, `birth_date → age_display`), fix `Child.to_dict(include_sensitive=False)`.
* [ ] `DELETE /api/subjects/:ref` (derecho al olvido: destruye DEK + tombstone, conserva transacciones).
* [ ] Pinecone: denylist metadata + filtro `$and` + reindex 512/1536.
* Criterio: ningún `to_dict`/log/Pinecone contiene PII en claro; test `test_pii_blind_llm` en verde.

### Fase 2 — Endurecimiento + observabilidad (semanas 3–4)

* [ ] Allowlist SQL-LLM + read-only + auditoría; `zod` en todos los forms; login genérico; CSP/headers; Turnstile en `/api/register`; eliminar `firebase/genkit` o pine Stanton.
* [ ] Logging JSON con rotación + máscara PII + `error_id`; métricas (`latencia, tokens, STT, WA qr/auth`) a endpoint `/metrics` (Prometheus) + Langfuse ya cableado.
* [ ] Tests: auth/RBAC/IDOR/rate-limit/uploads/webhooks + `pytest-cov ≥80%` + CI `lint+typecheck+build`.
* Criterio: beta 100 concurrentes sin errores 5xx >0.1%.

### Fase 3 — Streaming + Spark (mes 2)

* [ ] Redpanda o NATS en VPS (un solo binario, puerto interno), productores Flask/WA, esquemas `v1` congelados.
* [ ] `MinIO + jobs/silver_events.py` nocturno (02:00, `nice/ionice`, `--only` nada — job batch, no PM2), Gold en ClickHouse o DuckDB.
* [ ] Réplica lectura MySQL remota para reportes/Spark (CDC o dump incremental).
* Criterio: dashboard Gold <2s, streaming lag <5s, VPS día sin degradación.

### Fase 4 — Escala miles (mes 3)

* [ ] Separar workers API vs IA/streaming; sharding WA por `companyId` (`--only` por shard); STT en cola con GPU/CPU dedicada o API externa.
* [ ] 2.º VPS o contenedor Spark/ClickHouse; réplicas lectura; WAF + backup cifrado probado (restore drill).
* Criterio: 1k concurrentes p95 <800 ms API, 0 pérdida eventos.

---

## 7. Probar y desplegar SIN romper los otros proyectos del lab (regla de oro del VPS)

El VPS corre 21 apps (`aikrofy-*`, `ms-*`, `lefri-app`, `labmonitor`) en un solo `dump.pm2` y un solo Nginx. Un `pm2 kill/restart all`, `rm sites-enabled/default` o `certbot --nginx` global tumba transmisiones en vivo.

**Prohibido**: `pm2 kill|delete all|restart all|reload all|stop all`, `rm -f sites-enabled/default`, `systemctl restart nginx` sin `nginx -t`, `certbot --nginx` sin snapshot, `npm install+build` de 2 Next + `pip install` en hora pico (swap 72%), `pm2 save` tras tocar apps ajenas sin verificar `pm2 list`.

**Seguro (copiar/pegar)**:

```bash
pm2 list
cd /root/aigovcorex && pm2 reload ecosystem.config.js --only aigovcorex-backend --update-env
pm2 logs aigovcorex-backend --lines 100 --nostream
cp /etc/nginx/sites-enabled/aigovcorex.conf /tmp/aigovcorex.conf.bak && sudo nginx -t && sudo systemctl reload nginx
pm2 save   # solo después de verificar que las 21 apps siguen online
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5000/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9002
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/
```

Despliegues por partes (backend → whatsapp → portal → dashboard), fuera de horario pico, un servicio a la vez, con `backup + nginx -t + healthcheck + rollback` (`pm2 reload --only` previo). Staging: `start-local.sh` es solo local (puertos dev 3000) — jamás en VPS.

---

## 8. Stack final recomendado (ligero, open-source, bancario, realtime)

| Capa | Hoy | Recomendado | Por qué |
|------|-----|-------------|---------|
| API/IA | Flask+gunicorn+LangGraph | Igual + `flask-limiter+Redis` + workers separados | Menor cambio, mayor control |
| Auth/secretos | `.env` plano | Vault o `sops+age` + KMS (DEK/KEK, pepper identidad) | Estándar bancario, rotación |
| PII | Claro en MariaDB+Pinecone | `pii_vault` AES-256-GCM + `uid_enc` para LLM | Olvido sin borrar transacciones |
| Streaming | Ninguno | `NATS JetStream` (tiny) o `Redpanda` (Kafka-API) | Un binario, <200 MB, realtime |
| Batch/ML | Ninguno | `PySpark 3.5` nocturno + `MinIO` lake + `ClickHouse`/`DuckDB` gold | Equivalente Databricks open-source sin matar el VPS |
| Voz | Whisper CPU inline | Cola STT + purge audio 24h | 0.5–1 core/transcripción no bloquea API |
| Borde | Nginx | Igual + WAF/rate-limit + mTLS interno | TLS + HMAC + allowlist |

---

## 9. Checklist go/no-go beta

* [ ] C1–C9 cerrados, `pm2 list` 24h sin restarts anómalos, swap estable.
* [ ] `test_pii_blind_llm`, `test_olvido_conserva_transacciones`, `test_webhook_hmac`, `test_sql_allowlist`, `test_rbac_idor` en verde.
* [ ] Load-test 100 concurrentes (k6/Locust) p95 <800 ms, 0 PII en logs/Pinecone.
* [ ] Backup cifrado + restore drill + réplica lectura OK.
* [ ] Runbook despliegue seguro (sec. 7) firmado por el lab.

*Documento vivo: actualizar tras cada fase con métricas reales de `pm2 + /metrics + gold/daily_intent`.*
