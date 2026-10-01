<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ════════════════════════════════════════════════════════════════════
# 🔒 POLÍTICA DE NO REGRESIÓN Y PROTECCIÓN DE MEJORAS AIGOVCOREX
# ════════════════════════════════════════════════════════════════════

## 1. REGLAS DE ORO DE GIT Y MERGES (Causa de pérdidas previas)
- **NUNCA resolver conflictos con flags destructivos** como `git checkout --ours / --theirs` en bloques de frontend consolidados.
- **Sincronización bidireccional inmediata**: Tras realizar mejoras y validarlas en `main`, sincronizar siempre `dev` con `main` (`git checkout dev && git merge main && git push origin dev && git checkout main`). Ambas ramas deben mantenerse en el mismo HEAD para evitar sobreescrituras en pulls futuros.
- **Antes de cualquier `git merge` o `git pull`**, verificar con `git diff --stat` qué archivos serán alterados.

## 2. INVARIANTES DE CÓDIGO (PROHIBIDO REGRESIONAR)
- **Cédula (Ecuador)**: Validación en `frontend/dashboard/src/lib/cmci/engine.ts`:
  * Debe exigir **únicamente 10 dígitos numéricos** (`/^\d{10}$/`).
  * **NUNCA** bloquear por tercer dígito (`< 6`) ni rechazar por checksum rígido.
- **Fichas de Valoración (Vulnerabilidad y Socioeconómica)**:
  * El componente `<ChildSearchSelect>` es **OBLIGATORIO** en ambas fichas.
  * Al vincular un niño/a, se deben invocar `findMatchingCmci` y `buildUnifiedChildCode`/`pickUnifiedCode` para asignar automáticamente el centro correspondiente y el código unificado compartido (`FICHA-*`).
- **Navegación y Menús (`frontend/dashboard/src/lib/os-modules.ts`)**:
  * **Operaciones**: Contiene exactamente `Dashboard`, `Registro de Niños`, `Admisión`, `Asistencia` y `Biblioteca Documental`.
  * **Valoración**: Contiene exactamente `Ficha Vulnerabilidad`, `Ficha Socioeconómica`, `Priorización` y `Métricas e indicadores`.
- **Biblioteca Documental (`/biblioteca`)**:
  * Para **todos los roles**: Descarga de plantillas oficiales habilitada.
  * Para **Administrador de Licencia (`license_admin`, `super_admin`)**: Controles visibles de subida, reemplazo y eliminación de plantillas oficiales.
- **Agente y Tools (`backend/modules/early-childhood/agents/`)**:
  * 48 tools y 8 subagentes delegados (`delegate_*`).
  * `resolve_tenant_ids` garantiza que roles asignados a un centro específico solo acceden a niños de su propio centro.

