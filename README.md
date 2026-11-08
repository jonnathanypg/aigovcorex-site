# 🏛️ AI GovCoreX OS — Autonomous Agentic Compliance OS for the Public Sector

**AI GovCoreX** es el Sistema Operativo Agéntico de Cumplimiento y Auditoría en tiempo real para el sector público (GovTech / RegTech B2G), diseñado para transformar notas de voz e interacciones de campo en registros inalterables y listos para auditorías fiscales y regulatorias en programas sociales gubernamentales.

---

## 🏛️ Compendio Maestro y Documentación Centralizada

Toda la documentación técnica, manuales de arquitectura, auditorías y hojas de ruta han sido consolidadas y estructuradas:

- 📘 **Compendio Maestro Canónico:** [AIGOVCOREX_MASTER.md](file:///root/aigovcorex/AIGOVCOREX_MASTER.md) *(visión global, arquitectura multicapa, backend Flask, frontend Next.js, LangGraph, WhatsApp Gateway, modelos y seguridad PII)*.
- 🤖 **Reglas para Agentes de IA e Invariantes:** [AGENTS.md](file:///root/aigovcorex/AGENTS.md) *(políticas de no regresión, validación de cédulas, fichas CMCI y reglas de Git)*.
- 📝 **Memoria Compartida y Reglas de Desarrollo:** [GEMINI.md](file:///root/aigovcorex/GEMINI.md) *(directrices de equipo, arquitectura core y comandos de producción)*.
- 🛠️ **Manual Operativo de Comandos:** [CLAUDE.md](file:///root/aigovcorex/CLAUDE.md) *(convenciones de desarrollo rápido y linters)*.
- 📁 **Biblioteca Técnica Modular:** [docs/](file:///root/aigovcorex/docs/) *(auditorías detalladas, guías de despliegue, planes de seguridad Spark y documentación CMCI de fichas e impresión A4)*.

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
├── 📄 AIGOVCOREX_MASTER.md        # Compendio Canónico Maestro de Arquitectura y Negocio
└── 📁 docs/                       # Biblioteca Técnica de Auditoría, Despliegue y Fichas CMCI
```

---

## 🚀 Despliegue Rápido en Producción (PM2)

Todos los servicios se gestionan de forma centralizada en el VPS mediante PM2:

```bash
# 1. Instalar dependencias globales
npm install

# 2. Iniciar todos los servicios del proyecto
pm2 start ecosystem.config.js

# 3. Guardar estado de arranque para reboots del VPS
pm2 save
```

### Puertos en Producción:
- **`aigovcorex-portal`**: `http://127.0.0.1:3002` → `https://aigovcorex.com`
- **`aigovcorex-dashboard`**: `http://127.0.0.1:9002` → `https://app.aigovcorex.com`
- **`aigovcorex-backend`**: `http://127.0.0.1:5000` → `/api` en ambos dominios
- **`aigovcorex-whatsapp`**: `http://127.0.0.1:3001` → `/whatsapp`

> [!IMPORTANT]
> **Política de Seguridad del Servidor:** NUNCA ejecutar comandos globales de parada (`pm2 kill`, `pm2 stop all`). Reiniciar o detener únicamente procesos escopados (`pm2 restart aigovcorex-*`).

---

## 🔒 Reglas Críticas de No Regresión
1. **Cédula de Identidad (Ecuador):** La validación debe aceptar exactamente 10 dígitos numéricos (`/^\d{10}$/`) sin bloqueos por algoritmos rígidos desactualizados.
2. **Fichas CMCI:** Ambas fichas (Vulnerabilidad y Socioeconómica) deben compartir el mismo código unificado `FICHA-{CENTRO}-{AÑO}-{ID:03d}` generado por `child-code.ts`.
3. **Multi-Tenancy:** Ningún usuario puede visualizar registros fuera de los centros asignados a su cuenta.

---
*AI GovCoreX OS 2.5 — Noviembre 2026 — WEBLIFETECH*
