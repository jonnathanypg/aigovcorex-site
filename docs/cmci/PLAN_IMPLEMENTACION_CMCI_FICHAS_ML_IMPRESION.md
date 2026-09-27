# PLAN DE IMPLEMENTACIÓN CMCI — Fichas de Vulnerabilidad + Socioeconómica, Puntaje Automático, Impresión Oficial e Informes Mensuales
**Estado:** CONGELADO v1.0 — listo para ejecutar F0 · **Bitácora:** `log-development.md`
**Proyecto:** AI GovCoreX OS (`aigovcorex/`) · **Fecha:** 2026-09-27 · **Fuente:** análisis exhaustivo de `backend/`, `frontend/dashboard`, `frontend/portal`, `services/whatsapp-voice`, `IMPLEMETACION-Y-MEJORAS/` (2 Excels + 2 PDFs + transcripción Meet 2026-09-25 con Javier Gastiaburo, socio de dominio) + `Plataforma Multicentro CMCI Especificación Técnica.pdf`
**Objetivo:** replicar 1:1 las dos fichas Excel con sus fórmulas, crear motor determinista + modelo ligero ML para puntaje automático, inventariar datos, e implementar impresión con diseño estético oficial + reportes por fecha/niño. **Alcance global:** Ecuador (593, cédula módulo-10, CanastaRef INEC) es solo el `country_config` por defecto; el sistema queda multi-país desde F0 (teléfono E.164 + validador ID por país + params por país/centro, sin hardcodes EC).

---

## 1. ESTADO ACTUAL DEL PROYECTO AIGOVCOREX (sin omisiones)

### 1.1 Arquitectura monorepo (ver `aigovcorex/README.md`, `ecosystem.config.js`, `package.json`, `DEPLOY.md`)

```
aigovcorex/
├── frontend/portal/      # Next.js 14, puerto 3000 local / 3002 prod (discrepancia documentada) — marketing B2G + captación beta
├── frontend/dashboard/   # Next.js 14 + ShadcnUI + Recharts, puerto 9002 — Dashboard Operativo Unificado (70+ rutas)
├── backend/modules/
│   ├── early-childhood/  # MONOLITO ACTIVO KindiCore/CDI — Flask + LangGraph + MySQL/SQLite + Pinecone, puerto 5000
│   └── social/           # MÓDULO CANÓNICO NUEVO AI GovCoreX OS Motor Social (ProgramFormDefinition dinámico)
├── services/whatsapp-voice/ # Node+TS+Baileys multi-tenant (companyId==license_id), puerto 3001, auth MySQL bailey_sessions
├── nginx/aigovcorex.conf # 443 portal(3002)+dashboard(9002), /api/→5000, /whatsapp/→3001, TLS 1.3
├── ecosystem.config.js / deploy.sh / start-local.sh / start-all.sh / .env / .env.example
```

Puertos: Portal 3000/3002, Dashboard 9002, Backend 5000, WhatsApp 3001. PM2 4 apps. Deploy GitHub Actions `push main` → tar excluyendo node_modules/.next/venv → scp → `./deploy.sh` (8 fases).

### 1.2 Backend `early-childhood` — estado real

**Factory `backend/modules/early-childhood/app.py:create_app()`:** Flask + SQLAlchemy + CORS + JWT (1h/30d) + `middleware/tenant_context.py`. Registra 14 blueprints: `auth, api (agregador), super_admin (/api/super-admin), license_admin, coordinator, educator, webhooks whatsapp+telegram (/webhooks), knowledge (/api/knowledge), reports (/api), voice (/api/voice), public_chat, chat_upload, social_programs (/api/social)`. Rutas HTML `/, /dashboard, /super-admin, /license-admin, /coordinator, /educator, /children, /attendance, /nutrition, /reports` + `/health`. Auto-migraciones inline (`milestones ADD period/notes`, `licenses ADD agent_voice, enabled_modules, max_users...`, backfill `enabled_modules='["kindicore","social","geo","channels","copilot"]'`).

**DB dual (`config.py`):** si `DB_HOST+DB_USER+DB_PASSWORD` → `mysql+pymysql://...?charset=utf8mb4` (pool 5/5, recycle 10s, pre_ping — agresivo por inestabilidad; prod override 20/3600/40). Si no → `sqlite:///instance/cdi_database.db`. Testing → memory. 40+ modelos en `models/__init__.py:init_models()`: `licenses, license_admins, tenants, roles, users, families, representatives, children, attendance, nutrition_daily, menus, health_records, vaccines, milestones, applications, vulnerability_forms, waiting_lists, documents, knowledge_documents, conversation_history (SQL raw), social_programs, program_form_definitions, program_beneficiaries, geo_*, channel_*, notifications, generated_reports...`. Claves: `Family.tenant_id→tenants`, `Child.family_id`, `Application.center_id+child_id`, `VulnerabilityForm.child_id unique+application_id`, `KnowledgeDocument.license_id + tenant_id NULL=global`.

**APIs (32 blueprints en `api/`):** dashboard/stats, users, children (+representatives), attendance, health (WHO Z-score, vacunas Ecuador 0/2/4/6/12/15/18/48m), nutrition (menú, raciones, alertas), milestones (IDII 4 dominios), documents (doble prefijo `/api/documents` bug), applications (create/list/approve/reject/waitlist), monitoring (KPIs), interventions, operations, notifications, chat (LangGraph `/message|/stream|/history`), reports (`/generate|/download|/public|/export-sheets` → pdf/csv/xlsx vía reportlab/openpyxl), channels (wa init/qr/status/disconnect + telegram), messaging (`/api/api/messages` bug doble prefijo), planning, ingestion CSV 7 entidades, geo (`/points|/layers|/fences|/network`), channels-os, social legado.

**Módulo canónico `backend/modules/social/` (13 rutas `/api/social`):** `GET /programs`, `GET /beneficiaries`, `GET /programs/<id>/beneficiaries`, `POST /programs` (auto short_code + schema smart-fallback), `GET|PUT /programs/<id>`, `GET|PUT /programs/<id>/form`, `POST /programs/<id>/generate-form-ai`, `POST /programs/ai-create-full` (LLM), `POST /programs/<id>/submit` (+`_calculate_eligibility_score`), `POST /programs/<id>/conversational-step` (wizard WA/Web + `_validate_field_value` + PostulacionAgent), `GET /public/programs/<id>/form`. Modelos: `SocialProgram, ProgramFormDefinition {fields[] {id,label,type:text|number|currency|select|boolean|date|cedula|file, required, placeholder, conversational_prompt, scoring_weight 5-40, section_id, options, validation}, sections[], eligibility_rules[] {field,operator,value,points}}`, `ProgramBeneficiary {eligibility_score, socioeconomic_level critical_poverty|poverty|vulnerable|stable, household_members, monthly_income...}`.

**Lógica fichas EXISTENTE (doble sistema, NO es la de Javier — brecha crítica):**
- A) CDI clásico `models/application.py:VulnerabilityForm.calculate_score()` 0-100: per-cápita <100=+30/<200=+20/<300=+10 (30) + vivienda invasión15/prestada12/arrendada8 (15) + material caña10/madera7/mixto4 (10) + servicios faltantes×2.5 (10) + violencia10+discapacidad7+monoparental5+teen5+crónica4+desempleo4 (35) + educación madre/padre superior-5/secundaria-3/ninguna+5 + migrante+5+refugiado+5 → clamp → `>=75 crítico, >=50 alto, >=25 medio, else bajo`. Flujo `api/applications.py:create_application()` crea Family(+18 cols socio-geo vía `add_socioeconomic_columns.py`)+Representatives+Child(lista_espera)+Application(pending)[+VulnerabilityForm→priority_score]; approve→activo. `services/priority_service.py:VulnerabilityPriorityHeap` max-heap en memoria por tenant.
- B) Social dinámico: `_generate_schema_via_llm()` + fallback keywords + default 3 secciones/12 campos; validación cédula módulo-10 EC, fechas dd/mm/yyyy, rangos peso/talla, select fuzzy, boolean Sí/No; scoring `_calculate_eligibility_score()` suma points si regla matchea → min(100), default 75.0.

