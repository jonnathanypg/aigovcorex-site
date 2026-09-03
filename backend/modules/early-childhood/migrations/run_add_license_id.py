"""
Migration: Add license_id column to menus table
Run: python migrations/run_add_license_id.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    conn = db.engine.connect()
    
    # Check if column already exists
    try:
        result = conn.execute(text("SHOW COLUMNS FROM menus LIKE 'license_id'"))
        exists = result.fetchone()
        
        if exists:
            print("✅ Column 'license_id' already exists. No migration needed.")
        else:
            print("⏳ Adding column 'license_id' to menus table...")
            conn.execute(text("ALTER TABLE menus ADD COLUMN license_id INT NULL"))
            conn.execute(text("ALTER TABLE menus MODIFY COLUMN tenant_id INT NULL"))
            conn.execute(text(
                "ALTER TABLE menus ADD CONSTRAINT fk_menus_license_id "
                "FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE"
            ))
            conn.execute(text(
                "CREATE INDEX idx_menu_license_week ON menus (license_id, week_start_date)"
            ))
            conn.commit()
            print("✅ Migration complete! Column 'license_id' added successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()
