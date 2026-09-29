"""Servidor standalone stdlib (wsgiref) :5050 para proyectos del lab sin Flask.

Uso:  CORE_PEPPER=... python3 backend/common/core_server.py [--port 5050]
Rutas identicas al blueprint Flask (/core/v1/*). Sin dependencias externas.
"""

from __future__ import annotations

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wsgiref.simple_server import make_server

from core_engine import audit as audit_mod
from core_engine import events as events_mod
from core_engine import identity as identity_mod
from core_engine import keys as keys_mod
from core_engine import mask as mask_mod
from core_engine import pseudonym as pseudo_mod

_tombstones: set[str] = set()
_aggregates: dict[str, int] = {"events": 0, "audits": 0, "resolves": 0}


def _json(start, code: int, obj: dict):
    body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    status = {200: "200 OK", 400: "400 Bad Request", 404: "404 Not Found",
              500: "500 Internal Error"}.get(code, f"{code} OK")
    start(status, [("Content-Type", "application/json"), ("Content-Length", str(len(body)))])
    return [body]


def _read_body(env) -> dict:
    try:
        n = int(env.get("CONTENT_LENGTH") or 0)
    except (ValueError, TypeError):
        n = 0
    raw = env["wsgi.input"].read(n) if n > 0 else b"{}"
    try:
        d = json.loads(raw.decode("utf-8") or "{}")
        return d if isinstance(d, dict) else {}
    except (ValueError, UnicodeDecodeError):
        return {}


def app(environ, start):
    method = environ.get("REQUEST_METHOD", "GET")
    path = environ.get("PATH_INFO", "")
    if method == "GET" and path in ("/core/v1/health", "/health"):
        return _json(start, 200, {"status": "ok", "motor": "core-v1"})
    if method == "GET" and path == "/core/v1/keys/status":
        st = keys_mod.status()
        return _json(start, 200 if st.get("ok") else 500, st)
    if method == "POST" and path == "/core/v1/identity/resolve":
        b = _read_body(environ)
        try:
            out = identity_mod.resolve(b.get("nombre"), b.get("cedula"),
                                       b.get("fecha_iso", b.get("fecha_nac")),
                                       b.get("nacionalidad"), b.get("fecha_nac"))
        except Exception as exc:
            return _json(start, 500, {"error": type(exc).__name__})
        _aggregates["resolves"] += 1
        return _json(start, 200, out)
    if method == "POST" and path == "/core/v1/pseudonymize":
        b = _read_body(environ)
        try:
            out = pseudo_mod.pseudonymize(b.get("payload", {}), b.get("subject_ref", ""),
                                          b.get("intent", "analytics"), b.get("rol", "analyst"),
                                          b.get("finalidad", ""))
        except ValueError as exc:
            return _json(start, 400, {"error": str(exc)})
        return _json(start, 200, out)
    if method == "POST" and path == "/core/v1/mask":
        b = _read_body(environ)
        try:
            out = mask_mod.mask_payload(b.get("payload", {}), b.get("rol", "analyst"))
        except ValueError as exc:
            return _json(start, 400, {"error": str(exc)})
        return _json(start, 200, out)
    if method == "POST" and path == "/core/v1/events/publish":
        b = _read_body(environ)
        env_data = b.get("envelope", b)
        if "tenant" in b and "event_id" not in b and "envelope" not in b:
            env_data = events_mod.make_envelope(b.get("tenant", ""), b.get("domain", ""),
                                                b.get("subject_ref", ""), b.get("channel", "system"),
                                                b.get("intent", "analytics"), b.get("payload", {}),
                                                b.get("event", "generic"))
        ok, errs = events_mod.validate_envelope(env_data if isinstance(env_data, dict) else {})
        if not ok:
            return _json(start, 400, {"error": "envelope invalido", "details": errs})
        events_mod.default_producer.publish(env_data)
        _aggregates["events"] += 1
        return _json(start, 200, {"ok": True, "event_id": env_data["event_id"]})
    if method == "POST" and path == "/core/v1/audit/append":
        b = _read_body(environ)
        try:
            e = audit_mod.append(b.get("actor", ""), b.get("accion", ""),
                                 b.get("subject_ref", ""), b.get("finalidad", ""))
        except ValueError as exc:
            return _json(start, 400, {"error": str(exc)})
        _aggregates["audits"] += 1
        return _json(start, 200, e)
    if method == "POST" and path == "/core/v1/audit/verify":
        return _json(start, 200, audit_mod.verify_chain())
    if method == "POST" and path == "/core/v1/subjects/forget":
        b = _read_body(environ)
        ref = (b.get("subject_ref") or "").strip()
        if not ref:
            return _json(start, 400, {"error": "subject_ref requerido"})
        _tombstones.add(ref)
        preserved = {"aggregates": dict(_aggregates),
                     "audit_count": len(audit_mod.entries()),
                     "events_count": len(events_mod.default_producer.events)}
        return _json(start, 200, {"subject_ref": ref, "forgotten": True,
                                  "tombstoned": True, "preserved": preserved})
    return _json(start, 404, {"error": "no encontrado"})


def main() -> None:
    port = 5050
    for i, a in enumerate(sys.argv[1:]):
        if a == "--port" and i + 1 < len(sys.argv[1:]):
            port = int(sys.argv[1:][i + 1])
    print(f"core standalone en :{port} (stdlib wsgiref)", flush=True)
    make_server("0.0.0.0", port, app).serve_forever()


if __name__ == "__main__":
    main()
