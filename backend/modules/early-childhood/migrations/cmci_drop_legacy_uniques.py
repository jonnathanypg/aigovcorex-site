"""Alembic-style migration CMCI pre-corte: drop legacy UNIQUEs (sin borrar datos).

Revisión: cmci_drop_legacy_uniques
Aplica lo mismo que scripts/drop_legacy_uniques.py pero como migración
versionada (upgrade idempotente, downgrade no-op seguro: no recrea los
UNIQUEs legacy porque romperían histórico/multicentro).

Tablas/índices: ver scripts/drop_legacy_uniques.py (fuente de verdad).
"""
import os
import sys

revision = "cmci_drop_legacy_uniques"
down_revision = None
branch_labels = None
depends_on = None

_CURRENT_DIR = os.path.abspath(os.path.dirname(__file__))
_SCRIPTS_DIR = os.path.join(os.path.dirname(_CURRENT_DIR), "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

try:
    from drop_legacy_uniques import is_mysql, run_mysql, run_sqlite, sqlite_path_from_url
except ImportError:  # fallback si se ejecuta fuera del package
    sys.path.insert(0, _CURRENT_DIR)
    from drop_legacy_uniques import is_mysql, run_mysql, run_sqlite, sqlite_path_from_url


def _resolve_url():
    url = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
    if url:
        return url
    if os.getenv("DB_HOST") and os.getenv("DB_USER") and os.getenv("DB_PASSWORD"):
        return (
            f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
            f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME')}"
            "?charset=utf8mb4"
        )
    base = os.path.abspath(os.path.join(_CURRENT_DIR, ".."))
    return f"sqlite:///{os.path.join(base, 'instance', 'cdi_database.db')}"


def upgrade():
    url = _resolve_url()
    backup_dir = os.path.join(os.path.dirname(_CURRENT_DIR), "backups", "pre_corte")
    if is_mysql(url):
        run_mysql(url, backup_dir)
    else:
        run_sqlite(sqlite_path_from_url(url), backup_dir)


def downgrade():
    # No-op intencional: recrear UNIQUEs globales rompería histórico/multicentro.
    pass
