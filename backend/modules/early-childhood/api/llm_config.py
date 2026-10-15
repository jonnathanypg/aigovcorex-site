"""BYOT por empresa + creditos LEM-V4.
GET sin exponer key (solo masked). PUT cifra server-side. TEST no guarda.
"""
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.llm_config import LLMProviderConfig, LEMCreditLedger, SUPPORTED_PROVIDERS
from models.license import License, LicenseAdmin
from models.user import User

llm_config_bp = Blueprint("llm_config", __name__, url_prefix="/api/license-admin")


def _license_id_for(user: User) -> int | None:
    from utils.role_helpers import get_license_id_for_user
    try:
        return get_license_id_for_user(user)
    except Exception:
        return None


def _require_manager(user: User):
    if not user or not user.role or user.role.name not in ("license_admin", "super_admin", "supervisor"):
        return False
    return True


@llm_config_bp.route("/llm-providers", methods=["GET"])
@jwt_required()
def list_providers():
    out = {k: {"label": v["label"], "base_url": v["base_url"], "models": v["models"]} for k, v in SUPPORTED_PROVIDERS.items()}
    return jsonify({"providers": out}), 200


@llm_config_bp.route("/llm-config", methods=["GET"])
@jwt_required()
def get_llm_config():
    try:
        user = User.query.get(int(get_jwt_identity()))
        if not _require_manager(user):
            return jsonify({"error": "Acceso denegado"}), 403
        license_id = _license_id_for(user)
        if not license_id:
            return jsonify({"error": "Sin licencia asignada"}), 403
        cfg = LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).first()
        lic = License.query.get(license_id)
        allow_custom = bool(getattr(lic, "allow_custom_llm", False)) if lic else False
        ledger = LEMCreditLedger.query.filter_by(license_id=license_id).order_by(LEMCreditLedger.id.desc()).limit(10).all()
        return jsonify({
            "config": cfg.to_dict() if cfg else None,
            "allow_custom_llm": allow_custom,
            "using_platform_default": not (allow_custom and cfg),
            "credits": {
                "balance": int(getattr(lic, "lem_credits_balance", 0) or 0) if lic else 0,
                "enabled": bool(getattr(lic, "lem_enabled", True)) if lic else True,
            },
            # Compatibilidad legacy temporal
            "lem": {
                "balance": int(getattr(lic, "lem_credits_balance", 0) or 0) if lic else 0,
                "enabled": bool(getattr(lic, "lem_enabled", True)) if lic else True,
            },
            "recent_ledger": [l.to_dict() for l in ledger],
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)[:300]}), 500


@llm_config_bp.route("/llm-config", methods=["PUT"])
@jwt_required()
def save_llm_config():
    try:
        user = User.query.get(int(get_jwt_identity()))
        if not _require_manager(user):
            return jsonify({"error": "Acceso denegado"}), 403
        license_id = _license_id_for(user)
        if not license_id:
            return jsonify({"error": "Sin licencia asignada"}), 403
        lic = License.query.get(license_id)
        if not lic or not lic.allow_custom_llm:
            return jsonify({
                "error": "Esta cuenta no tiene habilitada la conexión de modelos propios (BYOT). La inferencia es gestionada por la plataforma."
            }), 403
        data = request.get_json(force=True, silent=True) or {}
        provider = str(data.get("provider") or "").lower().strip()
        if provider not in SUPPORTED_PROVIDERS:
            return jsonify({"error": f"Proveedor invalido. Use: {sorted(SUPPORTED_PROVIDERS)}"}), 400
        model = str(data.get("model") or "").strip() or None
        base_url = str(data.get("base_url") or "").strip() or SUPPORTED_PROVIDERS[provider]["base_url"]
        api_key = str(data.get("api_key") or "")
        if not api_key:
            return jsonify({"error": "api_key requerida (token propio de la empresa)"}), 400
        if len(api_key) < 8:
            return jsonify({"error": "api_key demasiado corta"}), 400
        from utils.llm_vault import encrypt_api_key
        enc = encrypt_api_key(api_key)
        # Desactiva anteriores, crea activa nueva (historial)
        LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).update({"is_active": False})
        cfg = LLMProviderConfig(
            license_id=license_id, provider=provider, model=model,
            api_key_enc=enc, base_url=base_url, is_active=True, last_error=None,
        )
        db.session.add(cfg)
        db.session.commit()
        return jsonify({"message": "Proveedor LLM guardado (BYOT)", "config": cfg.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)[:300]}), 500


@llm_config_bp.route("/llm-config/test", methods=["POST"])
@jwt_required()
def test_llm_config():
    try:
        user = User.query.get(int(get_jwt_identity()))
        if not _require_manager(user):
            return jsonify({"error": "Acceso denegado"}), 403
        data = request.get_json(force=True, silent=True) or {}
        # Si mandan api_key la prueban directo; si no, prueban la guardada
        provider = str(data.get("provider") or "").lower().strip()
        model = data.get("model")
        base_url = data.get("base_url")
        api_key = data.get("api_key") or ""
        license_id = _license_id_for(user)
        if not api_key and provider:
            cfg = LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).first()
            if cfg and (not provider or cfg.provider == provider):
                from utils.llm_vault import decrypt_api_key
                api_key = decrypt_api_key(cfg.api_key_enc)
                provider = cfg.provider
                model = model or cfg.model
                base_url = base_url or cfg.base_url
        if not provider or not api_key:
            return jsonify({"ok": False, "error": "provider y api_key requeridos"}), 400
        from services.llm_gateway import test_connection
        res = test_connection(provider, model, api_key, base_url)
        # Marca validacion si ok y hay config
        if res.get("ok") and license_id:
            cfg = LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).first()
            if cfg and cfg.provider == provider:
                cfg.last_validated_at = datetime.utcnow()
                cfg.last_error = None
                db.session.commit()
        elif license_id:
            cfg = LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).first()
            if cfg and cfg.provider == provider:
                cfg.last_error = str(res.get("error"))[:500]
                db.session.commit()
        code = 200 if res.get("ok") else 400
        return jsonify(res), code
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)[:300]}), 500


@llm_config_bp.route("/llm-config", methods=["DELETE"])
@jwt_required()
def delete_llm_config():
    try:
        user = User.query.get(int(get_jwt_identity()))
        if not _require_manager(user):
            return jsonify({"error": "Acceso denegado"}), 403
        license_id = _license_id_for(user)
        n = LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True).update({"is_active": False})
        db.session.commit()
        return jsonify({"message": f"Config BYOT desactivada ({n}). Vuelve a fallback global."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)[:300]}), 500
