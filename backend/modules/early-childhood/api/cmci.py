"""API CMCI F1 — fichas vulnerabilidad + socioeconómica (§3.1 §3.2 §10.1 + Fase 1).

Blueprint cmci_bp (url_prefix='/cmci') -> se registra UNA vez en api/__init__.py
sobre api_bp => rutas finales /api/cmci/*. NO usar prefijo /api aquí
(evita doble /api/api).

Persistencia primaria: modelos cmci.py (VulnerabilityAssessment,
SocioeconomicAssessment, ScoringParams vía ParamStore). POST crea siempre
una fila histórica (nunca overwrite); GET filtra en SQL (center/desde/hasta)
con paginación; priorización ordena en SQL (prioridad, alerta, total)
replicando Y/Z; dashboard agrega con COUNT/AVG SQL. Los dicts _VULN_DB/_SOC_DB
quedan SOLO como fallback si la DB no está disponible (try/except).

Incluye GET /vulnerability/<id>/ml-explain (F2 shadow: informa pero nunca
modifica el total determinista).
"""
import logging
from datetime import date, datetime

from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from middleware.tenant_context import tenant_required, TenantContext
from utils.role_helpers import (can_create_ficha, is_catering,
                                can_view_cmci_global)
from utils.phone_utils import normalize_phone_e164
from services.scoring import vulnerability_engine as VE
from services.scoring import socioeconomic_engine as SE
from services.scoring.params_store import ParamStore, load_seed
from services.scoring.explain import explain_vulnerability, explain_socioeconomic

logger = logging.getLogger(__name__)

cmci_bp = Blueprint("cmci", __name__, url_prefix="/cmci")

STORE = ParamStore()  # seed v1_validada_2026-09-25 + overrides por scope (DB-first)

# Fallback histórico en memoria (un registro por valoración, nunca overwrite).
# SOLO se usa si la DB no está disponible; la vía principal es SQL.
_VULN_DB = {}
_SOC_DB = {}
_SEQ = {"vuln": 0, "soc": 0}

# Clave reservada dentro de los JSON para metadatos del contrato API
# (center/child_name/observations/params_version/source + payload íntegro)
# que no tienen columna nativa en los modelos.
_META = "__meta__"

ADMIN_ROLES = ("license_admin", "super_admin")  # PUT /params solo license_admin


def _tenant():
    return TenantContext.get_current_tenant_id()


def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def _rollback_quiet():
    try:
        from models import db
        db.session.rollback()
    except Exception:
        pass


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


def _page_args(args):
    page = max(int(args.get("page", 1)), 1)
    per_page = min(max(int(args.get("per_page", 20)), 1), 100)
    return page, per_page


def _in_range_date(value, _from, _to):
    if not value:
        return False
    day = str(value)[:10]
    if _from and day < _from:
        return False
    if _to and day > _to:
        return False
    return True


def _parse_day(value):
    """Normaliza fecha ISO/date/datetime → (date|None, raw_iso|None)."""
    if value is None or value == "":
        return None, None
    if isinstance(value, datetime):
        return value.date(), value.isoformat(timespec="seconds")
    if isinstance(value, date):
        return value, value.isoformat()
    text = str(value).strip()
    if not text:
        return None, None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date(), text
    except ValueError:
        pass
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").date(), text
    except ValueError:
        return None, text


# --------------------------- VULNERABILIDAD (DB) ---------------------------

def _vuln_insert_db(body, answers, result, params_version, source):
    """Inserta fila histórica en vulnerability_assessments (nunca overwrite)."""
    from models import db
    from models.cmci import VulnerabilityAssessment

    body = body or {}
    answers = dict(answers) if isinstance(answers, dict) else {}
    result = result or {}
    assessed_in = body.get("assessed_at") or answers.get("assessed_at")
    day, raw = _parse_day(assessed_in or _now_iso())
    birth_in = answers.get("birth_date")
    bday, _ = _parse_day(birth_in) if birth_in else (None, None)
    stored_answers = dict(answers)
    stored_answers[_META] = {
        "center": body.get("center"), "child_name": body.get("child_name"),
        "observations": body.get("observations"),
        "params_version": params_version, "source": source,
        "assessed_at": raw, "result": result,
    }
    row = VulnerabilityAssessment(
        child_id=body.get("child_id"), center_id=_tenant(),
        code=body.get("code"), assessed_at=day, birth_date=bday,
        age_months=result.get("age_months"),
        in_range=(result.get("age_range") != "FUERA DE RANGO"),
        answers=stored_answers, scores=result.get("scores") or {},
        subtotals=result.get("subtotals") or {},
        total=result.get("total") or 0.0, level=result.get("level"),
        semaphore=result.get("semaphore"),
        protection_alert=bool(result.get("protection_flag")),
        priority=result.get("priority"),
        childcare_need=result.get("childcare_need"),
        alerts=result.get("alerts") or {},
        status=body.get("status", "En proceso"),
        created_by=getattr(getattr(g, "current_user", None), "id", None),
    )
    db.session.add(row)
    db.session.commit()
    return _vuln_to_record(row)


