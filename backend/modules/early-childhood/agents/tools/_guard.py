"""
Guard compartido — ninguna tool debe lanzar excepciones crudas al LLM.
Integra LEM-Ops Native Guard para evaluación matemática determinista de acciones.
"""
import functools
import logging

logger = logging.getLogger(__name__)


def unwrap_tool_kwargs(kwargs: dict) -> dict:
    """Desempaqueta argumentos anidados en 'kwargs', 'params', 'tool_input' o 'args'."""
    if not isinstance(kwargs, dict):
        return {}
    import json
    import ast
    out = dict(kwargs)
    for nested_key in ("kwargs", "params", "tool_input", "input", "data"):
        nested_val = out.get(nested_key)
        if isinstance(nested_val, dict):
            for k, v in nested_val.items():
                if k not in out or out[k] is None:
                    out[k] = v
            out.pop(nested_key, None)
        elif isinstance(nested_val, str) and nested_val.strip().startswith("{"):
            try:
                parsed = json.loads(nested_val)
            except Exception:
                try:
                    parsed = ast.literal_eval(nested_val)
                except Exception:
                    parsed = None
            if isinstance(parsed, dict):
                for k, v in parsed.items():
                    if k not in out or out[k] is None:
                        out[k] = v
                out.pop(nested_key, None)

    pos_args = out.get("args")
    if isinstance(pos_args, (list, tuple)):
        if len(pos_args) == 1:
            first = pos_args[0]
            if isinstance(first, dict):
                for k, v in first.items():
                    if k not in out or out[k] is None:
                        out[k] = v
            elif isinstance(first, str):
                s = first.strip()
                if s.startswith("{"):
                    try:
                        parsed = json.loads(s)
                    except Exception:
                        try:
                            parsed = ast.literal_eval(s)
                        except Exception:
                            parsed = None
                    if isinstance(parsed, dict):
                        for k, v in parsed.items():
                            if k not in out or out[k] is None:
                                out[k] = v
                else:
                    for k in ("name", "child_name", "staff_name", "query", "question"):
                        if k not in out or out[k] is None:
                            out[k] = s
        elif len(pos_args) >= 2:
            # Ejemplo: ['Jonnathan Peña', 'Hola Jonnathan...']
            first, second = pos_args[0], pos_args[1]
            if isinstance(first, str) and isinstance(second, str):
                for k in ("staff_name", "child_name", "name", "phone"):
                    if k not in out or out[k] is None:
                        out[k] = first
                for k in ("message", "message_template", "content", "text"):
                    if k not in out or out[k] is None:
                        out[k] = second
        out.pop("args", None)
    elif pos_args is None and "args" in out:
        out.pop("args", None)
    return out



def graceful_tool(fn):
    """Decorador para BaseTool._run: ejecuta guarda C99 LEM-Ops y convierte excepciones en {'success': False}."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        kwargs = unwrap_tool_kwargs(kwargs)
        tool_name = getattr(args[0], "name", "tool") if args else "tool"
        try:
            from services.lem_native_engine import LEMNativeEngine
            tid = kwargs.get("tenant_id")
            uid = kwargs.get("user_id")
            lid = kwargs.get("license_id")
            is_write = 1.0 if any(w in tool_name for w in ["record", "create", "delete", "update", "assign", "manage", "send", "log"]) else 0.0
            has_scope = 1.0 if (tid or lid) else 0.0
            has_user = 1.0 if uid else 0.0

            z = [
                is_write, has_scope, has_user,
                0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
            ]
            accepted, energy = LEMNativeEngine.evaluate_state(z, schema_name="gov_action_guard_v1", engine="ops")
            if not accepted:
                logger.warning(f"⛔ [LEM-Ops] Tool {tool_name} rechazada por equilibrio energético ({energy:.4f})")
                return {
                    "success": False,
                    "error": f"Acción '{tool_name}' bloqueada por invariante determinista LEM-Ops (energía={energy:.2f})."
                }
        except Exception as e:
            logger.debug(f"[LEM-Ops Guard] check bypassed on {tool_name}: {e}")

        try:
            return fn(*args, **kwargs)
        except Exception as e:
            logger.warning(f"[{tool_name}] error controlado: {e}")
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

