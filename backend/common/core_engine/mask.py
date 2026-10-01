"""Enmascarado por rol (stdlib only).

Upgrade AES-GCM (mismo API, CORE_CRYPTO=std|aesgcm):
  - Hoy: mascaras irreversibles de presentacion (***4567, ***123, edad).
  - Upgrade: la mascara seguiria igual en presentacion; con aesgcm el
    origen PII viviria sellado en vault y este modulo solo veria el
    placeholder. Sin cambios de firma.
"""

from __future__ import annotations

import datetime
import re

_PRIVILEGED = {"admin", "medico", "doctor", "super_admin"}


def mask_cedula(value: str | None) -> str:
    """cedula -> ***4567 (ultimos 4; si <4, enmascara todo)."""
    d = re.sub(r"\D+", "", str(value or ""))
    if len(d) <= 4:
        return "***"
    return "***" + d[-4:]


def birth_to_age_display(value: str | None, today: datetime.date | None = None) -> str:
    """birth_date ISO -> 'N años' (o 'N meses' si <1 año; 'desconocido')."""
    try:
        b = datetime.date.fromisoformat(str(value).strip()[:10])
    except (ValueError, TypeError):
        return "desconocido"
    t = today or datetime.date.today()
    months = (t.year - b.year) * 12 + (t.month - b.month) - (1 if t.day < b.day else 0)
    if months < 0:
        return "desconocido"
    if months < 12:
        return f"{months} meses"
    return f"{months // 12} años"


def mask_phone(value: str | None) -> str:
    """telefono -> ***123 (ultimos 3)."""
    d = re.sub(r"\D+", "", str(value or ""))
    if len(d) <= 3:
        return "***"
    return "***" + d[-3:]


def mask_generic(value: object, rol: str = "analyst") -> str:
    """Generico por rol: privilegiado ve parcial (2+***), resto ***."""
    s = str(value or "")
    if not s:
        return "***"
    if (rol or "").strip().lower() in _PRIVILEGED:
        return (s[:2] + "***") if len(s) > 2 else "***"
    return "***"


def mask_payload(payload: dict, rol: str = "analyst") -> dict:
    """Aplica mascaras por campo segun rol."""
    if not isinstance(payload, dict):
        raise ValueError("payload debe ser objeto")
    out = dict(payload)
    for k in ("cedula", "id_number", "documento"):
        if k in out:
            out[k] = mask_cedula(out[k])
    for k in ("telefono", "phone"):
        if k in out:
            out[k] = mask_phone(out[k])
    for k in ("birth_date", "fecha_nac", "fecha_nacimiento"):
        if k in out:
            out[k] = birth_to_age_display(out[k])
    for k in ("nombre", "name", "full_name", "email", "direccion", "address"):
        if k in out:
            out[k] = mask_generic(out[k], rol)
    return out
