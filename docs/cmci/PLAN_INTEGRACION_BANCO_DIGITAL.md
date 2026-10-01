# PLAN DE INTEGRACIÓN — Arquitectura Banco Digital + Plataforma AI GovCoreX
**Fecha:** 2026-09-29 · **Fuentes:** `proyect_arqutiecura_tipo_banco_digital/Arquitectura_Datos_Banco_Digital_FINAL.json` (146 nodos, 2 páginas) + `PLAN_MAESTRO_BETA_SEGURIDAD_ESCALA_SPARK.md` (9 secciones, verificado en repo) + estado real del código (inventario 2026-09-29).
**Tesis:** el diagrama banco es el estado objetivo 24-36 m; el plan maestro es el puente (beta segura → privacidad bancaria → streaming). Este documento decide **qué open-source implementar ya, en qué orden, sin romper el VPS**, preparando: trazabilidad tipo blockchain (WORM + hash chain), futuro banco comunitario (divisas, fondos bilaterales, subsidios universales, acuerdos banca tradicional/tarjetas), manejador único de datos del lab y criptografía nativa con LLM ciego + TTS local (Kokoro).

## 1. Resumen arquitectura banco (lo que propone el diagrama)
Lambda (Flink speed + Spark/dbt batch, lógica única) + Medallón Bronze→Silver→Gold con Quality Gate + Data Mesh (dominios, ODCS, DataHub) + CQRS + Fabric (Trino) + Privacy Gateway en frontera (tokeniza HMAC + cifra DEK antes de Kafka) + PII Vault (HSM/KMS, KEK→DEK) + Erasure Registry + WORM evidencia + Token Translation Service + MDM Party + invariantes I1-I9 (privacidad en frontera, Bronze sin lógica, Core>Lakehouse>proyección, fail-closed). Fases 1-3 (0-6 / 6-12 / 12-24 m). Invariantes compatibles con plan maestro §4 (subjects/pii_vault/tombstones, uid_enc, olvido por crypto-shredding).

## 2. Estado real verificado (qué hay / qué falta)
**Hay:** JWT+scrypt, `cryptography` declarado sin uso, CMCI 8 tablas, SSE efímero, dedup events, edge-tts cloud, faster-whisper desactivado, `normalize_phone_e164`, tests CMCI 46 passed.
**Falta todo lo bancario:** Vault/HSM/KMS, HMAC identity_key, uid_enc, subjects/pii_vault/tombstones, masking borde, `WEBHOOK_SECRET`/`ADMIN_API_KEY` sin uso, audit WORM, Kafka/Redpanda/NATS, Spark/MinIO/ClickHouse/Airflow/dbt, TTS local (Kokoro/Piper: 0 hits), purge audio 24h, `Child.to_dict` expone PII (child.py:178-203), puertos 5000/3001 en 0.0.0.0, `create_all()+12 ALTER` en arranque.
**Conclusión:** distancia correcta para fases; nada del diagrama existe en código: no reinventar, implantar por coexistencia.

## 3. Decisión open-source (qué sí, qué no, por qué)
| Capa | Elegido | Alternativa descartada hoy | Motivo |
|---|---|---|---|
| Secretos/KMS | `sops+age` ya + `Vault dev` después | HSM físico | Sin costo, cabe en VPS; HSM cuando haya banca real |
| Cifrado campo | `cryptography` (Fernet→AES-GCM) + DEK por tenant en Vault/sops | Nada custom | Ya declarado en requirements |
| PII/entidad | `subjects`+`pii_vault`+`tombstones` en MariaDB (tablas, no servicio nuevo) | Vault separado ya | Cero RAM extra |
| Streaming | `NATS JetStream` (~50 MB) | Kafka/Redpanda (~200 MB+) | Swap al 72%: lo único que cabe hoy |
| Batch/lake | `DuckDB+Parquet` ya → `MinIO` + `PySpark` nocturno después | ClickHouse ya | DuckDB cero-servidor; ClickHouse en Fase 3 |
| Orquesta | `APScheduler` en Flask ya → `Airflow` fuera del VPS después | Airflow en VPS | Airflow no cabe con 21 apps |
| Catálogo/linaje | `DataHub` liviano después; hoy `OpenLineage→JSON` en audit log | Marquez ya | Sin Java extra hoy |
| Voz | `Piper/Kokoro` local en borde | edge-tts cloud (actual) | PII no sale; Kokoro ES de buena calidad, ~300 MB ONNX |
| Trazabilidad blockchain | Hash-chain en audit log (SHA-256 encadenado) ya → WORM MinIO Object Lock después | Red privada ya | Inmutabilidad verificable sin nodos; red (Hyperledger/Besu) solo si un regulador la exige |

