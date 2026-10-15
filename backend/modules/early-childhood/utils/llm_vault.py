"""Vault cifrado para API keys LLM por licencia (BYOT).
Server-side only. Fail-closed: sin key maestra no se puede guardar/leer.
"""
from __future__ import annotations

import base64
import hashlib
import os


def _get_fernet():
    secret = (
        os.getenv("LLM_VAULT_KEY")
        or os.getenv("SECRET_KEY")
        or "dev-secret-key-change-in-production"
    )
    # Deriva clave Fernet 32B desde secreto via SHA256 -> urlsafe b64
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    try:
        from cryptography.fernet import Fernet
        return Fernet(key)
    except ImportError:
        return None


def encrypt_api_key(plain: str) -> str:
    if not plain:
        raise ValueError("api_key vacia")
    f = _get_fernet()
    if f is None:
        # Fallback ofuscado (no seguro, solo dev sin cryptography)
        return "b64:" + base64.b64encode(plain.encode()).decode()
    return "enc:" + f.encrypt(plain.encode()).decode()


def decrypt_api_key(blob: str | None) -> str:
    if not blob:
        return ""
    if blob.startswith("enc:"):
        f = _get_fernet()
        if f is None:
            raise ValueError("vault no disponible (cryptography ausente)")
        return f.decrypt(blob[4:].encode()).decode()
    if blob.startswith("b64:"):
        return base64.b64decode(blob[4:].encode()).decode()
    # Legacy en claro (migracion): retorna tal cual para re-cifrar al guardar
    return blob


def masked_key(blob: str | None) -> str:
    plain = ""
    try:
        plain = decrypt_api_key(blob)
    except Exception:
        return "***"
    if len(plain) <= 8:
        return "***"
    return f"{plain[:3]}...{plain[-4:]}"