def _vuln_to_record(row):
    """Serializa un row al contrato API (idéntico al histórico en memoria)."""
    answers = dict(getattr(row, "answers", None) or {})
    meta = answers.pop(_META, {})
    if not isinstance(meta, dict):
        meta = {}
    result = meta.get("result")
    if not isinstance(result, dict):
        total = getattr(row, "total", 0.0) or 0.0
        prot = bool(getattr(row, "protection_alert", False))
        result = {
            "total": total, "pct": total / 100.0,
            "level": getattr(row, "level", None),
            "priority": getattr(row, "priority", None),
            "protection_flag": prot,
            "protection_alert": "SÍ" if prot else "NO",
            "semaphore": getattr(row, "semaphore", None),
            "childcare_need": getattr(row, "childcare_need", None),
            "scores": getattr(row, "scores", None) or {},
            "subtotals": getattr(row, "subtotals", None) or {},
            "contrib": {}, "alerts": getattr(row, "alerts", None) or {},
            "age_months": getattr(row, "age_months", None),
            "order_y": VE.order_y(getattr(row, "priority", None) or "PRIORIDAD 3",
                                  prot, total),
        }
    assessed = meta.get("assessed_at")
    if not assessed and getattr(row, "assessed_at", None) is not None:
        assessed = row.assessed_at.isoformat()
    return {
        "id": row.id, "tenant_id": getattr(row, "center_id", None),
        "child_id": getattr(row, "child_id", None),
        "center": meta.get("center"), "code": getattr(row, "code", None),
        "child_name": meta.get("child_name"), "status": getattr(row, "status", None),
        "assessed_at": assessed, "observations": meta.get("observations"),
        "answers": answers, "result": result,
        "params_version": meta.get("params_version"),
        "source": meta.get("source"),
        "created_by": getattr(row, "created_by", None),
    }


def _vuln_base_query(args):
    """Query base con filtros tenant + center/desde/hasta (+child_id/status)."""
    from models.cmci import VulnerabilityAssessment

    q = VulnerabilityAssessment.query.filter(
        VulnerabilityAssessment.center_id == _tenant())
    center = args.get("center")
    if center:
        from models.tenant import Tenant
        q = (q.join(Tenant,
                    VulnerabilityAssessment.center_id == Tenant.id)
              .filter(Tenant.cmci_code == str(center)))
    if args.get("child_id") is not None and str(args.get("child_id")) != "":
        try:
            q = q.filter(VulnerabilityAssessment.child_id == int(args["child_id"]))
        except (TypeError, ValueError):
            from models import db
            q = q.filter(db.false())  # id no numérico → sin resultados
    if args.get("status"):
        q = q.filter(VulnerabilityAssessment.status == args["status"])
    if args.get("from"):
        day, _ = _parse_day(args["from"])
        if day is not None:
            q = q.filter(VulnerabilityAssessment.assessed_at >= day)
    if args.get("to"):
        day, _ = _parse_day(args["to"])
        if day is not None:
            q = q.filter(VulnerabilityAssessment.assessed_at <= day)
    return q


def _vuln_list_db(args):
    from models.cmci import VulnerabilityAssessment

    page, per_page = _page_args(args)
    q = _vuln_base_query(args)
    total = q.count()
    rows = (q.order_by(VulnerabilityAssessment.assessed_at.desc(),
                       VulnerabilityAssessment.id.desc())
             .limit(per_page).offset((page - 1) * per_page).all())
    return {"data": [_vuln_to_record(r) for r in rows], "page": page,
            "per_page": per_page, "total": total}


