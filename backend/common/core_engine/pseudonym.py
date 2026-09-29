"""Pseudonimizacion por politica (stdlib only).

Upgrade AES-GCM (mismo API, CORE_CRYPTO=std|aesgcm):
  - Hoy: sustitucion determinista de PII por subject_ref (token opaco).
  - Upgrade: los valores PII podrian sellarse con AES-GCM (nonce por campo,
    AAD=subject_ref+campo) y guardar `enc:<b64>` en vez de suprimir; el API
    `pseudonymize()`/`PolicyFilter` no cambiaria.
"""

from __future__ import annotations

PII_FIELDS = {"nombre", "name", "full_name", "cedula", "id_number", "documento",
              "telefono", "phone", "email", "direccion", "address", "birth_date",
              "fecha_nac", "fecha_nacimiento", "nacionalidad", "foto", "huella"}

# intent -> rol -> campos PII permitidos (todo lo demas se pseudonimiza)
_POLICY: dict[str, dict[str, set[str]]] = {
    "care": {
        "admin": {"nombre", "telefono"},
        "medico": {"nombre", "telefono", "birth_date"},
        "educador": {"nombre"},
        "default": set(),
    },
    "support": {
        "admin": {"nombre", "telefono"},
        "default": set(),
    },
    "analytics": {"default": set()},
    "billing": {
        "admin": {"nombre", "cedula"},
        "default": set(),
    },
}


class PolicyFilter:
    """PolicyFilter(intent, rol, finalidad) -> campos permitidos."""

    def __init__(self, intent: str = "analytics", rol: str = "analyst", finalidad: str = ""):
        self.intent = (intent or "analytics").strip().lower()
        self.rol = (rol or "analyst").strip().lower()
        self.finalidad = (finalidad or "").strip()

    def allowed_fields(self) -> set[str]:
        table = _POLICY.get(self.intent, {})
        if self.rol in table:
            return set(table[self.rol])
        return set(table.get("default", set()))

    def to_dict(self) -> dict:
        return {"intent": self.intent, "rol": self.rol, "finalidad": self.finalidad,
                "allowed": sorted(self.allowed_fields())}


def pseudonymize(payload: dict, subject_ref: str = "", intent: str = "analytics",
                 rol: str = "analyst", finalidad: str = "",
                 policy: PolicyFilter | None = None) -> dict:
    """Sustituye PII por subject_ref salvo campos permitidos por politica.

    Upgrade AES-GCM: mismo API; con aesgcm los campos recortados se
    retornarian como `enc:<...>` sellados en vez de el placeholder.
    """
    if not isinstance(payload, dict):
        raise ValueError("payload debe ser objeto")
    pf = policy or PolicyFilter(intent, rol, finalidad)
    allowed = pf.allowed_fields()
    ref = subject_ref or "cet_unknown"
    out: dict = {}
    for k, v in payload.items():
        if k == "subject_ref":
            out[k] = v
            continue
        if k in PII_FIELDS and k not in allowed:
            out[k] = f"[{ref}]" if k in ("nombre", "name", "full_name") else f"pseud:{ref}"
        else:
            out[k] = v
    out.setdefault("subject_ref", ref)
    return out
