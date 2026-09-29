"""params_store: hoja PARÁMETROS versionada (equivale a PARÁMETROS del Excel).

- Carga seeds/cmci/cmci_params_v1.json (v1_validada_2026-09-25, inmutable).
- get(scope): base global + override country + override center (merge profundo).
- set(scope, section, key, value): solo vía PUT /params (license_admin), versiona.
- validate(params): F14/G14 (dims=100), E51/E53:E60 (globales=100),
  socio pesos=1.0, rangos cubren 0-100.
Scopes: 'global' | 'country:XX' | 'center:YYY'.
"""
import copy
import json
import os
import re
from datetime import datetime

SEED_PATH = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "seeds", "cmci", "cmci_params_v1.json"))

SCOPES = ("global", "country", "center")


def load_seed(path=SEED_PATH):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _deep_merge(base, override):
    out = copy.deepcopy(base)
    for key, val in (override or {}).items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = copy.deepcopy(val)
    return out


class ParamStore:
    """Store versionado con overrides por scope.

    Vía principal: tabla scoring_params(scope,key,value,version) — un row
    por cada clave top-level del patch (upsert). GET lee DB y mezcla sobre
    el seed; si la DB no está disponible (sin app context / tabla ausente)
    usa el seed JSON + overrides en memoria como fallback (try/except).
    """

    def __init__(self, seed=None):
        self.seed = seed if seed is not None else load_seed()
        self.version = self.seed.get("version", "v1")
        self._overrides = {}  # scope -> dict parcial (fallback + caché)
        self._history = []  # auditoría de PUT

    def _refresh_version_from_db(self):
        """Sincroniza self.version con el último row persistido (best-effort)."""
        try:
            from models.cmci import ScoringParams
            row = (ScoringParams.query
                   .order_by(ScoringParams.updated_at.desc()).first())
            if row is not None and getattr(row, "version", None):
                self.version = row.version
        except Exception:
            pass

    def _db_overrides(self, scope):
        """Lee overrides persistidos del scope; {} si DB no disponible."""
        try:
            from models.cmci import ScoringParams
            rows = (ScoringParams.query.filter_by(scope=scope)
                    .order_by(ScoringParams.id.asc()).all())
            merged = {}
            for row in rows:
                if isinstance(getattr(row, "value", None), dict):
                    merged = _deep_merge(merged, {row.key: row.value})
            return merged
        except Exception:
            return {}

    def get(self, scope="global"):
        """Params efectivos: seed + overrides DB + overrides memoria."""
        if scope in (None, "global"):
            return copy.deepcopy(self.seed)
        self._refresh_version_from_db()
        merged = _deep_merge(self.seed, self._db_overrides(scope))
        return _deep_merge(merged, self._overrides.get(scope, {}))

    def set(self, scope, patch, actor=None):
        """Aplica override parcial por scope. Upsert en DB + bump de versión.

        Versión: v1 → v1.1-<fecha>, luego v1.2-<fecha>, ... (nunca reescribe
        el seed global inmutable). Si la DB no está disponible, persiste
        solo en memoria (fallback) manteniendo el mismo contrato.
        """
        if scope in (None, "global", ""):
            raise ValueError("El scope global (seed validada) es inmutable; use country:* o center:*")
        kind = scope.split(":", 1)[0] if ":" in scope else scope
        if kind not in SCOPES:
            raise ValueError(f"Scope inválido: {scope} (global|country:XX|center:YYY)")
        merged = _deep_merge(self.get(scope), patch)
        validate(merged)  # no persistir params que rompan sumas
        new_version = bump_version(self.version)
        try:
            from models import db
            from models.cmci import ScoringParams
            for key, val in (patch or {}).items():
                row = (ScoringParams.query
                       .filter_by(scope=scope, key=str(key)).first())
                if row is None:
                    db.session.add(ScoringParams(scope=scope, key=str(key),
                                                 value=val, version=new_version))
                else:
                    row.value = val
                    row.version = new_version
            db.session.commit()
        except Exception:
            try:
                from models import db as _db
                _db.session.rollback()
            except Exception:
                pass
        self._overrides[scope] = _deep_merge(self._overrides.get(scope, {}), patch)
        self.version = new_version
        self._history.append({"scope": scope, "patch": patch, "actor": actor,
                              "version": self.version})
        return self.get(scope)

    def history(self):
        return list(self._history)


def bump_version(current):
    """Bump menor con fecha: v1 → v1.1-<fecha>, v1.1-<f> → v1.2-<fecha>."""
    today = datetime.now().strftime("%Y-%m-%d")
    minor = re.match(r"^v(\d+)\.(\d+)-\d{4}-\d{2}-\d{2}$", str(current or ""))
    if minor:
        return f"v{minor.group(1)}.{int(minor.group(2)) + 1}-{today}"
    major = re.match(r"^v(\d+)\b", str(current or ""))
    if major:
        return f"v{major.group(1)}.1-{today}"
    return f"v1.1-{today}"


def validate(params):
    """Checks F14/G14 + E51/E53:E60 + socio 1.0 + rangos. Lanza ValueError."""
    errors = []
    vuln = params.get("vulnerability", {})
    dims = vuln.get("dimensions", [])
    dim_sum = sum(d.get("weight", 0) for d in dims)
    if abs(dim_sum - 100) > 0.01:  # F14=SUM debe 100
        errors.append(f"dims suman {dim_sum}, debe 100")
    indicators = vuln.get("indicators", [])
    glob_sum = sum(i.get("weight_global", 0) for i in indicators)
    if abs(glob_sum - 100) > 0.01:  # E51=SUM debe 100
        errors.append(f"pesos globales suman {glob_sum}, debe 100")
    by_dim = {}
    for i in indicators:
        by_dim.setdefault(i.get("dim"), 0.0)
        by_dim[i["dim"]] += i.get("weight_in_dim", 0)
    for dim, s in by_dim.items():  # E53:E60 ~100 (seed trae 33.33x3=99.99)
        if abs(s - 100) > 0.05:
            errors.append(f"{dim} suma {s}, debe 100")
    socio = params.get("socioeconomic", {})
    w_sum = sum(w.get("w", 0) for w in socio.get("weights", []))
    if abs(w_sum - 1.0) > 1e-9:
        errors.append(f"pesos socio suman {w_sum}, debe 1.0")
    for r in vuln.get("ranges", []):
        if r.get("from", 0) < 0 or r.get("to", 0) > 100:
            errors.append(f"rango fuera de 0-100: {r}")
    if errors:
        raise ValueError("REVISAR params: " + "; ".join(errors))
    return True