**Vectores/RAG `services/rag_service.py`:** Pinecone (`kindicore-rag`, `text-embedding-3-small`, DIM 512), namespace `license_{id}`, metadata `{license_id, scope:global|organization|module|center|project|operator, tenant_id?, module?, program_id?}`, chunk 1000/200, `index_document/ingest_text/query(top_k, RBAC super_admin ve todo)/get_context/delete_*`. Persistencia `knowledge_documents`. Upload pdf/docx/txt (`utils/text_extractor.py`), tool `ConsultKnowledgeTool`.

**Agentes multiagente:**
- `agents/langgraph_orchestrator.py:LangGraphOrchestrator` (producción): StateGraph {agent→tools→agent}, `ChatOpenAI gpt-4o-mini / Gemini`, `bind_tools(get_all_tools())`, ThreadPool 1 hilo, recursion 15 + circuit-breaker, fast-path tema claro/oscuro, personalidad por `License.agent_name/personality`, contexto org por rol, historial 6 msgs por sender+tenant, `run_sql_analysis + consult_knowledge_base`. Prompts `prompts/orchestrator_system.md, sql_analyst.md, child_profile.md`.
- `agents/orchestrator.py` clásico (classify intent → postulacion|ingesta|asistencia|resúmenes|contactos|general), `simple_orchestrator.py` fallback, especialistas `ingesta/asistencia/resúmenes/contactos/sql/sql_team/`, tools `analytics|management|messaging|notification|rag|report`, `social/agents/postulacion_agent.py:PostulacionAgent.process_step()+_llm_extract_and_reason()` (doble validación determinista→LLM JSON, anti-ruido, tono ecuatoriano) — núcleo fichas sociales. `llm_interface.py:get_llm()` auto OpenAI→Gemini, `extract_json/get_embeddings`.
- `services/`: context_service (contexto por rol), rag_service, priority_service, who_standards (LMS Z `((X/M)^L-1)/(L·S)`, classify weight/height, curvas ±3SD, anomalías), sql_executor, ingestion, voice (edge-tts; whisper desactivado py3.14), export/report_generator, identity_resolver, trie, sse_manager, upload, email, milestones_catalog.

**Deuda/riesgos backend:** doble blueprint social (legado early-childhood + canónico social/), doble prefijo `/api/api/messages`, columna `sections` con auto-migración runtime, `conversation_history` sin ORM, duplicado `tenant_id/center_id` en applications, `requirements.txt` py3.14 sin pandas/faster-whisper.

### 1.3 Frontend dashboard — estado real (70+ rutas, Next 14.2.24, Tailwind, Radix, RHF+Zod, React-Query, Zustand, Recharts, Leaflet)

Shell OS 3 niveles (`os-shell-layout`: rail 72px+subnav 240px+header+canvas+bottom-nav+ChatWidget Copiloto). Grupos: `(app)` KindiCore (`/dashboard,/registro,/admision,/asistencia,/seguimiento-idii,/salud-nutricion,/planificaciones,/intervencion-familiar,/monitoreo,/reportes,/operaciones,/ingestion,/notificaciones,/knowledge,/analysis,/seguridad`) + Social (`/social/dashboard|/programas/nuevo|/postulaciones|/beneficiarios|/red|/equipos|/proyectos|/reportes|/formularios`) + Geo + Canales + Copiloto + `license-admin/*` duplicado funcional + `/super-admin,/login`. Componentes por dominio (`registro/child-record-form 582L wizard 3 tabs`, `admision/admission-client+view-application-dialog Ficha Postulación`, `social/dynamic-form-renderer+program/beneficiary-details-dialog Ficha Dinámica/Socioeconómica`, `reports-client 354L`, etc.), 38 primitivas shadcn, tablas responsive dual + Badge + búsqueda client-side + AlertDialog delete, glassmorphism Amber/Orange + dark.

**Brecha impresión:** CERO `window.print`, CERO `@media print`, CERO `react-to-print`. Export 100% backend (`reports.service.ts:generate+download` → Blob → pdf/csv/xlsx; tipos asistencia/desarrollo/salud/general/ninos_matriz). Sin vista previa imprimible de Ficha Integral/MIES/Postulación. Sin botón Imprimir/PDF por ficha. Portal (Next+framer-motion+i18n ES/EN) es solo marketing, no expone fichas.

**Deuda frontend:** duplicación `(app)/*` vs `license-admin/*`, `child-record-form` campo `status` duplicado, import AlertDialog al final, `monitoring-client` hack `declare module progress`, sin paginación server-side/virtualización, cobertura desigual (monitoreo solo KPIs, canales/geo/copiloto dependen de servicios externos sin fallback).

### 1.4 Services `whatsapp-voice` + deploy

Baileys v7 multi-tenant (`sessions Map`, `tokens/` legacy → MySQL `bailey_sessions(pk_id,session_id,data JSON)`, `useMySQLAuthState`, fix 405 con `version [2,3000,1033893291]`, browser KindiCoreAI, 3 reintentos; auto-restore si `creds.me.id && registered`). Rutas `/session/init|/qr/:companyId|/status|/logout|/list`, `/lead|/lead/typing|/lead/media`. IoC puente → `POST ${BACKEND_URL}/webhooks/whatsapp {companyId,from,message,messageId,attachment?}` con fix LID (`remoteJidAlt`), descarga audio/document a `tmp/uploads`, texto+audiotranscrito en backend (`api/whatsapp_webhook.py`: dedup `whatsapp_processed_events`, valida `License.whatsapp_connected`, `IdentityResolver.resolve_from_phone`, ciudadano público vs `_process_ai_message` por rol → `LangGraphOrchestrator.process_message(channel=whatsapp)`, `[ATTACH_REPORT:url|filename]` → media, TTS `es-EC-LuisNeural` si voz, envío vía `WHATSAPP_API_URL/lead|/media|/typing`). Sin LLM multiagente en este servicio. Discrepancias: portal 3000 vs 3002, `WHATSAPP_BACKEND_URL /api/whatsapp-webhook` (ejemplo) vs `BACKEND_URL + /webhooks/whatsapp` (real correcto), `build:all` no compila whatsapp, Dockerfile obsoleto (puppeteer/venom).

---

## 2. LO QUE PIDE JAVIER (transcripción Meet 2026-09-25 10:32 GMT-05, 61 pág. + Resumen/Decisiones/Próximos pasos)

**Contexto:** convenio 250 días, 198 niños activos + 300 familias rotativas/mes, 3 centros (Bahía BH, Guasmo GU, Orquídeas OR), corte mensual día 24 (próximo 24-oct primer pago), inicio oficial lunes (contratos+personal+correos), miércoles acceso educadoras, capacitación + videos pantalla, técnico designado, teléfonos formato 593 (no 09, ya resuelto), financiamiento piloto mensual (licencia fundación), servidor en riesgo (~$200 adelanto), estrategia casos de éxito → otras alcaldías (Guayaquil independiente vs MIES en resto), robustez para renovación oct-2027.

