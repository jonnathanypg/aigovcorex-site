# 📝 MEMORIA COMPARTIDA (GEMINI) — AI GOVCOREX OS 2.5

Este archivo contiene las directrices de desarrollo, arquitectura y operación del proyecto **AI GovCoreX OS** para agentes de IA (Gemini, Claude, GPT).

---

## 🏛️ ARQUITECTURA CORE Y COMPENDIO MAESTRO
- **Compendio Central Unificado:** Todo el detalle de arquitectura, flujo de datos, blueprints, esquemas multi-tenant y seguridad se encuentra en [AIGOVCOREX_MASTER.md](file:///root/aigovcorex/AIGOVCOREX_MASTER.md).
- **Biblioteca Modular:** En la carpeta [docs/](file:///root/aigovcorex/docs/) y [docs/cmci/](file:///root/aigovcorex/docs/cmci/) se encuentran los manuales detallados de auditoría, despliegue, planes Spark y fichas CMCI de impresión A4.
- **Sistema:** Monorepo Modular Multi-Servicio:
  - Portal Institucional: Next.js 14 en puerto `3002`.
  - Dashboard Operativo: Next.js 14 en puerto `9002`.
  - Backend Compliance: Python Flask / Gunicorn en puerto `5000`.
  - Ingesta de Voz WhatsApp: Node.js / Baileys en puerto `3001`.
- **Knowledge Graph:** Utilizar siempre `codebase-memory-mcp` (proyecto `root-aigovcorex`) para localización precisa de funciones, modelos y llamadas API.

---

## 🛠️ REGLAS DE ORO DE DESARROLLO Y NO REGRESIÓN
1. **Validación de Cédula (Ecuador):**
   - En `frontend/dashboard/src/lib/cmci/engine.ts`, exigir **únicamente 10 dígitos numéricos** (`/^\d{10}$/`).
   - **Prohibido** bloquear por tercer dígito o chequeos obsoletos que descartan ciudadanos válidos.
2. **Código Único de Fichas CMCI:**
   - Vulnerabilidad y Socioeconómica comparten obligatoriamente el mismo código: `FICHA-{CENTRO}-{AÑO}-{ID:03d}` a través de `child-code.ts`.
   - El componente `<ChildSearchSelect>` es obligatorio para vincular al menor y asignar automáticamente el centro mediante `findMatchingCmci`.
3. **Multi-Tenancy Estricto:**
   - Ninguna consulta a base de datos debe saltarse `TenantContext.get_current_user()` o el filtro de `tenant_id`.
4. **Impresión A4 Fiel:**
   - Mantener las reglas CSS `@media print` en las rutas `/print` de fichas y cronogramas, asegurando que no se generen saltos de página huérfanos (`page-break-inside: avoid`).

---

## 🚀 POLÍTICAS DEL VPS Y COMANDOS SEGUROS
Consulte siempre la directriz global en `/root/AGENTS.md`:
- **NUNCA** ejecutar comandos globales como `pm2 kill`, `pm2 delete all` o `pm2 restart all`.
- Reiniciar o supervisar únicamente los servicios de AI GovCoreX:
  ```bash
  pm2 restart aigovcorex-backend
  pm2 restart aigovcorex-dashboard
  pm2 restart aigovcorex-portal
  pm2 restart aigovcorex-whatsapp
  ```
- Guardar snapshot tras cualquier alteración de servicios: `pm2 save`.

---

## 🔄 REGLA DE SINCRONIZACIÓN DE RAMAS GIT
Al finalizar cualquier trabajo en `main`:
```bash
git checkout dev && git merge main && git push origin dev && git checkout main
```
Ambas ramas (`main` y `dev`) deben mantenerse siempre al mismo nivel para evitar regresiones o pérdidas de código.
