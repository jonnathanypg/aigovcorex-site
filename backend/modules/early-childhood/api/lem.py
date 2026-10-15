"""Blueprint proxy LEM para aigovcorex backend — el frontend (aunque esté en otro hosting)
llama a /api/lem/verify con su JWT; la key privada LEM NUNCA sale del VPS.

Instalación:
  cp lem_blueprint.py backend/modules/early-childhood/api/lem.py
  # en app.py: from api.lem import lem_bp; app.register_blueprint(lem_bp)
Env: LEM_API_URL (default http://127.0.0.1:8080 en VPS), LEM_API_KEY, LEM_SCHEMA.
"""
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import urllib.request, json

lem_bp = Blueprint("lem", __name__, url_prefix="/api/lem")
BASE = os.getenv("LEM_API_URL", "http://127.0.0.1:8080").rstrip("/")
KEY = os.getenv("LEM_API_KEY", "")
DEFAULT_SCHEMA = os.getenv("LEM_SCHEMA", "example_flow")

def _lem(path, body):
    req = urllib.request.Request(BASE + path, method="POST",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read().decode())
    except Exception as e:
        try: return e.code, json.loads(e.read().decode() or "{}")
        except Exception: return 502, {"accepted": False, "reason": "lem_unreachable"}

@lem_bp.route("/verify", methods=["POST"])
@jwt_required()
def verify():
    d = request.get_json(force=True, silent=True) or {}
    state = d.get("state")
    if not isinstance(state, list) or len(state) != 16:
        return jsonify({"accepted": False, "reason": "bad_dimension"}), 400
    try: z = [float(x) for x in state]
    except (ValueError, TypeError):
        return jsonify({"accepted": False, "reason": "malformed_state"}), 400
    import math
    if any(not math.isfinite(x) or abs(x) > 1e12 for x in z):
        return jsonify({"accepted": False, "reason": "non_finite_or_out_of_range"}), 200
    code, res = _lem("/v1/evaluate", {"schema": d.get("schema", DEFAULT_SCHEMA), "state": z})
    return jsonify(res), code

@lem_bp.route("/health", methods=["GET"])
def health():
    try:
        with urllib.request.urlopen(BASE + "/healthz", timeout=5) as r:
            return jsonify(json.loads(r.read().decode())), 200
    except Exception:
        return jsonify({"status": "lem_unreachable"}), 502
