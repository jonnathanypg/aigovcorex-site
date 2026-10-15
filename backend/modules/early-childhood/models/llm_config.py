"""
BYOT LLM por licencia + ledger creditos LEM-V4.
Una config ACTIVA por licencia (is_active=True). Historial conserva inactivas.
"""
from models import db
from datetime import datetime

# Proveedor -> {label, base_url default (None=nativo), modelos sugeridos}
SUPPORTED_PROVIDERS = {
    "openai": {
        "label": "OpenAI",
        "base_url": None,
        "models": ["gpt-4o-mini", "gpt-4o", "gpt-5-nano"],
    },
    "anthropic": {
        "label": "Anthropic (Muse)",
        "base_url": None,
        "models": ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-5"],
    },
    "google": {
        "label": "Google (Gemini)",
        "base_url": None,
        "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    },
    "grok": {
        "label": "Grok (xAI)",
        "base_url": "https://api.x.ai/v1",
        "models": ["grok-2-latest", "grok-beta"],
    },
    "nvidia": {
        "label": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "models": ["meta/llama-3.1-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"],
    },
    "openrouter": {
        "label": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini", "google/gemini-flash-1.5"],
    },
    "groq": {
        "label": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "models": ["llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
    },
}


class LLMProviderConfig(db.Model):
    __tablename__ = "llm_provider_configs"

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey("licenses.id"), nullable=False, index=True)
    provider = db.Column(db.String(30), nullable=False, default="openai")
    model = db.Column(db.String(150), nullable=True)
    api_key_enc = db.Column(db.Text, nullable=True)
    base_url = db.Column(db.String(500), nullable=True)
    extra_json = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    last_validated_at = db.Column(db.DateTime, nullable=True)
    last_error = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_key=False):
        from utils.llm_vault import masked_key
        return {
            "id": self.id,
            "license_id": self.license_id,
            "provider": self.provider,
            "model": self.model,
            "base_url": self.base_url,
            "is_active": self.is_active,
            "has_key": bool(self.api_key_enc),
            "key_masked": masked_key(self.api_key_enc) if self.api_key_enc else None,
            "last_validated_at": self.last_validated_at.isoformat() if self.last_validated_at else None,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LEMCreditLedger(db.Model):
    """Auditoria append-only de creditos LEM-V4 por licencia.
    amount>0 compra/bono, amount<0 consumo validacion.
    """
    __tablename__ = "lem_credit_ledger"

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey("licenses.id"), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False, default=0)
    reason = db.Column(db.String(120), nullable=False, default="validate")
    ref = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "license_id": self.license_id,
            "amount": self.amount,
            "reason": self.reason,
            "ref": self.ref,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
