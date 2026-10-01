"""
PolicyFilter + Pseudonymizer — Minimización de datos para LLM ciego
Compatible con plan maestro §4.3 y PLAN_INTEGRACION_BANCO_DIGITAL.md §4

Flujo:
  Entrada → Auth + HMAC → IdentityResolver (vault, HMAC lookup) → normaliza a {uid_enc, scope}
    → PolicyFilter (¿qué campos necesita ESTE intent? minimiza) → Pseudonymizer
    → LLM (solo uid_enc + contexto mínimo)
"""
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass
from enum import Enum


class Intent(str, Enum):
    """Intents conocidos del sistema — extensible por módulo."""
    ASISTENCIA = "asistencia"
    CMCI = "cmci"
    SOCIOECONOMICA = "ficha_socioeconomica"
    VULNERABILIDAD = "ficha_vulnerabilidad"
    ADMISION = "admision"
    SALUD = "salud"
    NUTRICION = "nutricion"
    REPORTES = "reportes"
    CHAT_PUBLICO = "chat_publico"
    VOZ = "voz"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"


class Role(str, Enum):
    """Roles del sistema — coinciden con IdentityResolver."""
    SUPER_ADMIN = "super_admin"
    LICENSE_ADMIN = "license_admin"
    CENTER_COORDINATOR = "center_coordinator"
    EDUCADORA = "educadora"
    EDUCATOR = "educator"
    DOCTOR = "doctor"
    NUTRITIONIST = "nutritionist"
    SOCIAL_WORKER = "social_worker"
    PSYCHOLOGIST = "psychologist"
    ADMINISTRATIVE = "administrative"
    SUPERVISOR = "supervisor"
    PADRE = "padre"
    PARENT = "parent"
    PUBLIC_BOT = "public_bot"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class FieldPolicy:
    """Define qué campos se exponen para un (intent, role)."""
    allowed_fields: Set[str]
    require_consent: bool = False
    pii_fields: Set[str] = frozenset()


# === Políticas por defecto (bancario: mínimo necesario) ===
# Solo uid_enc + tenant_scope + campos estrictamente necesarios ya seudonimizados
DEFAULT_POLICIES: Dict[tuple, FieldPolicy] = {
    # Chat público / bot: SOLO uid_enc + intent + tenant_scope
    (Intent.CHAT_PUBLICO, Role.PUBLIC_BOT): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent"},
        pii_fields=set()
    ),
    (Intent.CHAT_PUBLICO, Role.UNKNOWN): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent"},
        pii_fields=set()
    ),
    
    # WhatsApp/Telegram entrada: uid_enc + intent + mensaje (texto ya limpio)
    (Intent.WHATSAPP, Role.PADRE): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent", "message_text", "channel"},
        pii_fields=set()
    ),
    (Intent.TELEGRAM, Role.PADRE): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent", "message_text", "channel"},
        pii_fields=set()
    ),
    
    # Voz: uid_enc + intent + transcripción (audio NUNCA sale)
    (Intent.VOZ, Role.PADRE): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent", "transcript", "channel"},
        pii_fields=set()
    ),
    
    # CMCI/Admisión: uid_enc + datos socioeconómicos YA AGREGADOS (scores, no PII)
    (Intent.CMCI, Role.EDUCADORA): FieldPolicy(
        allowed_fields={
            "uid_enc", "tenant_scope", "intent",
            "cmci_score", "vulnerability_score", "priority_level",
            "age_bucket", "family_size_bucket", "income_bucket"
        },
        pii_fields=set()
    ),
    (Intent.SOCIOECONOMICA, Role.SOCIAL_WORKER): FieldPolicy(
        allowed_fields={
            "uid_enc", "tenant_scope", "intent",
            "cmci_score", "vulnerability_score", "priority_level",
            "age_bucket", "family_size_bucket", "income_bucket",
            "housing_type", "services_access"
        },
        pii_fields=set()
    ),
    (Intent.VULNERABILIDAD, Role.DOCTOR): FieldPolicy(
        allowed_fields={
            "uid_enc", "tenant_scope", "intent",
            "vulnerability_score", "priority_level",
            "health_flags", "nutrition_flags", "age_bucket"
        },
        pii_fields=set()
    ),
    
    # Reportes/Analytics: SOLO agregados (k-anonimato ≥5)
    (Intent.REPORTES, Role.LICENSE_ADMIN): FieldPolicy(
        allowed_fields={
            "uid_enc", "tenant_scope", "intent",
            "daily_counts", "intent_distribution", "latency_p95"
        },
        pii_fields=set()
    ),
    
    # Fallback restrictivo: solo uid_enc
    (Intent.ASISTENCIA, Role.PADRE): FieldPolicy(
        allowed_fields={"uid_enc", "tenant_scope", "intent", "status"},
        pii_fields=set()
    ),
}