**Requerimientos funcionales (verbatim resumido):**
1. **15 documentos obligatorios por expediente** en módulo **Biblioteca** (descarga formato en blanco → impresión → llenado mano → escaneo fuera del sistema). NO subir expedientes completos (45 págs/niño) al sistema por espacio Hostinger. Sí plantillas: protocolo ingreso (cédula, partida nacimiento madre/padre, carné vacunación, planilla servicios básicos, respaldo laboral, ingresos ≤ básico, croquis perímetro CMCI), ficha postulación, ficha CDP, ficha socioeconómica, ficha vulnerabilidad, informe técnico visita, acta compromiso/corresponsabilidad, consentimiento informado, autorización imagen, ficha IDII, historia clínica, monitoreo nutricional, curvas crecimiento.
2. **Ficha vulnerabilidad automatizada dentro del sistema** con preguntas+fórmulas+cálculo automático (replicar Excel validado). Validación edad 12-42 meses (`FUERA DE RANGO` si no), códigos centro BH/GU/OR, guardado → base de datos (nuevo registro, no sobreescribir), priorización mensual/comité (10 cupos vs 50 carpetas), semáforo + prioridad + alertas protección, dashboard conteos, impresión con logos+diseño oficial para expediente físico y pago donante. Bug Excel actual: macro limpiar ficha falla.
3. **Ficha socioeconómica** separada: solo ingresos hogar y per-cápita (vs vulnerabilidad = entorno+redes+vivienda+comunitario). Prototipo v2 aún en construcción (Claude/ChatGPT, 1 semana). Pasar ambas aunque la económica sea borrador.
4. **Diferencia explícita:** económica = cuánto gana familia/per-cápita; vulnerabilidad = per-cápita + entorno + redes + servicios + comunitario (menos empírica, más estadística; ejemplo 800 con sin servicios > vulnerable que 400 con servicios).
5. **Captura conversacional WhatsApp:** mayor parte de postulación vía chat (PostulacionAgent), educador solo valida pendientes (alertas). Teléfonos 593.
6. **Informe mensual educadora automático** desde planificaciones semanales + asistencia + 9 niños asignados: encabezado convenio (convenio, finalidad, población, objetivo, servicios), periodo editable (ej. 03/04-03/06, corte 24-oct), 4 planificaciones/mes (ámbitos cognitivo/socioemocional/lenguaje/motor → vinculación emocional/descubrimiento/motor/lenguaje; fases inicio/desarrollo/cierre), gestión integral (n° usuarios, casos riesgo, capacitación, trabajo familia, actividades centro), campo editable 500 palabras + conclusiones auto desde data niños, firmas físicas educadora+coordinadora, botón **Imprimir informe mensual** (en su módulo) que imprime con diseño oficial. No enviar PDF por correo (llena Hostinger); imprimir+firmar en físico.
7. **Matrices exportables:** matriz general usuarios, matriz posibles beneficiarios (quienes pidieron info y no ingresaron — justifica productividad), matriz única beneficiarios (cortas), matriz consolidada coordinación, matriz asistencia Excel. Descargar desde sistema (no rellenar a mano), con encabezado que distinga cada matriz (mismo diseño/colores confunde).
8. **Semáforo completitud perfil:** columna/indicador en Registro (perfil completo/incompleto, rojo/verde salud e IDII), filtro incompletos, notificaciones a doctores (deadline 1-oct peso/talla), ver ficha sin entrar a editar.
9. **Histórico:** pestañas Activos/Egresados (edad, mudanza, retiro) en Registro niños; Pendientes/Rechazados en Admisión. Filtros por estado.
10. **Alertas/cronograma:** recordatorio cierre día 24 (2 días antes), mensajes WA a padres con código/link, depurar base teléfonos.
11. **Solicitudes entrega:** carpeta completa 1 centro + matrices con macros + docs modelo (ya entregado: `2_CENTRO-INFANTIL-DOCUMENTACION-EJEMPLOS/` con Alimentación/Usuarios/TTHH, 27 expedientes ~21-26MB c/u, matrices asistencia/consolidada/única en xlsx+pdf).

**Decisiones acordadas (p.3):** filtros egresados/rechazados; ficha vulnerabilidad con fórmulas en plataforma; biblioteca digital (no expedientes pesados); informe mensual auto desde planificaciones; indicadores completitud; difusión casos éxito; robustez para renovación.

---

## 3. ANÁLISIS EXACTO DE LOS DOS EXCELS (fórmulas replicables — fuente de verdad)

### 3.1 `Matriz_Vulnerabilidad_CMCI_VALIDADA_VERSION_1_OK_pruebas.xlsm` — VALIDADA v1 OK (7 hojas)

Hojas: `INSTRUCCIONES, VALORACIÓN, PARÁMETROS, BASE DE DATOS, PRIORIZACIÓN, DASHBOARD, PRUEBAS`. Named ranges críticos: `ParamRangoNivel (A165:A169), ParamRangoDesde (B165:B169), ParamRangoSemaforo (D165:D169), ParamPrioNombre (A173:A175), ParamPrioDesde (B173:B175), ParamOpcID/Texto/Score, ParamDim*, CanastaRef (B179=220), RatioT_100=1, RatioT_075=0.75, RatioT_050=0.5, RatioT_025=0.25, DepT_1=1, DepT_2=2, DepT_3=3, DepT_4=4, NnaT_2=2, NnaT_3=3, NnaT_4=4, HacT_2=2, HacT_3=3, NV_* (VALORACIÓN!C5,C6,C7,C9,C10,C11,C12,C16,F78-F84,G33...)`.

**Bloque 1 — Dimensiones (PARÁMETROS!F6:F13, deben sumar 100, F14=SUM, G14=IF(F14=100,"OK","REVISAR")):**
D1 Situación económica 20% · D2 Composición familiar 10% · D3 Laboral/educativa 15% · D4 Cuidado infantil 20% · D5 Vivienda 10% · D6 Salud/discapacidad 10% · D7 Protección/riesgos 10% · D8 Redes apoyo 5%.

**Bloque 2 — 33 indicadores (A18:A50, peso dimensión D, peso global E=VLOOKUP(dim)*D/100, E51=SUM debe 100, E53:E60=SUMIF por dimensión debe 100 c/u):**
D1: I1.1 per-cápita 20%, I1.2 inserción laboral 20%, I1.3 estabilidad ingresos 20%, I1.4 dependencia económica 20%, I1.5 registro social 20%.
D2: I2.1 estructura/jefatura 33.33%, I2.2 NNA dependientes 33.33%, I2.3 adicionales dependientes 33.33%.
D3: I3.1 laboral principal 25%, I3.2 segundo cuidador 25%, I3.3 compatibilidad horario 25%, I3.4 estudios principal 25%.
D4: I4.1 cuidador permanente 20%, I4.2 fragilidad arreglo 20%, I4.3 horas sin cuidador 20%, I4.4 riesgo interrupción 20%, I4.5 acceso servicio cuidado 20%.
D5: I5.1 tenencia 25%, I5.2 hacinamiento 25%, I5.3 servicios básicos 25%, I5.4 riesgo físico/ambiental 25%.
D6: I6.1 necesidad especial niño 25%, I6.2 barrera cuidador 25%, I6.3 crónica hogar 25%, I6.4 acceso salud 25%.
D7: I7.1 violencia 20%, I7.2 negligencia 20%, I7.3 ausencia redes protección 20%, I7.4 movilidad 20%, I7.5 otro riesgo 20%.
D8: I8.1 disponibilidad familiares 33.33%, I8.2 frecuencia apoyo 33.33%, I8.3 apoyo comunitario 33.33%.

**Bloque 3 — Opciones 0-4 (A64:A161, F=score):** ej. I1.2 formal ambos 0 / uno formal 1 / informal 2 / un desempleado 3 / ambos desempleados 4; I1.3 estables 0 / variables 2 / ocasionales 3 / sin ingresos 4; I1.5 sin dato 0 / vulnerabilidad 1 / pobreza 3 / extrema 4; I2.1 biparental 0 / monoparental con apoyo 2 / sin apoyo 3 / terceros 4; I3.1 formal 0 / informal 2 / busca 3 / sin búsqueda 1 (asimétrico — respetar); I4.3 ninguna 0 / 1-2h 1 / 3-4h 3 / 5h+ 4; I5.1 propia 0 / arrendada 1 / prestada 2 / inestable 4; I5.3 3 servicios 0 / 2 servicios 2 / ≤1 servicio 4; I7.x no 0 / observación 2 / claro-derivación 4; I7.4 no aplica 0 / regularización 1 / alta vulnerabilidad 3; resto ver filas 100-161.