def _vuln_detail_db(rec_id):
    from models.cmci import VulnerabilityAssessment

    row = (VulnerabilityAssessment.query
           .filter(VulnerabilityAssessment.id == rec_id,
                   VulnerabilityAssessment.center_id == _tenant()).first())
    return _vuln_to_record(row) if row is not None else None


def _vuln_rank_db(args):
    """Priorización: orden Y/Z en SQL (prioridad, alerta, total)."""
    from models.cmci import VulnerabilityAssessment

    page, per_page = _page_args(args)
    # Replica BASE col Y = priNum*100000 + alerta*1000 + total:
    # ordenar por Y desc equivale a (prioridad, alerta, total) desc, ya que
    # alerta*1000+total < 100000. Los literales 'PRIORIDAD 1/2/3' ordenan
    # ascendentemente igual que su rango, por eso prioridad ASC.
    q = (_vuln_base_query(args)
         .order_by(func.coalesce(VulnerabilityAssessment.priority,
                                 "PRIORIDAD 9").asc(),
                   VulnerabilityAssessment.protection_alert.desc(),
                   VulnerabilityAssessment.total.desc(),
                   VulnerabilityAssessment.id.asc()))
    total = q.count()
    rows = q.limit(per_page).offset((page - 1) * per_page).all()
    data = []
    for pos, row in enumerate(rows, start=(page - 1) * per_page + 1):
        rec = _vuln_to_record(row)
        res = rec["result"]
        data.append({"id": rec["id"], "code": rec.get("code"),
                     "child_id": rec.get("child_id"),
                     "child_name": rec.get("child_name"),
                     "center": rec.get("center"),
                     "assessed_at": rec.get("assessed_at"),
                     "age_months": res.get("age_months"),
                     "total": res.get("total"), "level": res.get("level"),
                     "priority": res.get("priority"),
                     "protection_alert": res.get("protection_alert"),
                     "semaphore": res.get("semaphore"),
                     "status": rec.get("status"),
                     "order_y": res.get("order_y"), "rank_z": pos})
    return {"data": data, "page": page, "per_page": per_page, "total": total}


def _vuln_dashboard_db(args):
    """Dashboard con agregados SQL (COUNT/AVG/GROUP BY)."""
    from models.cmci import VulnerabilityAssessment

    q = _vuln_base_query(args)
    id_col = VulnerabilityAssessment.id
    total = q.with_entities(func.count(id_col)).scalar() or 0
    avg = q.with_entities(func.avg(VulnerabilityAssessment.total)).scalar()
    by_level = {lvl: {"count": cnt, "pct": cnt / total if total else 0}
                for lvl, cnt in
                q.with_entities(VulnerabilityAssessment.level,
                                func.count(id_col))
                 .group_by(VulnerabilityAssessment.level).all()}
    by_prio = {prio: cnt for prio, cnt in
               q.with_entities(VulnerabilityAssessment.priority,
                               func.count(id_col))
                .group_by(VulnerabilityAssessment.priority).all()}
    alerts = (q.filter(VulnerabilityAssessment.protection_alert.is_(True))
               .with_entities(func.count(id_col)).scalar() or 0)
    if args.get("center"):
        by_center = {args["center"]: total}
    else:
        from models.tenant import Tenant
        center_col = func.coalesce(Tenant.cmci_code, "Sin centro")
        by_center = {c: cnt for c, cnt in
                     q.outerjoin(Tenant, VulnerabilityAssessment.center_id
                                 == Tenant.id)
                      .with_entities(center_col, func.count(id_col))
                      .group_by(center_col).all()}
    return {"total_E5": total, "avg_I5": (avg / 100.0 if avg is not None else None),
            "by_level": by_level, "by_priority_D17_D19": by_prio,
            "protection_alerts_E22": alerts, "by_center": by_center}


