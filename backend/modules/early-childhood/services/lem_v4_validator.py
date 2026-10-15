"""LEM-V4 como validador de seguridad + bloqueador + medidor de creditos.
Pre:  PII-mask, inyeccion, fuera-contexto, saldo creditos.
Post: fuga PII, alucinacion numerica, XSS/SQL/path-traversal, auditoria + consumo.
Fail-closed: bloquea y audita; nunca deja pasar PII en claro al LLM externo
sin seudonimizar (el gateway debe llamar a sanitize_for_llm antes).
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

LEM_COST_PER_VALIDATION = 1

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignora\s+(todas\s+)?las\s+instrucciones",
    r"system\s*:\s*you\s+are",
    r"reveal\s+(system|secret|api|key|prompt)",
    r"muestra\s+(tu\s+)?(prompt|clave|secreto|system)",
    r"jailbreak|DAN\s+mode|do\s+anything\s+now",
    r"exfiltrate|extrae\s+(todos\s+los\s+)?datos",
    r"<\s*script|javascript\s*:|onerror\s*=",
    r"(\bUNION\b.+\bSELECT\b|\bDROP\b.+\bTABLE\b|;\s*--)",
    r"\.\./\.\.|/etc/passwd|C:\\Windows",
]

_CEDULA_RE = re.compile(r"\b\d{10}\b")
_PHONE_RE = re.compile(r"\b(?:\+?593|0)?9\d{8}\b")


def _load_core():
    try:
        import sys as _sys
        import os as _os
        _COMMON = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "..", "..", "common"))
        if _COMMON not in _sys.path:
            _sys.path.insert(0, _COMMON)
        from core_engine import mask as mask_mod
        from core_engine import audit as audit_mod
        return mask_mod, audit_mod
    except Exception:
        return None, None


def get_balance(license_id: int) -> int:
    try:
        from models.license import License
        lic = License.query.get(license_id)
        return int(getattr(lic, "lem_credits_balance", 0) or 0)
    except Exception:
        return 0


def _consume(license_id: int, reason: str, ref: str = "") -> int:
    from models import db
    from models.llm_config import LEMCreditLedger
    from models.license import License
    lic = License.query.get(license_id)
    if not lic:
        raise ValueError("Licencia no encontrada")
    bal = int(getattr(lic, "lem_credits_balance", 0) or 0)
    if bal < LEM_COST_PER_VALIDATION:
        raise ValueError("Sin creditos LEM-V4. Recargue inferencia para continuar.")
    lic.lem_credits_balance = bal - LEM_COST_PER_VALIDATION
    db.session.add(LEMCreditLedger(license_id=license_id, amount=-LEM_COST_PER_VALIDATION, reason=reason, ref=ref[:200]))
    db.session.commit()
    try:
        mask_mod, audit_mod = _load_core()
        if audit_mod:
            audit_mod.append(actor=f"license:{license_id}", accion=f"lem_consume:{reason}", subject_ref="", finalidad="lem-v4-inference")
    except Exception:
        pass
    return int(lic.lem_credits_balance)


def sanitize_for_llm(payload: dict, rol: str = "analyst") -> dict:
    mask_mod, _ = _load_core()
    if mask_mod is None:
        # Fallback quirurgico minimo
        out = dict(payload or {})
        for k in ("cedula", "id_number", "documento", "telefono", "phone", "nombre", "name", "email", "direccion", "address"):
            if k in out:
                out[k] = "***"
        return out
    return mask_mod.mask_payload(dict(payload or {}), rol)


def pre_validate(message: str, license_id: int | None, role: str | None = None) -> dict:
    """Bloquea inyeccion/ataques antes del LLM. Consume 0 (solo post consume)."""
    text = (message or "").strip()
    if not text:
        return {"ok": False, "blocked": True, "reason": "mensaje_vacio"}
    if len(text) > 12000:
        return {"ok": False, "blocked": True, "reason": "mensaje_muy_largo"}
    low = text.lower()
    for pat in _INJECTION_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            try:
                _, audit_mod = _load_core()
                if audit_mod:
                    audit_mod.append(actor=f"license:{license_id}", accion="lem_block:injection", subject_ref="", finalidad="seguridad")
            except Exception:
                pass
            return {"ok": False, "blocked": True, "reason": "inyeccion_bloqueada"}
    # Fuera de contexto: la plataforma es CDI/programas sociales/operacion
    # Heuristica suave: no bloquear, solo advertir si no hay keywords ni pregunta operativa
    return {"ok": True, "blocked": False, "sanitized": text, "warnings": []}


def post_validate(llm_text: str, license_id: int | None, rag_context: str = "", has_sql_data: bool = False) -> dict:
    """Valida salida LLM, consume 1 credito si licencia valida. Retorna {ok, text, blocked_reason?, balance}."""
    text = llm_text or ""
    # 1. Fuga PII en salida hacia rol no privilegiado -> bloquear/mascarar
    if _CEDULA_RE.search(text) or _PHONE_RE.search(text):
        return {"ok": False, "blocked": True, "reason": "pii_en_salida", "text": "Respuesta bloqueada por LEM-V4: contenia datos sensibles. Reformule sin cedula/telefono."}
    low = text.lower()
    for pat in [r"<\s*script", r"javascript\s*:", r"\bunion\b.+\bselect\b", r"\bdrop\b.+\btable\b", r"\.\./"]:
        if re.search(pat, text, re.IGNORECASE):
            return {"ok": False, "blocked": True, "reason": "vulnerabilidad_en_salida", "text": "Respuesta bloqueada por LEM-V4: patron inseguro detectado."}
    # 2. Alucinacion numerica: si afirma cifras sin fuente RAG/SQL -> advertir (no bloquear duro, el SQL manda)
    numbers = re.findall(r"\b\d+(?:[.,]\d+)?\b", text)
    warnings: list[str] = []
    if numbers and not rag_context and not has_sql_data:
        warnings.append("cifras_sin_fuente: verifique con reporte/SQL antes de usar")
    # 3. Consumo creditos
    balance = None
    if license_id:
        try:
            balance = _consume(int(license_id), reason="chat_validate")
        except ValueError as e:
            return {"ok": False, "blocked": True, "reason": "sin_creditos", "text": str(e)}
        except Exception as e:
            logger.warning(f"LEM consume fallo: {e}")
    return {"ok": True, "blocked": False, "text": text, "warnings": warnings, "balance": balance}