**Bloque 4 — Rangos (A165:E169, editable):** 0-20 muy baja VERDE 63BE7B · 20.0001-40 baja VERDE 9BD16E · 40.0001-60 moderada AMARILLO FFEB84 · 60.0001-80 alta NARANJA F8A354 · 80.0001-100 crítica ROJO F8696B.
**Bloque 5 — Prioridad (A173:D175):** P3 0-40 menor/disponibilidad · P2 40-60 intermedia · P1 60-100 alta **o alerta protección**.
**Bloque 6 — Umbrales auto (B179:B192):** CanastaRef 220 USD (INEC ilustrativo), ratios y Dep/Nna/Hac arriba.

**Hoja VALORACIÓN (ficha individual imprimible):**
- A: C5 código `FV-GASIBA-2026-OR-002`, C6 fecha, C7 nombre, C8 nacimiento, **C9=`DATEDIF(C8,IF(C6="",TODAY(),C6),"m")`, G9=`IF(OR(C9<12,C9>42),"FUERA DE RANGO","EN RANGO")`**, C10 sexo, C11 CMCI (ListaCMCI), C12 sector, C13 representante, C14 parentesco, C15 teléfono, C16 estado (En proceso/Completa/Pendiente/Validada/Admitida/No admitida/Lista espera).
- B: C19 ingreso total, C20 integrantes, C21 perceptores, C22 NNA, C23 dormitorios.
- C matriz (C=respuestas, D=puntaje 0-4, E=peso dimensión VLOOKUP, F=peso global VLOOKUP, G=ponderado `D/4*F`):
  - C28 per-cápita `=C19/MAX(C20,1)`, D28 ratio vs CanastaRef por RatioT_* (0/1/2/3/4).
  - C29/C30/C32/C35/C37/C40-C43/C46-C50/C53/C55-C56/C59-C62/C65-C69/C72-C74 `SUMIFS(ParamOpcScore,ParamOpcID=I,ParamOpcTexto=C)`; C31 dependencia `=C20/MAX(C21,1)`, D31 por DepT_*; C36 `=C22`, D36 por NnaT_* (≤2→0, =3→1, =4→2, >4→3 — nota: máx 3 no 4); C54 hacinamiento `=C20/MAX(C23,1)`, D54 por HacT_* (≤2→0, ≤3→2, >3→4).
  - Subtotales G33=SUM(G28:G32) (máx 20), G38 (máx 10), G44 (máx 15), G51 (máx 20), G57 (máx 10), G63 (máx 10), G70 (máx 10), G75 (máx 5).
- D consolidado: **F78=`G33+G38+G44+G51+G57+G63+G70+G75` (0-100), F79=`F78/100`, F80=`INDEX(ParamRangoNivel,MATCH(F78,ParamRangoDesde,1))`, F81=`INDEX(ParamRangoSemaforo,...)`, F82=`IF((--(D65>=3)+--(D66>=3)+--(D67>=3)+--(D68>=3)+--(D69>=3))>0,"SÍ — REQUIERE REVISIÓN PROFESIONAL / PROTECCIÓN","NO")`, F83=`IF(F82<>"NO","PRIORIDAD 1",INDEX(ParamPrioNombre,MATCH(F78,ParamPrioDesde,1)))`, F84 necesidad cuidado `=IF((G51/20*100)>=60,"ALTA",IF(>=30,"MEDIA","BAJA"))`.**
- E alertas (G88:G97 auto Sí/No): protección (F82), sin cuidador D46>=4, monoparental sin apoyo D35>=3, desempleo D29>=3 OR D40=3, hacinamiento D54>=4, sin servicios D55>=4, necesidad urgente D48>=3 OR D49>=4, discapacidad D59>=4 OR D60>=4, sin red D72>=4, otro riesgo D69>=4.
- F resumen D100 `=C5`, D101 `=F78&"/100"`, D102 `=TEXT(F79,"0.0%")`, D103 `=F80`, D104 `=F83`, D105 `=F82`, D106 `=F84`, D107 observaciones libres.

**BASE DE DATOS (A5:Z152, cada fila 1 postulante, H:O 8 subtotales D1-D8):** P `=SUM(H:O)`, Q `=P/100`, R `=INDEX(ParamRangoNivel,MATCH(P,...))`, **S `=IF(T="Sí","PRIORIDAD 1",INDEX(ParamPrioNombre,MATCH(P,...)))`**, T alerta Sí/No (manual o espejo E), U necesidad `=IF(K/20*100>=60,"ALTA",...)`, V semáforo INDEX, W estado, **Y `=(IF(S=P1,3,IF(S=P2,2,1)))*100000+IF(T=Sí,1000,0)+P` (orden), Z `=RANK(Y,$Y$)+COUNTIF(...)` (ranking sin empates)**.
**PRIORIZACIÓN:** `INDEX(BASE!A:G,MATCH(fila,BASE!Z...))` espejo ordenado por Z (filas 5-45). **DASHBOARD:** E5 `=COUNTIF(BASE!A,"?*")`, I5 `=AVERAGEIF(BASE!A,"?*",BASE!P)/100`, D9:D13 `=COUNTIF(BASE!R,nivel)`, E9:E13 `=D/E5`, D17:D19 `=COUNTIF(BASE!S,prioridad)`, E22 `=COUNTIF(BASE!T,"Sí")`, D25:D28 `=COUNTIF(BASE!E,CMCI)`. **PRUEBAS:** 5 casos (8/No/muy baja→P3, 30→baja P3, 50→moderada P2, 70→alta P1, 44.5/Sí→moderada P1 por alerta) con `=INDEX/MATCH` + `=IF(D="Sí","PRIORIDAD 1",...)` + `=IF(AND(F=E,LEFT(H,11)=LEFT(G,11)),"OK","REVISAR")`; verificaciones pesos=100, min/max, sin #N/A/REF, semáforo/prioridad reactivos. **INSTRUCCIONES:** uso, macros Guardar/Limpiar (Limpiar con bug VBA reportado por Javier).

### 3.2 `Ficha_Socioeconomica_CMCI_v2_PROTOTIPO.xlsx` — PROTOTIPO (5 hojas, sin macros, aún en construcción)

