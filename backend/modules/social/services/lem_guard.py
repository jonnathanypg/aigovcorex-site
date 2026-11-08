"""
LEM Architecture Guard (Latent Equilibrium Models Dual Engine: LEM-Ops & LEM-V4)
Integración neurosimbólica unificada para AI GovCoreX OS.

Diferenciación de Capas:
- LEM-Ops (Capa L7 / Operaciones y Agentes):
  Vigila flujos conversacionales, triaje, integridad de cédula, incoherencias de formulario,
  detección de Prompt Injections (canal trampa m3=0) y reglas RBAC (z4 > z2).
  
- LEM-V4 (Capa L1-L4 / Silicio, Proceso e Infraestructura):
  Vigila los recursos físicos de ejecución (latencia de reloj, tamaño de buffers de entrada de voz/archivos,
  integridad de memoria y prevención de sobrecarga en el host).
"""

import os
import math
import logging
from typing import Dict, Any, Tuple, List, Optional

logger = logging.getLogger(__name__)


class PureLEMInvarianceEngine:
    """
    Motor autónomo de invarianzas matemáticas basadas en Funciones de Lyapunov
    y variedades de equilibrio continuo.
    Soporta explícitamente modo 'ops' (L7 - Aplicación/Agente) y modo 'v4' (L1-L4 - Silicio/Infraestructura).
    """
    def __init__(self, mode: str = "ops"):
        self.mode = mode
        self.FAIL_CLOSED_THRESHOLD = 0.20
        self.s = [0.0] * 128
        if mode == "ops":
            self._init_ops_schema()
        else:
            self._init_v4_schema()

    def _init_ops_schema(self):
        """Inicializa tensores para LEM-Ops: Operaciones, Agentes, RBAC y Admisiones."""
        # Axioma de balance de flujo z0 (ingreso datos) - z1 (validación de datos)
        self.s[0] = 1.0
        self.s[1] = -1.0

        for i in range(16):
            self.s[16 + i] = 1.0   # Máscara activa
            self.s[32 + i] = 0.0   # Cota inferior nominal
            self.s[48 + i] = 1.0   # Cota superior nominal

        # Canal 3: Canal trampa durmiente incondicional (Inyecciones, Jailbreaks, Cédula falsa)
        self.s[16 + 3] = 0.0
        self.s[48 + 3] = 0.0

        # Rigidez
        self.s[112] = 50.0  # GAIN_LIN
        self.s[113] = 10.0  # GAIN_BND

    def _init_v4_schema(self):
        """Inicializa tensores para LEM-V4: I/O de red, buffers de voz/archivos, estabilidad del servidor."""
        self.s[0] = 1.0
        self.s[1] = -1.0

        for i in range(16):
            self.s[16 + i] = 1.0
            self.s[32 + i] = 0.0
            self.s[48 + i] = 1.0

        # Canal 3: Trampa de saturación o memory leak / hook anómalo
        self.s[16 + 3] = 0.0
        self.s[48 + 3] = 0.0

        self.s[112] = 100.0  # Rigidez lineal de hardware
        self.s[113] = 20.0   # Rigidez de límites físicos

    def evaluate(self, state_z: List[float]) -> Tuple[float, bool]:
        """
        Evalúa el vector z ∈ ℝ¹⁶ contra la variedad de Lyapunov.
        Retorna: (energy: float, is_allowed: bool)
        """
        z = state_z[:16] if len(state_z) >= 16 else (state_z + [0.0] * (16 - len(state_z)))
        s = self.s

        # 1. Conservación de flujo lineal: (sum(w_i * z_i))^2 * GAIN_LIN
        bal = sum(s[i] * z[i] for i in range(16))
        gain_lin = s[112] if s[112] > 0 else 50.0
        e_lin = (bal ** 2) * gain_lin

        # 2. Cotas y canales trampa
        gain_bnd = s[113] if s[113] > 0 else 10.0
        e_bnd = 0.0
        for i in range(16):
            m = s[16 + i]
            l = s[32 + i]
            u = s[48 + i]
            val = z[i]

            # Canal trampa durmiente activado (m=0 y presencia de señal)
            if m == 0.0 and abs(val) > 1e-5:
                e_bnd += 5.0 + (val ** 2) * 50.0
            else:
                if val < l:
                    e_bnd += ((l - val) ** 2) * gain_bnd
                elif val > u:
                    e_bnd += ((val - u) ** 2) * gain_bnd

        # 3. Término RBAC en LEM-Ops: Si el impacto de la acción (z4) excede el privilegio del actor (z2)
        e_rbac = 0.0
        if self.mode == "ops" and len(z) > 4:
            privilege = z[2]
            action_impact = z[4]
            if action_impact > privilege and privilege < 0.6:
                e_rbac = ((action_impact - privilege) ** 2) * 15.0

        total_energy = e_lin + e_bnd + e_rbac
        is_allowed = total_energy < self.FAIL_CLOSED_THRESHOLD
        return total_energy, is_allowed


