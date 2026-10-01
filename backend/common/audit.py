"""
Audit Log + Hash Chain — Trazabilidad inmutable tipo WORM
Compatible con plan maestro §4 (trazabilidad blockchain) y PLAN_INTEGRACION_BANCO_DIGITAL.md §4

Diseño:
- Append-only JSON Lines en archivo rotativo (diario)
- Hash chain SHA-256 encadenado: hash_n = SHA256(hash_{n-1} || payload_n)
- Verificable sin blockchain: anyone can recompute chain
- Exportable a MinIO Object Lock (WORM) para compliance
- No PII en payload (solo subject_ref/uid_enc)
"""
import json
import hashlib
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from logging.handlers import TimedRotatingFileHandler
import logging


@dataclass(frozen=True)
class AuditEntry:
    """Entrada de auditoría inmutable."""
    v: int = 1
    entry_id: str = ""
    ts: str = ""
    event_type: str = ""           # "api_request", "webhook", "llm_call", "pii_access", "olvido", "config_change"
    tenant: str = ""
    subject_ref: str = ""          # uid_enc (nunca PII real)
    actor_role: str = ""           # role del que inicia la acción
    action: str = ""               # "read", "write", "delete", "decrypt", "export", "train"
    resource: str = ""             # "child", "message", "model", "vault", "config"
    outcome: str = ""              # "success", "denied", "error"
    details: Dict[str, Any] = None # Metadatos no-PII (lat_ms, tokens, model, ip_hash, etc.)
    prev_hash: str = ""            # Hash de entrada anterior (chain)
    entry_hash: str = ""           # Hash de esta entrada (SHA256)
    
    def __post_init__(self):
        if self.details is None:
            object.__setattr__(self, "details", {})


