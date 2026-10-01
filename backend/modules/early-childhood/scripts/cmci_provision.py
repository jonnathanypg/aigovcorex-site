#!/usr/bin/env python3
"""Provisión CMCI en VPS (MariaDB) — idempotente, sin borrar datos.

Orden:
  1. Deps pip (lee requirements.txt, instala lo faltante; omite faster-whisper/pandas a propósito)
  2. Backup DB (mysqldump si existe, si no aviso y sigue)
  3. scripts/drop_legacy_uniques.py (quita UNIQUEs legacy, crea índices nuevos)
  4. db.create_all() (crea cmci_*, country_configs, scoring_params y columnas cmci_code/country_iso vía app.py)
  5. Seed scoring_params v1 + country EC (si vacíos)
  6. Verificación (tablas + conteos + 1 compute determinista)

Uso en VPS:
  cd ~/aigovcorex/backend/modules/early-childhood
  source venv/bin/activate
  python3 scripts/cmci_provision.py
"""
import subprocess
import sys
import os

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKIP = ("faster-whisper", "pandas")


def pip_missing():
    missing = []
    try:
        import importlib.metadata as md
    except ImportError:
        return ["pip>=23"]
    req = os.path.join(BASE, "requirements.txt")
    pkgs = []
    for line in open(req):
        line = line.split("#")[0].strip()
        if not line or line.startswith("-"):
            continue
        name = line.split(">")[0].split("<")[0].split("=")[0].split("[")[0].strip()
        if not name or name.lower() in SKIP:
            continue
        pkgs.append(name)
    installed = {d.metadata["Name"].lower() for d in md.distributions()}
    return [p for p in pkgs if p.lower() not in installed]


def main():
    print("== [1/6] deps ==")
    missing = pip_missing()
    if missing:
        print("instalando:", ", ".join(missing))
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + missing)
    else:
        print("deps ok")
    print("== [2/6]+[3/6] backup + uniques legacy ==")
    subprocess.check_call([sys.executable, os.path.join(BASE, "scripts", "drop_legacy_uniques.py")])
    print("== [4/6] create_all ==")
    os.chdir(BASE)
    sys.path.insert(0, BASE)
    os.environ.setdefault("FLASK_ENV", "production")
    from app import create_app
    from models import db
    app = create_app("production")
    with app.app_context():
        from models import init_models
        init_models()
        db.create_all()
        print("create_all ok")
        print("== [5/6] seed ==")
        from models.cmci import ScoringParams, CountryConfig
        if ScoringParams.query.first() is None:
            import json
            params = json.load(open(os.path.join(BASE, "seeds", "cmci", "cmci_params_v1.json")))
            db.session.add(ScoringParams(scope="global", key="cmci_v1",
                                        value=params, version="v1_validada_2026-09-25"))
            db.session.commit()
            print("seed scoring_params v1 ok")
        else:
            print("scoring_params ya existe")
        ec = CountryConfig.query.filter_by(country_iso="EC").first()
        if ec is None:
            db.session.add(CountryConfig(country_iso="EC", name="Ecuador", phone_prefix="593",
                                         id_type="cedula", id_validation="modulo-10",
                                         timezone="America/Guayaquil", currency="USD"))
            db.session.commit()
            print("seed country EC ok")
        else:
            print("country EC ya existe")
        print("== [6/6] verificación ==")
        from sqlalchemy import inspect
        tables = set(inspect(db.engine).get_table_names())
        need = {"cmci_centers", "vulnerability_assessments", "socioeconomic_assessments",
                "scoring_params", "country_configs", "document_templates", "monthly_reports"}
        falta = need - tables
        assert not falta, f"faltan tablas: {falta}"
        from services.scoring.vulnerability_engine import compute as vuln_compute
        import json as _j
        params = _j.load(open(os.path.join(BASE, "seeds", "cmci", "cmci_params_v1.json")))
        r = vuln_compute({"I1.3": "Ingresos estables y permanentes",
                          "I2.1": "Hogar biparental (ambos progenitores presentes y a cargo)"},
                         params["vulnerability"])
        print(f"compute smoke ok: total={r['total']}")
        print("PROVISION_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
