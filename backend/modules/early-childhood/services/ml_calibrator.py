"""
F2 — Calibrador ML shadow CMCI (sin firma electrónica).

Wrapper post-score: NUNCA altera el score determinista. Si no hay modelo
o n<100, retorna el score intacto con {mode: shadow, proba: None}.
Solo informa: proba de prioridad + top3 factores + versionado ml_version.

Requisitos del plan: joblib <500KB, inferencia p95 <20ms, sin GPU,
try/except que nunca rompe el score determinista.

Stdlib-only en import: sklearn/joblib/numpy son opcionales y se cargan
lazy dentro de try/except. Sin ellos opera en modo shadow-sin-modelo.
"""
import logging
import os
import pickle
import threading
import time

logger = logging.getLogger(__name__)

# 12 features: D1-D8 + per_capita_ratio + dependencia + hacinamiento + n_alertas
FEATURE_NAMES = [
    "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8",
    "per_capita_ratio", "dependencia", "hacinamiento", "n_alertas",
]
N_FEATURES = len(FEATURE_NAMES)

MIN_TRAIN_SAMPLES = 100
MODEL_MAX_BYTES = 500 * 1024  # 500KB
INFER_BUDGET_MS = 20.0
ML_VERSION_DEFAULT = "cmci-cal-v1"

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_DIR = os.path.normpath(os.path.join(_MODULE_DIR, "..", "models_ml"))
DEFAULT_MODEL_PATH = os.path.join(DEFAULT_MODEL_DIR, "cmci_calibrator_v1.joblib")

_lock = threading.Lock()
_cache = {"key": None, "bundle": None, "ml_version": None, "n_train": 0}


def _safe_float(v, default=0.0):
    try:
        if v is None or isinstance(v, bool):
            return default if v is None else float(v)
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):  # NaN/Inf
            return default
        return f
    except (TypeError, ValueError):
        return default


def extract_features(form_data, scores=None, subtotals=None, alerts=None):
    """Construye el vector de 12 features desde form_data (+scores/subtotals/alerts opcionales).

    Nunca lanza: ante dato ausente/malformado usa 0.0.
    """
    try:
        fd = form_data if isinstance(form_data, dict) else {}
        subs = subtotals if isinstance(subtotals, dict) else {}
        if not subs and isinstance(fd.get("subtotals"), dict):
            subs = fd["subtotals"]
        sc = scores if isinstance(scores, dict) else {}
        if not sc and isinstance(fd.get("scores"), dict):
            sc = fd["scores"]
        al = alerts
        if al is None:
            al = fd.get("alerts", fd.get("n_alertas", 0))

        dims = [_safe_float(subs.get(f"D{i}")) for i in range(1, 9)]
        if all(d == 0.0 for d in dims) and sc:
            # Fallback: agregar scores 0-4 por dimensión si no hay subtotales
            per_dim = {f"D{i}": [] for i in range(1, 9)}
            for k, v in sc.items():
                dim = str(k)[:2].upper()
                if dim in per_dim:
                    per_dim[dim].append(_safe_float(v))
            dims = [float(sum(per_dim[f"D{i}"])) for i in range(1, 9)]

        per_capita_ratio = _safe_float(fd.get("per_capita_ratio",
                                       fd.get("ingreso_per_capita_ratio", 0.0)))
        if per_capita_ratio == 0.0:
            ingreso = _safe_float(fd.get("monthly_income",
                                  fd.get("ingreso_total", fd.get("ingreso", 0.0))))
            miembros = _safe_float(fd.get("household_members",
                                   fd.get("miembros_hogar", fd.get("n_miembros", 0.0))))
            canasta = _safe_float(fd.get("canasta_ref", 220.0)) or 220.0
            if miembros > 0 and ingreso > 0:
                per_capita_ratio = (ingreso / miembros) / canasta

        dependencia = _safe_float(fd.get("dependencia",
                                  fd.get("relacion_dependencia", 0.0)))
        if dependencia == 0.0:
            dependientes = _safe_float(fd.get("dependientes",
                                       fd.get("n_dependientes", fd.get("nna", 0.0))))
            perceptores = _safe_float(fd.get("perceptores",
                                      fd.get("n_perceptores", 0.0)))
            if perceptores > 0:
                dependencia = dependientes / perceptores

        hacinamiento = _safe_float(fd.get("hacinamiento",
                                   fd.get("personas_por_dormitorio", 0.0)))
        if hacinamiento == 0.0:
            personas = _safe_float(fd.get("household_members",
                                   fd.get("miembros_hogar", 0.0)))
            dorms = _safe_float(fd.get("dormitorios", fd.get("n_dormitorios", 0.0)))
            if dorms > 0:
                hacinamiento = personas / dorms

        if isinstance(al, dict):
            n_alertas = sum(1 for v in al.values() if v)
        elif isinstance(al, (list, tuple)):
            n_alertas = len([v for v in al if v])
        else:
            n_alertas = _safe_float(al)

        return dims + [per_capita_ratio, dependencia, hacinamiento, float(n_alertas)]
    except Exception as e:  # blindaje total: 12 ceros
        logger.warning("extract_features fallo (%s); retorno ceros", e)
        return [0.0] * N_FEATURES


