"""
Identity & Capability Tools — GASTI AI
Resuelven "¿quién soy? / ¿mi nombre?" y "¿qué puedes hacer?" sin alucinar.
Solo lectura, seguros para todos los roles.
"""
from langchain.tools import BaseTool
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class GetCurrentUserProfileTool(BaseTool):
    """Devuelve la identidad real del usuario autenticado (nombre, rol, centro, licencia)."""
    name: str = "get_current_user_profile"
    description: str = (
        "Obtiene el perfil del usuario ACTUAL que habla contigo (nombre real, rol, centro, licencia). "
        "Úsala SIEMPRE cuando pregunten 'quién soy', 'mi nombre', 'qué rol tengo', 'a qué centro pertenezco'. "
        "Input: {'user_id': 1}. No inventes nombres, usa esta herramienta."
    )

    def _run(self, *args, **kwargs) -> dict:
        user_id = kwargs.get("user_id")
        if not user_id:
            return {"success": False, "error": "user_id es requerido."}
        try:
            from services.identity_resolver import IdentityResolver
            from models.tenant import Tenant
            from utils.role_helpers import get_license_id_for_user

            user = IdentityResolver.get_user_or_virtual(int(user_id))
            if not user:
                return {"success": False, "error": "Usuario no encontrado."}

            role_name = getattr(getattr(user, "role", None), "name", "unknown") or "unknown"
            full_name = getattr(user, "full_name", None) or f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or "Usuario"
            tenant_id = getattr(user, "tenant_id", None)
            center_name = None
            centers = []
            license_name = None
            try:
                if tenant_id:
                    t = Tenant.query.get(int(tenant_id))
                    if t:
                        center_name = t.name
                # Multi-centro: listar todos los centros de su licencia
                lic_id = get_license_id_for_user(user)
                if lic_id:
                    from models.license import License
                    lic = License.query.get(int(lic_id))
                    if lic:
                        license_name = lic.name
                    tenants = Tenant.query.filter_by(license_id=int(lic_id), is_active=True).all()
                    centers = [x.name for x in tenants if x.name]
            except Exception as e:
                logger.warning(f"get_current_user_profile scope warn: {e}")

            return {
                "success": True,
                "user_id": getattr(user, "id", user_id),
                "full_name": full_name,
                "first_name": getattr(user, "first_name", ""),
                "last_name": getattr(user, "last_name", ""),
                "email": getattr(user, "email", ""),
                "role": role_name,
                "tenant_id": tenant_id,
                "center_name": center_name,
                "centers": centers,
                "license_name": license_name,
                "is_virtual": bool(getattr(user, "is_virtual", False)),
                "hint_respuesta": (
                    f"Eres {full_name}, con rol {role_name}"
                    + (f" en {center_name}" if center_name else "")
                    + (f" ({license_name})" if license_name else "")
                    + "."
                ),
            }
        except Exception as e:
            logger.error(f"get_current_user_profile error: {e}")
            return {"success": False, "error": str(e)}


class GetAssistantCapabilitiesTool(BaseTool):
    """Lista veraz de capacidades según rol (evita sobre-prometer)."""
    name: str = "get_assistant_capabilities"
    description: str = (
        "Describe lo que SÍ puedes hacer según el rol del usuario. Úsala cuando pregunten "
        "'qué puedes hacer', 'ayuda', 'para qué sirves'. Input: {'user_id': 1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        user_id = kwargs.get("user_id")
        try:
            from services.identity_resolver import IdentityResolver
            from services.context_service import ContextService

            role = "unknown"
            actions: list = []
            if user_id:
                user = IdentityResolver.get_user_or_virtual(int(user_id))
                if user and getattr(user, "role", None):
                    role = user.role.name or "unknown"
                    try:
                        scope = ContextService.get_data_scope(user)
                        actions = scope.get("allowed_actions", [])
                    except Exception:
                        pass
            puede_consultar = "select" in [a.lower() for a in actions] if actions else True
            return {
                "success": True,
                "role": role,
                "capacidades": [
                    "Decirte quién eres (tu nombre, rol y centro) usando tu perfil real.",
                    "Buscar un niño por nombre y darte su resumen de asistencia, nutrición, salud y desarrollo." if puede_consultar else "Consultar información (según tu permiso).",
                    "Listar quiénes FALTARON hoy / quiénes ASISTIERON hoy, por centro.",
                    "Dar métricas y tendencias de asistencia y salud del centro.",
                    "Consultar políticas y protocolos MIES en la base de conocimiento.",
                    "Enviar mensajes a representantes por WhatsApp (solo staff autorizado, con destinatario confirmado).",
                    "Registrar asistencia, nutrición y salud (solo staff con permiso de escritura).",
                ],
                "limites": [
                    "Nunca invento nombres: si no encuentro al niño, te lo digo y te pido el nombre exacto.",
                    "Solo veo datos de tu centro, salvo administradores de licencia (global).",
                    "Si una consulta falla 2 veces, te pido el dato que falta en vez de reintentar a ciegas.",
                ],
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
