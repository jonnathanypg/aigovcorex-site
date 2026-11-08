# 🏛️ AI GOVCOREX OS: COMPENDIO MAESTRO DE ARQUITECTURA, COMPLIANCE AGÉNTICO Y GOBIERNO DIGITAL

> **Documento Canónico Unificado**  
> **Versión del Sistema:** AI GovCoreX OS 2.5 (Producción VPS Ubuntu AMD EPYC, 8 vCPUs, 23 GB RAM)  
> **Fecha de Consolidación:** Noviembre 2026  
> **Arquitectura:** Monorepo Modular Multi-Servicio (B2G Compliance & GovTech)  
> **Stack Base:** Next.js 14 (App Router) + Python Flask / Gunicorn / LangGraph + Node.js (Baileys WhatsApp Voice Gateway) + MariaDB (`kindicore`) & MySQL Remota + Nginx SSL  

---

## 📑 ÍNDICE MAESTRO

1. [Visión General, Manifiesto y Modelo de Negocio B2G](#1-visión-general-manifiesto-y-modelo-de-negocio-b2g)
2. [Evolución Histórica y Fases de Desarrollo](#2-evolución-histórica-y-fases-de-desarrollo)
3. [Topología de Infraestructura, VPS y Orquestación PM2](#3-topología-de-infraestructura-vps-y-orquestación-pm2)
4. [Arquitectura de Red, Dominios y Capa Nginx](#4-arquitectura-de-red-dominios-y-capa-nginx)
5. [Capa de Frontend: Portal B2G y Dashboard Operativo](#5-capa-de-frontend-portal-b2g-y-dashboard-operativo)
6. [Capa de Backend: Módulos, Blueprints y Servicios](#6-capa-de-backend-módulos-blueprints-y-servicios)
7. [Arquitectura de Datos, Multi-Tenancy y Modelos ORM](#7-arquitectura-de-datos-multi-tenancy-y-modelos-orm)
8. [Ecosistema de Agentes de IA, LangGraph, RAG y Compliance](#8-ecosistema-de-agentes-de-ia-langgraph-rag-y-compliance)
9. [Ingesta de Voz WhatsApp y Procesamiento en Tiempo Real](#9-ingesta-de-voz-whatsapp-y-procesamiento-en-tiempo-real)
10. [Módulo CMCI: Fichas Oficiales, Fórmulas e Impresión A4](#10-módulo-cmci-fichas-oficiales-fórmulas-e-impresión-a4)
11. [Auditoría del Sistema, Seguridad PII, Deuda Técnica y Estado de Bugs](#11-auditoría-del-sistema-seguridad-pii-deuda-técnica-y-estado-de-bugs)
12. [Hoja de Ruta Estratégica: Spark, Big Data y Nuevos Módulos](#12-hoja-de-ruta-estratégica-spark-big-data-y-nuevos-módulos)
13. [Políticas de Desarrollo, Invariantes de Código y Reglas de Git](#13-políticas-de-desarrollo-invariantes-de-código-y-reglas-de-git)
14. [Índice de Documentación Modular Complementaria](#14-índice-de-documentación-modular-complementaria)

---

## 1. VISIÓN GENERAL, MANIFIESTO Y MODELO DE NEGOCIO B2G

### 1.1 El Manifiesto de AI GovCoreX
**AI GovCoreX** es el Sistema Operativo Agéntico de Cumplimiento y Auditoría en tiempo real para el sector público (GovTech / RegTech B2G). Está diseñado para **transformar notas de voz, interacciones de campo y planificaciones sociales en registros inalterables**, trazables y listos para auditorías fiscales y regulatorias en programas sociales gubernamentales.

En los programas gubernamentales y de asistencia social (como la primera infancia y el cuidado de adultos mayores), los equipos en territorio invierten hasta un 40% de su jornada laboral en rellenar formularios manuales y transcripciones. AI GovCoreX elimina esta fricción permitiendo que las educadoras y trabajadoras sociales interactúen mediante notas de voz de WhatsApp o interfaces web optimizadas; el sistema agéntico interpreta, valida según normativas, clasifica y genera fichas de cumplimiento certificadas.

### 1.2 Modelo de Negocio B2G y Propuesta de Valor
- **Licenciamiento por Entidad / GAD / Municipio:** Esquema multi-tenant con aislamiento estricto de datos por `tenant_id` y roles granulares (`super_admin`, `license_admin`, `coordinator`, `educator`, `auditor`).
- **Acreditación de Cumplimiento:** Emisión automática de reportes mensuales consolidados, fichas técnicas de vulnerabilidad socioeconómica y cronogramas normativos con firmas de responsabilidad listas para imprimir en formato A4 estándar.
- **Trazabilidad Forense:** Registro inmutable de cada inferencia, modificación y asistencia en Langfuse y base de datos con timestamps UTC.

---

## 2. EVOLUCIÓN HISTÓRICA Y FASES DE DESARROLLO

### 📅 Fase 1: Núcleo Agéntico y KindiCore AI (Q1-Q2 2026)
- Creación de la arquitectura monorepo modular.
- Implementación del módulo de Primera Infancia (`backend/modules/early-childhood`) con Flask y LangGraph.
- Orquestación del grafo multi-agente con 8 subagentes (`sql_analyst`, `planner`, `compliance`, `attendance`, etc.) y 48 tools especializadas.
- Despliegue del Gateway de WhatsApp Voice en Node.js/TypeScript con Baileys.

### 📅 Fase 2: Portal Matriz y Dashboard Unificado (Q3 2026)
- Desarrollo del Portal Institucional B2G ([`frontend/portal`](file:///root/aigovcorex/frontend/portal)) en Next.js 14 (Puerto 3002) para captación y presentación institucional.
- Desarrollo del Dashboard Operativo ([`frontend/dashboard`](file:///root/aigovcorex/frontend/dashboard)) en Next.js 14 (Puerto 9002) con diseño tipo OS Shell (`os-shell-layout.tsx`).
- Integración de autenticación JWT híbrida, selectores inteligentes de centros y navegación modular (`os-modules.ts`).

### 📅 Fase 3: Estandarización CMCI, Fichas A4 y Validación LEM (Q4 2026)
- **Código Unificado Compartido:** Generación estandarizada `FICHA-{CENTRO}-{AÑO}-{ID:03d}` uniendo Ficha de Vulnerabilidad y Ficha Socioeconómica.
- **Impresión A4 Fiel a la Norma:** Vistas de impresión pixel-perfect en CSS con diagramación oficial para fichas socioeconómicas, vulnerabilidad y cronogramas mensuales.
- **Validación Cédula Ecuador:** Ajuste estricto a 10 dígitos numéricos (`/^\d{10}$/`) sin bloqueos por fórmulas rígidas obsoletas.
- **Expansión a Programas Sociales:** Activación del módulo `backend/modules/social` para beneficiarios y postulaciones de programas complementarios.

---

## 3. TOPOLOGÍA DE INFRAESTRUCTURA, VPS Y ORQUESTACIÓN PM2

### 3.1 Especificaciones del Servidor
- **Servidor:** Contabo VPS Ubuntu 24.04 LTS (AMD EPYC, 8 vCPUs, 23 GB RAM, 387 GB SSD).
- **Procesos PM2:** Ejecutados bajo el usuario root con autoarranque systemd (`pm2-root.service`).

### 3.2 Clúster PM2 (`ecosystem.config.js`)
| Proceso PM2 | Directorio | Runtime | Puerto | Función |
|---|---|---|---|---|
| **`aigovcorex-portal`** | `frontend/portal` | Next.js (Node 20+) | `3002` | Portal público institucional (`aigovcorex.com`) |
| **`aigovcorex-dashboard`** | `frontend/dashboard` | Next.js (Node 20+) | `9002` | Dashboard operativo GovTech (`app.aigovcorex.com`) |
| **`aigovcorex-backend`** | `backend/modules/early-childhood` | Python Gunicorn (4w, 4t) | `5000` | API REST, SSE streaming y orquestación LangGraph |
| **`aigovcorex-whatsapp`** | `services/whatsapp-voice` | Node.js / Baileys | `3001` | Ingesta y transcripción de notas de voz WhatsApp |

```
┌────────────────────────────────────────────────────────────────────────┐
│                              VPS UBUNTU                                │
│                                                                        │
│  ┌───────────────────────┐           ┌──────────────────────────────┐  │
│  │ aigovcorex-portal     │           │ aigovcorex-dashboard         │  │
│  │ Next.js 14 (:3002)    │           │ Next.js 14 (:9002)           │  │
│  └──────────┬────────────┘           └──────────────┬───────────────┘  │
│             │                                       │                  │
│             └───────────────────┬───────────────────┘                  │
│                                 ▼                                      │
│             ┌───────────────────────────────────────┐                  │
│             │ Nginx Reverse Proxy (SSL Let's Encrypt)│                 │
│             │ aigovcorex.com / app.aigovcorex.com   │                  │
│             └───────────────────┬───────────────────┘                  │
│                                 │                                      │
│             ┌───────────────────┴───────────────────┐                  │
│             ▼                                       ▼                  │
│  ┌───────────────────────┐           ┌──────────────────────────────┐  │
│  │ aigovcorex-backend    │◀──────────│ aigovcorex-whatsapp          │  │
│  │ Flask / Gunicorn :5000│           │ Baileys / Node.js :3001      │  │
│  └──────────┬────────────┘           └──────────────────────────────┘  │
│             │                                                          │
│             ▼                                                          │
│  ┌───────────────────────┐                                             │
│  │ MariaDB local (:3306) │                                             │
│  │ Base: kindicore       │                                             │
│  └───────────────────────┘                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ARQUITECTURA DE RED, DOMINIOS Y CAPA NGINX

Configuración centralizada en `/etc/nginx/sites-available/aigovcorex`:
- **`https://aigovcorex.com` & `www.aigovcorex.com`:**
  - `/` → Proxy a `http://127.0.0.1:3002` (Portal Next.js).
  - `/api/` → Proxy a `http://127.0.0.1:5000/api/` con `proxy_buffering off` y timeouts de 300s para Server-Sent Events (SSE).
  - `/whatsapp/` → Proxy a `http://127.0.0.1:3001/` para webhook y emparejamiento QR.
  - `/static/` → Servido directamente por Flask `:5000` con caché de 7 días.
- **`https://app.aigovcorex.com` & `dashboard.aigovcorex.com`:**
  - `/` → Proxy a `http://127.0.0.1:9002` (Dashboard Next.js).
  - `/api/` → Proxy a `http://127.0.0.1:5000/api/` con streaming de IA sin buffer.
  - `/health` → Chequeo de salud hacia `http://127.0.0.1:5000/health`.

---

## 5. CAPA DE FRONTEND: PORTAL B2G Y DASHBOARD OPERATIVO

### 5.1 Portal Matriz Institucional (`frontend/portal`)
- Diseñado para tomadores de decisiones gubernamentales, ministros, directores de GADs y organismos internacionales.
- Secciones de captura de leads VIP Beta, calculadora de ahorro operativo y presentación de cumplimiento normativo.

### 5.2 Dashboard Operativo (`frontend/dashboard`)
- **Arquitectura OS Shell:** Interfaz unificada en `os-shell-layout.tsx` con soporte multi-módulo (`os-modules.ts`):
  - **Operaciones:** Dashboard analítico, Registro de Niños, Admisión, Asistencia en tiempo real y Biblioteca Documental.
  - **Valoración CMCI:** Ficha de Vulnerabilidad, Ficha Socioeconómica, Priorización de cupos y Métricas de impacto.
  - **Programas Sociales:** Gestión de beneficiarios, postulaciones y nuevos programas sociales.
- **Búsqueda y Vinculación Inteligente:** Componente `<ChildSearchSelect>` obligatorio que ejecuta coincidencia difusa de nombres, normalización NFD sin acentos y asignación automática del centro mediante `findMatchingCmci`.
- **Biblioteca Documental:** Acceso a plantillas normativas para educadoras y panel de gestión de archivos para administradores de licencia.

---

## 6. CAPA DE BACKEND: MÓDULOS, BLUEPRINTS Y SERVICIOS

### 6.1 Módulos Activos
1. **`backend/modules/early-childhood` (KindiCore AI):**
   - Motor principal con más de 35 blueprints Flask y 245 endpoints.
   - Factory pattern en `app.py:create_app()`.
   - Blueprints clave: `api/children.py`, `api/cmci.py`, `api/planning.py`, `api/social_programs.py`, `api/whatsapp_webhook.py`.
2. **`backend/modules/social`:**
   - Módulo para extensión a familias en extrema pobreza, adulto mayor y transferencias monetarias condicionadas.
3. **`backend/common`:**
   - Servicios transversales de auditoría, identidad, cálculo de hashes y validación LEM (`lem_guard.py`).

---

## 7. ARQUITECTURA DE DATOS, MULTI-TENANCY Y MODELOS ORM

### 7.1 Motor de Base de Datos
- **Motor:** MariaDB 10.11 local en puerto 3306 (Base de datos: `kindicore`).
- **ORM:** SQLAlchemy con soporte multi-tenant obligatorio.
- **Contexto de Seguridad:** `TenantContext.get_current_user()` y `resolve_tenant_ids()` aseguran que ningún usuario acceda a registros ajenos a su jurisdicción.

### 7.2 Modelos Principales
- **`Tenant`:** Entidad gubernamental o GAD titular de la licencia.
- **`Child` (`models/child.py`):** Expediente integral del menor (cédula 10 dígitos, datos biométricos, estado de desnutrición, código unificado `FICHA-*`).
- **`CmciVulnerabilityRecord` & `CmciSocioeconomicRecord`:** Registros de valoración con puntuaciones ponderadas.
- **`Attendance` & `DailyPlan`:** Asistencia diaria y planificaciones pedagógicas por grupo etario.
- **`SocialProgram` & `SocialBeneficiary`:** Programas de asistencia y expedientes familiares.

---

## 8. ECOSISTEMA DE AGENTES DE IA, LANGGRAPH, RAG Y COMPLIANCE

### 8.1 Orquestador Agéntico (`agents/langgraph_orchestrator.py`)
Grafo de decisión modular ejecutado con LangGraph que enruta las peticiones de voz o texto entre 8 agentes especialistas:
- **`sql_analyst`:** Consultas analíticas en lenguaje natural sobre la base de datos SQL con prompts enmascarados contra inyecciones.
- **`planner`:** Generación y validación de cronogramas y actividades semanales pedagógicas.
- **`compliance`:** Verificación de normativas MIES / CMCI y reglas de admisión.
- **`care_ops` & `management`:** Gestión de incidencias de salud, peso, talla y operaciones del centro.

### 8.2 Observabilidad con Langfuse
- Conexión configurada en `ecosystem.config.js` y `app.py` apuntando al servidor de observabilidad `https://labmonitor.weblifetech.com`.
- Rastreo detallado de tokens, latencias y llamadas a tools por sesión.

---

## 9. INGESTA DE VOZ WHATSAPP Y PROCESAMIENTO EN TIEMPO REAL

### 9.1 Flujo del Microservicio (`services/whatsapp-voice`)
1. Recepción del mensaje o nota de voz OGG/Opus a través del socket Baileys.
2. Descarga del buffer de audio y llamada a servicio de transcripción Whisper / TTS.
3. Despacho HTTP hacia el webhook del backend Flask (`POST /api/webhooks/whatsapp`).
4. Ejecución del pipeline agéntico en `VoiceService` y respuesta sintética o estructurada al usuario vía WhatsApp.

---

## 10. MÓDULO CMCI: FICHAS OFICIALES, FÓRMULAS E IMPRESIÓN A4

### 10.1 Especificación de Fichas Oficiales
- **Ficha de Vulnerabilidad:** Evalúa factores de riesgo biológico, familiar y del entorno con escalas normativas de 0 a 100 puntos.
- **Ficha Socioeconómica:** Evalúa ingresos del hogar, tipología de vivienda, acceso a servicios básicos y dependencia económica.
- **Código Compartido:** Generación instantánea mediante `child-code.ts` en formato `FICHA-{CENTRO}-{AÑO}-{ID:03d}`, garantizando que ambas evaluaciones correspondan al mismo expediente fiscal.
- **Impresión A4 (`print/page.tsx`):** Rutas especializadas con reglas `@media print`, tipografías compactas, saltos de página controlados (`page-break-inside: avoid`) y sellos de firma de directores y educadoras.

---

## 11. AUDITORÍA DEL SISTEMA, SEGURIDAD PII, DEUDA TÉCNICA Y ESTADO DE BUGS

### 11.1 Problemas Corregidos y Verificados
1. **Desincronización de Códigos de Ficha:** Resuelto unificando la lógica en `child-code.ts` y sincronizando en backend con `joinedload(Child.tenant)`.
2. **Validación Bloqueante de Cédula:** Eliminada la restricción rígida que bloqueaba cédulas válidas de provincias ecuatorianas; estandarizado a 10 dígitos numéricos exactos.
3. **Pérdida del Centro al Elegir Niño:** Corregido con el resolver bidireccional `findMatchingCmci` insensible a tildes y diacríticos.

### 11.2 Deuda Técnica y Recomendaciones
- **Enmascaramiento PII:** Implementar políticas de enmascaramiento en logs de producción (`Child.to_dict`) para evitar que números de cédula y nombres viajen en texto plano a agregadores de logs.
- **Migración a Migraciones Declarativas:** Sustituir los scripts `ALTER TABLE` manuales en arranque de Flask por revisiones ordenadas con Flask-Migrate / Alembic.

---

## 12. HOJA DE RUTA ESTRATÉGICA: SPARK, BIG DATA Y NUEVOS MÓDULOS

- **Plan Maestro Spark:** Documentado en [docs/03_plan_maestro_seguridad_spark.md](file:///root/aigovcorex/docs/03_plan_maestro_seguridad_spark.md). Preparación del esquema de datos para agregaciones masivas a nivel provincial y nacional mediante Apache Spark / PySpark.
- **Módulo Salud Comunitaria (`public-health`):** Previsto para brigadas médicas territoriales, cartillas de vacunación y seguimiento de anemia infantil.
- **Integración Banco Digital:** Conexión para validación de cuentas bancarias y dispersión segura de bonos sociales.

---

## 13. POLÍTICAS DE DESARROLLO, INVARIANTES DE CÓDIGO Y REGLAS DE GIT

1. **🛡️ Regla de Oro del VPS:** Nunca detener servicios ajenos al proyecto (`pm2 kill`, `pm2 stop all`). Operar siempre con `--only aigovcorex-*`.
2. **Sincronización Git Obligatoria:** Tras validar cambios en `main`, sincronizar inmediatamente con `dev`:
   ```bash
   git checkout dev && git merge main && git push origin dev && git checkout main
   ```
3. **Prohibido Resolver Conflictos con `--ours / --theirs`** en archivos consolidados de frontend o esquemas de base de datos.
4. **Codebase Memory MCP:** Usar siempre el proyecto `root-aigovcorex` para descubrir símbolos, blueprints y dependencias antes de editar archivos.

---

## 14. ÍNDICE DE DOCUMENTACIÓN MODULAR COMPLEMENTARIA

- 📘 [README.md](file:///root/aigovcorex/README.md) — Manifiesto, arquitectura modular y configuración de inicio.
- 🤖 [AGENTS.md](file:///root/aigovcorex/AGENTS.md) — Políticas de no regresión e invariantes de código.
- 📝 [GEMINI.md](file:///root/aigovcorex/GEMINI.md) — Memoria compartida de desarrollo, directrices operativas y comandos del VPS.
- 🛠️ [CLAUDE.md](file:///root/aigovcorex/CLAUDE.md) — Manual de comandos y directrices para agentes Claude.
- 📁 [docs/](file:///root/aigovcorex/docs/) — Manuales de auditoría, despliegue, planes Spark y documentación CMCI detallada.

---
*Fin del Compendio Maestro — AI GovCoreX OS 2.5 — Noviembre 2026*
