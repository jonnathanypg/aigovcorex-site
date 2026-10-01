"""
Guard compartido — ninguna tool debe lanzar excepciones crudas al LLM.
Si algo falla (sin app-context, DB caída, bug), devuelve dict de error.
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
