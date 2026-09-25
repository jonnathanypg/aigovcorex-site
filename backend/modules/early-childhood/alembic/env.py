import importlib
import os
import pkgutil
import sys
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

# Make the backend module importable (config.py, models/, etc.)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from config import get_config  # noqa: E402
from models import db, init_models  # noqa: E402

# Alembic Config object (values from alembic.ini)
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Resolve the database URL from the application config (.env is the source of truth)
# ALEMBIC_ENV lets us point autogenerate somewhere else (e.g. an empty local DB).
app_config = get_config(os.getenv("ALEMBIC_ENV", "production"))
DB_URL = app_config.SQLALCHEMY_DATABASE_URI
config.set_main_option("sqlalchemy.url", DB_URL.replace("%", "%%"))

# Import every model module so the MetaData is complete before autogenerate.
# init_models() only registers a subset, so auto-discover the whole package too.
import models as models_pkg  # noqa: E402

init_models()
for _mod in pkgutil.iter_modules(models_pkg.__path__):
    importlib.import_module(f"models.{_mod.name}")

target_metadata = db.metadata

# Tables owned by other components (WhatsApp microservice), not managed by these models
EXTERNAL_TABLES = {"bailey_sessions", "conversation_history"}


def include_object(object, name, type_, reflected, compare_to):
    """Skip reflected tables that are managed outside this app's models."""
    if type_ == "table" and reflected and name in EXTERNAL_TABLES and compare_to is None:
        return False
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(DB_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
