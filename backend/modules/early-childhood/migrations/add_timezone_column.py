from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

# Database Connection
if os.getenv('DB_HOST') and os.getenv('DB_USER') and os.getenv('DB_PASSWORD'):
    db_url = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME')}"
    )
else:
    print("❌ Error: DB_HOST, DB_USER, DB_PASSWORD required")
    exit(1)

engine = create_engine(db_url)
connection = engine.connect()

try:
    print("🔄 Checking if 'timezone' column exists in 'licenses' table...")
    
    # Check if column exists
    result = connection.execute(text(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'timezone'"
    ), {"db": os.getenv('DB_NAME')}).scalar()
    
    if result == 0:
        print("🚀 Adding 'timezone' column...")
        connection.execute(text(
            "ALTER TABLE licenses ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Guayaquil'"
        ))
        print("✅ Column 'timezone' added successfully!")
    else:
        print("✅ Column 'timezone' already exists. No action needed.")

    connection.commit()

except Exception as e:
    print(f"❌ Error during migration: {str(e)}")
finally:
    connection.close()