class PolicyFilter:
    """
    Filtra qué campos viajan al LLM según (intent, role).
    Principio: DENY BY DEFAULT — solo lo explícitamente permitido.
    """
    
    def __init__(self, policies: Optional[Dict[tuple, FieldPolicy]] = None):
        self.policies = policies or DEFAULT_POLICIES
    
    def get_allowed_fields(self, intent: str, role: str) -> Set[str]:
        """Retorna campos permitidos para (intent, role)."""
        key = (Intent(intent), Role(role))
        policy = self.policies.get(key)
        if policy:
            return policy.allowed_fields
        
        # Fallback: buscar por intent solo (cualquier role)
        for (i, r), p in self.policies.items():
            if i == Intent(intent):
                return p.allowed_fields
        
        # Fallback final: solo uid_enc + tenant_scope + intent
        return {"uid_enc", "tenant_scope", "intent"}
    
    def filter_context(self, context: Dict[str, Any], intent: str, role: str) -> Dict[str, Any]:
        """Filtra diccionario de contexto a solo campos permitidos."""
        allowed = self.get_allowed_fields(intent, role)
        return {k: v for k, v in context.items() if k in allowed}
    
    def register_policy(self, intent: str, role: str, policy: FieldPolicy):
        """Registra política custom (para módulos sociales, geo, etc.)."""
        self.policies[(Intent(intent), Role(role))] = policy


class Pseudonymizer:
    """
    Transformación final antes de enviar al LLM:
    - Reemplaza PII real por tokens/seudónimos
    - Mantiene uid_enc como única identidad
    - Redondea/agrupa numéricos (age_bucket, income_bucket, etc.)
    """
    
    # Mapeo de campos PII → transformación
    PII_TRANSFORMS = {
        "cedula": lambda v: f"***-{v[-4:]}" if v and len(v) >= 4 else "***",
        "nombre": lambda v: v.split()[0][0] + "***" if v else "***",
        "apellido": lambda v: v[0] + "***" if v else "***",
        "direccion": lambda v: "***" if v else None,
        "telefono": lambda v: f"***-{v[-4:]}" if v and len(v) >= 4 else "***",
        "email": lambda v: f"{v.split('@')[0][:2]}***@{v.split('@')[1]}" if v and "@" in v else "***",
        "fecha_nac": lambda v: None,  # NUNCA — solo age_display en borde
        "edad": lambda v: None,        # NUNCA — solo age_display en borde
        "salud": lambda v: "***" if v else None,
        "alergias": lambda v: "***" if v else None,
        "tipo_sangre": lambda v: "***" if v else None,
    }
    
    # Agrupaciones (bucketing) para campos numéricos sensibles
    BUCKET_RULES = {
        "age_bucket": lambda age: f"{(age // 5) * 5}-{(age // 5) * 5 + 4}" if age else "unknown",
        "family_size_bucket": lambda n: "1" if n == 1 else ("2-3" if n <= 3 else "4+"),
        "income_bucket": lambda inc: "low" if inc < 400 else ("mid" if inc < 800 else "high"),
    }
    
    def __init__(self, policy_filter: Optional[PolicyFilter] = None):
        self.policy_filter = policy_filter or PolicyFilter()
    
    def pseudonymize(
        self,
        raw_data: Dict[str, Any],
        intent: str,
        role: str,
        uid_enc: str,
        tenant_scope: str
    ) -> Dict[str, Any]:
        """
        Aplica PolicyFilter + transformaciones PII → diccionario listo para LLM.
        
        Args:
            raw_data: Datos en claro (Child.to_dict, etc.)
            intent: Intent del request
            role: Role del solicitante
            uid_enc: Identidad cifrada (subject_ref)
            tenant_scope: tenant_id o license_id como string
        
        Returns:
            Diccionario mínimo con solo uid_enc + campos permitidos seudonimizados.
        """
        # 1. Base obligatoria
        result = {
            "uid_enc": uid_enc,
            "tenant_scope": tenant_scope,
            "intent": intent,
        }
        
        # 2. Campos permitidos por política
        allowed = self.policy_filter.get_allowed_fields(intent, role)
        
        for field in allowed:
            if field in ("uid_enc", "tenant_scope", "intent"):
                continue
            
            if field in raw_data:
                value = raw_data[field]
                
                # Aplicar transformación si es PII conocido
                if field in self.PII_TRANSFORMS:
                    transformed = self.PII_TRANSFORMS[field](value)
                    if transformed is not None:
                        result[field] = transformed
                # Aplicar bucketing si aplica
                elif field in self.BUCKET_RULES:
                    result[field] = self.BUCKET_RULES[field](value)
                else:
                    # Campo no-PII permitido (scores, flags, buckets ya calculados)
                    result[field] = value
        
        return result
    
    def pseudonymize_batch(
        self,
        records: List[Dict[str, Any]],
        intent: str,
        role: str,
        uid_enc_map: Dict[int, str],  # child_id → uid_enc
        tenant_scope: str
    ) -> List[Dict[str, Any]]:
        """Batch para reportes/analytics (k-anonimato)."""
        results = []
        for rec in records:
            child_id = rec.get("id") or rec.get("child_id")
            uid = uid_enc_map.get(child_id)
            if not uid:
                continue
            results.append(self.pseudonymize(rec, intent, role, uid, tenant_scope))
        return results


# === Instancias globales (singleton pattern para Flask) ===
policy_filter = PolicyFilter()
pseudonymizer = Pseudonymizer(policy_filter)


def get_policy_filter() -> PolicyFilter:
    return policy_filter


def get_pseudonymizer() -> Pseudonymizer:
    return pseudonymizer