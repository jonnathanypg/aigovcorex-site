"""
CMCI pre-corte: elimina UNIQUEs legacy globales SIN borrar datos + crea índices nuevos.

Legacy a dropear (solo índices, nunca columnas/datos):
  - vulnerability_forms.child_id UNIQUE (bloquea histórico: 1 ficha por niño)
  - children.cedula UNIQUE global (bloquea multicentro: misma cédula en 2 tenants)
  - representatives.cedula UNIQUE global (bloquea familias distintas con mismo rep)

Nuevos a garantizar (IF NOT EXISTS):
  - idx_vuln_child            ON vulnerability_forms(child_id)
  - uq_child_tenant_cedula    UNIQUE ON children(tenant_id, cedula)
  - uq_rep_family_cedula      UNIQUE ON representatives(family_id, cedula)
  - idx_tenant_cmci_code      ON tenants(cmci_code)

Idempotente MySQL + SQLite. Hace backup previo:
  - SQLite: copia instance/cdi_database.db -> backup pre-corte
  - MySQL: mysqldump (si disponible) -> backup pre-corte

Uso:
  python scripts/drop_legacy_uniques.py [--backup-dir backups] [--database-url ...]
"""
import argparse
import datetime
import os
import shutil
import sqlite3
import subprocess
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NEW_INDEXES = [
    # (table, index_name, columns, unique)
    ("vulnerability_forms", "idx_vuln_child", ["child_id"], False),
    ("vulnerability_forms", "idx_vulnform_child", ["child_id"], False),  # alias legacy-code
    ("children", "uq_child_tenant_cedula", ["tenant_id", "cedula"], True),
    ("children", "idx_child_cedula", ["cedula"], False),
    ("representatives", "uq_rep_family_cedula", ["family_id", "cedula"], True),
    ("representatives", "idx_rep_cedula", ["cedula"], False),
    ("tenants", "idx_tenant_cmci_code", ["cmci_code"], False),
]

# Índices legacy conocidos a intentar dropear por nombre (además de detección
# por introspección). Todos son DROP INDEX si existe: sin datos tocados.
LEGACY_INDEX_NAMES = [
    ("vulnerability_forms", "uq_vulnerability_forms_child_id"),
    ("vulnerability_forms", "uq_vulnform_child_id"),
    ("vulnerability_forms", "ix_vulnerability_forms_child_id"),
    ("vulnerability_forms", "child_id"),  # MySQL auto-index por UNIQUE(col)
    ("children", "cedula"),
    ("children", "ix_children_cedula"),
    ("children", "uq_children_cedula"),
    ("children", "idx_children_cedula_unique"),
    ("representatives", "cedula"),
    ("representatives", "ix_representatives_cedula"),
    ("representatives", "uq_representatives_cedula"),
]


def _log(msg):
    print(f"[drop_legacy_uniques] {msg}", flush=True)


def resolve_database_url(cli_url=None):
    if cli_url:
        return cli_url
    url = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
    if url:
        return url
    # Fallback igual que config.py: MySQL si hay DB_HOST+DB_USER+DB_PASSWORD, si no sqlite
    if os.getenv("DB_HOST") and os.getenv("DB_USER") and os.getenv("DB_PASSWORD"):
        return (
            f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
            f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME')}"
            "?charset=utf8mb4"
        )
    default_sqlite = os.path.join(BASE_DIR, "instance", "cdi_database.db")
    return f"sqlite:///{default_sqlite}"


def is_mysql(url):
    return url.startswith("mysql")


def sqlite_path_from_url(url):
    # sqlite:////abs/path | sqlite:///rel/path | sqlite:///:memory:
    if ":memory:" in url:
        return None
    path = url.split("sqlite:///", 1)[-1].split("?", 1)[0]
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return path


def backup_sqlite(db_path, backup_dir):
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(backup_dir, f"cdi_database_pre_corte_{ts}.db")
    if db_path and os.path.exists(db_path):
        shutil.copy2(db_path, dest)
        _log(f"backup sqlite: {db_path} -> {dest}")
        return dest
    _log(f"sin archivo sqlite que respaldar ({db_path}); se omite backup")
    return None


