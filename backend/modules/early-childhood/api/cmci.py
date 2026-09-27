"""API CMCI F1 — fichas vulnerabilidad + socioeconómica (§3.1 §3.2 §10.1 + Fase 1).

Blueprint cmci_bp (url_prefix='/cmci') -> se registra UNA vez en api/__init__.py
sobre api_bp => rutas finales /api/cmci/*. NO usar prefijo /api aquí
(evita doble /api/api).

TODO(F0-resto, otro worker): sustituir _VULN_DB/_SOC_DB (dict/JSON en memoria)
por modelos cmci.py (VulnerabilityAssessment, SocioeconomicAssessment,
scoring_params, country_configs). El contrato de campos ya es el final.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, g

from middleware.tenant_context import tenant_required, TenantContext
from utils.role_helpers import (can_create_ficha, is_catering,
                                can_view_cmci_global)
from utils.phone_utils import normalize_phone_e164
from services.scoring import vulnerability_engine as VE
from services.scoring import socioeconomic_engine as SE
from services.scoring.params_store import ParamStore, load_seed
from services.scoring.explain import explain_vulnerability, explain_socioeconomic

try:
    from models.cmci import VulnerabilityAssessment  # noqa: F401 (lo crea otro worker F0)
    _HAS_MODELS = True
except ImportError:
    _HAS_MODELS = False  # fallback: store en memoria (ver TODO módulo)

cmci_bp = Blueprint("cmci", __name__, url_prefix="/cmci")

STORE = ParamStore()  # seed v1_validada_2026-09-25 + overrides por scope

# Stores históricos en memoria (un registro por valoración, nunca overwrite).
_VULN_DB = {}
_SOC_DB = {}
_SEQ = {"vuln": 0, "soc": 0}

ADMIN_ROLES = ("license_admin", "super_admin")  # PUT /params solo license_admin


def _tenant():
    return TenantContext.get_current_tenant_id()


def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def _require_admin():
    user = getattr(g, "current_user", None)
    role = getattr(getattr(user, "role", None), "name", None)
    if role not in ADMIN_ROLES:
        return jsonify({"error": "Solo license_admin puede modificar parámetros"}), 403
    return None


def _scope():
    return request.args.get("scope", "global")


def _check_idor(record):
    """IDOR: el registro debe pertenecer al tenant (cmci==tenant)."""
    if not record or record.get("tenant_id") != _tenant():
        return jsonify({"error": "Registro no encontrado"}), 404
    return None


def _deny_unless_can_create():
    """F5 RBAC §10.7 (sin firma electrónica): Educadora crea, Auxiliar
    apoya; Coordinadora revisa en papel impreso; Central solo lectura;
    Catering solo menú/ingesta (403 aquí)."""
    user = getattr(g, "current_user", None)
    if not can_create_ficha(user):
        if is_catering(user):
            return jsonify({"error": "Rol catering: solo menú e ingesta diaria"}), 403
        return jsonify({"error": "Su rol revisa en papel impreso; "
                                 "la creación es de Educadora/Auxiliar"}), 403
    return None


def _enforce_site(requested_center):
    """F5 filtro site forzado: si el usuario no es global y pide otro
    centro distinto al suyo → 404 (IDOR tenant==site)."""
    if not requested_center:
        return None
    user = getattr(g, "current_user", None)
    if can_view_cmci_global(user):
        return None
    own = TenantContext.get_current_cmci_code()
    if own and str(requested_center) != str(own):
        return jsonify({"error": "Registro no encontrado"}), 404
    return None


_PHONE_KEYS = ("telefono", "teléfono", "phone", "whatsapp", "celular")


def _normalize_phones(payload):
    """F5: depuración 09→593 (E.164 por país). No rompe si no hay teléfono."""
    if not isinstance(payload, dict):
        return payload
    iso = TenantContext.get_current_country_iso()
    for key in _PHONE_KEYS:
        if payload.get(key):
            normalized = normalize_phone_e164(payload[key], iso)
            if normalized:
                payload[key] = normalized
    return payload


def _paginate(items, page, per_page):
    total = len(items)
    start = (page - 1) * per_page
    return {"data": items[start:start + per_page], "page": page,
            "per_page": per_page, "total": total}


def _in_range_date(value, _from, _to):
    if not value:
        return False
    day = str(value)[:10]
    if _from and day < _from:
        return False
    if _to and day > _to:
        return False
    return True


# --------------------------- VULNERABILIDAD ---------------------------

@cmci_bp.route("/vulnerability/compute", methods=["POST"])
@tenant_required
def vuln_compute():
    """Preview sin guardar: replica VALORACIÓN F78-F84 + G88-G97."""
    body = request.get_json(force=True, silent=True) or {}
    answers = body.get("answers", body)
    try:
        result = VE.compute(answers, STORE.get(body.get("scope", "global")))
    except (ValueError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 422
    result["explain"] = explain_vulnerability(result, answers, STORE.get(body.get("scope", "global")))
    return jsonify(result), 200


@cmci_bp.route("/vulnerability", methods=["POST"])
@tenant_required
def vuln_create():
    """Guarda NUEVO registro histórico (macro Guardar; nunca sobreescribe)."""
    denied = _deny_unless_can_create()
    if denied:
        return denied
    body = request.get_json(force=True, silent=True) or {}
    site_err = _enforce_site(body.get("center"))
    if site_err:
        return site_err
    answers = _normalize_phones(body.get("answers", {}))
    try:
        params = STORE.get(body.get("scope", "global"))
        result = VE.compute(answers, params)
    except (ValueError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 422
    _SEQ["vuln"] += 1
    rec_id = _SEQ["vuln"]
    record = {
        "id": rec_id,
        "tenant_id": _tenant(),
        "child_id": body.get("child_id"),
        "center": body.get("center"),
        "code": body.get("code"),
        "child_name": body.get("child_name"),
        "status": body.get("status", "En proceso"),
        "assessed_at": body.get("assessed_at") or answers.get("assessed_at") or _now_iso(),
        "observations": body.get("observations"),
        "answers": answers,
        "result": result,
        "params_version": STORE.version,
        "source": "api",
        "created_by": getattr(getattr(g, "current_user", None), "id", None),
    }
    _VULN_DB[rec_id] = record
    return jsonify(record), 201


@cmci_bp.route("/vulnerability", methods=["GET"])
@tenant_required
def vuln_list():
    """GET /vulnerability?child_id&center&status&from&to&page&per_page."""
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    items = [r for r in _VULN_DB.values() if r.get("tenant_id") == _tenant()]
    if args.get("child_id"):
        items = [r for r in items if str(r.get("child_id")) == args["child_id"]]
    if args.get("center"):
        items = [r for r in items if r.get("center") == args["center"]]
    if args.get("status"):
        items = [r for r in items if r.get("status") == args["status"]]
    if args.get("from") or args.get("to"):
        items = [r for r in items if _in_range_date(r.get("assessed_at"), args.get("from"), args.get("to"))]
    items.sort(key=lambda r: r.get("assessed_at", ""), reverse=True)
    page = max(int(args.get("page", 1)), 1)
    per_page = min(max(int(args.get("per_page", 20)), 1), 100)
    return jsonify(_paginate(items, page, per_page)), 200


@cmci_bp.route("/vulnerability/<int:rec_id>", methods=["GET"])
@tenant_required
def vuln_detail(rec_id):
    err = _check_idor(_VULN_DB.get(rec_id))
    if err:
        return err
    return jsonify(_VULN_DB[rec_id]), 200


@cmci_bp.route("/priorizacion", methods=["GET"])
@tenant_required
def priorizacion():
    """Espejo PRIORIZACIÓN: orden Y/Z + paginación + filtros center/from/to."""
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    items = [r for r in _VULN_DB.values() if r.get("tenant_id") == _tenant()]
    if args.get("center"):
        items = [r for r in items if r.get("center") == args["center"]]
    if args.get("from") or args.get("to"):
        items = [r for r in items if _in_range_date(r.get("assessed_at"), args.get("from"), args.get("to"))]
    ranked = VE.ranking([{"id": r["id"], "order_y": r["result"]["order_y"]} for r in items])
    rank_by_id = {x["id"]: x["rank_z"] for x in ranked}
    rows = []
    for r in items:
        res = r["result"]
        rows.append({"id": r["id"], "code": r.get("code"), "child_id": r.get("child_id"),
                     "child_name": r.get("child_name"), "center": r.get("center"),
                     "assessed_at": r.get("assessed_at"), "age_months": res.get("age_months"),
                     "total": res["total"], "level": res["level"],
                     "priority": res["priority"], "protection_alert": res["protection_alert"],
                     "semaphore": res["semaphore"], "status": r.get("status"),
                     "order_y": res["order_y"], "rank_z": rank_by_id[r["id"]]})
    rows.sort(key=lambda x: x["rank_z"])
    page = max(int(args.get("page", 1)), 1)
    per_page = min(max(int(args.get("per_page", 20)), 1), 100)
    return jsonify(_paginate(rows, page, per_page)), 200


@cmci_bp.route("/dashboard", methods=["GET"])
@tenant_required
def dashboard():
    """Conteos DASHBOARD: E5/I5/D9-D13(+pct)/D17-D19/E22/D25-D28."""
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    items = [r for r in _VULN_DB.values() if r.get("tenant_id") == _tenant()]
    if args.get("center"):
        items = [r for r in items if r.get("center") == args["center"]]
    if args.get("from") or args.get("to"):
        items = [r for r in items if _in_range_date(r.get("assessed_at"), args.get("from"), args.get("to"))]
    total = len(items)  # E5 COUNTIF(BASE!A,'?*')
    avg = (sum(r["result"]["total"] for r in items) / total / 100.0) if total else None  # I5
    levels = {}
    for r in items:
        levels[r["result"]["level"]] = levels.get(r["result"]["level"], 0) + 1
    by_level = {k: {"count": v, "pct": v / total if total else 0}  # D9:D13 + E9:E13
                for k, v in levels.items()}
    prios = {}
    for r in items:
        prios[r["result"]["priority"]] = prios.get(r["result"]["priority"], 0) + 1  # D17:D19
    alerts = sum(1 for r in items if r["result"]["protection_flag"])  # E22
    by_center = {}
    for r in items:
        by_center[r.get("center") or "Sin centro"] = by_center.get(r.get("center") or "Sin centro", 0) + 1  # D25:D28
    return jsonify({"total_E5": total, "avg_I5": avg, "by_level": by_level,
                    "by_priority_D17_D19": prios, "protection_alerts_E22": alerts,
                    "by_center": by_center}), 200


# --------------------------- SOCIOECONÓMICA (espejo) ---------------------------

@cmci_bp.route("/socioeconomic/compute", methods=["POST"])
@tenant_required
def socio_compute():
    body = request.get_json(force=True, silent=True) or {}
    data = body.get("data", body)
    try:
        result = SE.compute(data, STORE.get(body.get("scope", "global")))
    except (ValueError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 422
    result["explain"] = explain_socioeconomic(result)
    return jsonify(result), 200


@cmci_bp.route("/socioeconomic", methods=["POST"])
@tenant_required
def socio_create():
    denied = _deny_unless_can_create()
    if denied:
        return denied
    body = request.get_json(force=True, silent=True) or {}
    site_err = _enforce_site(body.get("center"))
    if site_err:
        return site_err
    data = _normalize_phones(body.get("data", {}))
    try:
        result = SE.compute(data, STORE.get(body.get("scope", "global")))
    except (ValueError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 422
    _SEQ["soc"] += 1
    rec_id = _SEQ["soc"]
    record = {"id": rec_id, "tenant_id": _tenant(), "child_id": body.get("child_id"),
              "center": body.get("center"), "code": body.get("code"),
              "child_name": body.get("child_name"),
              "assessed_at": body.get("assessed_at") or data.get("assessed_at") or _now_iso(),
              "data": data, "result": result, "params_version": STORE.version,
              "source": "api",
              "created_by": getattr(getattr(g, "current_user", None), "id", None)}
    _SOC_DB[rec_id] = record
    return jsonify(record), 201


@cmci_bp.route("/socioeconomic", methods=["GET"])
@tenant_required
def socio_list():
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    items = [r for r in _SOC_DB.values() if r.get("tenant_id") == _tenant()]
    if args.get("child_id"):
        items = [r for r in items if str(r.get("child_id")) == args["child_id"]]
    if args.get("center"):
        items = [r for r in items if r.get("center") == args["center"]]
    items.sort(key=lambda r: r.get("assessed_at", ""), reverse=True)
    page = max(int(args.get("page", 1)), 1)
    per_page = min(max(int(args.get("per_page", 20)), 1), 100)
    return jsonify(_paginate(items, page, per_page)), 200


@cmci_bp.route("/socioeconomic/<int:rec_id>", methods=["GET"])
@tenant_required
def socio_detail(rec_id):
    err = _check_idor(_SOC_DB.get(rec_id))
    if err:
        return err
    return jsonify(_SOC_DB[rec_id]), 200


# --------------------------- PARAMS ---------------------------

@cmci_bp.route("/params", methods=["GET"])
@tenant_required
def params_get():
    scope = _scope()
    return jsonify({"scope": scope, "version": STORE.version,
                    "params": STORE.get(scope)}), 200


@cmci_bp.route("/params", methods=["PUT"])
@tenant_required
def params_put():
    """Solo license_admin. Scope global inmutable (seed validada)."""
    denied = _require_admin()
    if denied:
        return denied
    body = request.get_json(force=True, silent=True) or {}
    scope = body.get("scope", "global")
    patch = body.get("patch", {})
    try:
        updated = STORE.set(scope, patch,
                            actor=getattr(getattr(g, "current_user", None), "id", None))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    return jsonify({"scope": scope, "version": STORE.version, "params": updated}), 200


# --------------------------- IMPORT EXCELS ---------------------------

@cmci_bp.route("/import-excels", methods=["POST"])
@tenant_required
def import_excels():
    """Lee BASE DE DATOS de ambos Excels (openpyxl, valores cacheados) como
    snapshots históricos. Recomputa Y/Z sobre lo importado."""
    denied = _deny_unless_can_create()
    if denied:
        return denied
    try:
        import openpyxl
    except ImportError:
        return jsonify({"error": "openpyxl no instalado"}), 500
    import os as _os
    body = request.get_json(force=True, silent=True) or {}
    seed_dir = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "seeds", "cmci"))
    vuln_path = body.get("vuln_path") or _os.path.join(
        seed_dir, "Matriz_Vulnerabilidad_CMCI_VALIDADA_VERSION_1_OK_pruebas.xlsm")
    socio_path = body.get("socio_path") or _os.path.join(
        seed_dir, "Ficha_Socioeconomica_CMCI_v2_PROTOTIPO.xlsx")
    imported = {"vulnerability": 0, "socioeconomic": 0}

    wb = openpyxl.load_workbook(vuln_path, data_only=True, read_only=True)
    ws = wb["BASE DE DATOS"]
    for row in ws.iter_rows(min_row=5, max_row=152, values_only=True):
        code = row[0]
        if not code:
            continue
        total = row[15] or 0  # P
        alert = (row[19] == "Sí")  # T
        prio = row[18] or ("PRIORIDAD 1" if alert else "PRIORIDAD 3")  # S
        _SEQ["vuln"] += 1
        rec_id = _SEQ["vuln"]
        result = {"total": float(total), "pct": (row[16] or 0),
                  "level": row[17], "priority": prio,
                  "protection_flag": alert, "protection_alert": "SÍ" if alert else "NO",
                  "semaphore": row[21], "childcare_need": row[20],
                  "subtotals": {"D1": row[7], "D2": row[8], "D3": row[9], "D4": row[10],
                                "D5": row[11], "D6": row[12], "D7": row[13], "D8": row[14]},
                  "order_y": VE.order_y(prio, alert, float(total)),
                  "scores": {}, "contrib": {}, "alerts": {}}
        assessed = row[6]
        assessed_at = assessed.isoformat() if hasattr(assessed, "isoformat") else (str(assessed) if assessed else _now_iso())
        _VULN_DB[rec_id] = {"id": rec_id, "tenant_id": _tenant(), "code": code,
                            "child_name": row[1], "center": row[4], "status": row[22] or "Validada",
                            "assessed_at": assessed_at, "observations": row[23],
                            "answers": {}, "result": result, "params_version": STORE.version,
                            "source": "excel-import", "created_by": None}
        imported["vulnerability"] += 1
    wb.close()

    wb2 = openpyxl.load_workbook(socio_path, data_only=True, read_only=True)
    ws2 = wb2["BASE_DATOS"]
    for row in ws2.iter_rows(min_row=4, max_row=203, values_only=True):
        if not row[0]:
            continue
        _SEQ["soc"] += 1
        rec_id = _SEQ["soc"]
        assessed = row[1]
        assessed_at = assessed.isoformat() if hasattr(assessed, "isoformat") else (str(assessed) if assessed else _now_iso())
        _SOC_DB[rec_id] = {"id": rec_id, "tenant_id": _tenant(), "code": row[0],
                           "center": row[2], "child_name": row[3],
                           "assessed_at": assessed_at,
                           "data": {"integrantes": row[5]},
                           "result": {"ingreso_total": row[6], "gasto_total": row[7],
                                      "per_capita": row[8], "total": row[13],
                                      "classification": row[14]},
                           "params_version": STORE.version, "source": "excel-import",
                           "created_by": None}
        imported["socioeconomic"] += 1
    wb2.close()
    return jsonify({"imported": imported, "params_version": STORE.version}), 201
