# 📋 AUDITORÍA COMPLETA — ESTADO ACTUAL DEL PROYECTO AI GOVCOREX
**Fecha:** 2026-10-01 | **Commit:** `0a35432` (main) / `3500a1f` (dev) | **Branchs sincronizados:** `main` ↔ `dev` ↔ `origin`

---

## ✅ RESUMEN EJECUTIVO
Despliegue completo y sincronizado de todas las mejoras al módulo **CMCI (Primera Infancia / KindiCore AI)**. Ambos branches `main` y `dev` están alineados con `origin`. Servicios en producción: **backend 200**, **dashboard 307→200**, **portal 3002**, **whatsapp-voice 3001**.

---

## 🏗️ CAMBIOS PRINCIPALES IMPLEMENTADOS

### 1. FICHAS CMCI — CÓDIGO ÚNICO COMPARTIDO + CENTRO CORRECTO
**Archivos:** `src/lib/cmci/child-code.ts` (nuevo), `components/cmci/vulnerability-wizard.tsx`, `components/cmci/socioeconomic-form.tsx`, `services/children.service.ts`, `api/children.py`, `api/cmci.py`

| Problema | Solución |
|----------|----------|
| Vulnerabilidad `FV-*` y Socioeconómica `FS-*` generaban códigos distintos | **Unificado:** `FICHA-{CENTRO}-{AÑO}-{ID:03d}` en ambas fichas |
| Al seleccionar niño, el campo **Centro** quedaba vacío | **Fix:** `findMatchingCmci(centerName, tenantId, CMCI_LIST)` con match por `tenant_id` (memoria) + normalización NFD sin acentos + match bidireccional |
| `center_name` llegaba `None` para license_admin | **Backend:** `joinedload(Child.tenant)` en TODOS los roles + `get_child` eager load tenant |
| Código no se regeneraba al reelegir niño | **Inmediato:** `setCodigo(fallbackCode)` al click, luego corrige con `last_vuln.code \|\| last_socio.code` |

**Resultado:** Mismo niño → mismo código en ambas fichas, centro se selecciona automático al click.

---

### 2. BÚSQUEDA DE NIÑOS — DESDE 1ª LETRA, SIN ACENTOS, RELEVANCIA
**Archivos:** `api/children.py:search_children`, `services/children.service.ts`, ambos formularios

| Mejora | Detalle |
|--------|---------|
| **1 carácter** | Prefijo `X%` en apellido/nombre/cédula (no `%X%`) |
| **Múltiples tokens** | Relevancia: `CASE` prefijo completo → primer nombre → apellido → `else` |
| **Acentos/Unicode** | Frontend: `normalize('NFD').replace(/[\u0300-\u036f]/g,'')` para match `Orquídeas`=`orquideas` |
| **Mapeo `tenant_id`→CMCI** | Memoria `TENANT_ID_TO_CMCI[tenantId]=cmciName` para lookups instantáneos |
| **Placeholder** | "Escribe desde la 1ª letra (filtra por apellido)..." |

---

### 3. FILTRO DE FECHAS PERSONALIZADO — DASHBOARD + MONITOREO
**Archivos nuevos:** `components/dashboard/date-range-filter.tsx`
**Archivos modificados:** `monitoreo/page.tsx`, `dashboard/page.tsx`, `admision/dashboard-cmci/page.tsx`, `services/monitoring.service.ts`, `services/dashboard.service.ts`, `api/monitoring.py`, `api/dashboard.py`

| Componente | Presets | Backend params |
|------------|---------|----------------|
| **Monitoreo** | Mes / 7d / 30d / 90d / Custom | `?from=YYYY-MM-DD&to=YYYY-MM-DD` en KPIs + 4 charts |
| **Dashboard general** | Mismos presets | Stats + RecentAdmissions + DevelopmentChart |
| **Dashboard CMCI** | Mismos presets | Ya soportaba `?from&to` en backend, ahora UI conectada |

**Backend changes:**
- `monitoring.py`: `_parse_date_range()` helper, todos endpoints usan `period_start/period_end` vs `first_of_month` hardcodeado
- `dashboard.py`: `get_stats` + `get_recent_applications` aceptan `from/to`

---

### 4. UI/UX — DROPDOWN Z-INDEX + PLACEHOLDERS
**Archivos:** `vulnerability-wizard.tsx`, `socioeconomic-form.tsx`

| Fix | Detalle |
|-----|---------|
| **Dropdown detrás de Card Vivienda** | Primera `Card` → `relative z-20 overflow-visible`; input `z-30`; Cards hermanas `relative z-0` |
| **Placeholder actualizado** | "Escribe desde la 1ª letra (filtra por apellido)..." |
| **Clear limpia código** | `handleClearChild` ahora `setCodigo("")` |

---

### 5. BACKEND COMMON — MÓDULOS CORE AUDITORÍA/IDENTIDAD
**Archivos nuevos (creados en merge):** `backend/common/{audit.py,events.py,identity.py,mask.py,pseudonym.py,core_engine/*}`