class HashChainAuditLog:
    """
    Log de auditoría con hash chain (SHA-256 encadenado).
    Thread-safe, rotación diaria, verificación criptográfica.
    """
    
    def __init__(
        self,
        log_dir: str = "/var/log/aigovcorex/audit",
        max_bytes: int = 100_000_000,  # 100 MB por archivo
        backup_count: int = 90,         # 90 días
    ):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self._lock = threading.RLock()
        self._last_hash = "0" * 64  # Genesis hash
        self._entry_count = 0
        self._current_file: Optional[Path] = None
        
        # Cargar último hash al iniciar
        self._load_last_hash()
    
    def _load_last_hash(self):
        """Escanea archivos existentes para reconstruir chain."""
        files = sorted(self.log_dir.glob("audit-*.log*"))
        for f in files:
            try:
                with open(f, "r") as fp:
                    for line in fp:
                        line = line.strip()
                        if not line:
                            continue
                        entry = json.loads(line)
                        self._last_hash = entry.get("entry_hash", self._last_hash)
                        self._entry_count += 1
            except Exception:
                continue
    
    def _compute_hash(self, prev_hash: str, payload: Dict[str, Any]) -> str:
        """SHA256(prev_hash || canonical_json(payload))."""
        # Canonical JSON: sorted keys, no whitespace
        canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
        data = prev_hash + canonical
        return hashlib.sha256(data.encode()).hexdigest()
    
    def _get_log_file(self) -> Path:
        """Archivo de log del día actual."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return self.log_dir / f"audit-{today}.log"
    
    def append(
        self,
        event_type: str,
        tenant: str,
        subject_ref: str,
        actor_role: str,
        action: str,
        resource: str,
        outcome: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditEntry:
        """
        Añade entrada inmutable al log. Retorna la entrada con hashes.
        Thread-safe.
        """
        with self._lock:
            entry_id = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{self._entry_count:06d}"
            ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            
            # Payload para hash (sin entry_hash ni prev_hash)
            payload = {
                "v": 1,
                "entry_id": entry_id,
                "ts": ts,
                "event_type": event_type,
                "tenant": tenant,
                "subject_ref": subject_ref,
                "actor_role": actor_role,
                "action": action,
                "resource": resource,
                "outcome": outcome,
                "details": details or {},
            }
            
            entry_hash = self._compute_hash(self._last_hash, payload)
            
            entry = AuditEntry(
                v=1,
                entry_id=entry_id,
                ts=ts,
                event_type=event_type,
                tenant=tenant,
                subject_ref=subject_ref,
                actor_role=actor_role,
                action=action,
                resource=resource,
                outcome=outcome,
                details=details or {},
                prev_hash=self._last_hash,
                entry_hash=entry_hash,
            )
            
            # Escribir línea JSON
            log_file = self._get_log_file()
            with open(log_file, "a") as f:
                f.write(json.dumps(asdict(entry), separators=(",", ":"), ensure_ascii=False) + "\n")
            
            # Actualizar estado
            self._last_hash = entry_hash
            self._entry_count += 1
            
            return entry
    
    def verify_chain(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        """
        Verifica integridad de la hash chain en rango de fechas.
        Returns: {"valid": bool, "entries_checked": int, "first_bad": entry_id or None}
        """
        files = sorted(self.log_dir.glob("audit-*.log*"))
        
        if start_date:
            files = [f for f in files if f.stem >= f"audit-{start_date}"]
        if end_date:
            files = [f for f in files if f.stem <= f"audit-{end_date}"]
        
        prev_hash = "0" * 64
        checked = 0
        
        for f in files:
            try:
                with open(f, "r") as fp:
                    for line_num, line in enumerate(fp, 1):
                        line = line.strip()
                        if not line:
                            continue
                        
                        entry = json.loads(line)
                        payload = {k: v for k, v in entry.items() if k not in ("entry_hash", "prev_hash")}
                        expected_hash = self._compute_hash(prev_hash, payload)
                        
                        if entry.get("prev_hash") != prev_hash:
                            return {
                                "valid": False,
                                "entries_checked": checked,
                                "first_bad": entry.get("entry_id"),
                                "error": f"prev_hash mismatch at {entry.get('entry_id')}"
                            }
                        
                        if entry.get("entry_hash") != expected_hash:
                            return {
                                "valid": False,
                                "entries_checked": checked,
                                "first_bad": entry.get("entry_id"),
                                "error": f"entry_hash mismatch at {entry.get('entry_id')}"
                            }
                        
                        prev_hash = entry.get("entry_hash")
                        checked += 1
                        
            except Exception as e:
                return {
                    "valid": False,
                    "entries_checked": checked,
                    "first_bad": None,
                    "error": f"Parse error in {f}: {e}"
                }
        
        return {"valid": True, "entries_checked": checked, "first_bad": None}
    
    def export_worm(self, dest_path: str, start_date: str, end_date: str) -> int:
        """
        Exporta rango de fechas a archivo único para MinIO Object Lock (WORM).
        Returns: número de entradas exportadas.
        """
        files = sorted(self.log_dir.glob("audit-*.log*"))
        files = [f for f in files if f"audit-{start_date}" <= f.stem <= f"audit-{end_date}"]
        
        exported = 0
        with open(dest_path, "w") as out:
            for f in files:
                with open(f, "r") as inp:
                    for line in inp:
                        line = line.strip()
                        if line:
                            out.write(line + "\n")
                            exported += 1
        
        return exported
    
    def get_stats(self) -> Dict[str, Any]:
        """Estadísticas del log actual."""
        files = list(self.log_dir.glob("audit-*.log*"))
        total_size = sum(f.stat().st_size for f in files)
        return {
            "total_entries": self._entry_count,
            "total_files": len(files),
            "total_size_bytes": total_size,
            "last_hash": self._last_hash,
            "log_dir": str(self.log_dir),
        }


# === Instancia global (singleton) ===
_audit_log: Optional[HashChainAuditLog] = None
_audit_lock = threading.Lock()


def get_audit_log() -> HashChainAuditLog:
    """Obtiene instancia singleton del audit log."""
    global _audit_log
    with _audit_lock:
        if _audit_log is None:
            _audit_log = HashChainAuditLog()
        return _audit_log


# === Helpers de alto nivel para casos de uso comunes ===

def audit_api_request(
    tenant: str,
    subject_ref: str,
    actor_role: str,
    endpoint: str,
    method: str,
    outcome: str,
    lat_ms: int,
    status_code: int,
    ip_hash: Optional[str] = None,
):
    get_audit_log().append(
        event_type="api_request",
        tenant=tenant,
        subject_ref=subject_ref,
        actor_role=actor_role,
        action=f"{method}:{endpoint}",
        resource="api",
        outcome=outcome,
        details={
            "lat_ms": lat_ms,
            "status_code": status_code,
            "ip_hash": ip_hash,
        },
    )


def audit_webhook(
    tenant: str,
    subject_ref: str,
    channel: str,
    intent: str,
    outcome: str,
    lat_ms: int,
    verified: bool,
):
    get_audit_log().append(
        event_type="webhook",
        tenant=tenant,
        subject_ref=subject_ref,
        actor_role="system",
        action=f"receive_{channel}",
        resource="message",
        outcome=outcome,
        details={
            "channel": channel,
            "intent": intent,
            "lat_ms": lat_ms,
            "hmac_verified": verified,
        },
    )


def audit_llm_call(
    tenant: str,
    subject_ref: str,
    actor_role: str,
    intent: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    lat_ms: int,
    outcome: str,
    pii_filtered: bool = True,
):
    get_audit_log().append(
        event_type="llm_call",
        tenant=tenant,
        subject_ref=subject_ref,
        actor_role=actor_role,
        action="inference",
        resource="llm",
        outcome=outcome,
        details={
            "intent": intent,
            "model": model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "lat_ms": lat_ms,
            "pii_filtered": pii_filtered,
        },
    )


def audit_pii_access(
    tenant: str,
    subject_ref: str,
    actor_role: str,
    action: str,  # "decrypt", "reidentify", "export"
    resource: str,
    outcome: str,
    authorized_by: Optional[str] = None,
):
    get_audit_log().append(
        event_type="pii_access",
        tenant=tenant,
        subject_ref=subject_ref,
        actor_role=actor_role,
        action=action,
        resource=resource,
        outcome=outcome,
        details={
            "authorized_by": authorized_by,
        },
    )


def audit_olvido(
    tenant: str,
    subject_ref: str,
    actor_role: str,
    reason: str,
    outcome: str,
):
    """Derecho al olvido (crypto-shredding)."""
    get_audit_log().append(
        event_type="olvido",
        tenant=tenant,
        subject_ref=subject_ref,
        actor_role=actor_role,
        action="crypto_shred",
        resource="pii_vault",
        outcome=outcome,
        details={
            "reason": reason,
            "transactions_preserved": True,
        },
    )


def audit_config_change(
    tenant: str,
    actor_role: str,
    config_key: str,
    old_value_hash: str,
    new_value_hash: str,
    outcome: str,
):
    get_audit_log().append(
        event_type="config_change",
        tenant=tenant,
        subject_ref="",
        actor_role=actor_role,
        action="update",
        resource="config",
        outcome=outcome,
        details={
            "config_key": config_key,
            "old_value_hash": old_value_hash,
            "new_value_hash": new_value_hash,
        },
    )