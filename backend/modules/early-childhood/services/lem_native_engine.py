"""
LEM Native Engine — C99 In-Memory Deterministic Arbiter via lib (.dylib / .so).
Cero llamadas HTTP/API para inferencia de equilibrio latente.
Ejecuta en < 400 microsegundos por ciclo con memoria compartida/C99 FFI.
Compatible con macOS (.dylib local) y Linux (.so en VPS de producción).
"""
import os
import ctypes
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

class LemOpsNativeContext(ctypes.Structure):
    _fields_ = [('opaque_context', ctypes.c_uint8 * 1152)]


class LEMNativeEngine:
    """
    Motor nativo C99 de Latent Equilibrium Models (LEM-Ops / LEM-V4).
    Evalúa vectores de estado z en R^16 contra tensores de calibración S128.
    """
    _lib = None
    _ctx_cache = {}

    @classmethod
    def load_library(cls):
        if cls._lib is not None:
            return cls._lib

        # Rutas de descubrimiento ordenadas para macOS (.dylib) y Linux VPS (.so)
        candidates = [
            os.getenv("LEM_BIN_PATH"),
            "/opt/lem-api/liblemops.so",
            "/opt/lem-api/liblemops_pure.so",
            "/root/LEMs/SDK_LEM-Ops/liblemops.so",
            os.path.expanduser("~/LEMs/SDK_LEM-Ops/liblemops.so"),
            # Repositorio Latent_Equilibrium_Models en el workspace
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-Ops/liblemops.dylib")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-Ops/liblemops.so")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../lemnis-sentinel/lib/liblemops.dylib")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../lemnis-sentinel/lib/liblemops.so")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-V4/liblemv4.dylib")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-V4/liblemv4.so")),
        ]

        for p in candidates:
            if p and os.path.exists(p):
                try:
                    lib = ctypes.CDLL(p)
                    # Comprobar símbolos C99 exportados
                    if hasattr(lib, 'lemops_init') and hasattr(lib, 'lemops_evaluate'):
                        lib.lemops_init.argtypes = [ctypes.POINTER(LemOpsNativeContext), ctypes.POINTER(ctypes.c_double)]
                        lib.lemops_init.restype = ctypes.c_int
                        lib.lemops_evaluate.argtypes = [
                            ctypes.POINTER(LemOpsNativeContext),
                            ctypes.POINTER(ctypes.c_double),
                            ctypes.POINTER(ctypes.c_double)
                        ]
                        lib.lemops_evaluate.restype = ctypes.c_int
                        cls._lib = lib
                        logger.info(f"✅ [LEM-NATIVE] Binario C99 cargado exitosamente en memoria: {p}")
                        return cls._lib
                except Exception as e:
                    logger.debug(f"[LEM-NATIVE] Fallo intento con {p}: {e}")

        logger.warning("⚠️ [LEM-NATIVE] Binario nativo C99 no encontrado en rutas conocidas. Operando en modo fallback.")
        return None

    @classmethod
    def get_or_create_context(cls, schema_name: str = "gov_action_guard_v1"):
        if schema_name in cls._ctx_cache:
            return cls._ctx_cache[schema_name]

        lib = cls.load_library()
        if not lib:
            return None

        # Tensor de calibración S128
        s128 = (ctypes.c_double * 128)()
        for i in range(128):
            s128[i] = 0.0

        # Calibración para invariantes de gobernanza y acciones de agentes:
        # Canales z0..z7 activos (mask = 1.0)
        for i in range(16, 24):
            s128[i] = 1.0
        # Límites superiores u = 1.0
        for i in range(48, 56):
            s128[i] = 1.0

        # Ganancia lineal y de borde
        s128[112] = 100.0  # GAIN_LIN
        s128[113] = 10.0   # GAIN_BND

        ctx = LemOpsNativeContext()
        res = lib.lemops_init(ctypes.byref(ctx), s128)
        if res == 0:
            cls._ctx_cache[schema_name] = ctx
            return ctx
        return None

    @classmethod
    def evaluate_state(cls, z_vector: list[float], schema_name: str = "gov_action_guard_v1") -> Tuple[bool, float]:
        """
        Evalúa el vector de estado z de 16 dimensiones contra el binario C99 en silicio/memoria.
        Retorna: (is_accepted, energy)
        Umbral de equilibrio determinista: E(z, S) < 0.20
        """
        lib = cls.load_library()
        if not lib:
            # Fallback determinista seguro
            max_dev = max(abs(x) for x in z_vector[:8]) if z_vector else 0.0
            return (max_dev <= 1.0, float(max_dev * 0.1))

        ctx = cls.get_or_create_context(schema_name)
        if not ctx:
            return (True, 0.0)

        # Rellenar o truncar a exactamente 16 doubles
        z16 = (ctypes.c_double * 16)()
        for i in range(16):
            val = z_vector[i] if i < len(z_vector) else 0.0
            z16[i] = float(val)

        energy = ctypes.c_double(0.0)
        eval_res = lib.lemops_evaluate(ctypes.byref(ctx), z16, ctypes.byref(energy))
        
        # Estado aceptado si eval_res == 0 y energía < 0.20 (invariante libre de perturbación)
        is_accepted = (eval_res == 0 and energy.value < 0.20)
        return is_accepted, float(energy.value)
