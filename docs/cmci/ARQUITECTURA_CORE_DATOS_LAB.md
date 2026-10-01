# ARQUITECTURA DE DATOS CORE DEL LAB — principios bancarios a nivel laboratorio
**Fecha:** 2026-09-29 · **Fuentes:** diagrama banco (146 nodos, invariantes I1-I9) + `PLAN_MAESTRO_BETA_SEGURIDAD_ESCALA_SPARK.md` + `docs/cmci/PLAN_INTEGRACION_BANCO_DIGITAL.md` + inventario real de 16 proyectos del lab.
**Tesis:** un solo `_core/` compartido (identidad, seudonimización, eventos, auditoría, llaves, contratos, calidad, lago, linaje, voz, MDM) con el mismo `uid_enc` en todos los verticales; cada proyecto conserva su SoR y publica data products con contrato ODCS. LLM ciego en todo el lab; TTS/STT local vía MediaSuite.

## 1. Inventario lab (qué hay que unificar)
| Proyecto | Datos sensibles | Reutilizable al core |
|---|---|---|
| aigovcorex / kindicoreai | Menores, salud, socioeconómica MIES | IdentityResolver, RAG por licencia, RBAC, voz |
| enpiai / personai | Salud wellness, chats privados cifrados | SkillAdapter, CRM 360°, selfchat guardrails |
| LeFriApp | Legal, **AES-256-GCM ya** | Patrón cifrado app-level del lab |
| aikrofy | B2B, billing créditos, heap/trie <0.1ms | Scoring, auth caché, REST/MCP |
| MediaSuite | Voz (cascada STT/TTS), pagos | **TTS/STT local compartido (Piper/Kokoro)** |
| TurismAI | Tenant-root zero-leakage, permisos | RBAC granular, toggles |
| nexus / auditwlt | Marketing, tokens OAuth | token_manager, PayPal |
| agenticnucleus / Neri / aiwebworker | Gateway WA, on-device, blur/anonymize | Baileys canónico, anonimización previa |
| archify-lab / skills | Descubrimiento, estándares | Plantillas PM2/Nginx, skills voz/RAG/MCP |

## 2. Core compartido `_core/` vs vertical
**Core:** `identity/` (HMAC+pepper, uid_enc, normalize), `pseudonym/`+`mask/` (PolicyFilter, k-anonimato, `***4567`/age_display), `events/` (NATS + envelope v1), `audit/` (hash-chain), `keys/` (sops+age→Vault→HSM), `contracts/` (ODCS+Pact), `quality/` (GE/Soda), `lake/` (silver jobs), `lineage/` (OpenLineage→DataHub), `tts-stt/` (Piper/Kokoro + purge 24h), `mdm/` (party golden record), `token-translation/` (joins vía OPA).
**Vertical:** su SoR intacto (único que escribe, I3), Command API+outbox, productor NATS con dominio, borde re-identificador, DSAR local → Erasure core. Prohibido leer tablas ajenas (I4).

## 3. Identidad única cross-proyecto
`identity_key=HMAC(nombre|cedula|fecha_nac|nacionalidad, pepper_vN)`; `uid_enc=AES-GCM(uid)`; edad nunca en key. Tablas core únicas: `subjects`, `pii_vault` (usuario SQL aparte), `tombstones`, `consents(training_opt_in)`. Identidades débiles (solo teléfono, menor sin cédula, caso anónimo) con `confidence` low/medium y promoción con merge que conserva `subject_ref`. Olvido = destruye DEK + tombstone, conserva transacciones; se re-aplica tras restore/replay (I7).

## 4. Dominios y secuencia
Dominios: `identidad-party`, `plataforma-keys`, `gov-ciudadano`, `infancia`, `bienestar`, `legal-triaje`, `enterprise`, `viajes`, `contenido-media`, `marketing-analytics`, `prospeccion`, `cumplimiento`, `banco-comunitario` (F4). **F0** blindaje lab (secretos, bind, HMAC, alembic, masking) → **F1** privacidad multi-tenant piloto infancia (LLM ciego, DSAR) → **F2** voz local + NATS → **F3** lakehouse ligero + Gold → **F4** ledger doble-entrada, fondos bilaterales, subsidios anti-doble-cobro, divisas sandbox, tarjetas sin PAN, WORM, blockchain solo huella. Bloqueadores: sin F0 no hay beta; sin pepper no hay uid; sin envelope no hay Silver; sin Erasure no hay replay/ML; sin ODCS no hay Fabric; sin WORM no hay F4.
