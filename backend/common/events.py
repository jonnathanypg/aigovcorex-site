"""
Eventos NATS v1 — Productor ligero para streaming multi-tenant
Compatible con plan maestro §5.2 y PLAN_INTEGRACION_BANCO_DIGITAL.md §5

Contrato estable (congelado para Spark/Silver):
{
  "v": 1,
  "event_id": "uuid",
  "ts": "iso8601",
  "tenant": "t_123",
  "subject_ref": "uid_enc:...",
  "channel": "whatsapp|web|telegram|voice",
  "intent": "asistencia|cmci|...",
  "lat_ms": 123,
  "tokens": 456,
  "model": "gpt-4o-mini",
  "err": null
}

Bronze (crudo inmutable, 90d TTL) → Silver (limpio + subject_ref validado) → Gold (agregados)
"""
import json
import uuid
import time
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager


# === Configuración ===
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
NATS_STREAM = os.getenv("NATS_STREAM", "EVENTS")
NATS_SUBJECT_PREFIX = os.getenv("NATS_SUBJECT_PREFIX", "events")


@dataclass(frozen=True)
class EventEnvelope:
    """Contrato v1 inmutable — NO MODIFICAR sin versionar."""
    v: int = 1
    event_id: str = ""
    ts: str = ""
    tenant: str = ""
    subject_ref: str = ""
    channel: str = ""
    intent: str = ""
    lat_ms: int = 0
    tokens: int = 0
    model: str = ""
    err: Optional[str] = None
    
    # Campos opcionales para debugging (no en Silver)
    user_role: Optional[str] = None
    license_id: Optional[str] = None
    
    def to_json(self) -> bytes:
        return json.dumps(asdict(self), separators=(",", ":"), ensure_ascii=False).encode()
    
    @classmethod
    def create(
        cls,
        tenant: str,
        subject_ref: str,
        channel: str,
        intent: str,
        lat_ms: int = 0,
        tokens: int = 0,
        model: str = "",
        err: Optional[str] = None,
        user_role: Optional[str] = None,
        license_id: Optional[str] = None,
    ) -> "EventEnvelope":
        return cls(
            event_id=str(uuid.uuid4()),
            ts=datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            tenant=tenant,
            subject_ref=subject_ref,
            channel=channel,
            intent=intent,
            lat_ms=lat_ms,
            tokens=tokens,
            model=model,
            err=err,
            user_role=user_role,
            license_id=license_id,
        )


class NATSProducer:
    """
    Productor NATS asíncrono con reconexión y backpressure.
    Un solo cliente por proceso (pool en gunicorn workers).
    """
    _instance: Optional["NATSProducer"] = None
    _nc = None
    _js = None
    _connected = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self) -> bool:
        """Conecta a NATS + JetStream. Idempotente."""
        if self._connected:
            return True
        
        try:
            import nats
            from nats.js import JetStreamContext
            
            self._nc = await nats.connect(
                NATS_URL,
                max_reconnect_attempts=-1,
                reconnect_time_wait=2,
                connect_timeout=10,
            )
            self._js = self._nc.jetstream()
            
            # Asegurar stream existe (idempotente)
            await self._js.add_stream(
                name=NATS_STREAM,
                subjects=[f"{NATS_SUBJECT_PREFIX}.>"],
                retention="limits",
                max_age=7776000,  # 90 días
                max_bytes=10_737_418_240,  # 10 GB
                storage="file",
                replicas=1,
            )
            
            self._connected = True
            return True
            
        except Exception as e:
            print(f"[NATSProducer] Conexión fallida: {e}")
            self._connected = False
            return False
    
    async def publish(self, event: EventEnvelope) -> bool:
        """Publica evento a JetStream. No bloquea (fire-and-forget con ack)."""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            print(f"[NATSProducer] Sin conexión, evento descartado: {event.event_id}")
            return False
        
        try:
            subject = f"{NATS_SUBJECT_PREFIX}.{event.tenant}.{event.intent}"
            ack = await self._js.publish(subject, event.to_json())
            # ack.seq, ack.stream disponibles para tracking
            return True
        except Exception as e:
            print(f"[NATSProducer] Error publicando {event.event_id}: {e}")
            return False
    
    async def publish_batch(self, events: list[EventEnvelope]) -> int:
        """Publica lote (útil para backfill)."""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            return 0
        
        published = 0
        for event in events:
            if await self.publish(event):
                published += 1
        return published
    
    async def close(self):
        if self._nc:
            await self._nc.close()
            self._connected = False


# === Helpers síncronos para uso en Flask (threading) ===
_sync_producer: Optional[NATSProducer] = None


def get_sync_producer() -> NATSProducer:
    """Obtiene productor para uso síncrono (crea loop si necesario)."""
    global _sync_producer
    if _sync_producer is None:
        _sync_producer = NATSProducer()
    return _sync_producer


def emit_event_sync(
    tenant: str,
    subject_ref: str,
    channel: str,
    intent: str,
    lat_ms: int = 0,
    tokens: int = 0,
    model: str = "",
    err: Optional[str] = None,
    user_role: Optional[str] = None,
    license_id: Optional[str] = None,
) -> bool:
    """
    Emite evento de forma síncrona (para Flask routes).
    Crea loop temporal si no hay uno corriendo.
    """
    producer = get_sync_producer()
    
    event = EventEnvelope.create(
        tenant=tenant,
        subject_ref=subject_ref,
        channel=channel,
        intent=intent,
        lat_ms=lat_ms,
        tokens=tokens,
        model=model,
        err=err,
        user_role=user_role,
        license_id=license_id,
    )
    
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    if loop.is_running():
        # Si hay loop corriendo (ej. gunicorn con uvicorn), schedule task
        future = asyncio.run_coroutine_threadsafe(producer.publish(event), loop)
        return future.result(timeout=5)
    else:
        return loop.run_until_complete(producer.publish(event))


# === Context manager para lifespan (Flask app factory) ===
@asynccontextmanager
async def nats_lifespan(app):
    """Para integración con Flask lifespan (quart/flask-async)."""
    producer = NATSProducer()
    await producer.connect()
    yield
    await producer.close()


# === Utilidades para testing / debug ===
def create_test_event(tenant: str = "test", subject_ref: str = "uid_enc:test") -> EventEnvelope:
    return EventEnvelope.create(
        tenant=tenant,
        subject_ref=subject_ref,
        channel="web",
        intent="test",
        lat_ms=10,
        tokens=5,
        model="test-model",
    )


def verify_event_schema(event_json: bytes) -> bool:
    """Valida que evento cumple contrato v1."""
    try:
        data = json.loads(event_json)
        required = {"v", "event_id", "ts", "tenant", "subject_ref", "channel", "intent", "lat_ms", "tokens", "model"}
        return all(k in data for k in required) and data.get("v") == 1
    except Exception:
        return False