def backup_mysql(backup_dir):
    """Intenta mysqldump; si no hay binario/credenciales, advierte sin romper."""
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(backup_dir, f"mysqldump_pre_corte_{ts}.sql")
    host = os.getenv("DB_HOST", "")
    user = os.getenv("DB_USER", "")
    pwd = os.getenv("DB_PASSWORD", "")
    name = os.getenv("DB_NAME", "")
    port = os.getenv("DB_PORT", "3306")
    if not (host and user and pwd and name):
        _log("sin credenciales MySQL completas (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME); "
             "haga mysqldump manual antes del corte")
        return None
    cmd = ["mysqldump", f"-h{host}", f"-P{port}", f"-u{user}", f"-p{pwd}", name]
    try:
        with open(dest, "w") as fh:
            subprocess.run(cmd, stdout=fh, check=True, timeout=300)
        _log(f"backup mysqldump -> {dest}")
        return dest
    except FileNotFoundError:
        _log("mysqldump no instalado; haga backup manual antes del corte")
    except Exception as exc:  # noqa: BLE001 - idempotente: reportar, no romper
        _log(f"mysqldump falló ({exc}); haga backup manual antes del corte")
    return None


# ---------------- SQLite ----------------

def _sqlite_table_exists(conn, table):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def _sqlite_index_list(conn, table):
    return conn.execute(f"PRAGMA index_list('{table}')").fetchall()


def _sqlite_index_info(conn, index_name):
    return conn.execute(f"PRAGMA index_info('{index_name}')").fetchall()


def run_sqlite(db_path, backup_dir):
    if db_path is None or not os.path.exists(db_path):
        _log(f"sqlite sin archivo ({db_path}); nada que migrar")
        return {"dialect": "sqlite", "dropped": [], "created": [], "backup": None}
    backup = backup_sqlite(db_path, backup_dir)
    conn = sqlite3.connect(db_path)
    dropped, created = [], []
    try:
        for table, index_name, cols, unique in NEW_INDEXES:
            if not _sqlite_table_exists(conn, table):
                continue
            # 1) Dropear legacy: cualquier índice UNIQUE de 1 sola columna
            #    (child_id | cedula) que NO sea uno de los nuevos compuestos.
            new_names = {n for _, n, _, _ in NEW_INDEXES}
            for row in _sqlite_index_list(conn, table):
                # PRAGMA index_list: seq, name, unique, origin, partial
                iname, iunique = row[1], row[2]
                if not iunique or iname in new_names:
                    continue
                try:
                    info = _sqlite_index_info(conn, iname)
                except Exception:
                    continue
                if len(info) == 1:
                    col = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
                    # index_info: seqno, cid, name
                    cid = info[0][1]
                    colname = next((c[1] for c in col if c[0] == cid), None)
                    if colname in ("child_id", "cedula") and table in (
                        "vulnerability_forms", "children", "representatives"
                    ):
                        conn.execute(f'DROP INDEX IF EXISTS "{iname}"')
                        dropped.append(f"{table}.{iname}")
                        _log(f"DROP INDEX {iname} ON {table} (legacy unique {colname})")
            # 2) Dropear por nombre conocido (idempotente)
            for ltable, lname in LEGACY_INDEX_NAMES:
                if ltable != table:
                    continue
                existing = {r[1] for r in _sqlite_index_list(conn, table)}
                if lname in existing and lname not in new_names:
                    # Solo dropear si es UNIQUE de 1 columna legacy
                    try:
                        info = _sqlite_index_info(conn, lname)
                        if len(info) == 1:
                            conn.execute(f'DROP INDEX IF EXISTS "{lname}"')
                            dropped.append(f"{table}.{lname}")
                            _log(f"DROP INDEX {lname} ON {table} (nombre legacy)")
                    except Exception:
                        pass
            # 3) Crear índice nuevo IF NOT EXISTS (sin tocar datos)
            uniq = "UNIQUE " if unique else ""
            collist = ", ".join(f'"{c}"' for c in cols)
            conn.execute(
                f'CREATE {uniq}INDEX IF NOT EXISTS "{index_name}" '
                f'ON "{table}" ({collist})'
            )
            created.append(f"{table}.{index_name}")
        conn.commit()
    finally:
        conn.close()
    _log(f"sqlite OK: dropped={dropped} created={created}")
    return {"dialect": "sqlite", "dropped": dropped, "created": created, "backup": backup}


