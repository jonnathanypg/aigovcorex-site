"""
F5 — Rate-limit para auth (5 intentos/min/IP, sliding window en memoria stdlib).

Sin dependencias externas (no flask-limiter): suficiente para 1 instancia
gunicorn gthread; con múltiples workers cada worker aplica su ventana
(acceptable para login; prod puede poner nginx limit_req como respaldo).
"""
import time
import threading
from functools import wraps
from flask import request, jsonify

AUTH_RATE_LIMIT_PER_MINUTE = 5
RATE_LIMIT_AUTH_WINDOW_SECONDS = 60
RATE_LIMIT_AUTH = "5/minute"  # etiqueta config (usada en tests + docs)

_lock = threading.Lock()
_hits = {}  # ip -> [timestamps]


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


def is_rate_limited(ip, now=None):
    """True si ip ya agotó la ventana. Solo lectura (no registra)."""
    now = now if now is not None else time.time()
    with _lock:
        stamps = [t for t in _hits.get(ip, [])
                  if now - t < RATE_LIMIT_AUTH_WINDOW_SECONDS]
        return len(stamps) >= AUTH_RATE_LIMIT_PER_MINUTE


def _register_hit(ip, now=None):
    now = now if now is not None else time.time()
    with _lock:
        stamps = [t for t in _hits.get(ip, [])
                  if now - t < RATE_LIMIT_AUTH_WINDOW_SECONDS]
        stamps.append(now)
        _hits[ip] = stamps


def reset_rate_limit(ip=None):
    """Limpia contadores (tests + admin)."""
    with _lock:
        if ip:
            _hits.pop(ip, None)
        else:
            _hits.clear()


def rate_limit_auth(f):
    """Decorador para /api/auth/login: 429 si >5 intentos/min/IP."""
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = _client_ip()
        if is_rate_limited(ip):
            return jsonify({
                "error": "Demasiados intentos. Reintente en 1 minuto.",
                "rate_limit": RATE_LIMIT_AUTH,
            }), 429
        _register_hit(ip)
        return f(*args, **kwargs)
    return decorated
