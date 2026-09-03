"""
Migration script: Add socioeconomic and geographic columns to families and representatives tables.
Run once, then delete.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = create_app()

# Columns to add to 'families' table
FAMILY_COLUMNS = [
    ("sector", "VARCHAR(100)"),
    ("neighborhood", "VARCHAR(100)"),
    ("residency_years", "INT"),
    ("previous_address", "TEXT"),
    ("previous_city", "VARCHAR(100)"),
    ("previous_province", "VARCHAR(100)"),
    ("housing_type", "VARCHAR(50)"),
    ("employment_type", "VARCHAR(50)"),
    ("monthly_income_range", "VARCHAR(50)"),
    ("household_type", "VARCHAR(50)"),
    ("economic_condition", "VARCHAR(50)"),
    ("geographic_zone", "VARCHAR(50)"),
    ("ethnic_identity", "VARCHAR(50)"),
    ("has_disability", "BOOLEAN DEFAULT FALSE"),
    ("disability_detail", "VARCHAR(255)"),
    ("mobility_status", "VARCHAR(50)"),
    ("migrant_origin", "VARCHAR(255)"),
    ("social_risks", "JSON"),
]

# Columns to add to 'representatives' table
REP_COLUMNS = [
    ("birth_place", "VARCHAR(255)"),
    ("birth_province", "VARCHAR(100)"),
    ("nationality", "VARCHAR(100) DEFAULT 'Ecuatoriana'"),
]

def add_column_if_not_exists(table, column_name, column_type):
    """Add a column to a table if it doesn't already exist."""
    try:
        with db.engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text(
                f"SELECT COUNT(*) FROM information_schema.columns "
                f"WHERE table_name = :table AND column_name = :col"
            ), {"table": table, "col": column_name})
            exists = result.scalar() > 0
            
            if not exists:
                conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{column_name}` {column_type}"))
                conn.commit()
                logger.info(f"  ✅ Added {table}.{column_name}")
            else:
                logger.info(f"  ⏭️  {table}.{column_name} already exists")
    except Exception as e:
        logger.error(f"  ❌ Error adding {table}.{column_name}: {e}")

if __name__ == "__main__":
    with app.app_context():
        logger.info("🚀 Starting socioeconomic columns migration...")
        
        logger.info("\n📋 Adding columns to 'families' table:")
        for col_name, col_type in FAMILY_COLUMNS:
            add_column_if_not_exists("families", col_name, col_type)
        
        logger.info("\n👤 Adding columns to 'representatives' table:")
        for col_name, col_type in REP_COLUMNS:
            add_column_if_not_exists("representatives", col_name, col_type)
        
        logger.info("\n✅ Migration complete!")
