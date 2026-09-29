"""Tests F5 — endurecimiento multicentro + go-live (§Fase 5 + §10.7).

- IDOR: ficha de otro tenant (cruza site) → 404.
- RBAC §10.7: catering no crea ficha → 403 (solo menú/ingesta).
- Rate-limit auth: config 5/min/IP presente + ventana deslizante funcional.
- Alcance global: country_dummy (XX/999) resuelve prefijo distinto a EC/593
  + depuración 09→593 en E.164.
Sin firma electrónica en ningún caso (firma física en papel, fuera del sistema).

Ejecución: pytest tests/test_cmci_f5.py
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from models import db
import models.tenant  # noqa: F401
import models.user  # noqa: F401
import models.cmci  # noqa: F401


import importlib.util

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load_cmci_module():
    """Carga api/cmci.py por ruta (evita api/__init__.py, que arrastra
    blueprints con deps pesadas como pytz no instaladas en test)."""
    if "cmci_api_f5" in sys.modules:
        return sys.modules["cmci_api_f5"]
    spec = importlib.util.spec_from_file_location(
        "cmci_api_f5", os.path.join(_HERE, "..", "api", "cmci.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["cmci_api_f5"] = mod
    spec.loader.exec_module(mod)
    return mod


def make_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = "f5-test-secret"
    app.config["PROPAGATE_EXCEPTIONS"] = True
    db.init_app(app)
    JWTManager(app)
    cmci_mod = _load_cmci_module()
    cmci_bp, _VULN_DB, _SEQ = cmci_mod.cmci_bp, cmci_mod._VULN_DB, cmci_mod._SEQ
    from auth.authentication import auth_bp
    app.register_blueprint(cmci_bp, url_prefix="/api/cmci")
    app.register_blueprint(auth_bp)
    # Limpia stores en memoria entre apps (globales del módulo)
    _VULN_DB.clear()
    _SEQ["vuln"] = 0
    _SEQ["soc"] = 0
    return app


@pytest.fixture()
def ctx():
    import models.license  # noqa: F401 (FK tenants.license_id)
    import models.child  # noqa: F401 (FK vulnerability_assessments.child_id)
    import models.attendance  # noqa: F401 (rel Child.attendances)
    import models.nutrition  # noqa: F401
    import models.health  # noqa: F401
    import models.milestone  # noqa: F401
    import models.planning  # noqa: F401
    import models.intervention  # noqa: F401
    import models.report  # noqa: F401
    from models.tenant import Tenant
    from models.user import User, Role
    app = make_app()
    with app.app_context():
        db.create_all()
        roles = {}
        for rn in ("educadora", "catering", "coordinator"):
            r = Role(name=rn, description=rn)
            db.session.add(r)
            roles[rn] = r
        db.session.flush()
        tenant_a = Tenant(name="CMCI Orquídeas", cmci_code="OR",
                          country_iso="EC")
        tenant_b = Tenant(name="CMCI Guasmo", cmci_code="GU",
                          country_iso="EC")
        db.session.add_all([tenant_a, tenant_b])
        db.session.flush()
        users = {}
        for key, (tid, rn) in {"edu_a": (None, "educadora"),
                               "cat_a": (None, "catering"),
                               "coord_a": (None, "coordinator"),
                               "edu_b": (None, "educadora")}.items():
            u = User(tenant_id=tid, role_id=roles[rn].id,
                     email=f"{key}@test.ec", first_name="T", last_name="U")
            u.set_password("x")
            db.session.add(u)
            users[key] = u
        db.session.flush()
        users["edu_a"].tenant_id = tenant_a.id
        users["cat_a"].tenant_id = tenant_a.id
        users["coord_a"].tenant_id = tenant_a.id
        users["edu_b"].tenant_id = tenant_b.id
        db.session.commit()
        ids = {"tenant_a": tenant_a.id, "tenant_b": tenant_b.id,
               **{k: u.id for k, u in users.items()}}
    return app, ids


def _auth(app, uid):
    with app.app_context():
        tok = create_access_token(identity=str(uid))
    return {"Authorization": f"Bearer {tok}"}


# ── IDOR tenant==site ────────────────────────────────────────────────────

def test_idor_cruza_sitio_404(ctx):
    """Ficha del tenant A vista por usuario del tenant B → 404.

    NOTA contrato DB-first: la persistencia primaria de CMCI es la tabla
    vulnerability_assessments (api/cmci.py), por eso la fixture inserta el
    row en DB en vez de manipular el fallback en memoria _VULN_DB
    (solo activo si la DB no está disponible).
    """
    from datetime import date
    from models import db as _db
    from models.cmci import VulnerabilityAssessment
    app, ids = ctx
    client = app.test_client()
    with app.app_context():
        rec = VulnerabilityAssessment(
            center_id=ids["tenant_a"], code="FV-X-001", status="Validada",
            assessed_at=date(2026, 9, 1), total=61.1,
            level="Vulnerabilidad alta", priority="PRIORIDAD 1",
            protection_alert=False)
        _db.session.add(rec)
        _db.session.commit()
        rid = rec.id
    with app.test_request_context():
        pass
    # Mismo tenant: 200
    r = client.get(f"/api/cmci/vulnerability/{rid}",
                   headers=_auth(app, ids["edu_a"]))
    assert r.status_code == 200, r.get_json()
    # Cruza de sitio: 404 (no 403: no se revela existencia)
    r = client.get(f"/api/cmci/vulnerability/{rid}",
                   headers=_auth(app, ids["edu_b"]))
    assert r.status_code == 404, r.get_json()
    # Filtro site forzado en listado: pedir otro centro → 404
    r = client.get("/api/cmci/vulnerability?center=GU",
                   headers=_auth(app, ids["edu_a"]))
    assert r.status_code == 404, r.get_json()
    # Listado propio no filtra de más
    r = client.get("/api/cmci/vulnerability",
                   headers=_auth(app, ids["edu_a"]))
    assert r.status_code == 200
    assert r.get_json()["total"] == 1
    r = client.get("/api/cmci/vulnerability",
                   headers=_auth(app, ids["edu_b"]))
    assert r.get_json()["total"] == 0


# ── RBAC §10.7 (sin firma electrónica) ────────────────────────────────────

def test_catering_no_crea_ficha_403(ctx):
    """Catering solo menú/ingesta: POST fichas → 403."""
    app, ids = ctx
    client = app.test_client()
    for path in ("/api/cmci/vulnerability", "/api/cmci/socioeconomic"):
        r = client.post(path, json={"answers": {}, "data": {}},
                        headers=_auth(app, ids["cat_a"]))
        assert r.status_code == 403, (path, r.get_json())
        assert "menú" in r.get_json()["error"]
    # Coordinadora revisa en papel impreso: no crea en sistema → 403
    r = client.post("/api/cmci/vulnerability", json={"answers": {}},
                    headers=_auth(app, ids["coord_a"]))
    assert r.status_code == 403, r.get_json()
    # Educadora sí pasa el guard (falla en motor por body vacío, no en RBAC)
    r = client.post("/api/cmci/vulnerability", json={"answers": {}},
                    headers=_auth(app, ids["edu_a"]))
    assert r.status_code != 403, r.get_json()


def test_matriz_rbac_helpers():
    from utils.role_helpers import (can_create_ficha, is_catering,
                                    can_view_cmci_global)

    class _R:
        def __init__(self, name):
            self.name = name

    class _U:
        def __init__(self, name):
            self.role = _R(name)
            self.tenant_id = 1

    assert can_create_ficha(_U("educadora")) is True
    assert can_create_ficha(_U("auxiliar_parvulos")) is True
    assert can_create_ficha(_U("coordinator")) is False
    assert can_create_ficha(_U("catering")) is False
    assert is_catering(_U("catering")) is True
    assert can_view_cmci_global(_U("super_admin")) is True
    assert can_view_cmci_global(_U("educadora")) is False


# ── Rate-limit auth 5/min/IP ─────────────────────────────────────────────

def test_rate_limit_config_presente():
    from auth import rate_limit as rl
    assert rl.AUTH_RATE_LIMIT_PER_MINUTE == 5
    assert rl.RATE_LIMIT_AUTH_WINDOW_SECONDS == 60
    assert rl.RATE_LIMIT_AUTH == "5/minute"


def test_rate_limit_ventana_deslizante():
    from auth.rate_limit import (is_rate_limited, _register_hit,
                                 reset_rate_limit,
                                 AUTH_RATE_LIMIT_PER_MINUTE)
    ip = "10.9.9.9-f5"
    reset_rate_limit(ip)
    base = 1_700_000_000.0
    for i in range(AUTH_RATE_LIMIT_PER_MINUTE):
        assert is_rate_limited(ip, now=base + i) is False
        _register_hit(ip, now=base + i)
    assert is_rate_limited(ip, now=base + 5) is True  # 6.º en <60s
    assert is_rate_limited(ip, now=base + 61) is False  # ventana expiró
    reset_rate_limit(ip)


def test_login_bloquea_sexto_intento_429(ctx):
    """End-to-end: 5 logins fallidos OK (401) y el 6.º → 429."""
    from auth.rate_limit import reset_rate_limit
    app, _ = ctx
    client = app.test_client()
    reset_rate_limit()
    codes = []
    for _ in range(6):
        r = client.post("/api/auth/login",
                        json={"email": "nadie@test.ec", "password": "x"},
                        environ_base={"REMOTE_ADDR": "10.8.8.8-f5"})
        codes.append(r.status_code)
    assert codes[:5] == [401] * 5, codes
    assert codes[5] == 429, codes
    assert client.post("/api/auth/login",
                       json={"email": "nadie@test.ec", "password": "x"},
                       environ_base={"REMOTE_ADDR": "10.8.8.8-f5"}
                       ).get_json()["rate_limit"] == "5/minute"
    reset_rate_limit()


# ── Alcance global: país_dummy + E.164 ────────────────────────────────────

def test_country_dummy_prefijo_distinto(ctx):
    """XX/999 resuelve distinto a EC/593 (cero hardcodes EC)."""
    from utils.phone_utils import resolve_phone_prefix
    app, _ = ctx
    with app.app_context():
        assert resolve_phone_prefix("EC") == "593"
        assert resolve_phone_prefix("XX") == "999"
        assert resolve_phone_prefix("XX") != resolve_phone_prefix("EC")


def test_depuracion_09_a_593():
    """09XXXXXXXX → +593XXXXXXXX; idempotente si ya es E.164."""
    from utils.phone_utils import (normalize_phone_e164, is_e164,
                                   resolve_phone_prefix)
    assert normalize_phone_e164("0991234567", "EC") == "+593991234567"
    assert normalize_phone_e164("09 912 34567", "EC") == "+593991234567"
    assert normalize_phone_e164("+593991234567", "EC") == "+593991234567"
    assert is_e164("+593991234567") is True
    assert is_e164("0991234567") is False
    # País dummy: misma regla, otro prefijo
    assert resolve_phone_prefix("XX") == "999"
    assert normalize_phone_e164("0991234567", "XX") == "+999991234567"


if __name__ == "__main__":
    import subprocess
    raise SystemExit(subprocess.call(
        [sys.executable, "-m", "pytest", __file__, "-v"]))