| Módulo | Propósito |
|--------|-----------|
| `audit.py` | HashChainAuditLog (append-only, verificación criptográfica) |
| `events.py` | Event sourcing / domain events |
| `identity.py` | Pseudonimización determinista, claves derivadas |
| `mask.py` | Enmascaramiento PII para logs/export |
| `pseudonym.py` | PolicyFilter por rol/tenant |

---

## 📊 ESTADO DE SERVICIOS (PM2)
| Servicio | Puerto | Estado | PID | Uptime |
|----------|--------|--------|-----|--------|
| **aigovcorex-backend** | 5000 | ✅ online | 2491078 | 0s (reiniciado) |
| **aigovcorex-dashboard** | 9002 | ✅ online (307→/dashboard) | 2491080 | 0s |
| **aigovcorex-portal** | 3002 | ✅ online | 2405511 | 35h |
| **aigovcorex-whatsapp** | 3001 | ✅ online | 2405510 | 35h |
| **aikrofy-* / ms-* / lefri-app** | — | ✅ online (sin cambios) | — | — |

**Health checks:** `curl -s http://127.0.0.1:5000/` → `200` | `http://127.0.0.1:9002/` → `307` (redirect a `/dashboard` → `200`)

---

## 📁 ARCHIVOS CLAVE MODIFICADOS/CREADOS (RESUMEN)

### Backend (Python Flask)
```
backend/modules/early-childhood/api/
├── children.py           # search_children + get_child: eager load tenant, 1-char prefix
├── monitoring.py         # _parse_date_range, all endpoints: from/to params
├── dashboard.py          # get_stats + get_recent_applications: from/to params
├── cmci.py               # dashboard: ya soportaba from/to
└── document_templates.py # nuevo: gestión plantillas
backend/common/
├── audit.py, events.py, identity.py, mask.py, pseudonym.py
└── core_engine/          # contratos, keys, audit chain
```

### Frontend Dashboard (Next.js 14)
```
src/
├── components/
│   ├── dashboard/
│   │   ├── date-range-filter.tsx      # NUEVO: presets + custom range
│   │   ├── stats-cards.tsx            # from/to props
│   │   ├── recent-admissions.tsx      # from/to props
│   │   └── development-chart.tsx      # from/to props
│   ├── cmci/
│   │   ├── vulnerability-wizard.tsx   # z-index, unified code, findMatchingCmci
│   │   └── socioeconomic-form.tsx     # z-index, unified code, findMatchingCmci
│   └── monitoreo/
│       ├── monitoring-client.tsx      # from/to props
│       └── monitoring-charts.tsx      # from/to props, dynamic description
├── lib/cmci/
│   ├── child-code.ts                  # NUEVO: buildUnifiedChildCode, pickUnifiedCode, findMatchingCmci
│   ├── engine.ts, params.ts           # tipos compartidos
└── services/
    ├── children.service.ts            # search: retorna center_name, tenant_id, family_id
    ├── monitoring.service.ts          # todos métodos aceptan {from,to}
    ├── dashboard.service.ts           # getStats + getRecentApplications con from/to
    └── cmci.service.ts                # dashboard(filters) con from/to
src/app/(app)/
├── monitoreo/page.tsx                 # DateRangeFilter + key con from/to
├── dashboard/page.tsx                 # DateRangeFilter + key con from/to
└── admision/
    └── dashboard-cmci/page.tsx        # DateRangeFilter + cmciService.dashboard({from,to})
```

---

## 🔄 GIT STATUS
```
Branch: main (y dev) → origin/main, origin/dev
Last commit: 0a35432 "merge: sync dev -> main (CMCI fichas, date filters, bug fixes)"
Status: clean, sin conflictos, ambos branches empujados
```

---

## 🧪 VERIFICACIONES PENDIENTES / PRÓXIMOS PASOS
- [ ] Test E2E: license_admin selecciona niño de centro distinto → centro se autoselecciona
- [ ] Test E2E: educadora (single-center) → centro ya por defecto, búsqueda filtra solo su centro
- [ ] Test E2E: ficha vulnerabilidad → guardar → editar → recalcula puntaje → guardar nueva versión
- [ ] Test E2E: filtro fechas monitoreo → KPIs/charts se actualizan al cambiar preset
- [ ] Documentar en `docs/cmci/` el flujo unificado de código FICHA-*

---

## 📝 NOTAS TÉCNICAS PARA FUTUROS DESARROLLADORES
1. **`joinedload(Child.tenant)` es crítico** en `search_children` y `get_child` para license_admin; sin él `child.tenant` es `None` y `center_name` falla.
2. **`CMCI_LIST` usa nombres completos** (`"CMCI Guasmo"`) pero `tenant.name` devuelve slug (`"Guasmo"`). El match normalizado resuelve esto.
3. **Código unificado `FICHA-*`** no es retroactivo: fichas existentes con `FV-*`/`FS-*` conviven; la primera vez que se abre la ficha "hermana" se reutiliza ese código.
4. **Date filter keys** (`key={\`${tenantId}-${from}-${to}\`}`) fuerzan remount del componente para refetch limpio.
5. **`TENANT_ID_TO_CMCI`** es mapa en memoria; si el usuario cambia de centro en el selector superior, la próxima búsqueda re-mapea automáticamente.

---

*Generado automáticamente como parte de la auditoría post-despliegue 2026-10-01*