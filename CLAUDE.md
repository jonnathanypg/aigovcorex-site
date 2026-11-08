# 🛠️ CLAUDE DEVELOPER MANUAL (AI GOVCOREX OS 2.5)

> **Documentación Centralizada:** Consultar [AIGOVCOREX_MASTER.md](file:///root/aigovcorex/AIGOVCOREX_MASTER.md) para la visión integral del sistema y [docs/](file:///root/aigovcorex/docs/) para manuales especializados.
> **Herramienta Obligatoria de Descubrimiento:** Usar siempre `codebase-memory-mcp` (proyecto `root-aigovcorex`).

---

## 🚀 COMANDOS ESENCIALES DEL SISTEMA

### 🌐 Frontend Portal Institucional (Next.js 14)
- **Directorio:** `frontend/portal/`
- **Desarrollo:** `npm run dev` (puerto `3002`)
- **Build producción:** `npm run build`

### ⚛️ Frontend Dashboard Operativo (Next.js 14)
- **Directorio:** `frontend/dashboard/`
- **Desarrollo:** `npm run dev` (puerto `9002`)
- **Build producción:** `npm run build`
- **Linter:** `npm run lint`

### 🐍 Backend Compliance (Flask / Python)
- **Directorio:** `backend/modules/early-childhood/`
- **Activar venv:** `source venv/bin/activate`
- **Ejecutar tests:** `pytest tests/`
- **Gunicorn Producción:** `gunicorn wsgi:app --bind 0.0.0.0:5000 --workers 4 --threads 4`

### 💬 Gateway WhatsApp Voice (Node.js)
- **Directorio:** `services/whatsapp-voice/`
- **Build:** `npm run build`
- **Inicio:** `node dist/app.js` (puerto `3001`)

---

## 🤖 COMPORTAMIENTO PARA AGENTES IA
- Respetar siempre las reglas e invariantes definidas en [AGENTS.md](file:///root/aigovcorex/AGENTS.md) y [GEMINI.md](file:///root/aigovcorex/GEMINI.md).
- Nunca realizar merges destructivos (`git checkout --ours / --theirs`).
