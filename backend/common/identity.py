"""
Identidad Bancaria Cifrada — HMAC+Pepper + AES-GCM/DEK
Compatible con plan maestro §4.2 y PLAN_INTEGRACION_BANCO_DIGITAL.md §4

Este módulo proporciona:
- identity_key: HMAC-SHA256 determinista con pepper rotativo (lookup deduplicante)
- uid_enc: Fernet/AES-GCM envelope (lo que ve el LLM/Spark, opaco sin KMS)
- subject_ref: referencia estable para transacciones/eventos (uid_enc)
"""
import os
import hmac
import hashlib
import unicodedata
import base64
from typing import Optional, Tuple
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


_IDENTITY_PEPPER_KEY = "IDENTITY_PEPPER"          # En KMS/Infisical
_DEK_PII_KEY = "DEK_PII"                          # En KMS/Infisical (rotación 90d)
_DEK_PII_VERSION_KEY = "DEK_PII_VERSION"          # Para rotación suave


def _get_secret(key: str) -> bytes:
    """Obtiene secreto de KMS/Infisical/env. En prod: usar cliente KMS real."""
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Secreto {key} no configurado en KMS/Infisical/env")
    return base64.urlsafe_b64decode(val) if len(val) % 4 == 0 else val.encode()


def _normalize(v: str) -> str:
    """NFKD + uppercase + ASCII only (estable para cédula/nombre/fecha/nacionalidad)."""
    return unicodedata.normalize('NFKD', v.strip().upper()).encode('ascii', 'ignore').decode()


def identity_key(
    nombre: str,
    cedula: str,
    fecha_nac: str,
    nacionalidad: str,
    pepper: Optional[bytes] = None
) -> str:
    """
    Genera clave de identidad determinista (HMAC-SHA256 + pepper).
    
    Args:
        nombre: Nombre completo
        cedula: Cédula/identidad nacional
        fecha_nac: Fecha nacimiento YYYY-MM-DD (inmutable)
        nacionalidad: Código país (EC, CO, etc.)
        pepper: Pepper del KMS (rotativo). Si None, usa env IDENTITY_PEPPER.
    
    Returns:
        Hex string de 64 chars (SHA256). Único por persona, estable en el tiempo.
    
    Nota: Edad NO entra en el key (cambia cada año). Se calcula al vuelo en borde.
    """
    if pepper is None:
        pepper = _get_secret(_IDENTITY_PEPPER_KEY)
    
    raw = "|".join([
        _normalize(nombre),
        cedula.strip(),
        fecha_nac,
        _normalize(nacionalidad)
    ])
    return hmac.new(pepper, raw.encode(), hashlib.sha256).hexdigest()


def _get_dek() -> Tuple[bytes, int]:
    """Obtiene DEK actual + versión. En prod: KMS Transit decrypt."""
    dek_b64 = os.getenv(_DEK_PII_KEY)
    version = int(os.getenv(_DEK_PII_VERSION_KEY, "1"))
    if not dek_b64:
        raise RuntimeError("DEK_PII no configurado en KMS/Infisical")
    return base64.urlsafe_b64decode(dek_b64), version


def uid_enc(identity_key_hex: str, dek: Optional[bytes] = None, version: int = 1) -> str:
    """
    Cifra identity_key en envelope AES-GCM (Fernet-compatible) para LLM/Spark.
    
    Returns:
        String base64url: "v{version}:{ciphertext}" — opaco, irreversible sin KMS.
    """
    if dek is None:
        dek, version = _get_dek()
    
    plaintext = f"uid:{identity_key_hex}".encode()
    f = Fernet(base64.urlsafe_b64encode(dek))
    token = f.encrypt(plaintext)
    return f"v{version}:{token.decode()}"


def uid_dec(uid_enc_str: str) -> str:
    """
    Descifra uid_enc → identity_key_hex (solo borde autorizado con KMS).
    Raises: InvalidToken si version/DEK incorrecto.
    """
    if not uid_enc_str.startswith("v"):
        raise ValueError("Formato uid_enc inválido")
    
    version_str, token = uid_enc_str.split(":", 1)
    version = int(version_str[1:])
    
    dek, _ = _get_dek()  # En prod: KMS get version-specific DEK
    f = Fernet(base64.urlsafe_b64encode(dek))
    plaintext = f.decrypt(token.encode())
    
    if not plaintext.startswith(b"uid:"):
        raise ValueError("Token corrupto")
    return plaintext[4:].decode()


def generate_identity_pepper() -> str:
    """Genera pepper nuevo (32 bytes base64url) para rotación en KMS."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


def generate_dek() -> str:
    """Genera DEK nuevo (32 bytes base64url) para rotación en KMS."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


# === Compatibilidad con tablas subjects/pii_vault ===

def subject_ref_from_identity(nombre: str, cedula: str, fecha_nac: str, nacionalidad: str) -> str:
    """Helper: identity_key → uid_enc (subject_ref para BD/eventos)."""
    ik = identity_key(nombre, cedula, fecha_nac, nacionalidad)
    return uid_enc(ik)


def verify_identity_match(
    nombre: str, cedula: str, fecha_nac: str, nacionalidad: str,
    stored_identity_key_hex: str
) -> bool:
    """Verifica si datos en claro coinciden con identity_key almacenado (constante-time)."""
    computed = identity_key(nombre, cedula, fecha_nac, nacionalidad)
    return hmac.compare_digest(computed, stored_identity_key_hex)


def compute_age_display(fecha_nac: str) -> int:
    """Calcula edad a partir de fecha_nac (solo para borde autorizado)."""
    from datetime import date
    try:
        y, m, d = map(int, fecha_nac.split("-"))
        today = date.today()
        return today.year - y - ((today.month, today.day) < (m, d))
    except Exception:
        return 0