class LEMUnifiedGuard:
    """
    Fachada unificada para la orquestación conjunta de LEM-Ops y LEM-V4.
    """
    _instance = None

    def __init__(self):
        self.ops_engine = PureLEMInvarianceEngine(mode="ops")
        self.v4_engine = PureLEMInvarianceEngine(mode="v4")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = LEMUnifiedGuard()
        return cls._instance

    def audit_intake_admission(
        self,
        form_data: Dict[str, Any],
        eligibility_score: float,
        cedula_valid: bool,
        intake_channel: str,
        caller_privilege: float = 0.3,
        suspected_injection: bool = False
    ) -> Dict[str, Any]:
        """
        Ejecuta la auditoría LEM-Ops para admisiones ciudadanas y flujos conversacionales.
        z[0] = Ratio de completitud del formulario [0..1]
        z[1] = Consistencia y veracidad de datos (1.0 si cédula y datos válidos, 0.0 si falla)
        z[2] = Privilegio del solicitante (0.3 ciudadano público, 0.7 operador, 0.9 admin)
        z[3] = Trampa durmiente (1.0 si hay inyección de prompt o manipulación de cédula)
        z[4] = Impacto del beneficio asignado (según score de elegibilidad)
        z[5] = Integridad del canal
        """
        total_keys = len(form_data) if form_data else 0
        completeness = min(1.0, max(0.1, total_keys / 6.0))
        data_quality = 1.0 if cedula_valid else 0.0
        norm_score = min(1.0, max(0.0, float(eligibility_score or 0) / 100.0))

        # El impacto de otorgar cupo directo (si score >= 70, impacto moderado-alto 0.65)
        benefit_impact = 0.65 if norm_score >= 0.70 else 0.20

        # Canal trampa ceba si no hay cédula válida o hay sospecha de inyección
        trap_signal = 1.0 if (suspected_injection or not cedula_valid) else 0.0

        # Construcción vector z para LEM-Ops
        z_ops = [0.0] * 16
        z_ops[0] = completeness
        z_ops[1] = completeness if data_quality == 1.0 else 0.0  # Balance de flujo
        z_ops[2] = caller_privilege
        z_ops[3] = trap_signal
        z_ops[4] = benefit_impact
        z_ops[5] = 0.8 if intake_channel in ('whatsapp', 'telegram') else 0.5

        energy_ops, allowed_ops = self.ops_engine.evaluate(z_ops)

        return {
            "allowed": allowed_ops,
            "engine": "LEM-Ops",
            "energy": round(energy_ops, 6),
            "threshold": self.ops_engine.FAIL_CLOSED_THRESHOLD,
            "trap_triggered": trap_signal > 0,
            "cedula_verified": cedula_valid,
            "score": eligibility_score,
            "lem_status": "APPROVED" if allowed_ops else "QUARANTINE_REVIEW"
        }

    def audit_system_io(
        self,
        payload_bytes: int,
        processing_latency_ms: float,
        is_voice_audio: bool = False
    ) -> Dict[str, Any]:
        """
        Ejecuta la auditoría LEM-V4 para vigilar la capa física y recursos del servidor.
        """
        # Normalizar tamaño de payload (max 15MB audio)
        norm_bytes = min(1.0, payload_bytes / (15.0 * 1024 * 1024))
        # Normalizar latencia (umbral alerta 10 segundos)
        norm_latency = min(1.0, processing_latency_ms / 10000.0)

        z_v4 = [0.0] * 16
        z_v4[0] = norm_bytes
        z_v4[1] = norm_bytes  # Balance nominal de I/O
        z_v4[2] = norm_latency
        z_v4[3] = 1.0 if norm_bytes > 0.95 or norm_latency > 0.95 else 0.0  # Trampa de saturación

        energy_v4, allowed_v4 = self.v4_engine.evaluate(z_v4)

        return {
            "allowed": allowed_v4,
            "engine": "LEM-V4",
            "energy": round(energy_v4, 6),
            "threshold": self.v4_engine.FAIL_CLOSED_THRESHOLD,
            "status": "HEALTHY" if allowed_v4 else "RESOURCE_THROTTLED"
        }


# Alias de compatibilidad
LEMAdmissionGuard = LEMUnifiedGuard