## 4. Manejador único de datos del lab (todos los proyectos, un solo análisis)
`backend/common/` nuevo (fuera de early-childhood para reusar entre módulos/lab): `identity.py` (HMAC+pepper, uid_enc), `pseudonym.py` (PolicyFilter: qué campos por intent/rol), `events.py` (productor NATS + envelope v1: event_id, tenant, subject_ref, channel, intent, lat, tokens), `audit.py` (append-only + hash chain), `mask.py` (mascarado por rol). Cada proyecto AI_LAB (GovCoreX, KindiCore, LefriApp…) publica data products a NATS con contrato; el manejador es el único lector con vistas Gold por tenant. Regla: ningún módulo lee tablas ajenas (I4).

## 5. Fases de integración (coexistencia, sin downtime VPS)
**F0 Blindaje (días, antes de todo):** rotar secretos; `bind 127.0.0.1` + ufw; `WEBHOOK_SECRET` HMAC + `ADMIN_API_KEY` + helmet/cors/limit; `alembic upgrade head`, fuera DDL de `app.py`; `Child.to_dict(include_sensitive=False)`; sacar `.env.local` de frontends. Criterio: plan maestro §9 parcial.
**F1 Privacidad bancaria (sem 1-4):** `subjects/pii_vault/tombstones` + backfill + `identity_key/uid_enc` + `PolicyFilter` en webhooks/chat/voz + borde que re-identifica por rol + `DELETE /api/subjects/:ref` (olvido conserva transacciones) + Pinecone denylist `$and`. LLM ciego desde aquí: `test_pii_blind_llm` verde.
**F2 Voz local + streaming (sem 5-8):** Piper/Kokoro en borde (quitar PII de edge-tts/OpenAI), STT en cola + purge 24h, NATS JetStream + envelope v1 + consumidores alertas/SSE, audit hash-chain. TTS local = interfaz sin fuga.
**F3 Lakehouse ligero (mes 3-4):** MinIO Bronze/Silver/Gold + `silver_events.py` nocturno + DuckDB Gold + conciliación Core↔Gold + Quality Gate (Great Expectations) + cuarentena/DLQ.
**F4 Banco comunitario (mes 5+, exige licencia):** ledger doble-entrada (`accounts/journals/postings`, ISO 4217) + WORM evidencia + `accounts` de fondos bilaterales (trazabilidad donante→beneficiario) + motor subsidios universales (elegibilidad, anti-doble-cobro por identity_key) + sandbox divisas (tasas, límites) + conectores banca/tarjetas (ISO 8583/API, PAN nunca entra: token+BIN+4) + overdraft/interbancario. Blockchain solo como **huella** (hash de lote Gold anclado) salvo exigencia regulatoria.

## 6. Criterios de aceptación
F0: C1-C9 plan maestro cerrados. F1: 0 PII en logs/Pinecone/prompts + olvido conserva transacciones. F2: `test_voz_sin_pii_externa` + lag NATS <5s. F3: Gold<2s + cuadre Core. F4: balance cuadra a cero + trazabilidad donante→subsidio + sandbox divisas auditado.
