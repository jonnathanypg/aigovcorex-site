# 🏛️ AI GovCoreX OS — Autonomous Agentic Compliance OS for the Public Sector

**AI GovCoreX** es el Sistema Operativo Agéntico de Cumplimiento y Auditoría en tiempo real para el sector público (GovTech / RegTech B2G), diseñado para transformar notas de voz e interacciones de campo en registros inalterables y listos para auditorías fiscales y regulatorias en programas sociales gubernamentales.

---

## 🗂️ Arquitectura Modular del Repositorio

El repositorio está estructurado como un **Sistema Operativo Monorepo Modular**:

```
aigovcorex/
│
├── 📁 frontend/
│   ├── 🏛️ portal/                 # Portal Institucional B2G + Captación VIP Beta (Next.js 14, Puerto 3000)
│   └── ⚛️ dashboard/              # Dashboard Operativo Unificado de Centros y Redes (Next.js 14, Puerto 9002)
│
├── 📁 backend/
│   └── 📁 modules/
│       ├── 🧸 early-childhood/    # [ACTIVO] Módulo Primera Infancia / KindiCore AI (Python Flask + LangGraph, Puerto 5000)
│       ├── 🤝 social-welfare/     # [ROADMAP] Módulo Asistencia Social & Adulto Mayor / SocialCore AI
│       └── 🩺 public-health/      # [ROADMAP] Módulo Salud Comunitaria & Brigadas / HealthCore AI
│
├── 📁 services/
│   └── 💬 whatsapp-voice/         # Gateway de Ingesta de Notas de Voz por WhatsApp (Node.js/TypeScript, Puerto 3001)
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
| **Portal Matriz AI GovCoreX** | `frontend/portal/` | Next.js 14 (App Router) + Tailwind | **3000** |
| **Dashboard Primera Infancia** | `frontend/dashboard/` | Next.js 14 + ShadcnUI + Recharts | **9002** |
| **Backend Agéntico Python** | `backend/modules/early-childhood/` | Python Flask + LangGraph + MySQL + RAG | **5000** |
| **Gateway WhatsApp Voice** | `services/whatsapp-voice/` | Node.js + TypeScript + Baileys | **3001** |

---

## ⚙️ Configuración Rápida (`.env`)

1. Copia el archivo maestro de entorno en la raíz:
   ```bash
   cp .env.example .env
   ```
2. Configura las credenciales de base de datos, llaves de LLM (OpenAI / Anthropic / Groq) y el webhook de leads.

---

## 🛠️ Comandos de Ejecución

### Levantar todo el ecosistema con un solo comando:
```bash
./start-local.sh
```

### O mediante PM2 (Producción / VPS / Hostinger):
```bash
npm run pm2:start
npm run pm2:logs
npm run pm2:stop
```

### Ejecutar componentes individuales:
```bash
# Portal Institucional
npm run dev:portal

# Dashboard Operativo
npm run dev:dashboard

# Compilar todos los frontends
npm run build:all
```

---

© 2026 AI GovCoreX. Todos los derechos reservados.
