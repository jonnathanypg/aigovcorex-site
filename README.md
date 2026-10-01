# 🏛️ AI GovCoreX OS — Autonomous Agentic Compliance OS for the Public Sector

**AI GovCoreX** es el Sistema Operativo Agéntico de Cumplimiento y Auditoría en tiempo real para el sector público (GovTech / RegTech B2G), diseñado para transformar notas de voz e interacciones de campo en registros inalterables y listos para auditorías fiscales y regulatorias en programas sociales gubernamentales.

---

## 🗂️ Arquitectura Modular del Repositorio

El repositorio está estructurado como un **Sistema Operativo Monorepo Modular**:

```
aigovcorex/
│
├── 📁 frontend/
│   ├── 🏛️ portal/                 # Portal Institucional B2G + Captación VIP Beta (Next.js 14, Puerto 3002)
│   └── ⚛️ dashboard/              # Dashboard Operativo Unificado de Centros y Redes (Next.js 14, Puerto 9002)
│
├── 📁 backend/
│   └── 📁 modules/
│       ├── 🧸 early-childhood/    # [ACTIVO] Módulo Primera Infancia / KindiCore AI (Python Flask + LangGraph, Puerto 5000)
│       ├── 🤝 social/             # [ACTIVO] Módulo Programas Sociales & Adulto Mayor (Python Flask, Puerto 5000)
│       └── 🩺 public-health/      # [ROADMAP] Módulo Salud Comunitaria & Brigadas / HealthCore AI
│
├── 📁 services/
│   └── 💬 whatsapp-voice/         # Gateway de Ingesta de Notas de Voz por WhatsApp (Node.js/TypeScript, Puerto 3001)
│
├── 📁 backend/common/             # Núcleo compartido: auditoría, identidad, eventos, enmascaramiento PII
│
├── 📄 ecosystem.config.js         # Configuración PM2 para orquestación de todos los microservicios
├── 📄 start-local.sh              # Script para levantar todo el ecosistema en local
├── 📄 .env.example                # Configuración maestra consolidada de variables de entorno
└── 📄 package.json                # Scripts raíz de gestión, compilación y despliegue
```

---

## 🚀 Puertos y Microservicios

| Servicio | Ubicación | Tecnología | Puerto por Defecto |
| :--- | :--- | :--- | :---: |
| **Portal Matriz AI GovCoreX** | `frontend/portal/` | Next.js 14 (App Router) + Tailwind | **3002** |
| **Dashboard Primera Infancia** | `frontend/dashboard/` | Next.js 14 + ShadcnUI + Recharts | **9002** |
| **Backend Agéntico Python** | `backend/modules/early-childhood/` | Python Flask + LangGraph + MySQL + RAG | **5000** |
| **Backend Social** | `backend/modules/social/` | Python Flask + MySQL | **5000** (mismo proceso) |
| **Gateway WhatsApp Voice** | `services/whatsapp-voice/` | Node.js + TypeScript + Baileys | **3001** |

---

## ✨ NUEVAS FUNCIONALIDADES CMCI (v2026.10)

### 🔑 Código Unificado `FICHA-*` (Vulnerabilidad + Socioeconómica)
- **Mismo niño = mismo código** en ambas fichas: `FICHA-{CENTRO}-{AÑO}-{ID:03d}`
- Reutiliza código previo: `last_vulnerability.code || last_socioeconomic.code || fallback`
- Al seleccionar niño → código inmediato → se corrige con histórico si existe

### 🎯 Centro Auto-seleccionado al Elegir Niño
- `findMatchingCmci(centerName, tenantId, CMCI_LIST)` con:
  - **Mapeo `tenant_id`→CMCI** en memoria (instantáneo tras primer uso)
  - **Normalización NFD** sin acentos (`Orquídeas` = `orquideas`)
  - **Match bidireccional** (`cmci.includes(tenant) || tenant.includes(cmci)`)

### 🔍 Búsqueda de Niños — Desde la 1ª Letra
- **Prefijo 1-char:** `X%` en apellido/nombre/cédula (no `%X%`)
- **Relevancia:** `CASE` prefijo completo → primer nombre → apellido
- **Acentos/Unicode:** normalización automática en frontend

### 📅 Filtro de Fechas Personalizado (Presets + Custom)
| Vista | Presets | Backend |
|-------|---------|---------|
| **Monitoreo** | Mes / 7d / 30d / 90d / Custom | `?from=YYYY-MM-DD&to=YYYY-MM-DD` en KPIs + 4 charts |
| **Dashboard General** | Mismos | Stats + RecentAdmissions + DevelopmentChart |
| **Dashboard CMCI** | Mismos | Ya soportado en backend, ahora UI conectada |

### 🎨 UI/UX — Dropdown Z-Index Fix
- Primera `Card` → `relative z-20 overflow-visible`
- Input búsqueda → `z-30`
- Cards hermanas → `relative z-0`
- Placeholder: *"Escribe desde la 1ª letra (filtra por apellido)..."*

---

## 🏗️ BACKEND COMMON — NÚCLEO COMPARTIDO
Módulos listos para uso transversal:

| Módulo | Propósito |
|--------|-----------|
| `audit.py` | HashChainAuditLog (append-only, verificación criptográfica) |
| `events.py` | Event sourcing / domain events |
| `identity.py` | Pseudonimización determinista, claves derivadas |
| `mask.py` | Enmascaramiento PII para logs/export |
| `pseudonym.py` | PolicyFilter por rol/tenant |

---

## ⚙️ Configuración Rápida (`.env`)

1. Copia el archivo maestro de entorno en la raíz:
   ```bash
   cp .env.example .env
   ```
2. Configura credenciales de BD, llaves LLM (OpenAI/Anthropic/Groq), webhook de leads.

---

## 🛠️ Comandos de Ejecución

### Levantar todo el ecosistema:
```bash
./start-local.sh
```

### PM2 (Producción / VPS):
```bash
npm run pm2:start
npm run pm2:logs
npm run pm2:stop
```

### Componentes individuales:
```bash
# Portal Institucional
npm run dev:portal

# Dashboard Operativo
npm run dev:dashboard

# Compilar todos los frontends
npm run build:all
```

---

## 📋 Health Checks Rápidos
```bash
# Backend API
curl -s http://127.0.0.1:5000/        # → 200

# Dashboard (redirect a /dashboard)
curl -s http://127.0.0.1:9002/       # → 307 → 200

# Portal
curl -s http://127.0.0.1:3002/       # → 200

# WhatsApp Voice
curl -s http://127.0.0.1:3001/       # → 200
```

---

## 📚 Documentación Técnica
- `AUDITORIA_ESTADO_ACTUAL.md` — Auditoría completa post-despliegue
- `docs/cmci/` — Especificaciones CMCI, planes de implementación, logs
- `proyect_arqutiecura_tipo_banco_digital/` — Arquitectura Banco Digital (drawio + JSON)

---

## 📦 Despliegue en VPS (PM2)
```bash
# Desde /root/aigovcorex
pm2 start ecosystem.config.js
pm2 save
# systemd arranca PM2 al boot automáticamente
```

---

## 🔐 Seguridad y Cumplimiento
- **Auditoría inmutable:** HashChainAuditLog en `backend/common/audit.py`
- **Pseudonimización:** `identity.py` + `pseudonym.py` para exportaciones PII-safe
- **Rate limiting:** `auth/rate_limit.py` en endpoints públicos
- **CORS/Headers:** configurados en `app.py` y nginx

---

© 2026 AI GovCoreX. Todos los derechos reservados.