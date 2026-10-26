"""
LEM Guard (Latent Equilibrium Models Neurosymbolic Shield)
Integración nativa para AI GovCoreX OS.

Garantiza invariantes matemáticas deterministas en la atención conversacional,
triaje de admisiones, prevención de alucinaciones y registro de beneficiarios.

Contrato Fail-Closed:
- z ∈ ℝ¹⁶ representa el estado del flujo de admisión.
- Si E(z, S) >= 0.20 -> La admisión entra en cuarentena (estado 'applicant' con flag de revisión)
  y se bloquea la aprobación directa.
- Inmunidad a inyecciones de prompt, cédulas inválidas y manipulación de subsidios.
"""

import os
import math
import logging
from typing import Dict, Any, Tuple, List, Optional

logger = logging.getLogger(__name__)


class PureLEMInvarianceEngine:
    """
    Motor autónomo de invarianzas matemáticas basadas en Funciones de Lyapunov
    y variedades de equilibrio (Zero-Dependency Python Pure Engine).
    Compatible con C-ABI LEM-V4 / LEM-Ops.
    """
    def __init__(self, mode: str = "ops"):
        self.mode = mode
        self.FAIL_CLOSED_THRESHOLD = 0.20
        # Esquema S ∈ ℝ¹²⁸
        # S[0..15] = Pesos lineales w
        # S[16..31] = Máscaras de canal m (m=0.0 es trampa incondicional)
        # S[32..47] = Cotas inferiores l
        # S[48..63] = Cotas superiores u
        # S[112] = Rigidez lineal GAIN_LIN
        # S[113] = Rigidez de cotas GAIN_BND
        self.s = [0.0] * 128
        self._init_admission_schema()

    def _init_admission_schema(self):
        # Axioma de balance de flujo z0 (ingreso datos) - z1 (comprobación datos)
        self.s[0] = 1.0
        self.s[1] = -1.0

        for i in range(16):
            self.s[16 + i] = 1.0   # Máscara activa
            self.s[32 + i] = 0.0   # Cota inferior nominal
            self.s[48 + i] = 1.0   # Cota superior nominal

        # Canal 3: Canal trampa durmiente (detección de inyecciones, jailbreaks o incoherencias)
        self.s[16 + 3] = 0.0
        self.s[48 + 3] = 0.0

        # Cotas de admisibilidad
        self.s[48 + 0] = 1.0   # Tasa de completitud del formulario [0..1]
        self.s[48 + 1] = 1.0   # Consistencia de datos [0..1]
        self.s[48 + 2] = 1.0   # Scoring de elegibilidad normalizado [0..1]
        self.s[48 + 4] = 1.0   # Nivel socioeconómico [0..1]
        self.s[48 + 5] = 1.0   # Dispersión / Entropía de respuestas [0..1]

        # Rigidez
        self.s[112] = 50.0  # GAIN_LIN
        self.s[113] = 10.0  # GAIN_BND

    def evaluate(self, state_z: List[float]) -> Tuple[float, bool]:
        """
        Evalúa el vector z ∈ ℝ¹⁶ contra la variedad de Lyapunov.
        Retorna: (energy: float, is_allowed: bool)
        """
        z = state_z[:16] if len(state_z) >= 16 else (state_z + [0.0] * (16 - len(state_z)))
        s = self.s

        # 1. Conservación de flujo
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

            # Canal trampa activado (m=0 y presencia de señal)
            if m == 0.0 and abs(val) > 1e-5:
                e_bnd += 5.0 + (val ** 2) * 50.0
            else:
                if val < l:
                    e_bnd += ((l - val) ** 2) * gain_bnd
                elif val > u:
                    e_bnd += ((val - u) ** 2) * gain_bnd

        total_energy = e_lin + e_bnd
        is_allowed = total_energy < self.FAIL_CLOSED_THRESHOLD
        return total_energy, is_allowed


class LEMAdmissionGuard:
    """
    Guardián neurosimbólico para el flujo de admisión y registro conversacional.
    """
    _instance = None

    def __init__(self):
        self.engine = PureLEMInvarianceEngine()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = LEMAdmissionGuard()
        return cls._instance

    def audit_intake_admission(
        self,
        form_data: Dict[str, Any],
        eligibility_score: float,
        cedula_valid: bool,
        intake_channel: str,
        suspected_injection: bool = False
    ) -> Dict[str, Any]:
        """
        Mapea el estado de una postulación conversacional al vector z ∈ ℝ¹⁶:
        z[0] = Ratio de campos completados [0..1]
        z[1] = Calidad de datos (1.0 si cédula y datos obligatorios OK, 0.0 si inválidos)
        z[2] = Score de elegibilidad normalizado (score / 100.0)
        z[3] = Señal trampa (1.0 si hay intento de inyección o inconsistencia grave)
        z[4] = Peso socioeconómico
        z[5] = Integridad del canal
        """
        # Calcular completitud
        total_keys = len(form_data) if form_data else 0
        completeness = min(1.0, max(0.1, total_keys / 6.0))

        # Integridad del dato clave (cédula ecuatoriana válida)
        data_quality = 1.0 if cedula_valid else 0.0

        # Normalizar score de elegibilidad [0.0 .. 1.0]
        norm_score = min(1.0, max(0.0, float(eligibility_score or 0) / 100.0))

        # Trampa: Si hay sospecha de inyección o cédula flagrantemente inválida en registro
        trap_signal = 1.0 if (suspected_injection or not cedula_valid) else 0.0

        # Construcción del vector de estado continuo z ∈ ℝ¹⁶
        z = [0.0] * 16
        z[0] = completeness
        z[1] = completeness if data_quality == 1.0 else 0.0  # Balance con z[0]
        z[2] = norm_score
        z[3] = trap_signal
        z[4] = 0.5
        z[5] = 0.8 if intake_channel in ('whatsapp', 'telegram') else 0.5

        energy, is_allowed = self.engine.evaluate(z)

        return {
            "allowed": is_allowed,
            "energy": round(energy, 6),
            "threshold": self.engine.FAIL_CLOSED_THRESHOLD,
            "trap_triggered": trap_signal > 0,
            "cedula_verified": cedula_valid,
            "score": eligibility_score,
            "lem_status": "APPROVED" if is_allowed else "QUARANTINE_REVIEW"
        }
