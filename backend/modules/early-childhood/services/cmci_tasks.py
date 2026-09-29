"""
F5 — Tareas async para reportes pesados (fallback thread + SSE existente).

Sin Redis/Celery: registro en memoria + Thread con app_context.
El frontend consulta GET /api/cmci/tasks/<id> o el stream SSE
GET /api/cmci/tasks/<id>/stream (usa sse_manager.format_sse).
"""
import logging
import threading
import time
import uuid

logger = logging.getLogger(__name__)

PENDING = "pending"
RUNNING = "running"
DONE = "done"
FAILED = "failed"

_tasks = {}
_lock = threading.Lock()


def submit_task(fn, *args, **kwargs):
    """Encola fn(app, *args, **kwargs) en thread; retorna task_id (202)."""
    from flask import current_app
    try:
        app = current_app._get_current_object()
    except Exception:
        app = None
    task_id = uuid.uuid4().hex[:12]
    with _lock:
        _tasks[task_id] = {"task_id": task_id, "status": PENDING,
                           "result": None, "error": None,
                           "created_at": time.time()}
    thread = threading.Thread(target=_run, args=(task_id, app, fn, args, kwargs),
                              daemon=True)
    thread.start()
    return task_id


def _run(task_id, app, fn, args, kwargs):
    with _lock:
        _tasks[task_id]["status"] = RUNNING
    try:
        if app is not None:
            with app.app_context():
                result = fn(app, *args, **kwargs)
        else:
            result = fn(None, *args, **kwargs)
        with _lock:
            _tasks[task_id].update({"status": DONE, "result": result})
    except Exception as exc:  # noqa: BLE001 — la tarea nunca tumba el request
        logger.error(f"task {task_id} fallo: {exc}")
        with _lock:
            _tasks[task_id].update({"status": FAILED, "error": str(exc)})


def get_task(task_id):
    with _lock:
        task = _tasks.get(task_id)
        return dict(task) if task else None


def reset_tasks():
    """Limpia registro (tests)."""
    with _lock:
        _tasks.clear()
