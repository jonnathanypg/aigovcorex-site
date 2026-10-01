"""Identidad: normalizacion, identity_key HMAC, uid opaco, alias.

Upgrade a AES-GCM (mismo API, flag CORE_CRYPTO=std|aesgcm):
  - Hoy (std): identity_key=HMAC-SHA256(canonical, pepper); uid_enc es un
    token opaco `cet_<32hex>` sin PII; el vault mapea uid->identity_key.
  - Upgrade (aesgcm): el vault cifraria cada fila con AES-GCM
    (nonce aleatorio 96b, AAD=uid+pepper_version). `resolve()` y
    `resolve_uid()` mantendrian firma y retorno; solo cambia el reposo.
  - NUNCA loguear PII: este modulo no hace logging de inputs; si se anade
    logging, registrar solo identity_key[:8] / uid / confidence.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
import time
import unicodedata

from . import keys as keys_mod

_UID_RE = re.compile(r"^cet_[0-9a-f]{32}$")
_lock = threading.Lock()
# uid -> {"identity_key": hex, "pepper_version": str, "confidence": str, "created_at": str}
_vault: dict[str, dict] = {}
# identity_key -> uid (para estabilidad)
_by_key: dict[str, str] = {}
# uid_drop -> uid_keep (alias)
_alias: dict[str, str] = {}


def normalize_text(value: str | None) -> str:
    """NFKD -> sin tildes -> UPPER -> colapsa espacios."""
    if value is None:
        return ""
    s = unicodedata.normalize("NFKD", str(value))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.upper()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _norm_cedula(value: str | None) -> str:
    return re.sub(r"\D+", "", str(value or "")).strip()


def _norm_fecha(value: str | None) -> str:
    return str(value or "").strip()  # se espera ISO YYYY-MM-DD


def canonical(nombre: str | None, cedula: str | None, fecha_iso: str | None, nacionalidad: str | None) -> str:
    """Cadena canonica 'NOMBRE|CEDULA|FECHA|NAC' (sin PII en logs)."""
    return "|".join([
        normalize_text(nombre),
        _norm_cedula(cedula),
        _norm_fecha(fecha_iso),
        normalize_text(nacionalidad),
    ])


def identity_key(nombre, cedula, fecha_iso, nacionalidad, pepper_version: str | None = None) -> tuple[str, str]:
    """HMAC-SHA256(canonical, pepper) -> (hex, version). Fail-closed sin pepper.

    Upgrade AES-GCM: misma firma; con aesgcm el retorno no cambia (el HMAC
    sigue siendo determinista para join). El cifrado aplicaria al vault,
    no a esta funcion.
    """
    pepper, ver = keys_mod.get_pepper(pepper_version)
    msg = canonical(nombre, cedula, fecha_iso, nacionalidad).encode("utf-8")
    digest = hmac.new(pepper.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return digest, ver


def confidence_for(nombre, cedula, fecha_iso, nacionalidad) -> str:
    """high: 4/4 campos validos; medium: 3/4; low: resto."""
    parts = [bool(normalize_text(nombre)), bool(_norm_cedula(cedula)),
             bool(_norm_fecha(fecha_iso)), bool(normalize_text(nacionalidad))]
    n = sum(parts)
    if n >= 4:
        return "high"
    if n == 3:
        return "medium"
    return "low"


def _new_uid() -> str:
    return "cet_" + secrets.token_hex(16)


def _sqlite_path() -> str | None:
    return os.environ.get("CORE_VAULT_DB", "").strip() or None


def _sqlite_save(uid: str, rec: dict) -> None:
    path = _sqlite_path()
    if not path:
        return
    con = sqlite3.connect(path)
    try:
        con.execute("CREATE TABLE IF NOT EXISTS vault(uid TEXT PRIMARY KEY, ikey TEXT, ver TEXT, conf TEXT, ts TEXT)")
        con.execute("INSERT OR REPLACE INTO vault VALUES(?,?,?,?,?)",
                    (uid, rec["identity_key"], rec["pepper_version"], rec["confidence"], rec["created_at"]))
        con.commit()
    finally:
        con.close()


def _sqlite_load(uid: str) -> dict | None:
    path = _sqlite_path()
    if not path or not os.path.exists(path):
        return None
    con = sqlite3.connect(path)
    try:
        cur = con.execute("SELECT ikey, ver, conf, ts FROM vault WHERE uid=?", (uid,))
        row = cur.fetchone()
        if not row:
            return None
        return {"identity_key": row[0], "pepper_version": row[1], "confidence": row[2], "created_at": row[3]}
    finally:
        con.close()


def resolve(nombre=None, cedula=None, fecha_iso=None, nacionalidad=None, fecha_nac=None) -> dict:
    """Resuelve identidad -> {subject_ref, identity_key, confidence, is_new}.

    Estable: misma PII canonica + mismo pepper => mismo identity_key y
    mismo uid (re-emite el existente). `fecha_nac` es alias de fecha_iso.
    No retorna ni loguea PII.
    """
    fecha = fecha_iso if fecha_iso is not None else fecha_nac
    key, ver = identity_key(nombre, cedula, fecha, nacionalidad)
    conf = confidence_for(nombre, cedula, fecha, nacionalidad)
    with _lock:
        uid = _by_key.get(key)
        if uid:
            return {"subject_ref": uid, "identity_key": key, "pepper_version": ver,
                    "confidence": conf, "is_new": False}
        uid = _new_uid()
        rec = {"identity_key": key, "pepper_version": ver, "confidence": conf,
               "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        _vault[uid] = rec
        _by_key[key] = uid
    _sqlite_save(uid, rec)
    return {"subject_ref": uid, "identity_key": key, "pepper_version": ver,
            "confidence": conf, "is_new": True}


def resolve_uid(uid: str) -> dict | None:
    """uid opaco -> {identity_key, pepper_version, confidence} o None.

    Sigue alias de merge_alias. Valida formato cet_<32hex>.
    """
    if not uid or not isinstance(uid, str):
        return None
    with _lock:
        target = _alias.get(uid, uid)
        rec = _vault.get(target)
    if rec:
        return {"subject_ref": target, "identity_key": rec["identity_key"],
                "pepper_version": rec["pepper_version"], "confidence": rec["confidence"]}
    rec = _sqlite_load(target)
    if rec:
        return {"subject_ref": target, **rec}
    if not _UID_RE.match(uid):
        return None
    return None


def merge_alias(uid_keep: str, uid_drop: str) -> dict:
    """Fusiona alias: uid_drop -> uid_keep. Retorna comprobante sin PII."""
    if not _UID_RE.match(uid_keep or "") or not _UID_RE.match(uid_drop or ""):
        raise ValueError("uid con formato invalido (cet_<32hex>)")
    with _lock:
        if uid_keep not in _vault or uid_drop not in _vault:
            # intenta hidratar desde sqlite
            for u in (uid_keep, uid_drop):
                if u not in _vault:
                    rec = _sqlite_load(u)
                    if rec:
                        _vault[u] = rec
        if uid_keep not in _vault or uid_drop not in _vault:
            raise KeyError("uid desconocido")
        if uid_keep == uid_drop:
            raise ValueError("uid_keep y uid_drop identicos")
        _alias[uid_drop] = uid_keep
    return {"kept": uid_keep, "aliased": uid_drop, "ok": True}


def clear_memory() -> None:
    """Solo tests: limpia vault/alias en memoria."""
    with _lock:
        _vault.clear()
        _by_key.clear()
        _alias.clear()