Hojas: `REGISTRO_SOCIOECONOMICO, BASE_DATOS, PARAMETROS, METODOLOGIA, DASHBOARD`.
**PARAMETROS:** pesos B4:B10 (Ingreso 0.30, Composición 0.15, Laboral 0.15, Vivienda 0.15, Servicios 0.10, Gastos 0.10, Educación 0.05 — suman 1.0); rangos D4:F6 (<50 alta, <75 media, else baja — **invertido vs vulnerabilidad: aquí 100=mejor condición**); catálogos CMCI/sexo/tenencia; matriz puntuación Alto 100 / Medio 60 / Bajo 20; umbrales B25=3 hacinamiento moderado, B26=4 elevado, B27=0.7 carga alta, B28=0.5 carga media.
**REGISTRO (ficha individual):** B4 código, B5 fecha, B6 CMCI, B7 niño, B8 nacimiento, B9 edad meses (manual en prototipo — debe ser DATEDIF como vulnerabilidad), B10 sexo, B11 representante, B12 parentesco, B13 teléfono 960193518, B14 dirección, B15 sector; E4 integrantes 6, E5 <5a 2, E6 5-17a 2, E7 adultos 2, E8 mayores 0, E9 discapacidad 1, E10 enfermedad 0, E11 trabajan 1, E12 generan ingreso 2, E13 dormitorios 3, E14 personas/dormitorio 3.
Ingresos B18:B25 (sueldos 1000, jornales 0, independiente 500, negocios 40, pensiones 0, bonos 50, ayudas 0, otros 0) → **E18 `=SUM(B18:B25)` (1590), E19 per-cápita `=E18/E4` (265.0)**. Egresos B29:B38 (alim 200, arriendo 250, básicos 50, transporte 25, educación 75, salud 50, cuidado 0, deudas 0, vestimenta 30, otros 0) → **E29 `=SUM` (680), E30 disponible `=E18-E29` (910), E31 %gastos `=E29/E18` (0.4277)**. Vivienda B42 arrendada, B43 situación, B44 ladrillo, B45:B50 Sí/Sí/No/Sí/Sí/Sí; E42 formal, E43 educación 100, E44 bono Sí, E45 ayuda No.
Indicadores: **B54 personas/perceptor `=E4/E12` (3.0), B55 cobertura servicios `=COUNTIF(B45:B50,"Sí")/6` (0.833), B56 personas/dormitorio 3, B57 carga `=IF(E31>=0.7,"Alta",IF(E31>=0.5,"Media","Baja"))`, B58 dependencia `=IF(B54>=4,"Alta",IF(B54>=2,"Media","Baja"))`.**
Puntaje (B62:B68 × pesos): **B62 ingreso `=IF(E19<=0,0,IF(E19>=600,100,IF(E19>=300,60,20)))`** (cortes 600/300 — calibrar vs CanastaRef 220 de vulnerabilidad); B63 composición por B58 (Baja 100/Media 60/Alta 20); B64 laboral por E42 (formal/jubilado 100, informal/independiente 60, desempleo 20); B65 vivienda por B42/B43; B66 servicios por B55 (>=0.8→100, >=0.5→60, else 20); B67 gastos por E31 (<0.5→100, <0.7→60, else 20); B68 educación por E43. **E62 total `=SUMPRODUCT(B62:B68,PARAMETROS!B4:B10)` (0-100, mayor=mejor), E63 clasificación `=IF(E62<50,"alta",IF(E62<75,"media","baja"))`.**
BASE_DATOS A4:O203 espejo + N puntaje, O clasificación, I per-cápita; DASHBOARD B4 `=COUNTIF(BASE!A,"<>")`, B5 `=AVERAGE(BASE!N)`, B6:B8 `=COUNTIF(BASE!O,nivel)`, B9 `=AVERAGE(BASE!I)`, H5:K8 `=COUNTIF/COUNTIFS por CMCI×nivel`. METODOLOGIA: objetivo, puntaje 0-100 ponderado configurable, interpretación, limitación (no sustituye entrevista/visita), protección (códigos, acceso limitado), casos ficticios A/B/C.

### 3.3 Regla de oro para el sistema

**Vulnerabilidad (0-100, mayor = más vulnerable):** `Total = Σ (score_i/4 × peso_global_i)` con 33 indicadores; `Nivel = INDEX(Rangos,MATCH(Total,Desde,1))`; `Alerta = ANY(D65:D69>=3)`; `Prioridad = Alerta? P1 : INDEX(Prios,MATCH(Total,...))`; ranking `Y=priNum*100000+alerta*1000+total`, `Z=RANK+COUNTIF(desempate)`. **Socioeconómica (0-100, mayor = mejor):** `Total = ΣPRODUCTO(subpuntajes 100/60/20, pesos)`; `Clasif = <50 alta, <75 media, else baja`. Ambos configurables vía tabla `scoring_params` (pesos, rangos, umbrales CanastaRef/ratios/Dep/Nna/Hac, cortes 600/300). Validación edad `DATEDIF(nac,fecha_val)=m; EN RANGO iff 12<=m<=42`.

---

## 4. BRECHAS: LO QUE FALTA PARA CUMPLIR A JAVIER

| # | Requerimiento Javier | Estado actual | Brecha |
|---|---|---|---|
| 1 | Ficha vulnerabilidad con 33 indicadores + fórmulas exactas + semáforo + prioridad + alertas | `VulnerabilityForm.calculate_score()` antiguo (ingreso+vivienda+material+servicios+bonos, umbrales 75/50/25) — NO coincide con Excel validado | Reemplazar/ampliar motor; migrar pesos/rangos/umbrales a tablas configurables |
| 2 | Ficha socioeconómica 7 dimensiones + per-cápita + SUMPRODUCT | No existe (solo `Family` + `monthly_income_range`) | Crear módulo nuevo |
| 3 | Impresión ficha individual con diseño oficial + logos al dar a Imprimir (Excel: área impresión con encabezado, tabla, resumen, firmas) | Sin print CSS ni print views | Crear `print/ficha-vulnerabilidad/[id]`, `print/ficha-socioeconomica/[id]`, `print/informe-mensual` con `@media print`, `@page A4`, header logos, tabla, semáforo color, firmas |
| 4 | Base datos + priorización ordenada + dashboard (conteos/promedios/por CMCI) | Dashboards genéricos, sin ranking Y/Z ni conteos por nivel/prioridad/CMCI | Endpoints ranking + vistas Priorización/Dashboard CMCI |
| 5 | Guardar cada valoración como nuevo registro histórico (no sobreescribir) + estados (En proceso/Completa/Pendiente/Validada/Admitida/No admitida/Lista espera) | `VulnerabilityForm.child_id unique` impide histórico | Quitar unique, modelo `VulnerabilityAssessment` versionado por `assessed_at` |
| 6 | Biblioteca 15 plantillas (descarga en blanco, no expedientes pesados) | `documents` + `knowledge` existen pero sin biblioteca de plantillas | Módulo Biblioteca + tabla `document_templates` + storage plantillas |
| 7 | Informe mensual auto desde planificaciones+asistencia+9 niños, periodo editable, campo 500 palabras, conclusiones auto, firmas | `reports/generate` genérico, `planning` básico | Builder informe mensual CMCI + endpoint compose + print view |
| 8 | Semáforo completitud (salud/IDII), filtro incompletos, alertas doctores, ver sin editar | Sin columna completitud | `profile_completeness` calculado + columna + filtro + notificaciones |
| 9 | Pestañas Activos/Egresados + Pendientes/Rechazados | `status` existe (activo/inactivo/egresado/lista_espera) pero sin pestañas/filtros UI ni motivo egreso | UI tabs + `egress_reason/date` + `application_status` |
| 10 | Matrices exportables con encabezado distintivo (general/posibles/única/consolidada/asistencia) | Export genérico `Matriz_Ninos.xlsx` | 5 exports con formato oficial (openpyxl estilos + encabezado) |
| 11 | Captura WhatsApp conversacional de fichas | `PostulacionAgent` genérico, sin mapeo a 33+7 campos | Mapear wizard a campos fichas + validación + alertas pendientes |
| 12 | Modelo ligero ML puntaje automático | Solo reglas deterministas | Añadir calibrador ML ligero (ver §5) con fallback determinista |
| 13 | Multi-centro `cmci_id` (Bahía/Guasmo/Orquídeas) + RBAC + corte día 24 + recordatorios | `tenant_id` existe pero sin `cmci_code` BH/GU/OR ni jobs día 24 | Añadir `cmci_code`, cron cierre, notificaciones |
| 14 | Fechas por niño (valoración, nacimiento, periodo informe) | Parcial | Estandarizar `assessed_at, birth_date, period_start/end` en todas las vistas/print |

---

## 5. DECISIÓN TÉCNICA: MOTOR DETERMINISTA + MODELO LIGERO (no solo ML)

**No reemplazar fórmulas por ML puro.** El Excel de Javier es norma validada ante donante (DASE/MDH): el puntaje debe ser reproducible y auditable. El ML va como **capa de calibración/detección** sobre el motor determinista.

