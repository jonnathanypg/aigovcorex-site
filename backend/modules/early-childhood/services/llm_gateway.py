"""Gateway LLM unificado BYOT por licencia.
Prioridad: config activa de la licencia -> fallback global .env (compat).
Soporta: openai, anthropic, google, grok(xai), nvidia, openrouter, groq.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def get_active_config(license_id: int | None):
    if not license_id:
        return None
    try:
        from models.llm_config import LLMProviderConfig
        return (
            LLMProviderConfig.query.filter_by(license_id=license_id, is_active=True)
            .order_by(LLMProviderConfig.updated_at.desc())
            .first()
        )
    except Exception as e:
        logger.warning(f"Gateway: no se pudo leer config licencia {license_id}: {e}")
        return None


def resolve_credentials(license_id: int | None) -> dict:
    """Retorna {provider, model, api_key, base_url, source}.
    source=license|env. Fail-closed si no hay nada.
    Si la licencia NO tiene permitido BYOT (allow_custom_llm=False), fuerza fallback global del sistema.
    """
    from config import get_config
    from models.license import License
    config = get_config()

    lic = License.query.get(license_id) if license_id else None
    can_use_custom = bool(getattr(lic, "allow_custom_llm", False)) if lic else True

    cfg = get_active_config(license_id) if can_use_custom else None
    if cfg is not None:
        try:
            from utils.llm_vault import decrypt_api_key
            plain = decrypt_api_key(cfg.api_key_enc) if cfg.api_key_enc else ""
        except Exception as e:
            raise ValueError(f"Vault LLM ilegible: {e}")
        if plain:
            return {
                "provider": (cfg.provider or "openai").lower(),
                "model": cfg.model,
                "api_key": plain,
                "base_url": cfg.base_url,
                "source": "license",
                "config_id": cfg.id,
            }
    # Fallback global del sistema (IA gestionada por defecto)
    if getattr(config, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY"):
        return {
            "provider": "openai",
            "model": getattr(config, "OPENAI_MODEL", "gpt-4o-mini"),
            "api_key": getattr(config, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY"),
            "base_url": None,
            "source": "env",
            "config_id": None,
        }
    if getattr(config, "GOOGLE_API_KEY", None) or os.getenv("GOOGLE_API_KEY"):
        return {
            "provider": "google",
            "model": getattr(config, "GEMINI_MODEL", "gemini-1.5-flash"),
            "api_key": getattr(config, "GOOGLE_API_KEY", None) or os.getenv("GOOGLE_API_KEY"),
            "base_url": None,
            "source": "env",
            "config_id": None,
        }
    raise ValueError("No LLM configurado: no hay proveedor activo y no hay keys globales en el sistema")


def _openai_compat_completion(api_key: str, model: str, messages: list, base_url: str | None, temperature: float, max_tokens: int) -> str:
    from openai import OpenAI
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = OpenAI(**kwargs)
    resp = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature, max_tokens=max_tokens
    )
    return resp.choices[0].message.content


def _anthropic_completion(api_key: str, model: str, messages: list, temperature: float, max_tokens: int) -> str:
    # Separa system para API Anthropic
    system = "\n".join(m.get("content", "") for m in messages if m.get("role") == "system")
    convo = [m for m in messages if m.get("role") != "system"]
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        # anthropic SDK espera messages con role user/assistant
        norm = [{"role": ("assistant" if m["role"] == "assistant" else "user"), "content": m["content"]} for m in convo] or [
            {"role": "user", "content": system}
        ]
        msg = client.messages.create(
            model=model or "claude-3-5-sonnet-latest",
            max_tokens=max_tokens, temperature=temperature,
            system=system or None, messages=norm,
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    except ImportError:
        # Fallback HTTP puro sin SDK
        import json as _json
        import urllib.request as _url
        norm = [{"role": ("assistant" if m["role"] == "assistant" else "user"), "content": m["content"]} for m in convo] or [
            {"role": "user", "content": system}
        ]
        body = _json.dumps({"model": model, "max_tokens": max_tokens, "temperature": temperature, "system": system, "messages": norm}).encode()
        req = _url.Request("https://api.anthropic.com/v1/messages", data=body, method="POST", headers={
            "Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01"})
        with _url.urlopen(req, timeout=60) as r:
            data = _json.loads(r.read().decode())
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def _google_completion(api_key: str, model: str, messages: list, temperature: float, max_tokens: int) -> str:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    mdl = genai.GenerativeModel(model or "gemini-1.5-flash")
    parts = []
    for m in messages:
        if m["role"] == "system":
            parts.append(f"INSTRUCCIONES DEL SISTEMA:\n{m['content']}\n")
        elif m["role"] == "user":
            parts.append(f"USUARIO:\n{m['content']}\n")
        else:
            parts.append(f"ASISTENTE:\n{m['content']}\n")
    resp = mdl.generate_content("\n".join(parts), generation_config={"temperature": temperature, "max_output_tokens": max_tokens})
    return resp.text


def chat_completion(messages: list, license_id: int | None = None, temperature: float = 0.7, max_tokens: int = 1000) -> dict:
    """Retorna {text, provider, model, source}. Lanza ValueError fail-closed."""
    creds = resolve_credentials(license_id)
    provider = (creds["provider"] or "openai").lower()
    model = creds["model"]
    key = creds["api_key"]
    base = creds.get("base_url")
    if provider in ("openai", "grok", "nvidia", "openrouter", "groq"):
        text = _openai_compat_completion(key, model, messages, base, temperature, max_tokens)
    elif provider == "anthropic":
        text = _anthropic_completion(key, model, messages, temperature, max_tokens)
    elif provider in ("google", "gemini"):
        text = _google_completion(key, model, messages, temperature, max_tokens)
    else:
        raise ValueError(f"Proveedor no soportado: {provider}")
    return {"text": text, "provider": provider, "model": model, "source": creds.get("source")}


def get_embeddings(texts: list[str], license_id: int | None = None) -> list:
    creds = resolve_credentials(license_id)
    provider = (creds["provider"] or "openai").lower()
    if provider in ("openai", "grok", "nvidia", "openrouter", "groq"):
        from openai import OpenAI
        from config import get_config
        config = get_config()
        emb_model = getattr(config, "EMBEDDING_MODEL", "text-embedding-3-small")
        emb_dim = int(getattr(config, "EMBEDDING_DIMENSION", 512) or 512)
        kwargs = {"api_key": creds["api_key"]}
        if creds.get("base_url"):
            kwargs["base_url"] = creds["base_url"]
        client = OpenAI(**kwargs)
        params = {"model": emb_model, "input": texts}
        if emb_dim and "text-embedding-3" in emb_model and provider == "openai":
            params["dimensions"] = emb_dim
        resp = client.embeddings.create(**params)
        return [d.embedding for d in resp.data]
    if provider in ("google", "gemini"):
        import google.generativeai as genai
        genai.configure(api_key=creds["api_key"])
        out = []
        for t in texts:
            r = genai.embed_content(model="models/embedding-001", content=t, task_type="retrieval_document")
            out.append(r["embedding"])
        return out
    if provider == "anthropic":
        raise ValueError("Anthropic no provee embeddings: configure OpenAI/Google para RAG o use Voyage via OpenRouter")
    raise ValueError(f"Embeddings no soportados para {provider}")


def test_connection(provider: str, model: str | None, api_key: str, base_url: str | None = None) -> dict:
    """Prueba minima (5 tokens). No guarda nada. Retorna {ok, latency_ms?, error?}."""
    import time
    t0 = time.time()
    try:
        p = (provider or "").lower()
        msgs = [{"role": "user", "content": "Responde solo: ok"}]
        if p in ("openai", "grok", "nvidia", "openrouter", "groq"):
            text = _openai_compat_completion(api_key, model or "gpt-4o-mini", msgs, base_url, 0.0, 5)
        elif p == "anthropic":
            text = _anthropic_completion(api_key, model or "claude-3-5-haiku-latest", msgs, 0.0, 5)
        elif p in ("google", "gemini"):
            text = _google_completion(api_key, model or "gemini-1.5-flash", msgs, 0.0, 5)
        else:
            return {"ok": False, "error": f"Proveedor no soportado: {provider}"}
        return {"ok": True, "reply": (text or "")[:200], "latency_ms": int((time.time() - t0) * 1000)}
    except Exception as e:
        msg = str(e)
        # Nunca devolver la key
        return {"ok": False, "error": msg[:300]}
