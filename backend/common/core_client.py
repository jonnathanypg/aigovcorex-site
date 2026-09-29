"""Cliente SDK stdlib (urllib) del MOTOR.

Uso:
    from core_client import CoreClient
    c = CoreClient("http://localhost:5050")  # o Flask http://.../core/v1...
    c.health(); c.resolve_identity(...); ...
"""

from __future__ import annotations

import json
import urllib.request


class CoreClient:
    """CoreClient(base_url) con mismos metodos que la API."""

    def __init__(self, base_url: str, timeout: float = 10.0):
        self.base = base_url.rstrip("/")
        # acepta base con o sin /core/v1
        if not self.base.endswith("/core/v1"):
            self.base += "/core/v1"
        self.timeout = timeout

    def _call(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body or {}).encode("utf-8")
        req = urllib.request.Request(self.base + path, data=data if method != "GET" else None,
                                     method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as exc:
            return {"error": str(exc)}

    def health(self) -> dict:
        return self._call("GET", "/health", {})

    def resolve_identity(self, nombre="", cedula="", fecha_iso="", nacionalidad="") -> dict:
        return self._call("POST", "/identity/resolve",
                          {"nombre": nombre, "cedula": cedula, "fecha_iso": fecha_iso,
                           "nacionalidad": nacionalidad})

    def pseudonymize(self, payload: dict, subject_ref="", intent="analytics",
                     rol="analyst", finalidad="") -> dict:
        return self._call("POST", "/pseudonymize",
                          {"payload": payload, "subject_ref": subject_ref,
                           "intent": intent, "rol": rol, "finalidad": finalidad})

    def mask(self, payload: dict, rol="analyst") -> dict:
        return self._call("POST", "/mask", {"payload": payload, "rol": rol})

    def publish_event(self, envelope: dict) -> dict:
        return self._call("POST", "/events/publish", {"envelope": envelope})

    def audit_append(self, actor="", accion="", subject_ref="", finalidad="") -> dict:
        return self._call("POST", "/audit/append",
                          {"actor": actor, "accion": accion,
                           "subject_ref": subject_ref, "finalidad": finalidad})

    def audit_verify(self) -> dict:
        return self._call("POST", "/audit/verify", {})

    def keys_status(self) -> dict:
        return self._call("GET", "/keys/status", {})

    def forget(self, subject_ref="") -> dict:
        return self._call("POST", "/subjects/forget", {"subject_ref": subject_ref})
