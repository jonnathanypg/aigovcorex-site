"""Pepper versionado + DEK refs (stdlib only).

Upgrade a AES-GCM (mismo API, flag CORE_CRYPTO=std|aesgcm):
  - Hoy: HMAC-SHA256 + tokens opacos; el "vault" guarda solo identity_key,
    nunca PII ni claves. CORE_CRYPTO=std es el unico modo activo.
  - Upgrade: si CORE_CRYPTO=aesgcm y hay paquete `cryptography` disponible,
    cifrar el identity_key en reposo con AES-GCM (nonce 96b aleatorio,
    AAD=uid_enc+pepper_version). El API publico (get_pepper, dek_ref,
    fail_closed, status) NO cambia; solo el almacenamiento interno del vault
    pasa de plaintext-ref a sealed blob. Mantener fail_closed si falta
    CORE_PEPPER_* o el keystore AES.
"""

from __future__ import annotations

import os

ENV_VERSION = "CORE_PEPPER_VERSION"
ENV_CURRENT = "CORE_PEPPER"
ENV_FILE = "CORE_PEPPER_FILE"  # ruta a fichero tipo sops/plain con el pepper
ENV_CRYPTO = "CORE_CRYPTO"  # std | aesgcm (solo std implementado)


class MissingSecretError(RuntimeError):
    """Se lanza cuando no hay secreto configurado (fail-closed)."""


def crypto_mode() -> str:
    """Modo cripto: 'std' (activo) | 'aesgcm' (reservado, mismo API).

    Upgrade AES-GCM: con CORE_CRYPTO=aesgcm se usaria AES-GCM para sellar
    el vault en reposo; este stdlib build lo reporta pero sigue operando
    en modo std (sin dependencias externas).
    """
    return os.environ.get(ENV_CRYPTO, "std").strip().lower() or "std"


def _read_file_secret() -> str | None:
    path = os.environ.get(ENV_FILE, "").strip()
    if not path:
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            val = fh.read().strip()
            return val or None
    except OSError:
        return None


def current_version() -> str:
    """Version activa del pepper (default 'v1')."""
    return os.environ.get(ENV_VERSION, "v1").strip() or "v1"


def list_versions() -> list[str]:
    """Versiones con secreto disponible en entorno (CORE_PEPPER_V<n>)."""
    out = []
    for k in os.environ:
        if k.startswith("CORE_PEPPER_V") and k not in (ENV_VERSION, ENV_CURRENT, ENV_FILE, ENV_CRYPTO):
            suffix = k[len("CORE_PEPPER_"):]
            if suffix and suffix[0] == "V" and suffix[1:].strip("_").isalnum():
                out.append(suffix.lower())  # V1 -> v1
    if ENV_CURRENT in os.environ and os.environ[ENV_CURRENT].strip():
        if current_version() not in out:
            out.append(current_version())
    if _read_file_secret() and current_version() not in out:
        out.append(current_version())
    return sorted(set(out))


def get_pepper(version: str | None = None) -> tuple[str, str]:
    """Retorna (pepper, version). Fail-closed si no hay secreto.

    Orden: CORE_PEPPER_V<ver> > CORE_PEPPER (si version==activa) >
    CORE_PEPPER_FILE. Nunca retorna default hardcodeado.

    Upgrade AES-GCM: mismo API; con aesgcm el pepper se usaria ademas
    como KEK-input via HKDF para derivar DEKs por dominio.
    """
    ver = (version or current_version()).strip() or "v1"
    key = f"CORE_PEPPER_{ver.upper()}"
    val = os.environ.get(key, "").strip()
    if val:
        return val, ver
    if ver == current_version():
        cur = os.environ.get(ENV_CURRENT, "").strip()
        if cur:
            return cur, ver
        fval = _read_file_secret()
        if fval:
            return fval, ver
    raise MissingSecretError(
        f"fail-closed: sin secreto para version '{ver}' "
        f"(defina {key} o {ENV_CURRENT}/{ENV_FILE})"
    )


def fail_closed() -> None:
    """Valida que exista secreto; lanza MissingSecretError si no."""
    get_pepper()


def dek_ref(name: str) -> str:
    """Referencia opaca a una DEK por dominio (nunca expone material).

    Upgrade AES-GCM: con aesgcm, dek_ref() seguiria retornando el mismo
    formato 'dek:<name>:<version>'; el desenvolvimiento real ocurriria en
    un KMS/vault externo. Hoy solo se retorna la referencia versionada.
    """
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in (name or "").strip()) or "default"
    return f"dek:{safe}:{current_version()}"


def rehmac(old_hex: str, old_version: str, new_version: str | None = None) -> dict:
    """Rotacion con re-HMAC: documenta el procedimiento sin tocar PII.

    Como el vault solo guarda identity_key (HMAC, no reversible a PII),
    la rotacion consiste en re-resolver identidades y re-emitir keys con
    el pepper nuevo; este helper deja constancia del par versionado.
    El re-HMAC real de PII solo puede hacerlo quien posee la PII original.

    Upgrade AES-GCM: mismo API; con aesgcm se re-sellarian los blobs del
    vault con la DEK nueva manteniendo AAD(uid+version).
    """
    return {
        "old_version": old_version,
        "new_version": new_version or current_version(),
        "old_key_prefix": (old_hex or "")[:8],
        "note": "re-resolve identities with new pepper; vault holds only HMAC keys",
        "crypto": crypto_mode(),
    }


def status() -> dict:
    """Estado de claves sin exponer secretos."""
    try:
        _, ver = get_pepper()
        ok = True
    except MissingSecretError as exc:
        return {"ok": False, "error": str(exc), "crypto": crypto_mode()}
    return {
        "ok": ok,
        "active_version": ver,
        "available_versions": list_versions(),
        "crypto": crypto_mode(),
        "fail_closed": True,
    }
