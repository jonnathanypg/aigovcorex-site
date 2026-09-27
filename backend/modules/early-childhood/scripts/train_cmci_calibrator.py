#!/usr/bin/env python3
"""
F2 — Entrena el calibrador ML shadow CMCI (tiny, CPU-only, <500KB).

Fuente: histórico del comité (vulnerability_assessments). Label proxy:
PRIORIDAD 1 (o protection_alert) → 1, resto → 0.
Features: las 12 de services.ml_calibrator.extract_features.

Sin datos (n<100) o sin sklearn: genera metrics.json template con
status + AUC/calibration en null, exit 0 (nunca rompe el pipeline).
"""
import argparse
import json
import os
import sys

MODULE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if MODULE_DIR not in sys.path:
    sys.path.insert(0, MODULE_DIR)
if os.path.dirname(MODULE_DIR) not in sys.path:
    sys.path.insert(0, os.path.dirname(MODULE_DIR))  # backend/modules

from services.ml_calibrator import (  # noqa: E402
    FEATURE_NAMES, MIN_TRAIN_SAMPLES, MODEL_MAX_BYTES,
    ML_VERSION_DEFAULT, extract_features,
)

DEFAULT_OUT_DIR = os.path.join(MODULE_DIR, "models_ml")
MODEL_FILENAME = "cmci_calibrator_v1.joblib"
METRICS_FILENAME = "metrics.json"
ML_VERSION = ML_VERSION_DEFAULT


def write_template(out_dir, reason, n=0):
    os.makedirs(out_dir, exist_ok=True)
    metrics = {
        "ml_version": ML_VERSION,
        "status": reason,  # sin_datos | muestra_insuficiente | sin_sklearn
        "n": int(n),
        "n_min_requerido": MIN_TRAIN_SAMPLES,
        "features": FEATURE_NAMES,
        "auc": None,
        "brier": None,
        "calibration_bins": None,
        "model_type": None,
        "model_bytes": None,
        "nota": "Shadow inactivo: calibrate() retorna score intacto con proba None.",
    }
    with open(os.path.join(out_dir, METRICS_FILENAME), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    print(f"[train_cmci] template metrics.json ({reason}, n={n})")
    return 0


def load_history(db_url=None):
    """Lee histórico del comité. Retorna lista de dicts o [] si no disponible."""
    try:
        from app import create_app  # noqa
        from models import db  # noqa
        from models.cmci import VulnerabilityAssessment  # noqa
        app = create_app()
        if db_url:
            app.config["SQLALCHEMY_DATABASE_URI"] = db_url
        rows = []
        with app.app_context():
            q = VulnerabilityAssessment.query.filter(
                VulnerabilityAssessment.status.in_(
                    ["Validada", "Admitida", "No admitida", "Lista de espera",
                     "Completa"])
            ).all()
            for r in q:
                rows.append({
                    "answers": r.answers or {}, "scores": r.scores or {},
                    "subtotals": r.subtotals or {}, "alerts": r.alerts or {},
                    "priority": r.priority, "protection_alert": r.protection_alert,
                })
        return rows
    except Exception as e:
        print(f"[train_cmci] sin acceso a histórico ({e}); modo template")
        return []


def main():
    ap = argparse.ArgumentParser(description="Entrena calibrador ML shadow CMCI")
    ap.add_argument("--db-url", default=None)
    ap.add_argument("--out", default=DEFAULT_OUT_DIR)
    ap.add_argument("--min-samples", type=int, default=MIN_TRAIN_SAMPLES)
    ap.add_argument("--model-type", default="logreg",
                    choices=["logreg", "hgb"],
                    help="logreg=LogisticRegression tiny; hgb=HistGradientBoosting tiny")
    args = ap.parse_args()

    try:
        import sklearn  # noqa: F401
    except ImportError:
        return write_template(args.out, "sin_sklearn")

    rows = load_history(args.db_url)
    if len(rows) < args.min_samples:
        reason = "sin_datos" if not rows else "muestra_insuficiente"
        return write_template(args.out, reason, n=len(rows))

    import numpy as np
    X, y = [], []
    for r in rows:
        fd = dict(r["answers"] or {})
        fd["subtotals"] = r["subtotals"] or {}
        fd["scores"] = r["scores"] or {}
        fd["alerts"] = r["alerts"] or {}
        X.append(extract_features(fd))
        y.append(1 if (r["priority"] == "PRIORIDAD 1" or r["protection_alert"]) else 0)
    X = np.array(X, dtype=float)
    y = np.array(y, dtype=int)
    if len(set(y.tolist())) < 2:
        return write_template(args.out, "sin_varianza_label", n=len(rows))

    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.model_selection import StratifiedKFold
    from sklearn.metrics import roc_auc_score, brier_score_loss
    if args.model_type == "hgb":
        clf = HistGradientBoostingClassifier(max_iter=50, max_depth=3,
                                             max_leaf_nodes=15, l2_regularization=1.0)
        model_type = "HistGradientBoostingClassifier(max_iter=50,max_depth=3)"
    else:
        clf = LogisticRegression(C=1.0, max_iter=200, solver="lbfgs")
        model_type = "LogisticRegression(C=1.0,lbfgs)"

    skf = StratifiedKFold(n_splits=min(5, min(int((y == 0).sum()),
                                             int((y == 1).sum()), 5)), shuffle=True,
                          random_state=42)
    aucs, briers, oof = [], [], np.zeros(len(y))
    for tr, te in skf.split(X, y):
        clf.fit(X[tr], y[tr])
        p = clf.predict_proba(X[te])[:, 1]
        oof[te] = p
        try:
            aucs.append(float(roc_auc_score(y[te], p)))
        except ValueError:
            pass
        briers.append(float(brier_score_loss(y[te], p)))
    # Calibración por deciles sobre out-of-fold
    bins = []
    order = np.argsort(oof)
    for b in np.array_split(order, 10):
        bins.append({"n": int(len(b)), "proba_media": round(float(oof[b].mean()), 4),
                     "tasa_real": round(float(y[b].mean()), 4)})

    clf.fit(X, y)  # modelo final con todo el histórico
    os.makedirs(args.out, exist_ok=True)
    model_path = os.path.join(args.out, MODEL_FILENAME)
    bundle = {"model": clf, "ml_version": ML_VERSION, "n_train": int(len(rows)),
              "feature_names": FEATURE_NAMES,
              "metrics": {"auc_mean": round(float(np.mean(aucs)), 4) if aucs else None}}
    try:
        import joblib
        joblib.dump(bundle, model_path)
    except ImportError:
        import pickle
        with open(model_path, "wb") as f:
            pickle.dump(bundle, f)
    size = os.path.getsize(model_path)
    if size > MODEL_MAX_BYTES:
        os.remove(model_path)
        print(f"[train_cmci] modelo {size}B >500KB; descartado, solo template")
        return write_template(args.out, "modelo_sobretamano", n=len(rows))

    metrics = {"ml_version": ML_VERSION, "status": "entrenado", "n": int(len(rows)),
               "n_min_requerido": args.min_samples, "features": FEATURE_NAMES,
               "auc": round(float(np.mean(aucs)), 4) if aucs else None,
               "brier": round(float(np.mean(briers)), 4) if briers else None,
               "calibration_bins": bins, "model_type": model_type,
               "model_bytes": size,
               "nota": "Shadow: informa proba/top3; el score determinista manda."}
    with open(os.path.join(args.out, METRICS_FILENAME), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    print(f"[train_cmci] OK n={len(rows)} auc={metrics['auc']} "
          f"brier={metrics['brier']} bytes={size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