# ---------------- MySQL ----------------

def run_mysql(url, backup_dir):
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        _log("SQLAlchemy no instalado; instale con: pip install -r requirements.txt")
        raise
    backup = backup_mysql(backup_dir)
    engine = create_engine(url)
    dropped, created = [], []
    new_names = {n for _, n, _, _ in NEW_INDEXES}
    with engine.begin() as conn:
        for table, index_name, cols, unique in NEW_INDEXES:
            exists = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.TABLES "
                     "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"),
                {"t": table},
            ).scalar()
            if not exists:
                continue
            # 1) Detectar UNIQUEs legacy de 1 columna (child_id|cedula)
            rows = conn.execute(
                text("SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM "
                     "information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() "
                     "AND TABLE_NAME = :t ORDER BY INDEX_NAME, SEQ_IN_INDEX"),
                {"t": table},
            ).fetchall()
            by_index = {}
            for iname, cname, non_unique in rows:
                by_index.setdefault(iname, {"cols": [], "unique": non_unique == 0})
                by_index[iname]["cols"].append(cname)
            for iname, meta in by_index.items():
                if iname == "PRIMARY" or iname in new_names:
                    continue
                if (meta["unique"] and len(meta["cols"]) == 1
                        and meta["cols"][0] in ("child_id", "cedula")
                        and table in ("vulnerability_forms", "children", "representatives")):
                    try:
                        conn.execute(text(f"DROP INDEX `{iname}` ON `{table}`"))
                        dropped.append(f"{table}.{iname}")
                        _log(f"DROP INDEX {iname} ON {table} (legacy unique)")
                    except Exception as exc:
                        _log(f"DROP INDEX {iname} omitido ({exc})")
            # 2) Nombres legacy conocidos (por si introspección no los vio)
            for ltable, lname in LEGACY_INDEX_NAMES:
                if ltable != table or lname in new_names:
                    continue
                try:
                    conn.execute(text(f"DROP INDEX `{lname}` ON `{table}`"))
                    dropped.append(f"{table}.{lname}")
                    _log(f"DROP INDEX {lname} ON {table} (nombre legacy)")
                except Exception:
                    pass  # no existe -> idempotente
            # 3) Crear nuevo si no existe
            cnt = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.STATISTICS "
                     "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t "
                     "AND INDEX_NAME = :i"),
                {"t": table, "i": index_name},
            ).scalar()
            if not cnt:
                uniq = "UNIQUE " if unique else ""
                collist = ", ".join(f"`{c}`" for c in cols)
                conn.execute(text(f"CREATE {uniq}INDEX `{index_name}` ON `{table}` ({collist})"))
                _log(f"CREATE {uniq}INDEX {index_name} ON {table}")
            created.append(f"{table}.{index_name}")
    _log(f"mysql OK: dropped={dropped} created={created}")
    return {"dialect": "mysql", "dropped": dropped, "created": created, "backup": backup}


def main(argv=None):
    parser = argparse.ArgumentParser(description="CMCI pre-corte: drop legacy uniques (sin borrar datos)")
    parser.add_argument("--backup-dir", default=os.path.join(BASE_DIR, "backups", "pre_corte"))
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args(argv)
    url = resolve_database_url(args.database_url)
    _log(f"dialecto: {'mysql' if is_mysql(url) else 'sqlite'}")
    if is_mysql(url):
        run_mysql(url, args.backup_dir)
        return 0
    run_sqlite(sqlite_path_from_url(url), args.backup_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
