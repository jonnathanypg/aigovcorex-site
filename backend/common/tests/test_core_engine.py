"""Tests del MOTOR (stdlib + pytest + Flask test_client e2e)."""

import os
import sys

import pytest

# stdlib engine directo (sin Flask)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("CORE_PEPPER_V1", "test-pepper-v1")
os.environ.setdefault("CORE_PEPPER_V2", "test-pepper-v2")
os.environ.setdefault("CORE_PEPPER_VERSION", "v1")

from core_engine import audit, contracts, events, identity, keys, mask, pseudonym  # noqa: E402


@pytest.fixture(autouse=True)
def _clean():
    identity.clear_memory()
    audit.clear()
    events.default_producer.events.clear()
    yield
    identity.clear_memory()
    audit.clear()
    events.default_producer.events.clear()


def test_identity_stable_and_normalized():
    a = identity.resolve("María José", "1710034065", "2019-04-03", "ec")
    b = identity.resolve("maria jose", "1710034065", "2019-04-03", "EC")
    assert a["subject_ref"] == b["subject_ref"]
    assert a["identity_key"] == b["identity_key"]
    assert a["subject_ref"].startswith("cet_")
    assert a["confidence"] == "high"


def test_pepper_change_changes_key():
    os.environ["CORE_PEPPER_VERSION"] = "v1"
    k1, _ = identity.identity_key("Ana", "123", "2020-01-01", "EC")
    os.environ["CORE_PEPPER_VERSION"] = "v2"
    try:
        k2, _ = identity.identity_key("Ana", "123", "2020-01-01", "EC")
    finally:
        os.environ["CORE_PEPPER_VERSION"] = "v1"
    assert k1 != k2


def test_uid_opaque_no_pii_and_resolve():
    r = identity.resolve("Ana Pérez", "999", "2020-05-05", "EC")
    uid = r["subject_ref"]
    assert uid.startswith("cet_") and len(uid) == 36
    for pii in ("Ana", "Pérez", "PEREZ", "999"):
        assert pii not in uid
    rec = identity.resolve_uid(uid)
    assert rec and rec["identity_key"] == r["identity_key"]


def test_merge_alias():
    a = identity.resolve("A Uno", "111", "2020-01-01", "EC")
    b = identity.resolve("B Dos", "222", "2020-01-01", "EC")
    out = identity.merge_alias(a["subject_ref"], b["subject_ref"])
    assert out["ok"]
    rec = identity.resolve_uid(b["subject_ref"])
    assert rec["subject_ref"] == a["subject_ref"]


def test_policy_filter_trims():
    out = pseudonym.pseudonymize({"nombre": "Ana", "cedula": "123", "edad": 5},
                                 "cet_x", intent="analytics", rol="analyst")
    assert out["edad"] == 5 and out["subject_ref"] == "cet_x"
    assert "Ana" not in str(out) and "123" not in str(out)
    pf = pseudonym.PolicyFilter("care", "educador", "care")
    assert "nombre" in pf.allowed_fields()


def test_mask_formats():
    assert mask.mask_cedula("1710034065") == "***4065"
    assert mask.mask_phone("0991234567") == "***567"
    age = mask.birth_to_age_display("2019-04-03")
    assert "año" in age
    m = mask.mask_payload({"cedula": "1710034065", "telefono": "0991",
                           "birth_date": "2019-04-03", "nombre": "Ana"}, rol="analyst")
    assert m["cedula"] == "***4065" and m["nombre"] == "***"


def test_envelope_valid_invalid():
    env = events.make_envelope("ec", "health", "cet_x", "web", "care", {}, "ficha.crear")
    ok, _ = events.validate_envelope(env)
    assert ok
    bad = dict(env)
    del bad["tenant"]
    ok2, errs = events.validate_envelope(bad)
    assert not ok2 and errs
    p = events.MemoryProducer()
    assert p.publish(env)["ok"]
    with pytest.raises(ValueError):
        p.publish(bad)
    nats = events.NatsStubProducer()
    assert nats.publish(env)["backend"] == "nats-stub"
    jl = events.JsonlProducer("/tmp/core_test_events.jsonl")
    assert jl.publish(env)["backend"] == "jsonl"


def test_audit_chain_and_tamper():
    audit.append("educadora", "ficha.crear", "cet_a", "care")
    audit.append("admin", "ficha.ver", "cet_a", "support")
    assert audit.verify_chain()["ok"]
    chain = audit.entries()
    chain[0]["accion"] = "hack"
    assert not audit.verify_chain(chain)["ok"]


def test_forget_preserves_aggregates_via_api():
    from flask import Flask
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..",
                                    "modules", "early-childhood"))
    from core_api import core_bp
    app = Flask(__name__)
    app.register_blueprint(core_bp)
    tc = app.test_client()
    r = tc.post("/core/v1/identity/resolve",
                json={"nombre": "Ana", "cedula": "123",
                      "fecha_iso": "2020-01-01", "nacionalidad": "EC"})
    ref = r.get_json()["subject_ref"]
    tc.post("/core/v1/events/publish",
            json={"tenant": "ec", "domain": "health", "subject_ref": ref})
    tc.post("/core/v1/audit/append",
            json={"actor": "a", "accion": "x", "subject_ref": ref})
    f = tc.post("/core/v1/subjects/forget", json={"subject_ref": ref})
    body = f.get_json()
    assert body["forgotten"] and body["preserved"]["aggregates"]["events"] >= 1


def test_api_flask_e2e():
    from flask import Flask
    from core_api import core_bp
    app = Flask(__name__)
    app.register_blueprint(core_bp)
    tc = app.test_client()
    assert tc.get("/core/v1/health").status_code == 200
    assert tc.get("/core/v1/keys/status").get_json()["ok"]
    r = tc.post("/core/v1/identity/resolve",
                json={"nombre": "X", "cedula": "1",
                      "fecha_iso": "2020-01-01", "nacionalidad": "EC"})
    assert r.status_code == 200 and r.get_json()["subject_ref"].startswith("cet_")
    assert tc.post("/core/v1/pseudonymize",
                   json={"payload": {"nombre": "X"}, "subject_ref": "cet_y"}).status_code == 200
    assert tc.post("/core/v1/mask",
                   json={"payload": {"cedula": "1234567890"}}).get_json()["cedula"] == "***7890"
    env = events.make_envelope("ec", "health", "cet_y", "web", "care")
    assert tc.post("/core/v1/events/publish", json={"envelope": env}).status_code == 200
    assert tc.post("/core/v1/events/publish", json={"envelope": {"v": 1}}).status_code == 400
    assert tc.post("/core/v1/audit/append",
                   json={"actor": "a", "accion": "b"}).status_code == 200
    assert tc.post("/core/v1/audit/verify").get_json()["ok"]


def test_contracts_validator():
    ok, _ = contracts.validate_contract({"name": "n", "domain": "d", "owner": "o",
                                         "version": "1.0.0", "schema": {"a": 1}, "slo": {}})
    assert ok
    ok2, errs = contracts.validate_contract({"name": "n"})
    assert not ok2 and errs
