"""
Mascarado por Rol — Borde de re-identificación autorizada
Compatible con plan maestro §4.3 y PLAN_INTEGRACION_BANCO_DIGITAL.md §4

Flujo de salida:
  LLM response → De-identificador de borde (¿rol autorizado? → re-identifica nombre/edad desde vault : devuelve "***" / age_display) → canal

Reglas:
- LLM NUNCA ve PII real (solo uid_enc + buckets/scores)
- Borde autorizado (license_admin, doctor, social_worker con scope) puede re-identificar
- Borde no autorizado (padre, public_bot, educator) ve solo: nombre***, edad_display, ***-1234
"""
from typing import Dict, Any, Optional, Set
from dataclasses import dataclass
from enum import Enum


class MaskLevel(str, Enum):
    """Niveles de mascarado progresivos."""
    FULL = "full"           # Todo PII mascarado (public_bot, unknown)
    NAME_INITIAL = "name_initial"  # Primera letra nombre + *** (padre, educator)
    AGE_DISPLAY = "age_display"    # Edad calculada (doctor, social_worker, license_admin)
    FULL_PII = "full_pii"          # PII completo (super_admin, license_admin con scope, auditoría)


# Roles que pueden ver cada nivel
ROLE_MASK_LEVEL = {
    # Nivel mínimo: solo uid_enc + buckets
    "public_bot": MaskLevel.FULL,
    "unknown": MaskLevel.FULL,
    
    # Padre ve inicial nombre + edad_display + ***-tel
    "padre": MaskLevel.NAME_INITIAL,
    "parent": MaskLevel.NAME_INITIAL,
    
    # Educadora ve inicial nombre + edad_display
    "educadora": MaskLevel.NAME_INITIAL,
    "educator": MaskLevel.NAME_INITIAL,
    "center_coordinator": MaskLevel.NAME_INITIAL,
    "coordinator": MaskLevel.NAME_INITIAL,
    
    # Profesionales salud/social ven edad_display + buckets (no nombre real)
    "doctor": MaskLevel.AGE_DISPLAY,
    "nutritionist": MaskLevel.AGE_DISPLAY,
    "social_worker": MaskLevel.AGE_DISPLAY,
    "psychologist": MaskLevel.AGE_DISPLAY,
    "administrative": MaskLevel.AGE_DISPLAY,
    "supervisor": MaskLevel.AGE_DISPLAY,
    
    # Admins ven todo (con auditoría)
    "license_admin": MaskLevel.FULL_PII,
    "super_admin": MaskLevel.FULL_PII,
}


# Campos PII y sus transformaciones por nivel
PII_FIELDS = {
    "nombre": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: (v.split()[0][0] + "***") if v else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "apellido": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "full_name": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: (v.split()[0][0] + "***") if v else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "cedula": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: f"***-{v[-4:]}" if v and len(v) >= 4 else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "cedula_enc": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "fecha_nac": {
        MaskLevel.FULL: lambda v: None,
        MaskLevel.NAME_INITIAL: lambda v: None,
        MaskLevel.AGE_DISPLAY: lambda v: None,  # Solo age_display
        MaskLevel.FULL_PII: lambda v: v,
    },
    "edad": {
        MaskLevel.FULL: lambda v: None,
        MaskLevel.NAME_INITIAL: lambda v: v,  # age_display
        MaskLevel.AGE_DISPLAY: lambda v: v,   # age_display
        MaskLevel.FULL_PII: lambda v: v,
    },
    "birth_date": {
        MaskLevel.FULL: lambda v: None,
        MaskLevel.NAME_INITIAL: lambda v: None,
        MaskLevel.AGE_DISPLAY: lambda v: None,
        MaskLevel.FULL_PII: lambda v: v,
    },
    "telefono": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: f"***-{v[-4:]}" if v and len(v) >= 4 else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "phone": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: f"***-{v[-4:]}" if v and len(v) >= 4 else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "email": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: f"{v.split('@')[0][:2]}***@{v.split('@')[1]}" if v and "@" in v else "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "direccion": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "address": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "salud": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",  # Solo health_flags agregados
        MaskLevel.FULL_PII: lambda v: v,
    },
    "health": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "alergias": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "allergies": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "tipo_sangre": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "blood_type": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "photo_url": {
        MaskLevel.FULL: lambda v: None,
        MaskLevel.NAME_INITIAL: lambda v: None,
        MaskLevel.AGE_DISPLAY: lambda v: None,
        MaskLevel.FULL_PII: lambda v: v,
    },
    "nacionalidad": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
    "nationality": {
        MaskLevel.FULL: lambda v: "***",
        MaskLevel.NAME_INITIAL: lambda v: "***",
        MaskLevel.AGE_DISPLAY: lambda v: "***",
        MaskLevel.FULL_PII: lambda v: v,
    },
}


