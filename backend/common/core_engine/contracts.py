"""Validador ODCS minimo (stdlib only).

Upgrade AES-GCM: sin impacto (contratos describen datos, no cifrado).
"""

from __future__ import annotations

import re

REQUIRED_TOP = ("name", "domain", "owner", "version", "schema", "slo")
_SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def validate_contract(doc: dict) -> tuple[bool, list[str]]:
    """Valida contrato ODCS minimo -> (ok, errores)."""
    errs: list[str] = []
    if not isinstance(doc, dict):
        return False, ["contrato debe ser objeto"]
    for f in REQUIRED_TOP:
        if f not in doc or doc[f] in (None, ""):
            errs.append(f"falta {f}")
    if doc.get("version") and not _SEMVER.match(str(doc["version"]).strip()):
        errs.append("version debe ser semver X.Y.Z")
    schema = doc.get("schema")
    if schema is not None:
        if not isinstance(schema, dict):
            errs.append("schema debe ser objeto")
        elif not schema:
            errs.append("schema vacio")
    slo = doc.get("slo")
    if slo is not None and not isinstance(slo, dict):
        errs.append("slo debe ser objeto")
    return (len(errs) == 0), errs
