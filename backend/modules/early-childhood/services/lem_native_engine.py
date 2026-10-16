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

class LemNativeContext(ctypes.Structure):
    _fields_ = [('opaque_context', ctypes.c_uint8 * 1152)]


# Alias de retrocompatibilidad
LemOpsNativeContext = LemNativeContext


class LEMNativeEngine:
    """
    Motor nativo C99 de Latent Equilibrium Models (LEM-Ops y LEM-V4).
    Evalúa vectores de estado z en R^16 contra tensores de calibración S128.
    - engine="ops": utiliza liblemops.so (lemops_init / lemops_evaluate / lemops_get_version)
    - engine="v4":  utiliza liblemv4.so  (lemv4_init  / lemv4_evaluate  / lemv4_get_version)
    """
    _lib_ops = None
    _lib_v4 = None
    _lib_ops_path = None
    _lib_v4_path = None
    _ctx_cache: Dict[str, LemNativeContext] = {}

    @classmethod
    def _bind_lib(cls, paths: list, prefix: str) -> Tuple[Optional[ctypes.CDLL], Optional[str]]:
        init_name = f"{prefix}_init"
        eval_name = f"{prefix}_evaluate"
        ver_name = f"{prefix}_get_version"
        for p in paths:
            if p and os.path.exists(p):
                try:
                    lib = ctypes.CDLL(p)
                    if hasattr(lib, init_name) and hasattr(lib, eval_name):
                        init_fn = getattr(lib, init_name)
                        eval_fn = getattr(lib, eval_name)
                        init_fn.argtypes = [ctypes.POINTER(LemNativeContext), ctypes.POINTER(ctypes.c_double)]
                        init_fn.restype = ctypes.c_int
                        eval_fn.argtypes = [
                            ctypes.POINTER(LemNativeContext),
                            ctypes.POINTER(ctypes.c_double),
                            ctypes.POINTER(ctypes.c_double),
                        ]
                        eval_fn.restype = ctypes.c_int
                        if hasattr(lib, ver_name):
                            ver_fn = getattr(lib, ver_name)
                            ver_fn.argtypes = []
                            ver_fn.restype = ctypes.c_char_p
                        logger.info(f"✅ [LEM-NATIVE] Binario C99 ({prefix.upper()}) cargado en memoria: {p}")
                        return lib, p
                except Exception as e:
                    logger.debug(f"[LEM-NATIVE] Fallo intento {prefix} con {p}: {e}")
        return None, None

    @classmethod
    def load_library(cls, engine: str = "ops"):
        if engine == "v4":
            if cls._lib_v4 is not None:
                return cls._lib_v4
            v4_candidates = [
                os.getenv("LEM_V4_BIN_PATH"),
                "/opt/lem-api/liblemv4.so",
                "/opt/lem-api/liblemv4_pure.so",
                "/root/LEMs/SDK_LEM-V4/liblemv4.so",
                "/root/Latent-Equilibrium-Model/LEMs/SDK_LEM-V4/liblemv4.so",
                os.path.expanduser("~/LEMs/SDK_LEM-V4/liblemv4.so"),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent-Equilibrium-Model/LEMs/SDK_LEM-V4/liblemv4.so")),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-V4/liblemv4.dylib")),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-V4/liblemv4.so")),
            ]
            cls._lib_v4, cls._lib_v4_path = cls._bind_lib(v4_candidates, "lemv4")
            if cls._lib_v4 is not None:
                return cls._lib_v4
            # Fallback a LEM-Ops si V4 no está presente
            return cls.load_library("ops")

        if cls._lib_ops is not None:
            return cls._lib_ops

        ops_candidates = [
            os.getenv("LEM_BIN_PATH"),
            "/opt/lem-api/liblemops.so",
            "/opt/lem-api/liblemops_pure.so",
            "/root/LEMs/SDK_LEM-Ops/liblemops.so",
            "/root/Latent-Equilibrium-Model/LEMs/SDK_LEM-Ops/liblemops.so",
            os.path.expanduser("~/LEMs/SDK_LEM-Ops/liblemops.so"),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent-Equilibrium-Model/LEMs/SDK_LEM-Ops/liblemops.so")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-Ops/liblemops.dylib")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Latent_Equilibrium_Models/LEMs/SDK_LEM-Ops/liblemops.so")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../lemnis-sentinel/lib/liblemops.dylib")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../lemnis-sentinel/lib/liblemops.so")),
        ]
        cls._lib_ops, cls._lib_ops_path = cls._bind_lib(ops_candidates, "lemops")
        if cls._lib_ops is None:
            logger.warning("⚠️ [LEM-NATIVE] Binario nativo C99 no encontrado en rutas conocidas. Operando en modo fallback.")
        return cls._lib_ops

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        lib_ops = cls.load_library("ops")
        lib_v4 = cls.load_library("v4")
        ops_ver = None
        v4_ver = None
        if lib_ops and hasattr(lib_ops, "lemops_get_version"):
            try:
                ops_ver = lib_ops.lemops_get_version().decode("utf-8", errors="ignore")
            except Exception:
                pass
        if lib_v4 and hasattr(lib_v4, "lemv4_get_version"):
            try:
                v4_ver = lib_v4.lemv4_get_version().decode("utf-8", errors="ignore")
            except Exception:
                pass
        return {
            "lem_ops_loaded": lib_ops is not None,
            "lem_ops_path": cls._lib_ops_path,
            "lem_ops_version": ops_ver,
            "lem_v4_loaded": cls._lib_v4 is not None,
            "lem_v4_path": cls._lib_v4_path,
            "lem_v4_version": v4_ver,
        }

    @classmethod
    def get_or_create_context(cls, schema_name: str = "gov_action_guard_v1", engine: str = "ops"):
        cache_key = f"{engine}:{schema_name}"
        if cache_key in cls._ctx_cache:
            return cls._ctx_cache[cache_key]

        lib = cls.load_library(engine)
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

        ctx = LemNativeContext()
        init_fn = getattr(lib, "lemv4_init", None) if (engine == "v4" and hasattr(lib, "lemv4_init")) else getattr(lib, "lemops_init", None)
        if not init_fn:
            return None
        res = init_fn(ctypes.byref(ctx), s128)
        if res == 0:
            cls._ctx_cache[cache_key] = ctx
            return ctx
        return None

    @classmethod
    def evaluate_state(cls, z_vector: list[float], schema_name: str = "gov_action_guard_v1", engine: str = "ops") -> Tuple[bool, float]:
        """
        Evalúa el vector de estado z de 16 dimensiones contra el binario C99 en silicio/memoria.
        Retorna: (is_accepted, energy)
        Umbral de equilibrio determinista: E(z, S) < 0.20
        """
        lib = cls.load_library(engine)
        if not lib:
            # Fallback determinista seguro
            max_dev = max(abs(x) for x in z_vector[:8]) if z_vector else 0.0
            return (max_dev <= 1.0, float(max_dev * 0.1))

        ctx = cls.get_or_create_context(schema_name, engine=engine)
        if not ctx:
            return (True, 0.0)

        # Rellenar o truncar a exactamente 16 doubles
        z16 = (ctypes.c_double * 16)()
        for i in range(16):
            val = z_vector[i] if i < len(z_vector) else 0.0
            z16[i] = float(val)

        energy = ctypes.c_double(0.0)
        eval_fn = getattr(lib, "lemv4_evaluate", None) if (engine == "v4" and hasattr(lib, "lemv4_evaluate")) else getattr(lib, "lemops_evaluate", None)
        if not eval_fn:
            return (True, 0.0)
        eval_res = eval_fn(ctypes.byref(ctx), z16, ctypes.byref(energy))

        # Estado aceptado si eval_res == 0 y energía < 0.20 (invariante libre de perturbación)
        is_accepted = (eval_res == 0 and energy.value < 0.20)
        return is_accepted, float(energy.value)
