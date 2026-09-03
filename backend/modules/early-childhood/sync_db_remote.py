import os
import sys
import logging
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine.url import make_url

# Configuración del servidor remoto (DESTINO)
REMOTE_DB_URI = "mysql+pymysql://u668392243_wltcdi:TuContrasenaAqui@82.197.82.185:3306/u668392243_kindicore"

# Asegúrate de reemplazar 'TuContrasenaAqui' con la contraseña real que tienes.

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def sync_data():
    """
    Sincroniza datos desde la base de datos LOCAL (donde corre este script)
    hacia la base de datos REMOTA (Hostinger/Alibaba externa).
    NO borra tablas, NO altera estructura, SOLO inserta datos faltantes.
    """
    # 1. Cargar contexto de Flask local
    sys.path.append(os.getcwd())
    try:
        from app import app, db
    except ImportError:
        logger.error("No se pudo importar 'app' o 'db'. Ejecuta este script desde la raíz del proyecto (kindicore-py).")
        return

    with app.app_context():
        local_engine = db.engine
        local_url = make_url(local_engine.url)
        logger.info(f"🟢 Conectado a DB LOCAL: {local_url.database} ({local_url.drivername})")

        # 2. Conectar a DB Remota
        try:
            remote_engine = create_engine(REMOTE_DB_URI)
            remote_conn = remote_engine.connect()
            logger.info(f"🟢 Conectado a DB REMOTA: {REMOTE_DB_URI.split('@')[-1]}")
        except Exception as e:
            logger.error(f"🔴 Error conectando a DB REMOTA: {e}")
            return

        # 3. Obtener tablas (ordenadas por dependencias si es posible, o al menos lista completa)
        inspector = inspect(local_engine)
        table_names = inspector.get_table_names()

        # Orden sugerido para evitar FK errors (primero independientes, luego dependientes)
        # Ajusta este orden según tu modelo si es necesario.
        priority_tables = [
            'roles', 'users', 'licenses', 'tenants', 'families', 'children', 
            'applications', 'waiting_lists', 'documents'
        ]
        
        # Orden final: Prioritarias primero, luego el resto ordenado alfabéticamente
        sorted_tables = [t for t in priority_tables if t in table_names] + \
                        sorted([t for t in table_names if t not in priority_tables])

        logger.info(f"📋 Tablas a sincronizar: {len(sorted_tables)}")

        # 4. Iterar y copiar datos
        for table in sorted_tables:
            if table == 'alembic_version': continue # Ignorar migraciones

            logger.info(f"🔄 Procesando tabla: {table}...")
            
            # Leer datos locales
            try:
                local_data = db.session.execute(text(f"SELECT * FROM {table}")).fetchall()
                if not local_data:
                    logger.info(f"   Derived: Tabla vacía o sin datos. Saltando.")
                    continue
                
                columns = local_data[0].keys()
                rows = [dict(row._mapping) for row in local_data]
                
                logger.info(f"   -> Leídos {len(rows)} registros locales.")

                # Insertar en remoto (Uno por uno o en batch con manejo de errores)
                inserted_count = 0
                existing_count = 0
                error_count = 0
                
                for row in rows:
                    # Construir INSERT statement
                    cols_str = ', '.join([f"`{k}`" for k in row.keys()])
                    vals_str = ', '.join([f":{k}" for k in row.keys()])
                    
                    # Usamos INSERT IGNORE para MySQL para no fallar si ya existe (PK duplicate)
                    # O INSERT ... ON DUPLICATE KEY UPDATE si quieres actualizar.
                    # El usuario pidió "solo cargar datos... sin dañar ni modificar tablas actuales".
                    # Asumimos que si existe, SE DEJA EL REMOTO (no sobrescribir).
                    
                    insert_sql = text(f"INSERT IGNORE INTO {table} ({cols_str}) VALUES ({vals_str})")
                    
                    try:
                        result = remote_conn.execute(insert_sql, row)
                        if result.rowcount > 0:
                            inserted_count += 1
                        else:
                            existing_count += 1
                    except Exception as e:
                        # logger.warning(f"Error insertando fila en {table}: {e}")
                        error_count += 1
                
                remote_conn.commit()
                logger.info(f"   ✅ {table}: {inserted_count} insertados, {existing_count} omitidos (ya existían), {error_count} errores.")

            except Exception as e:
                logger.error(f"❌ Error procesando tabla {table}: {e}")

        remote_conn.close()
        logger.info("✨ Sincronización completada.")

if __name__ == "__main__":
    print("⚠️  ATENCIÓN: Este script copiará datos de LOCAL -> REMOTO.")
    print("    Asegúrate de haber configurado la contraseña correcta en la variable REMOTE_DB_URI.")
    confirm = input("¿Deseas continuar? (si/no): ")
    if confirm.lower() == 'si':
        sync_data()
    else:
        print("Cancelado.")