**Arquitectura propuesta (`backend/modules/early-childhood/services/scoring/`):**
```
scoring/
├── vulnerability_engine.py   # replica exacta §3.1: 33 indicadores, D/4*W, F78, F80-F84, G88-G97, Y/Z ranking
├── socioeconomic_engine.py   # replica exacta §3.2: E18/E19/E29-E31, B54-B58, B62-B68, E62 SUMPRODUCT, E63
├── params_store.py           # lee scoring_params (pesos, rangos, umbrales, cortes) — equivale a hoja PARÁMETROS, editable por admin
├── ml_calibrator.py          # modelo ligero: regresión logística / LightGBM tiny o sklearn Ridge (<=50KB), features = 8 subtotales D1-D8 + per-cápita + dependencia + hacinamiento + alertas; target = prioridad/nivel histórico comité; salida = proba + SHAP-lite (top-3 factores)
└── explain.py                # traza: por indicador (respuesta, score 0-4, peso global, aporte) + comparativa determinista vs ML
```
- **Entrenamiento:** con `BASE DE DATOS` histórica (cuando haya 100+ valoraciones con decisión comité Admitida/No admitida/Lista espera). Si <100 casos, ML en modo `shadow` (solo sugiere, no decide). Serializar `joblib` <200KB, inferencia <10ms, sin GPU, versionado `ml_model_version` en cada predicción.
- **Uso en comité (10 cupos vs 50 carpetas):** ranking primario determinista Y/Z; ML como segunda columna `ml_priority_proba` + `ml_top_factors` para desempatar y detectar sesgos (ej. ficha con puntaje medio pero alerta latente).
- **Inventario datos:** script `scripts/import_cmci_excels.py` lee ambos Excels (openpyxl) → `vulnerability_assessments` + `socioeconomic_assessments` + `scoring_params` (seed desde PARÁMETROS) → valida con PRUEBAS (5 casos deben dar OK).

---

## 6. PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 0 — Congelar norma + seed (1-2 días)
- [ ] Copiar Excels a `backend/modules/early-childhood/seeds/cmci/` (solo lectura). Extraer PARÁMETROS a `seeds/cmci_params_v1.json` (pesos, rangos, umbrales, opciones 0-4, cortes 600/300, CanastaRef 220).
- [ ] Tablas nuevas (migración Alembic + `db.create_all` fallback): `cmci_centers(id, code BH/GU/OR, name, coverage_total 72, parish, district)`, `vulnerability_assessments(id, child_id, center_id, code, assessed_at, birth_date, age_months, in_range, answers JSONB 33, scores JSONB, subtotals D1-D8, total, level, semaphore, protection_alert, priority, childcare_need, alerts JSONB, status, ml_proba, ml_version, created_by)`, `socioeconomic_assessments(id, child_id, ..., incomes JSONB, expenses JSONB, per_capita, expense_ratio, coverage_services, dependency, subscores 7, total, classification)`, `scoring_params(scope, key, value JSONB, version)` con scope `global|country:EC|country:XX|center:BH` (sin hardcodear CanastaRef/cortes), `country_configs(country_iso, phone_prefix, phone_example, id_type, id_validation, timezone, currency)` (seed `EC: 593, cedula modulo-10, America/Guayaquil, USD`), `document_templates(id, title, category 15 docs, file_url, version)`, `monthly_reports(id, educator_id, center_id, period_start/end, payload JSONB, conclusions_auto, educator_notes 500w, status, pdf_url)`, alter `children` (+`egress_reason/date`, `profile_completeness`), `applications` (+`committee_decision`), alter `tenants/licenses` (+`country_iso` default EC, `timezone`).
- [ ] Quitar `unique` en `VulnerabilityForm.child_id` (mantener tabla legacy solo lectura) — histórico por `assessed_at`.
- [ ] Criterio Done: `pytest tests/test_cmci_engines.py` con 5 casos PRUEBAS en verde.

### FASE 1 — Motores deterministas + API (3-5 días)
- [ ] `vulnerability_engine.compute(answers, params)` → implementa §3.1 al pie (incluye D36 máx 3, I3.1 asimétrico, F82 `ANY>=3`, F84 sobre G51/20). `socioeconomic_engine.compute(...)` → §3.2 (incluye B64/B65/B68 con catálogos exactos).
- [ ] Endpoints: `POST /api/cmci/vulnerability/compute` (preview sin guardar), `POST /api/cmci/vulnerability` (guarda nuevo registro), `GET /api/cmci/vulnerability?child_id&center_id&status`, `GET /api/cmci/vulnerability/<id>`, `GET /api/cmci/priorizacion?center_id&from&to` (orden Y/Z + paginación), `GET /api/cmci/dashboard` (conteos E5/I5/D9-D13/D17-D19/E22/D25-D28), `POST /api/cmci/socioeconomic/*` espejo, `GET /api/cmci/params` + `PUT /api/cmci/params` (solo license_admin, audita versión), `POST /api/cmci/import-excels` (carga BASE DE DATOS histórica).
- [ ] Validaciones por `country_config` (nunca hardcode EC): edad `DATEDIF` + rango configurable por país/programa (EC CMCI 12-42); ID según `id_validation` del país (`EC:cedula modulo-10`, otros: estrategia por país); teléfono E.164 según `phone_prefix` del país (`EC:593`, reutiliza fix WA LID) con fallback configurable; `cmci_id/site_code` inyectado desde JWT (`WHERE site=tenant`) + IDOR middleware.
- [ ] Done: colección Postman + `verify_api_fix.py` extendido.

### FASE 2 — Modelo ligero ML shadow (2-3 días, en paralelo a Fase 3)
- [ ] `ml_calibrator.py`: sklearn `LogisticRegression(class_weight=balanced)` o `HistGradientBoosting(max_iter=100, max_depth=3)` — features 12 numéricas (D1-D8, per_capita_ratio, dependencia, hacinamiento, n_alertas). Train `scripts/train_cmci_calibrator.py` con histórico comité; guarda `models/cmci_calibrator_v1.joblib` + `metrics.json` (AUC, calibration). Si n<100 → modo shadow (no exponer decisión, solo log).
- [ ] Endpoint `GET /api/cmci/vulnerability/<id>/ml-explain` → `{ml_priority_proba, top3_factores, determinista_total, delta}`. UI muestra como insignia secundaria, nunca sustituye semáforo oficial.
- [ ] Done: inferencia p95 <20ms, modelo <500KB, test `test_ml_shadow.py`.

### FASE 3 — Frontend fichas + impresión oficial (5-7 días) — PRIORIDAD JAVIER
- [ ] Rutas dashboard: `/admision/ficha-vulnerabilidad/nueva|/[id]`, `/admision/ficha-socioeconomica/nueva|/[id]`, `/admision/priorizacion`, `/admision/dashboard-cmci`, `/biblioteca`, `/informes/informe-mensual`.
- [ ] Formularios wizard por secciones D1-D8 (33 selects con opciones exactas PARÁMETROS) + bloque hogar C19-C23 con cálculo en vivo (per-cápita, dependencia, hacinamiento, edad/rango). Auto-guarda borrador `En proceso`; botón `Guardar valoración` crea registro (equivale a macro Guardar, sin bug Limpiar: botón `Nueva valoración` limpia a defaults).
- [ ] **Print views** (`src/app/(app)/print/...` + `print.css`): `@page {size:A4; margin:12mm}`, `@media print {oculta shell/nav}`, header con logos (GASIBA/DASE/CMCI — `public/logos/`), título `MATRIZ DE VALORACIÓN DE VULNERABILIDAD FAMILIAR — CMCI`, bloques A-F idénticos al Excel (identificación, hogar, matriz por dimensiones con puntaje/peso/aporte, consolidado con semáforo color E165:E169, alertas, resumen, observaciones, firmas educadora/coordinadora + fecha). Igual para socioeconómica (bloques ingresos/egresos/indicadores/puntaje) e informe mensual. Botón `Imprimir / Guardar PDF` → `window.print()` (usa diálogo sistema → PDF con diseño). Cada print lleva `Código + Fecha valoración + Periodo` por niño (requisito fechas).
- [ ] Priorización tabla ordenada por Z con columnas Código/Niño/Edad/CMCI/Fecha/Total/Nivel/Prioridad/Alerta/Estado + export Excel con estilos oficiales (openpyxl: encabezado distintivo por matriz para no confundir general/posibles/única). Dashboard CMCI con conteos + semáforo + por centro.
- [ ] Biblioteca: grid 15 plantillas con `Descargar en blanco` (no visor pesado). Registro: tabs `Activos|Egresados|Todos` + columna `Completitud` (rojo/verde salud+IDII) + filtro incompletos + `Ver ficha` (read-only) separado de `Editar`.
- [ ] Done: prueba impresión en Chrome → PDF 1-2 págs, logos visibles, colores semáforo, firmas; Lighthouse sin regresión.

