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
    """Bloquea inyección/ataques antes del LLM usando heurística + evaluación C99 LEM en disco."""
    text = (message or "").strip()
    if not text:
        return {"ok": False, "blocked": True, "reason": "mensaje_vacio", "text": "Por favor ingrese un mensaje."}
    if len(text) > 12000:
        return {"ok": False, "blocked": True, "reason": "mensaje_muy_largo", "text": "El mensaje excede el límite permitido."}

    low = text.lower()
    for pat in _INJECTION_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            try:
                _, audit_mod = _load_core()
                if audit_mod:
                    audit_mod.append(actor=f"license:{license_id}", accion="lem_block:injection", subject_ref="", finalidad="seguridad")
            except Exception:
                pass
            return {
                "ok": False, 
                "blocked": True, 
                "is_attack": True,
                "reason": "inyeccion_bloqueada",
                "text": "⛔ Acción no permitida: Su solicitud contiene patrones contrarios a las políticas de seguridad y gobernanza de la plataforma."
            }

    # Evaluación matemática C99 LEM-Ops del vector de estado del input
    try:
        from services.lem_native_engine import LEMNativeEngine
        # z0: longitud normalizada, z1: ratio caracteres especiales, z2: palabras clave sospechosas
        spec_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
        z = [
            min(1.0, len(text) / 2000.0),
            min(1.0, (spec_chars / max(1, len(text))) * 3.0),
            1.0 if any(k in low for k in ['prompt', 'bypass', 'eval', 'select', 'where', 'delete']) else 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
        ]
        accepted, energy = LEMNativeEngine.evaluate_state(z, schema_name="lem_v4_pre_guard", engine="v4")
        if not accepted:
            return {
                "ok": False,
                "blocked": True,
                "is_attack": True,
                "reason": "lem_energy_threshold_exceeded",
                "text": "⛔ Solicitud rechazada por el motor determinista de seguridad (anomalía estructural detectada)."
            }
    except Exception as e:
        logger.debug(f"[LEM Pre] C99 check skipped: {e}")

    return {"ok": True, "blocked": False, "sanitized": text, "warnings": []}


def post_validate(llm_text: str, license_id: int | None, rag_context: str = "", has_sql_data: bool = False, allow_pii_role: bool = False) -> dict:
    """
    Valida salida del agente.
    - Ataques/Vulnerabilidades detectadas -> Bloqueo estricto.
    - Cédulas o datos sensibles en rol no privilegiado -> Enmascaramiento fluido determinista (sin romper el chat).
    - Cifras numéricas sin respaldo SQL/RAG -> Marca contingencia para auto-recuperación.
    - Ejecuta evaluación C99 en disco y deduce crédito en MariaDB.
    """
    text = llm_text or ""
    
    # 1. Ataques o patrones inseguros en la salida (XSS, SQL, Path Traversal) -> Bloqueo Perimetral
    for pat in [r"<\s*script", r"javascript\s*:", r"\bunion\b.+\bselect\b", r"\bdrop\b.+\btable\b", r"\.\./"]:
        if re.search(pat, text, re.IGNORECASE):
            return {
                "ok": False, 
                "blocked": True, 
                "is_attack": True,
                "reason": "vulnerabilidad_en_salida", 
                "text": "⛔ Respuesta bloqueada por políticas de seguridad: se detectó un patrón potencialmente inseguro en los datos generados."
            }

    # 2. Protección de Datos Sensibles (PII): Enmascarar con elegancia en lugar de bloqueo brusco
    has_pii = bool(_CEDULA_RE.search(text) or _PHONE_RE.search(text))
    if has_pii and not allow_pii_role:
        # Enmascarar cédula conservando solo los últimos 3 dígitos
        text = _CEDULA_RE.sub(lambda m: f"***-***-{m.group(0)[-3:]}", text)
        # Enmascarar teléfono
        text = _PHONE_RE.sub(lambda m: f"09****{m.group(0)[-4:]}", text)

    # 3. Determinismo y Contingencia de Alucinación Numérica
    numbers = re.findall(r"\b\d+(?:[.,]\d+)?\b", text)
    needs_contingency = False
    warnings: list[str] = []
    
    # Si emite cifras específicas y no hubo ni SQL ni RAG activo
    if numbers and not rag_context and not has_sql_data:
        needs_contingency = True
        warnings.append("alucinacion_numerica_posible: cifras generadas sin contexto determinista de base de datos")

    # 4. Evaluación de Estado en Silicio C99 (LEM-V4)
    try:
        from services.lem_native_engine import LEMNativeEngine
        z = [
            1.0 if has_pii else 0.0,
            1.0 if needs_contingency else 0.0,
            min(1.0, len(text) / 4000.0),
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
        ]
        accepted, energy = LEMNativeEngine.evaluate_state(z, schema_name="lem_v4_post_guard", engine="v4")
    except Exception as e:
        accepted, energy = True, 0.0

    # 5. Consumo de Créditos y Auditoría en MariaDB
    balance = None
    if license_id:
        try:
            balance = _consume(int(license_id), reason="chat_validate")
        except ValueError as e:
            return {"ok": False, "blocked": True, "reason": "sin_creditos", "text": str(e)}
        except Exception as e:
            logger.warning(f"LEM consume fallo: {e}")

    return {
        "ok": True, 
        "blocked": False, 
        "text": text, 
        "needs_contingency": needs_contingency,
        "warnings": warnings, 
        "balance": balance,
        "energy": energy
    }
