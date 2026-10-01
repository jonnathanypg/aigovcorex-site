"""Eventos: envelope v1 validado + productores memoria/JSONL/stub NATS.

Upgrade AES-GCM (mismo API, CORE_CRYPTO=std|aesgcm):
  - Hoy: payload en claro con PII ya pseudonimizada aguas arriba.
  - Upgrade: con aesgcm el campo `payload` podria ir sellado
    (AES-GCM, AAD=event_id+tenant); `publish()`/`validate()` sin cambios.
"""

from __future__ import annotations

import json
import os
import threading
import time
import uuid

REQUIRED = ("v", "event_id", "ts", "tenant", "domain", "subject_ref", "channel", "intent")
CHANNELS = {"web", "whatsapp", "telegram", "voice", "batch", "system"}
_lock = threading.Lock()


def make_envelope(tenant: str, domain: str, subject_ref: str, channel: str = "system",
                  intent: str = "analytics", payload: dict | None = None,
                  event: str = "generic", event_id: str | None = None,
                  ts: str | None = None) -> dict:
    """Construye envelope v1 (no valida PII; pseudonimizar antes)."""
    return {
        "v": 1,
        "event_id": event_id or f"evt_{uuid.uuid4().hex[:16]}",
        "ts": ts or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tenant": tenant,
        "domain": domain,
        "subject_ref": subject_ref,
        "channel": channel,
        "intent": intent,
        "event": event,
        "payload": payload or {},
    }


def validate_envelope(env: dict) -> tuple[bool, list[str]]:
    """Valida envelope v1 -> (ok, errores)."""
    errs: list[str] = []
    if not isinstance(env, dict):
        return False, ["envelope debe ser objeto"]
    for f in REQUIRED:
        if f not in env or env[f] in (None, ""):
            errs.append(f"falta {f}")
    if env.get("v") != 1:
        errs.append("v debe ser 1")
    if env.get("channel") not in CHANNELS:
        errs.append(f"channel invalido (uno de {sorted(CHANNELS)})")
    for f in ("tenant", "domain", "subject_ref", "intent", "event_id"):
        v = env.get(f)
        if v is not None and not isinstance(v, str):
            errs.append(f"{f} debe ser string")
    if "payload" in env and not isinstance(env["payload"], dict):
        errs.append("payload debe ser objeto")
    return (len(errs) == 0), errs


class MemoryProducer:
    """Productor en memoria (tests/dev)."""

    def __init__(self):
        self.events: list[dict] = []

    def publish(self, env: dict) -> dict:
        ok, errs = validate_envelope(env)
        if not ok:
            raise ValueError("; ".join(errs))
        with _lock:
            self.events.append(env)
        return {"ok": True, "event_id": env["event_id"], "backend": "memory"}


class JsonlProducer:
    """Append JSONL a fichero (stdlib). Mismos metodos que memoria."""

    def __init__(self, path: str | None = None):
        self.path = path or os.environ.get("CORE_EVENTS_FILE", "var/core_events.jsonl")

    def publish(self, env: dict) -> dict:
        ok, errs = validate_envelope(env)
        if not ok:
            raise ValueError("; ".join(errs))
        d = os.path.dirname(os.path.abspath(self.path))
        os.makedirs(d, exist_ok=True)
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(env, ensure_ascii=False) + "\n")
        return {"ok": True, "event_id": env["event_id"], "backend": "jsonl"}


class NatsStubProducer:
    """Stub NATS con mismos metodos (no abre red; buffer local).

    Integracion real NATS: sustituir `publish()` por nats-py publish al
    subject `core.<tenant>.<domain>` manteniendo esta firma.
    """

    def __init__(self, subject_prefix: str = "core"):
        self.subject_prefix = subject_prefix
        self.sent: list[dict] = []

    def subject_for(self, env: dict) -> str:
        return f"{self.subject_prefix}.{env.get('tenant')}.{env.get('domain')}"

    def publish(self, env: dict) -> dict:
        ok, errs = validate_envelope(env)
        if not ok:
            raise ValueError("; ".join(errs))
        with _lock:
            self.sent.append({"subject": self.subject_for(env), "event": env})
        return {"ok": True, "event_id": env["event_id"], "backend": "nats-stub",
                "subject": self.subject_for(env)}


# Productor por defecto compartido (memoria)
default_producer = MemoryProducer()
