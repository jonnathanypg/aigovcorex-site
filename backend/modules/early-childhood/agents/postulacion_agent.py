"""
PostulacionAgent Forwarder
AI GovCoreX OS — Backward-compatible forwarder from canonical module: backend/modules/social
"""
import sys
import os

_BACKEND_MODULES_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _BACKEND_MODULES_PATH not in sys.path:
    sys.path.insert(0, _BACKEND_MODULES_PATH)

from social.agents.postulacion_agent import PostulacionAgent

__all__ = ['PostulacionAgent']
