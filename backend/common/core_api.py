"""API HTTP del MOTOR (blueprint Flask `core_bp`, url_prefix=/core/v1).

Monta UNA vez en backend/modules/early-childhood/app.py (ver comentario
CORE-MOTOR alla). Rutas:
  POST /identity/resolve, /pseudonymize, /mask, /events/publish,
       /audit/append, /audit/verify, POST /subjects/forget,
  GET  /keys/status, /health
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

try:  # importado como paquete backend.common.*
    from .core_engine import audit as audit_mod
    from .core_engine import events as events_mod
    from .core_engine import identity as identity_mod
    from .core_engine import keys as keys_mod
    from .core_engine import mask as mask_mod
    from .core_engine import pseudonym as pseudo_mod
except ImportError:  # importado top-level (sys.path -> backend/common)
    from core_engine import audit as audit_mod
    from core_engine import events as events_mod
    from core_engine import identity as identity_mod
    from core_engine import keys as keys_mod
    from core_engine import mask as mask_mod
    from core_engine import pseudonym as pseudo_mod

core_bp = Blueprint("core", __name__, url_prefix="/core/v1")

# Tombstones + agregados conservados tras forget (sin PII)
_tombstones: set[str] = set()
_aggregates: dict[str, int] = {"events": 0, "audits": 0, "resolves": 0}


def _body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@core_bp.post("/identity/resolve")
def identity_resolve():
    b = _body()
    try:
        out = identity_mod.resolve(
            nombre=b.get("nombre"), cedula=b.get("cedula"),
            fecha_iso=b.get("fecha_iso", b.get("fecha_nac")),
            nacionalidad=b.get("nacionalidad"),
            fecha_nac=b.get("fecha_nac"),
        )
    except Exception as exc:  # fail-closed pepper -> 500 sin PII
        return jsonify({"error": type(exc).__name__, "detail": str(exc)[:200]}), 500
    _aggregates["resolves"] += 1
    return jsonify(out), 200


@core_bp.post("/pseudonymize")
def do_pseudonymize():
    b = _body()
    try:
        out = pseudo_mod.pseudonymize(
            b.get("payload", {}), b.get("subject_ref", ""),
            b.get("intent", "analytics"), b.get("rol", "analyst"), b.get("finalidad", ""))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(out), 200


@core_bp.post("/mask")
def do_mask():
    b = _body()
    try:
        out = mask_mod.mask_payload(b.get("payload", {}), b.get("rol", "analyst"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(out), 200


@core_bp.post("/events/publish")
def events_publish():
    b = _body()
    env = b.get("envelope", b)
    # permite construir desde campos sueltos
    if "tenant" in b and "event_id" not in b and "envelope" not in b:
        env = events_mod.make_envelope(
            tenant=b.get("tenant", ""), domain=b.get("domain", ""),
            subject_ref=b.get("subject_ref", ""), channel=b.get("channel", "system"),
            intent=b.get("intent", "analytics"), payload=b.get("payload", {}),
            event=b.get("event", "generic"))
    ok, errs = events_mod.validate_envelope(env if isinstance(env, dict) else {})
    if not ok:
        return jsonify({"error": "envelope invalido", "details": errs}), 400
    _aggregates["events"] += 1
    events_mod.default_producer.publish(env)
    return jsonify({"ok": True, "event_id": env["event_id"]}), 200


@core_bp.post("/audit/append")
def audit_append():
    b = _body()
    try:
        e = audit_mod.append(b.get("actor", ""), b.get("accion", ""),
                             b.get("subject_ref", ""), b.get("finalidad", ""))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    _aggregates["audits"] += 1
    return jsonify(e), 200


@core_bp.post("/audit/verify")
def audit_verify():
    return jsonify(audit_mod.verify_chain()), 200


@core_bp.get("/keys/status")
def keys_status():
    st = keys_mod.status()
    return jsonify(st), 200 if st.get("ok") else 500


@core_bp.post("/subjects/forget")
def subjects_forget():
    """Tombstone + conserva agregados (conteos, nunca PII). Retorna lo conservado."""
    b = _body()
    ref = (b.get("subject_ref") or "").strip()
    if not ref:
        return jsonify({"error": "subject_ref requerido"}), 400
    _tombstones.add(ref)
    preserved = {"aggregates": dict(_aggregates),
                 "audit_count": len(audit_mod.entries()),
                 "events_count": len(events_mod.default_producer.events)}
    return jsonify({"subject_ref": ref, "forgotten": True,
                    "tombstoned": True, "preserved": preserved}), 200


@core_bp.get("/health")
def health():
    return jsonify({"status": "ok", "motor": "core-v1"}), 200
