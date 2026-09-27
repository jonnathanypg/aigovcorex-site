"""
F5 — Normalización de teléfonos a E.164 por país (cero hardcodes EC).

Regla Javier: teléfonos en formato 593 (no 09). El prefijo se resuelve desde
CountryConfig (default EC/593); `country_dummy` (XX/999) prueba alcance global.
"""
import re

# Fallback si no hay DB/CountryConfig (seed v1: EC default global)
DEFAULT_PREFIXES = {
    "EC": "593",
    "XX": "999",  # país_dummy de tests (alcance global)
}
DEFAULT_ISO = "EC"


def resolve_phone_prefix(country_iso="EC"):
    """Prefijo telefónico por país: CountryConfig → fallback seed → EC."""
    iso = (country_iso or DEFAULT_ISO).upper()
    try:
        from models.cmci import CountryConfig
        cfg = CountryConfig.query.filter_by(country_iso=iso).first()
        if cfg and cfg.phone_prefix:
            return str(cfg.phone_prefix)
    except Exception:
        pass
    return DEFAULT_PREFIXES.get(iso, DEFAULT_PREFIXES[DEFAULT_ISO])


def normalize_phone_e164(raw, country_iso="EC"):
    """09XXXXXXXX → +593XXXXXXXX (EC); genérico por país.

    - '+593...' / '00593...' se conservan (solo limpieza).
    - '09...' → '+<prefijo>9...' (quita el 0 inicial).
    - '<prefijo>...' sin '+' → se antepone '+'.
    - 9-10 dígitos sin prefijo → '+<prefijo><dígitos>'.
    Retorna None si vacío; si no es parseable retorna dígitos limpios.
    """
    if raw is None:
        return None
    digits = re.sub(r"[^\d]", "", str(raw))
    if not digits:
        return None
    prefix = resolve_phone_prefix(country_iso)
    if str(raw).strip().startswith("+"):
        return "+" + digits
    if digits.startswith("00"):
        return "+" + digits[2:]
    if digits.startswith(prefix) and len(digits) > len(prefix):
        return "+" + digits
    if digits.startswith("0"):
        return "+" + prefix + digits[1:]
    if 9 <= len(digits) <= 10:
        return "+" + prefix + digits
    return "+" + digits


def is_e164(phone):
    """True si ya está en formato E.164 (+<prefijo><número>)."""
    return bool(phone) and re.fullmatch(r"\+\d{8,15}", str(phone)) is not None