def get_mask_level(role: str) -> MaskLevel:
    """Obtiene nivel de mascarado para un role."""
    return ROLE_MASK_LEVEL.get(role.lower(), MaskLevel.FULL)


def mask_field(value: Any, field_name: str, mask_level: MaskLevel) -> Any:
    """Aplica mascarado a un campo según nivel."""
    field_lower = field_name.lower()
    
    if field_lower in PII_FIELDS:
        transform = PII_FIELDS[field_lower].get(mask_level)
        if transform:
            return transform(value)
    
    # Campos no-PII pasan sin cambios
    return value


def mask_dict(data: Dict[str, Any], role: str, age_display: Optional[int] = None) -> Dict[str, Any]:
    """
    Mascara diccionario completo según role.
    
    Args:
        data: Diccionario con PII (ej. Child.to_dict())
        role: Role del solicitante
        age_display: Edad calculada (para inyectar en NAME_INITIAL/AGE_DISPLAY)
    
    Returns:
        Diccionario con PII mascarado según permisos del role.
    """
    mask_level = get_mask_level(role)
    result = {}
    
    for key, value in data.items():
        masked = mask_field(value, key, mask_level)
        
        # Inyectar age_display si corresponde
        if key.lower() in ("edad", "age", "age_display") and mask_level in (MaskLevel.NAME_INITIAL, MaskLevel.AGE_DISPLAY):
            if age_display is not None:
                masked = age_display
            elif value is not None:
                masked = value
        
        # Omitir campos que se transforman a None (fecha_nac, photo_url, etc. en niveles bajos)
        if masked is not None:
            result[key] = masked
    
    return result


def mask_list(items: list, role: str, age_display_map: Optional[Dict[int, int]] = None) -> list:
    """Mascarar lista de diccionarios (ej. lista de niños)."""
    return [mask_dict(item, role, age_display_map.get(item.get("id")) if age_display_map else None) for item in items]


# === Helpers específicos para modelos existentes ===

def mask_child_response(child_dict: Dict[str, Any], role: str) -> Dict[str, Any]:
    """
    Mascara respuesta de Child según role.
    Inyecta age_display calculado desde fecha_nac.
    """
    from backend.common.identity import compute_age_display
    
    fecha_nac = child_dict.get("fecha_nac") or child_dict.get("birth_date")
    age_display = compute_age_display(fecha_nac) if fecha_nac else None
    
    return mask_dict(child_dict, role, age_display)


def mask_family_response(family_dict: Dict[str, Any], role: str) -> Dict[str, Any]:
    """Mascarar familia (incluye representantes y niños)."""
    result = mask_dict(family_dict, role)
    
    # Mascarar representantes
    if "representatives" in result and isinstance(result["representatives"], list):
        result["representatives"] = [
            mask_dict(rep, role) for rep in result["representatives"]
        ]
    
    # Mascarar niños
    if "children" in result and isinstance(result["children"], list):
        result["children"] = [
            mask_child_response(child, role) for child in result["children"]
        ]
    
    return result


def mask_user_response(user_dict: Dict[str, Any], role: str) -> Dict[str, Any]:
    """Mascarar usuario (para IdentityResolver responses)."""
    return mask_dict(user_dict, role)


# === Middleware Flask para respuesta automática ===
def create_mask_middleware():
    """
    Crea middleware Flask que mascara responses JSON según JWT role.
    Uso: app.after_request(mask_middleware)
    """
    from flask import request, g, jsonify
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    
    def mask_middleware(response):
        # Solo mascarar JSON responses
        if not response.is_json:
            return response
        
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            
            if user_id:
                # Obtener role del usuario (cacheado en g)
                if not hasattr(g, "user_role"):
                    try:
                        # Runtime normal: backend/modules/early-childhood en sys.path
                        from services.identity_resolver import IdentityResolver
                    except ImportError:
                        IdentityResolver = None  # backend/common es código compartido sin runtime propio
                    user = IdentityResolver.get_user_or_virtual(user_id) if IdentityResolver else None
                    g.user_role = user.role.name if user and user.role else "unknown"
                
                role = g.user_role
                
                # Mascarar data en response
                data = response.get_json()
                if isinstance(data, dict):
                    if "data" in data and isinstance(data["data"], (dict, list)):
                        if isinstance(data["data"], list):
                            data["data"] = mask_list(data["data"], role)
                        else:
                            data["data"] = mask_dict(data["data"], role)
                    elif "children" in data and isinstance(data["children"], list):
                        data["children"] = [mask_child_response(c, role) for c in data["children"]]
                    
                    response.set_data(jsonify(data).get_data())
        
        except Exception:
            # Si falla auth, mascarar al máximo (FULL)
            data = response.get_json()
            if isinstance(data, dict):
                if "data" in data:
                    data["data"] = mask_dict(data["data"], "unknown") if isinstance(data["data"], dict) else data["data"]
                response.set_data(jsonify(data).get_data())
        
        return response
    
    return mask_middleware