def _vuln_create_mem(body, answers, result):
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
    return record


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
    try:
        record = _vuln_insert_db(body, answers, result, STORE.version, "api")
    except Exception as exc:
        logger.warning("vuln_create: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
        record = _vuln_create_mem(body, answers, result)
    return jsonify(record), 201


@cmci_bp.route("/vulnerability", methods=["GET"])
@tenant_required
def vuln_list():
    """GET /vulnerability?child_id&center&status&from&to&page&per_page."""
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    try:
        return jsonify(_vuln_list_db(args)), 200
    except Exception as exc:
        logger.warning("vuln_list: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
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
    try:
        record = _vuln_detail_db(rec_id)
    except Exception as exc:
        logger.warning("vuln_detail: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
        err = _check_idor(_VULN_DB.get(rec_id))
        if err:
            return err
        return jsonify(_VULN_DB[rec_id]), 200
    if record is None:
        return jsonify({"error": "Registro no encontrado"}), 404
    return jsonify(record), 200


@cmci_bp.route("/vulnerability/<int:assessment_id>/ml-explain", methods=["GET"])
@tenant_required
def ml_explain(assessment_id: int):
    """Explica el shadow ML de una ficha de vulnerabilidad CMCI.

    Retorna {ml_priority_proba, top3, determinista_total, delta,
    ml_version, mode}. Si no hay modelo o la ficha no tiene proba
    persistida, recalcula shadow al vuelo (sin persistir ni alterar nada).
    El ML es shadow: NUNCA modifica el total determinista (delta 0.0).
    """
    try:
        from models.cmci import VulnerabilityAssessment
        from services.ml_calibrator import calibrate, explain_for_assessment

        rec = VulnerabilityAssessment.query.get(assessment_id)
        if not rec:
            return jsonify({'success': False,
                            'error': 'Ficha no encontrada'}), 404
        # F5 IDOR: la ficha debe pertenecer al tenant (site==tenant).
        tenant_id = TenantContext.get_current_tenant_id()
        if getattr(rec, 'center_id', None) not in (None, tenant_id):
            return jsonify({'success': False,
                            'error': 'Ficha no encontrada'}), 404

        proba = getattr(rec, 'ml_proba', None)
        ml_version = getattr(rec, 'ml_version', None)
        top3 = None
        if proba is None:
            # Recálculo shadow al vuelo (solo lectura, sin persistir)
            fd = dict(getattr(rec, 'answers', None) or {})
            fd.pop(_META, None)
            fd['subtotals'] = getattr(rec, 'subtotals', None) or {}
            fd['scores'] = getattr(rec, 'scores', None) or {}
            fd['alerts'] = getattr(rec, 'alerts', None) or {}
            _, info = calibrate(None, fd, getattr(rec, 'total', 0.0) or 0.0)
            proba = info.get('proba')
            top3 = info.get('top3', [])
            ml_version = info.get('ml_version')
        payload = explain_for_assessment(getattr(rec, 'total', 0.0) or 0.0,
                                         proba, top3=top3, ml_version=ml_version)
        payload['success'] = True
        payload['assessment_id'] = assessment_id
        return jsonify(payload), 200
    except Exception as e:
        logger.error(f'ml-explain fallo: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@cmci_bp.route("/priorizacion", methods=["GET"])
@tenant_required
def priorizacion():
    """Espejo PRIORIZACIÓN: orden Y/Z + paginación + filtros center/from/to."""
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    try:
        return jsonify(_vuln_rank_db(args)), 200
    except Exception as exc:
        logger.warning("priorizacion: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
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
    try:
        return jsonify(_vuln_dashboard_db(args)), 200
    except Exception as exc:
        logger.warning("dashboard: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
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


# --------------------------- SOCIOECONÓMICA (DB) ---------------------------

def _soc_insert_db(body, data, result, params_version, source):
    """Inserta fila histórica en socioeconomic_assessments (nunca overwrite)."""
    from models import db
    from models.cmci import SocioeconomicAssessment

    body = body or {}
    data = dict(data) if isinstance(data, dict) else {}
    result = result or {}
    assessed_in = body.get("assessed_at") or data.get("assessed_at")
    day, raw = _parse_day(assessed_in or _now_iso())
    ingresos = data.get("ingresos")
    egresos = data.get("egresos")
    stored_in = dict(ingresos) if isinstance(ingresos, dict) else {}
    stored_in[_META] = {
        "center": body.get("center"), "child_name": body.get("child_name"),
        "code": body.get("code"), "params_version": params_version,
        "source": source, "assessed_at": raw,
        "data": data, "result": result,
    }
    row = SocioeconomicAssessment(
        child_id=body.get("child_id"), center_id=_tenant(),
        code=body.get("code"), assessed_at=day,
        incomes=stored_in,
        expenses=dict(egresos) if isinstance(egresos, dict) else {},
        per_capita=result.get("per_capita"),
        expense_ratio=result.get("ratio_gasto"),
        coverage_services=result.get("cobertura_servicios"),
        dependency=result.get("personas_por_perceptor"),
        subscores=result.get("subscores") or {},
        total=result.get("total") or 0.0,
        classification=result.get("classification"),
    )
    db.session.add(row)
    db.session.commit()
    return _soc_to_record(row)


def _soc_to_record(row):
    """Serializa un row al contrato API (idéntico al histórico en memoria)."""
    incomes = dict(getattr(row, "incomes", None) or {})
    meta = incomes.pop(_META, {})
    if not isinstance(meta, dict):
        meta = {}
    data = meta.get("data")
    if not isinstance(data, dict):
        data = {"ingresos": incomes,
                "egresos": dict(getattr(row, "expenses", None) or {})}
    result = meta.get("result")
    if not isinstance(result, dict):
        result = {"per_capita": getattr(row, "per_capita", None),
                  "total": getattr(row, "total", 0.0) or 0.0,
                  "classification": getattr(row, "classification", None),
                  "subscores": getattr(row, "subscores", None) or {}}
    assessed = meta.get("assessed_at")
    if not assessed and getattr(row, "assessed_at", None) is not None:
        assessed = row.assessed_at.isoformat()
    return {
        "id": row.id, "tenant_id": getattr(row, "center_id", None),
        "child_id": getattr(row, "child_id", None),
        "center": meta.get("center"),
        "code": getattr(row, "code", None) or meta.get("code"),
        "child_name": meta.get("child_name"), "assessed_at": assessed,
        "data": data, "result": result,
        "params_version": meta.get("params_version"),
        "source": meta.get("source"),
    }


def _soc_base_query(args):
    from models.cmci import SocioeconomicAssessment

    q = SocioeconomicAssessment.query.filter(
        SocioeconomicAssessment.center_id == _tenant())
    if args.get("center"):
        from models.tenant import Tenant
        q = (q.join(Tenant,
                    SocioeconomicAssessment.center_id == Tenant.id)
              .filter(Tenant.cmci_code == str(args["center"])))
    if args.get("child_id") is not None and str(args.get("child_id")) != "":
        try:
            q = q.filter(SocioeconomicAssessment.child_id == int(args["child_id"]))
        except (TypeError, ValueError):
            from models import db
            q = q.filter(db.false())
    if args.get("from"):
        day, _ = _parse_day(args["from"])
        if day is not None:
            q = q.filter(SocioeconomicAssessment.assessed_at >= day)
    if args.get("to"):
        day, _ = _parse_day(args["to"])
        if day is not None:
            q = q.filter(SocioeconomicAssessment.assessed_at <= day)
    return q


def _soc_list_db(args):
    from models.cmci import SocioeconomicAssessment

    page, per_page = _page_args(args)
    q = _soc_base_query(args)
    total = q.count()
    rows = (q.order_by(SocioeconomicAssessment.assessed_at.desc(),
                       SocioeconomicAssessment.id.desc())
             .limit(per_page).offset((page - 1) * per_page).all())
    return {"data": [_soc_to_record(r) for r in rows], "page": page,
            "per_page": per_page, "total": total}


def _soc_detail_db(rec_id):
    from models.cmci import SocioeconomicAssessment

    row = (SocioeconomicAssessment.query
           .filter(SocioeconomicAssessment.id == rec_id,
                   SocioeconomicAssessment.center_id == _tenant()).first())
    return _soc_to_record(row) if row is not None else None


def _soc_create_mem(body, data, result):
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
    return record


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
    try:
        record = _soc_insert_db(body, data, result, STORE.version, "api")
    except Exception as exc:
        logger.warning("socio_create: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
        record = _soc_create_mem(body, data, result)
    return jsonify(record), 201


@cmci_bp.route("/socioeconomic", methods=["GET"])
@tenant_required
def socio_list():
    args = request.args
    site_err = _enforce_site(args.get("center"))
    if site_err:
        return site_err
    try:
        return jsonify(_soc_list_db(args)), 200
    except Exception as exc:
        logger.warning("socio_list: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
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
    try:
        record = _soc_detail_db(rec_id)
    except Exception as exc:
        logger.warning("socio_detail: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
        err = _check_idor(_SOC_DB.get(rec_id))
        if err:
            return err
        return jsonify(_SOC_DB[rec_id]), 200
    if record is None:
        return jsonify({"error": "Registro no encontrado"}), 404
    return jsonify(record), 200


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

    vuln_rows, soc_rows = [], []
    wb = openpyxl.load_workbook(vuln_path, data_only=True, read_only=True)
    ws = wb["BASE DE DATOS"]
    for row in ws.iter_rows(min_row=5, max_row=152, values_only=True):
        code = row[0]
        if not code:
            continue
        total = row[15] or 0  # P
        alert = (row[19] == "Sí")  # T
        prio = row[18] or ("PRIORIDAD 1" if alert else "PRIORIDAD 3")  # S
        result = {"total": float(total), "pct": (row[16] or 0),
                  "level": row[17], "priority": prio,
                  "protection_flag": alert, "protection_alert": "SÍ" if alert else "NO",
                  "semaphore": row[21], "childcare_need": row[20],
                  "subtotals": {"D1": row[7], "D2": row[8], "D3": row[9], "D4": row[10],
                                "D5": row[11], "D6": row[12], "D7": row[13], "D8": row[14]},
                  "order_y": VE.order_y(prio, alert, float(total)),
                  "scores": {}, "contrib": {}, "alerts": {}}
        assessed = row[6]
        vuln_rows.append({"body": {"code": code, "child_name": row[1],
                                   "center": row[4],
                                   "status": row[22] or "Validada",
                                   "assessed_at": assessed,
                                   "observations": row[23]},
                          "answers": {}, "result": result})
    wb.close()

    wb2 = openpyxl.load_workbook(socio_path, data_only=True, read_only=True)
    ws2 = wb2["BASE_DATOS"]
    for row in ws2.iter_rows(min_row=4, max_row=203, values_only=True):
        if not row[0]:
            continue
        assessed = row[1]
        soc_rows.append({"body": {"code": row[0], "center": row[2],
                                  "child_name": row[3], "assessed_at": assessed},
                         "data": {"integrantes": row[5]},
                         "result": {"ingreso_total": row[6], "gasto_total": row[7],
                                    "per_capita": row[8], "total": row[13],
                                    "classification": row[14]}})
    wb2.close()

    imported = {"vulnerability": 0, "socioeconomic": 0}
    try:
        for item in vuln_rows:
            _vuln_insert_db(item["body"], item["answers"], item["result"],
                            STORE.version, "excel-import")
            imported["vulnerability"] += 1
        for item in soc_rows:
            _soc_insert_db(item["body"], item["data"], item["result"],
                           STORE.version, "excel-import")
            imported["socioeconomic"] += 1
    except Exception as exc:
        logger.warning("import_excels: DB no disponible (%s); fallback memoria", exc)
        _rollback_quiet()
        for item in vuln_rows:
            body = item["body"]
            if hasattr(body.get("assessed_at"), "isoformat"):
                body = dict(body, assessed_at=body["assessed_at"].isoformat())
            elif body.get("assessed_at"):
                body = dict(body, assessed_at=str(body["assessed_at"]))
            else:
                body = dict(body, assessed_at=_now_iso())
            _SEQ["vuln"] += 1
            rec_id = _SEQ["vuln"]
            _VULN_DB[rec_id] = {"id": rec_id, "tenant_id": _tenant(),
                                "code": body["code"],
                                "child_name": body["child_name"],
                                "center": body["center"],
                                "status": body["status"],
                                "assessed_at": body["assessed_at"],
                                "observations": body["observations"],
                                "answers": {}, "result": item["result"],
                                "params_version": STORE.version,
                                "source": "excel-import", "created_by": None}
            imported["vulnerability"] += 1
        for item in soc_rows:
            body = item["body"]
            if hasattr(body.get("assessed_at"), "isoformat"):
                body = dict(body, assessed_at=body["assessed_at"].isoformat())
            elif body.get("assessed_at"):
                body = dict(body, assessed_at=str(body["assessed_at"]))
            else:
                body = dict(body, assessed_at=_now_iso())
            _SEQ["soc"] += 1
            rec_id = _SEQ["soc"]
            _SOC_DB[rec_id] = {"id": rec_id, "tenant_id": _tenant(),
                               "code": body["code"],
                               "center": body["center"],
                               "child_name": body["child_name"],
                               "assessed_at": body["assessed_at"],
                               "data": item["data"], "result": item["result"],
                               "params_version": STORE.version,
                               "source": "excel-import", "created_by": None}
            imported["socioeconomic"] += 1
    return jsonify({"imported": imported, "params_version": STORE.version}), 201
