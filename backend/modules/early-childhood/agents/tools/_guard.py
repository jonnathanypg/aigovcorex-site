"""
Guard compartido — ninguna tool debe lanzar excepciones crudas al LLM.
Integra LEM-Ops Native Guard para evaluación matemática determinista de acciones.
"""
import functools
import logging

logger = logging.getLogger(__name__)


def graceful_tool(fn):
    """Decorador para BaseTool._run: convierte excepciones en {'success': False}."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            tool = getattr(args[0], "name", "tool") if args else "tool"
            logger.warning(f"[{tool}] error controlado: {e}")
            try:
                from models import db as _db
                _db.session.rollback()
            except Exception:
                pass
            return {"success": False, "error": f"{type(e).__name__}: {str(e)[:300]}"}
    return wrapper


def lem_ops_guard(action_name: str):
    """
    Decorador determinista de invariantes LEM-Ops sobre herramientas.
    Evalúa si la acción y parámetros cumplen las restricciones matemáticas
    mediante el motor C99 en silicio/memoria antes de alterar la base de datos.
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                from services.lem_native_engine import LEMNativeEngine
                # Construcción del vector de estado de la acción z in R^16
                # z0: acción de escritura (1.0) vs lectura (0.0), z1: presencia de tenant_id, z2: presencia de user_id
                tid = kwargs.get("tenant_id")
                uid = kwargs.get("user_id")
                z = [
                    1.0 if any(w in action_name for w in ["record", "create", "delete", "update", "assign"]) else 0.0,
                    1.0 if tid else 0.0,
                    1.0 if uid else 0.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
                ]
                accepted, energy = LEMNativeEngine.evaluate_state(z, schema_name="gov_action_guard_v1")
                if not accepted:
                    logger.warning(f"⛔ [LEM-Ops] Acción {action_name} rechazada por equilibrio energético ({energy:.4f})")
                    return {
                        "success": False,
                        "error": f"Acción '{action_name}' bloqueada por invariante determinista de gobernanza (energía={energy:.2f})."
                    }
            except Exception as e:
                logger.debug(f"[LEM-Ops Guard] check bypassed: {e}")

            return fn(*args, **kwargs)
        return wrapper
    return decorator