### FASE 4 — Informe mensual auto + matrices + alertas (3-5 días)
- [ ] Builder `monthly_report_service.compose(educator_id, period_start/end)`: jala `plannings` (4 semanas, ámbitos+fases), `attendance`, 9 niños (`assigned_educator_id`), casos riesgo, capacitaciones, talleres familia; `conclusions_auto` = template con agregados (asistencia %, hitos, alertas) + LLM solo para redactar (PostulacionAgent tono, máx 500 palabras campo editable aparte). Guarda `monthly_reports` + print view firmable.
- [ ] Exports: `GET /api/cmci/export/matriz-general|posibles|unica|consolidada|asistencia?center_id&from&to` (xlsx con encabezado + fecha corte + filtros aplicados). Cron `day 22 08:00 America/Guayaquil`: notifica cierre día 24 (coordinadoras+educadoras+doctores), `day 24 23:59` congela periodo (snapshot). Alerta incompletos a doctores (deadline 1-oct configurable).
- [ ] WhatsApp wizard: mapear 33+7 preguntas a `conversational_prompt` en `ProgramFormDefinition` (reutiliza `_validate_field_value` + cédula/fechas/rangos), educador ve `pendientes` y valida. Normalización teléfonos 593.
- [ ] Done: informe de prueba con periodo 03/04-03/06 impreso + export matriz única descargado por Javier.

### FASE 5 — Endurecimiento multicentro + go-live (2-3 días)
- [ ] `cmci_code` BH/GU/OR en JWT + filtro SQL forzado + RBAC matriz espec técnica (Central global, Coordinadora revisa/aprueba en papel impreso, Educadora crea, Auxiliar apoyo, Catering menú). Rate-limit auth 5/min/IP, TLS 1.3, AES-256 cédulas/expedientes (según §6.2). Async reportes pesados: `202 Accepted + task_id` → Redis/Celery o fallback thread + SSE (`sse_manager.py` ya existe) → descarga.
- [ ] Capacitación: videos pantalla (acceso correo, link, crear usuarios, imprimir informe), alta masiva educadoras pre-miércoles, depuración 09→593, mensajes WA a padres con código/link.
- [ ] Corte 24-oct: congelar, imprimir expedientes (fichas con diseño oficial), entregar donante. Métrica eficiencia nutricional `(ingesta_real/cobertura_total)*100` (ej. 68/72=94.44%) para catering si aplica.
- [ ] Done: checklist pre-cierre en verde, backup DB, `pm2 status` + `curl /health` OK.

---

## 7. MAPEO EXCEL → CÓDIGO (trazabilidad para auditoría)

| Excel | Celda/fórmula | Código |
|---|---|---|
| VULN PARÁMETROS F6:F13, F14/G14 | pesos dimensiones + check 100 | `scoring_params: vuln.dim_weights`, `params_store.validate()` |
| VULN PARÁMETROS E18:E50, E51, E53:E60 | pesos globales + checks | `vulnerability_engine.global_weights()`, test `test_weights_sum_100` |
| VULN PARÁMETROS F64:F161 | opciones 0-4 | `scoring_params: vuln.options[{id,text,score}]`, validación select estricto |
| VULN PARÁMETROS B165:E169, B173:D175, B179:B192 | rangos, prioridades, umbrales | `scoring_params: vuln.ranges/priorities/thresholds` (editable admin, versionado) |
| VALORACIÓN C9/G9 | DATEDIF + rango 12-42 | `utils.age_months()` + `in_range` |
| VALORACIÓN C28/D28, C31/D31, C36/D36, C54/D54 | calculados per-cápita/dependencia/NNA/hacinamiento | `vulnerability_engine.auto_indicators()` |
| VALORACIÓN D=SUMIFS, G=D/4*F, G33...G75 | puntajes + ponderados + subtotales | `vulnerability_engine.score_row()` |
| VALORACIÓN F78-F84, G88-G97, D100-D107 | consolidado + alertas + resumen | `vulnerability_engine.consolidate()` |
| BASE P-Z | total/nivel/prioridad/alerta/necesidad/semáforo/Y/Z | `vulnerability_engine.persist_row()` + `ranking()` |
| PRIORIZACIÓN / DASHBOARD / PRUEBAS | espejo ordenado / conteos / 5 casos | `api priorizacion/dashboard` + `tests/test_cmci_engines.py::test_pruebas_5_casos` |
| SOCIO E18/E19/E29-E31, B54-B58, B62-B68, E62/E63 | ingresos/per-cápita/gastos/indicadores/subpuntajes/total/clasif | `socioeconomic_engine.*` |
| SOCIO PARAMETROS B4:B10, D4:F6, B25:B28 | pesos / rangos invertidos / umbrales | `scoring_params: socio.*` |

---

## 8. RIESGOS Y DECISIONES ABIERTAS PARA JAVIER

1. **Socioeconómica aún prototipo** (sin macros, B9 edad manual — se implementa DATEDIF como vulnerabilidad) — B64/B65/B68 **resueltos en §10.1 con fórmulas literales**; se congela v2 versionada; cualquier cambio de cortes 600/300 requiere re-validación comité.
2. **CanastaRef 220 ilustrativo** — actualizar con INEC vigente antes del corte 24-oct o el per-cápita D28 se descalibra.
3. **I3.1 asimétrico** (sin búsqueda=1 < informal=2) y **D36 máx 3** — se replica tal cual; no "corregir" sin aprobación Javier (altera histórico).
4. **No subir escaneos pesados** — Biblioteca solo plantillas; si a futuro se quiere expediente digital click-to-view, estimar S3/R2 aparte (Hostinger se llena).
5. **Discrepancia puertos/URLs WA** (§1.4) — unificar a `BACKEND_URL + /webhooks/whatsapp` antes de go-live.

---

## 9. CRITERIOS DE ACEPTACIÓN (demo a Javier)

- [ ] Crear valoración vulnerabilidad de un niño 12-42m → total/nivel/semáforo/prioridad idénticos al Excel (comparativa lado a lado, 5 casos PRUEBAS en OK).
- [ ] `Imprimir` ficha → PDF A4 con logos, colores semáforo, resumen y firmas (igual diseño Excel).
- [ ] Priorización ordenada + Dashboard con conteos por nivel/prioridad/CMCI + export matrices con encabezado distintivo.
- [ ] Ficha socioeconómica con per-cápita/SUMPRODUCT/clasificación + print.
- [ ] Informe mensual generado desde planificaciones + periodo editable + campo 500w + conclusiones auto + print firmable.
- [ ] Tabs Activos/Egresados + Pendientes/Rechazados, columna completitud con semáforo, filtro incompletos.
- [ ] ML en shadow: proba + top-3 factores visibles sin alterar decisión oficial.
- [ ] Corte 24-oct simulado: recordatorio día 22, congelado día 24, expedientes listos para donante.

*Generado por análisis automatizado del repo + Excels (openpyxl, fórmulas exactas) + transcripción Meet 61 pág. + espec técnica 14 pág. Mantener este .md como contrato funcional; cualquier cambio a fórmulas exige nueva versión de `scoring_params` + validación de Javier (aprobación funcional, no firma electrónica).*

---

## 10. ADDENDUM REPASO FINAL (2026-09-27) — lo que faltaba y se corrige

Repaso completo de `2_CENTRO-INFANTIL-DOCUMENTACION-EJEMPLOS/`, VBA, `page_setup` y espec técnica. Hallazgos que el plan v1 no cubría y quedan incorporados:

