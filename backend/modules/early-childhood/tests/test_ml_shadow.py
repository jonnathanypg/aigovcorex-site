"""
F2 — Tests del calibrador ML shadow (sin firma electrónica).

- Shadow sin modelo retorna score intacto + proba None.
- Con modelo dummy: proba en [0,1] + top3, score intacto.
- El determinista nunca se altera ante excepciones.
- 12 features siempre.
- Hook en social_programs.py: firma con defaults (callers intactos) + lazy.
- train script sin sklearn/datos genera metrics template.

Stdlib-only (sin flask/sklearn/joblib): el bundle dummy se serializa
con pickle, que el loader acepta como fallback de joblib.
"""
import importlib.util
import os
import pickle
import sys
import tempfile

MODULE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if MODULE_DIR not in sys.path:
    sys.path.insert(0, MODULE_DIR)

from services.ml_calibrator import (  # noqa: E402
    FEATURE_NAMES, MIN_TRAIN_SAMPLES, calibrate,
    explain_for_assessment, extract_features,
)


class FakeModel:
    """Modelo dummy picklable: proba fija válida + coef_ para top3."""

    def __init__(self):
        self.coef_ = [0.5, -0.4, 0.3, 0.2, -0.1, 0.05,
                      0.0, 0.0, 0.9, -0.7, 0.6, 0.1]

    def predict_proba(self, X):
        s = sum(X[0])
        p = 0.7 if s >= 0 else 0.3
        return [[1.0 - p, p]]


def _dummy_bundle(path, n_train=150, ml_version="test-v1"):
    bundle = {"model": FakeModel(), "ml_version": ml_version,
              "n_train": n_train, "feature_names": FEATURE_NAMES}
    with open(path, "wb") as f:
        pickle.dump(bundle, f)
    return path


def test_shadow_sin_modelo_retorna_intacto():
    score, info = calibrate(7, {"monthly_income": 400, "household_members": 4},
                            63.5, model_path="/no/existe/modelo.joblib")
    assert score == 63.5
    assert info["mode"] == "shadow"
    assert info["proba"] is None


def test_con_modelo_dummy_proba_0_1_y_score_intacto():
    with tempfile.TemporaryDirectory() as d:
        mp = _dummy_bundle(os.path.join(d, "m.joblib"))
        fd = {"subtotals": {"D1": 12.0, "D4": 15.0}, "monthly_income": 300,
              "household_members": 5, "dormitorios": 2, "alerts": {"x": True}}
        score, info = calibrate(7, fd, 72.0, model_path=mp)
        assert score == 72.0, "shadow no debe modificar el determinista"
        assert info["mode"] == "shadow"
        assert info["proba"] is not None and 0.0 <= info["proba"] <= 1.0
        assert info["ml_priority_proba"] == info["proba"]
        assert len(info["top3"]) == 3
        assert info["ml_version"] == "test-v1"
        assert info["delta"] == 0.0
        assert info["latency_ms"] < 1000.0


def test_muestra_insuficiente_retorna_intacto():
    with tempfile.TemporaryDirectory() as d:
        mp = _dummy_bundle(os.path.join(d, "m.joblib"), n_train=MIN_TRAIN_SAMPLES - 1)
        score, info = calibrate(1, {"D1": 5}, 40.0, model_path=mp)
        assert score == 40.0
        assert info["proba"] is None
        assert info["reason"] == "muestra_insuficiente"


def test_determinista_nunca_alterado_en_excepcion():
    # form_data patológico + bundle corrupto + model_path inválido
    with tempfile.TemporaryDirectory() as d:
        bad = os.path.join(d, "bad.joblib")
        with open(bad, "wb") as f:
            f.write(b"esto no es un pickle valido {{[")
        for fd, mp in [({"a": object()}, bad),
                       (None, bad),
                       ({"x": float("nan")}, d),  # directorio como path
                       ("no-un-dict", bad)]:
            score, info = calibrate(1, fd, 55.5, model_path=mp)
            assert score == 55.5, f"alterado con fd={type(fd)}"
            assert info["mode"] == "shadow"
            assert info["proba"] is None


def test_features_siempre_12_floats():
    for fd in [{}, None, "lixo", {"subtotals": {"D1": "alto", "D9": 5}},
               {"scores": {"I1.1": 4}, "alerts": {"a": True, "b": False}}]:
        feats = extract_features(fd)
        assert len(feats) == 12, feats
        assert all(isinstance(x, float) for x in feats)


def test_explain_no_toca_total():
    p = explain_for_assessment(81.25, 0.92, top3=[{"feature": "D1", "aporte": 1.0}],
                               ml_version="cmci-cal-v1")
    assert p["determinista_total"] == 81.25
    assert p["ml_priority_proba"] == 0.92
    assert p["delta"] == 0.0
    assert p["mode"] == "shadow"
    p2 = explain_for_assessment(81.25, None)
    assert p2["ml_priority_proba"] is None and p2["determinista_total"] == 81.25


def test_hook_social_programs_firma_y_lazy():
    paths = [
        os.path.join(MODULE_DIR, "..", "social", "api", "social_programs.py"),
        os.path.join(MODULE_DIR, "api", "social_programs.py"),
    ]
    for p in paths:
        src = open(os.path.normpath(p), encoding="utf-8").read()
        assert ("def _calculate_eligibility_score(form_data: dict, rules: list, "
                "program_id=None)" in src), f"firma con defaults en {p}"
        assert "_attach_ml_shadow(program_id, form_data, final_score)" in src
        assert "from services.ml_calibrator import calibrate" in src
        # callers de 2 args siguen válidos por el default; submit/conversational
        # pasan program_id explícito pero el score/status siguen deterministas
        assert "ml_shadow" in src


def test_train_script_genera_template_sin_datos():
    spec = importlib.util.spec_from_file_location(
        "train_cmci_calibrator",
        os.path.join(MODULE_DIR, "scripts", "train_cmci_calibrator.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.argv = ["train_cmci_calibrator.py"]
    spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory() as d:
        # Sin sklearn en el entorno (o sin datos) → template, exit 0
        rc = mod.write_template(d, "sin_datos", n=0)
        assert rc == 0
        import json
        m = json.load(open(os.path.join(d, "metrics.json"), encoding="utf-8"))
        assert m["auc"] is None and m["status"] == "sin_datos"
        assert len(m["features"]) == 12
