# MOTOR de datos del ecosistema — guía integración 5-min

Solo stdlib Python. Cero dependencias externas (sin pip/network).

## 1. Arrancar

```bash
# Opción A: standalone (cualquier proyecto del lab, sin Flask)
CORE_PEPPER_V1=super-secreto-local CORE_PEPPER_VERSION=v1 \
  python3 backend/common/core_server.py --port 5050
curl -s localhost:5050/core/v1/health
curl -s localhost:5050/core/v1/keys/status

# Opción B: montado en Flask early-childhood (ya registrado UNA vez en app.py)
CORE_PEPPER_V1=... python3 backend/modules/early-childhood/wsgi.py
curl -s localhost:5000/core/v1/health
```

Env:
- `CORE_PEPPER_V1`, `CORE_PEPPER_V2`… + `CORE_PEPPER_VERSION=v1` (fail-closed si falta)
- o `CORE_PEPPER=<valor>` / `CORE_PEPPER_FILE=/run/secrets/pepper`
- opcional: `CORE_VAULT_DB=var/vault.sqlite`, `CORE_EVENTS_FILE=var/core_events.jsonl`
- `CORE_CRYPTO=std` (activo) | `aesgcm` (reservado: mismo API, sella vault con AES-GCM)

## 2. Integrar por proyecto (aikrofy / kindicoreai / enpiai vía HTTP)

```bash
BASE=http://localhost:5050/core/v1
# identidad -> subject_ref opaco (nunca PII en logs)
curl -s $BASE/identity/resolve -H 'Content-Type: application/json' -d \
 '{"nombre":"María José","cedula":"1710034065","fecha_iso":"2019-04-03","nacionalidad":"EC"}'
# pseudonimizar / enmascarar
curl -s $BASE/pseudonymize -H 'Content-Type: application/json' -d \
 '{"payload":{"nombre":"Ana","cedula":"123"},"subject_ref":"cet_...","intent":"analytics","rol":"analyst"}'
curl -s $BASE/mask -H 'Content-Type: application/json' -d \
 '{"payload":{"cedula":"1710034065","telefono":"0991234567","birth_date":"2019-04-03"},"rol":"analyst"}'
# evento + auditoría
curl -s $BASE/events/publish -H 'Content-Type: application/json' -d \
 '{"tenant":"ec","domain":"health","subject_ref":"cet_...","channel":"web","intent":"care"}'
curl -s $BASE/audit/append -H 'Content-Type: application/json' -d \
 '{"actor":"educadora","accion":"ficha.crear","subject_ref":"cet_...","finalidad":"care"}'
# olvido (tombstone, conserva agregados)
curl -s $BASE/subjects/forget -H 'Content-Type: application/json' -d '{"subject_ref":"cet_..."}'
```

```python
import sys
sys.path.insert(0, "backend/common")
from core_client import CoreClient
c = CoreClient("http://localhost:5050")
print(c.health())
r = c.resolve_identity("María José", "1710034065", "2019-04-03", "EC")
print(r["subject_ref"], r["confidence"])
print(c.pseudonymize({"nombre": "Ana", "edad": 5}, r["subject_ref"]))
print(c.mask({"cedula": "1710034065", "telefono": "0991234567"}))
print(c.audit_append("educadora", "ficha.crear", r["subject_ref"], "care"))
print(c.audit_verify())
print(c.forget(r["subject_ref"]))
```

## 3. Upgrade AES-GCM (cuando haya red/`cryptography`)
Mismo API, flag `CORE_CRYPTO=aesgcm`: el vault sella filas con AES-GCM
(nonce 96b, AAD=uid+versión); HMAC/uid/token/PolicyFilter sin cambios.
Ver docstring de cada función en `core_engine/*.py`.