### 10.1 Fórmulas socioeconómicas completas (corrige truncados §3.2)
- `B64 =IF(OR(E42="Empleo formal",E42="Jubilado/a"),100,IF(OR(E42="Empleo informal",E42="Trabajo independiente"),60,20))`
- `B65 =IF(OR(B42="Propia",B43="Casa",B43="Departamento"),100,IF(OR(B42="Arrendada",B42="Prestada/Cedida",B42="Anticresis"),60,20))`
- `B68 =IF(OR(E43="Bachillerato completo",E43="Técnico/tecnológico",E43="Universitario",E43="Posgrado"),100,IF(E43="Sin escolaridad",20,60))`
- `BASE_DATOS` fila 4 es espejo vivo del registro: `A4=IF(REGISTRO!B4="","",REGISTRO!B4)`, `B4..P4 =IF(A4="","",REGISTRO!B5/B6/B7/B11/E4/E18/E29/E19/B55/B56/B57/E42/E62/E63/E64)` — el backend debe replicar este espejo (una valoración = una fila histórica, nunca sobreescribir).
- Acción: `socioeconomic_engine` debe implementar B64/B65/B68 literales (no simplificar "formal=100" genérico) y test `test_socio_B64_B65_B68`.

### 10.2 Informes TTHH son 4 roles, no solo educadora
`GESTIÓN TTHH/` contiene: `1_INFORME DE ACTIVIDADES` (técnico coord + trabajadora social + asistente administrativo + auxiliar párvulos + 8 educadoras: Arroyo, Barzola, Franco, Jiménez, Pérez, Quimi, Rodríguez, Saltos), `2_REGISTRO DE ASISTENCIAS` (coordinadora/educadoras, trabajadora social, asistente), `3_PLANIFICACIONES LÚDICAS` (8 PDFs abril-junio), `4_REPORTE DASE` (cronogramas semanales 4-8 mayo → 1-5 junio, xlsx+pdf), `5_FACTURAS` (abril-mayo, mayo-junio por persona).
- Corrección FASE 4: builder `monthly_report_service` debe soportar tipos `educadora | auxiliar | trabajo_social | coordinacion | asistente` con plantillas distintas (la de educadora lleva planificaciones; la de auxiliar lleva rutinas cuidado/higiene Módulo E; la de trabajo social lleva visitas/informes). No generalizar a un solo formato.

### 10.3 Gestión alimentación = Módulo D completo (faltaba detalle)
`GESTIÓN DE ALIMENTACIÓN/`: `1_INFORME MENSUAL`, `2_FICHA DIARIA RECEPCIÓN`, `3_MENÚ SEMANAL`, `4_MATRIZ ASISTENCIA (xlsx+pdf 03abr-02may)`, `5_REGISTRO ASISTENCIAS abr-jun`.
- Reglas a implementar (espec §4.1-4.2): `Aporte CMCI=75% en 4 tiempos (desayuno/refrigerio/almuerzo/lunch)`, `Hogar=25%`; `Eficiencia=(ingesta_real/cobertura_total)*100` (ej. 68/72=94.44%) diaria y consolidada mensual para pago catering; control organoléptico diario (olor/color/sabor Conforme-NoConforme, aceptabilidad Excelente/Buena/Regular/Mala) + 2 entregas (07:00 desayuno+fruta, 11:00 almuerzo+colada) + `cumplió_menú Sí/No + novedades`.
- Acción: añadir a FASE 4 endpoints `nutrition/intake` + print matriz ingesta + export para DASE.

### 10.4 Fichas IDII / médicas / postulación (carpeta USUARIOS 6/7/8)
- `6_FICHAS IDII`: 2 tomas (benef. ago-feb, egresos abr-jun) — el sistema debe versionar tomas 1ra/2da por niño y marcar egresos.
- `7_VALORACIONES MÉDICAS`: 2 tomas idénticas — alimenta semáforo completitud (peso/talla) y deadline doctores.
- `8_FICHAS DE POSTULACIÓN`: `FICHAS DE POSTULACION.pdf` plantilla — va a Biblioteca como doc #2 (ver §10.6).
- Acción: `profile_completeness` = `tiene_valoracion_vuln && tiene_socioeconomica && tiene_idii_toma_vigente && tiene_valoracion_medica_toma_vigente && tiene_postulacion`.

### 10.5 VBA + impresión (evidencia física)
- `.xlsm` contiene `xl/vbaProject.bin` (macros Guardar→append fila a BASE con `Z=ranking`, Limpiar→reset VALORACIÓN a defaults; Limpiar con bug reportado) + `xl/printerSettings/*.bin`. `page_setup`: VALORACIÓN portrait A4 (paper 9), BASE landscape A4, sin `print_area`/`print_titles` definidos → el diseño de impresión vive en anchos de columna + logos embebidos, no en área configurada.
- Acción FASE 3: no intentar extraer VBA binario; reimplementar Guardar (=POST crea registro) y Nueva (=reset frontend). Definir en CSS `@page A4 portrait` para fichas y `landscape` para priorización/matrices. Extraer logos del Excel (`openpyxl` images / `xl/media/`) a `frontend/dashboard/public/logos/` antes de maquetar print.

### 10.6 Biblioteca: lista cerrada de 15 plantillas (no genérica)
1 protocolo requisitos ingreso, 2 ficha postulación, 3 ficha CDP, 4 ficha socioeconómica (blanco), 5 ficha vulnerabilidad (blanco), 6 informe técnico visita, 7 acta compromiso/corresponsabilidad, 8 consentimiento informado, 9 autorización imagen, 10 ficha IDII, 11 historia clínica, 12 monitoreo nutricional + curvas, 13 ficha diaria alimentación, 14 menú semanal, 15 informe mensual (por rol). Cada una con `versión + fecha vigencia + centro aplicable`.
- Acción FASE 3: tabla `document_templates` con estas 15 categorías fijas (enum, no libre).

### 10.7 Cobertura + RBAC (sin firma electrónica — firma física en papel impreso fuera del sistema)
- Cobertura: 72/centro, 9 niños/educadora. Roles: Coordinador_General, Coordinadora_Centro, Educadora, Auxiliar_Párvulos, Auxiliar_Servicios, Catering (solo carga menú), Central DASE/MDH (global). La validación/aprobación es firma física sobre el documento impreso, fuera del sistema; no se implementa firma electrónica.
- Acción FASE 5: verificación IDOR `tenant==cmci` + `202 Accepted` para reportes pesados (ya previsto). Sin tabla `signatures`, sin endpoint de firma, sin microservicio de firma.

### 10.8 Gobierno del dato (faltaba)
- `scoring_params` versionado (`v1_validada_2026-09-25` inmutable; cambios → `v2` + re-cómputo bajo demanda, nunca reescribe histórico). Backup pre-corte 24 + snapshot periodo congelado (solo lectura). Actualizar `CanastaRef` con INEC vigente antes de cada convenio; si cambia, comité valida nueva versión (sin firma electrónica).
- Criterio aceptación añadido: comparativa Excel-vs-sistema en los 5 casos PRUEBAS + 2 casos reales Javier (750/8 integrantes→61.1 alta naranja; 2500/2 integrantes→baja) con diff 0.00.

Estándar integral global (sin cinta): migraciones Alembic versionadas, sin duplicar blueprints/lógica legacy, cero hardcodes de país (593/cédula/CanastaRef solo viven en `country_configs`+`scoring_params` con scope; default EC), validación estricta selects/edad/ID/teléfono por país, tests 5 PRUEBAS + 2 casos Javier + 1 caso país_dummy (prefijo distinto, otro ID, otra moneda) en verde, print/download A4 como única salida formal (sin firma electrónica en sistema). Documentos quedan listos para imprimir y descargar; la firma es física en papel fuera del sistema.

Sí, tengo claro qué hacer y qué se necesita: replicar fórmulas literales (§3 + §10.1), histórico por registro, impresión/descarga A4 oficial, informe multi-rol, matrices con encabezado distintivo, ML shadow, multicentro BH/GU/OR con corte 24. Nada del plan v1 se elimina; §10 lo completa.