def _load_bundle(model_path=None):
    """Carga lazy del bundle joblib (cacheado por ruta+mtime). Retorna dict o None."""
    path = os.path.abspath(model_path or DEFAULT_MODEL_PATH)
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    key = (path, mtime)
    with _lock:
        if _cache["key"] == key:
            return _cache["bundle"]
    bundle = None
    try:
        size = os.path.getsize(path)
        if size > MODEL_MAX_BYTES:
            logger.warning("ml_calibrator: modelo %s supera 500KB (%d B); ignorado",
                           path, size)
            return None
        try:
            import joblib  # type: ignore
            bundle = joblib.load(path)
        except ImportError:
            with open(path, "rb") as f:
                bundle = pickle.load(f)
        if not isinstance(bundle, dict) or "model" not in bundle:
            logger.warning("ml_calibrator: bundle sin clave 'model'; ignorado")
            return None
    except Exception as e:
        logger.warning("ml_calibrator: no se pudo cargar modelo (%s)", e)
        return None
    with _lock:
        _cache.update({
            "key": key,
            "bundle": bundle,
            "ml_version": str(bundle.get("ml_version", ML_VERSION_DEFAULT)),
            "n_train": int(bundle.get("n_train", 0) or 0),
        })
    return bundle


def _top3_factors(model, features):
    """Top3 factores (nombre, aporte). Nunca lanza; fallback a |x|."""
    try:
        names = list(FEATURE_NAMES)
        coefs = getattr(model, "coef_", None)
        if coefs is not None:
            import math
            row = list(coefs[0]) if getattr(coefs, "ndim", 1) == 2 else list(coefs)
            contrib = [(n, float(c) * float(x)) for n, c, x in zip(names, row, features)]
            contrib.sort(key=lambda t: abs(t[1]), reverse=True)
            return [{"feature": n, "aporte": round(a, 4)} for n, a in contrib[:3]]
        importances = getattr(model, "feature_importances_", None)
        if importances is not None:
            pairs = sorted(zip(names, list(importances)),
                           key=lambda t: abs(float(t[1])), reverse=True)
            return [{"feature": n, "aporte": round(float(v), 4)} for n, v in pairs[:3]]
    except Exception as e:
        logger.warning("ml_calibrator top3 fallo (%s); fallback", e)
    try:
        pairs = sorted(zip(FEATURE_NAMES, features),
                       key=lambda t: abs(float(t[1])), reverse=True)
        return [{"feature": n, "aporte": round(float(v), 4)} for n, v in pairs[:3]]
    except Exception:
        return []


def calibrate(program_id, form_data, deterministic_score, scores=None,
              subtotals=None, alerts=None, model_path=None):
    """Calibración shadow post-score.

    Retorna (score_intacto, info). El score determinista JAMÁS se modifica:
    delta siempre 0.0 y ante cualquier excepción se retorna intacto con
    proba None. `program_id` solo se registra con fines de trazabilidad.
    """
    try:
        det = _safe_float(deterministic_score, default=0.0)
    except Exception:
        det = 0.0
    base_info = {"mode": "shadow", "proba": None, "ml_version": None,
                 "program_id": program_id}
    try:
        features = extract_features(form_data, scores=scores,
                                    subtotals=subtotals, alerts=alerts)
        bundle = _load_bundle(model_path)
        if bundle is None:
            return det, dict(base_info, reason="sin_modelo")
        n_train = 0
        try:
            n_train = int(bundle.get("n_train", 0) or 0)
        except (TypeError, ValueError):
            n_train = 0
        ml_version = str(bundle.get("ml_version", ML_VERSION_DEFAULT))
        if n_train < MIN_TRAIN_SAMPLES:
            return det, dict(base_info, ml_version=ml_version,
                             n_train=n_train, reason="muestra_insuficiente")
        t0 = time.perf_counter()
        proba = float(bundle["model"].predict_proba([features])[0][1])
        latency_ms = (time.perf_counter() - t0) * 1000.0
        if not (0.0 <= proba <= 1.0):
            proba = min(1.0, max(0.0, proba))
        top3 = _top3_factors(bundle["model"], features)
        info = dict(base_info, ml_version=ml_version, n_train=n_train,
                    ml_priority_proba=round(proba, 4), proba=round(proba, 4),
                    top3=top3, latency_ms=round(latency_ms, 3),
                    delta=0.0, budget_ms=INFER_BUDGET_MS,
                    budget_exceeded=bool(latency_ms > INFER_BUDGET_MS))
        return det, info
    except Exception as e:
        logger.warning("ml_calibrator shadow fallo (%s); score intacto", e)
        try:
            return det, dict(base_info, reason="excepcion_calibracion")
        except Exception:
            return deterministic_score, {"mode": "shadow", "proba": None}


def explain_for_assessment(assessment_total, ml_proba, top3=None, ml_version=None):
    """Construye el payload de ml-explain sin tocar el total determinista."""
    try:
        det = _safe_float(assessment_total, default=0.0)
        proba = None if ml_proba is None else min(1.0, max(0.0, float(ml_proba)))
        return {"determinista_total": det, "ml_priority_proba": proba,
                "top3": list(top3 or [])[:3], "ml_version": ml_version,
                "delta": 0.0, "mode": "shadow"}
    except Exception:
        return {"determinista_total": assessment_total, "ml_priority_proba": None,
                "top3": [], "ml_version": None, "delta": 0.0, "mode": "shadow"}
