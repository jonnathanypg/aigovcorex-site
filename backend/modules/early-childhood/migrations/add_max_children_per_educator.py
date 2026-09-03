"""
Add max_children_per_educator to tenants table.
Limite de niños que pueden asignarse a una educadora por centro.
"""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

if os.getenv('DB_HOST') and os.getenv('DB_USER') and os.getenv('DB_PASSWORD'):
    db_url = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME')}"
    )
else:
    print("Error: DB_HOST, DB_USER, DB_PASSWORD required")
    exit(1)

engine = create_engine(db_url)
connection = engine.connect()

try:
    print("Checking if 'max_children_per_educator' exists in 'tenants'...")
    result = connection.execute(text(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'max_children_per_educator'"
    ), {"db": os.getenv('DB_NAME')}).scalar()

    if result == 0:
        print("Adding 'max_children_per_educator' column...")
        connection.execute(text(
            "ALTER TABLE tenants ADD COLUMN max_children_per_educator INT DEFAULT 10"
        ))
        connection.commit()
        print("Column added successfully.")
    else:
        print("Column already exists. No action needed.")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    connection.close()
