"""Auditoria append-only con hash-chain SHA256 (stdlib only).

Upgrade AES-GCM (mismo API, CORE_CRYPTO=std|aesgcm):
  - Hoy: cadena SHA256 sobre campos en claro (sin PII: solo subject_ref).
  - Upgrade: con aesgcm se podria sellar `detalle` opcional con AES-GCM
    (AAD=seq+hash); `append()`/`verify_chain()` mantendrian firma.
"""

from __future__ import annotations

import hashlib
import threading
import time

_lock = threading.Lock()
_chain: list[dict] = []


def _hash_entry(seq: int, ts: str, actor: str, accion: str, subject_ref: str,
                finalidad: str, prev_hash: str) -> str:
    raw = "|".join([str(seq), ts, actor, accion, subject_ref, finalidad, prev_hash])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def append(actor: str, accion: str, subject_ref: str = "", finalidad: str = "") -> dict:
    """Agrega entrada encadenada. Requiere actor+accion (sin PII)."""
    if not (actor or "").strip() or not (accion or "").strip():
        raise ValueError("actor y accion requeridos")
    with _lock:
        prev = _chain[-1]["hash"] if _chain else "GENESIS"
        seq = len(_chain)
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        h = _hash_entry(seq, ts, actor.strip(), accion.strip(),
                        (subject_ref or "").strip(), (finalidad or "").strip(), prev)
        entry = {"seq": seq, "ts": ts, "actor": actor.strip(), "accion": accion.strip(),
                 "subject_ref": (subject_ref or "").strip(), "finalidad": (finalidad or "").strip(),
                 "prev_hash": prev, "hash": h}
        _chain.append(entry)
        return dict(entry)


def entries() -> list[dict]:
    """Copia de la cadena (solo lectura)."""
    with _lock:
        return [dict(e) for e in _chain]


def verify_chain(chain: list[dict] | None = None) -> dict:
    """Verifica linkage SHA256. Detecta manipulacion -> {ok, error, at}."""
    items = entries() if chain is None else chain
    prev = "GENESIS"
    for i, e in enumerate(items):
        if e.get("seq") != i or e.get("prev_hash") != prev:
            return {"ok": False, "at": i, "error": f"ruptura en seq {i}"}
        expect = _hash_entry(e["seq"], e["ts"], e["actor"], e["accion"],
                             e.get("subject_ref", ""), e.get("finalidad", ""), e["prev_hash"])
        if e.get("hash") != expect:
            return {"ok": False, "at": i, "error": f"hash invalido en seq {i}"}
        prev = e["hash"]
    return {"ok": True, "count": len(items)}


def clear() -> None:
    """Solo tests."""
    with _lock:
        _chain.clear()
