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
    print("🔄 Checking column type of 'content' in 'knowledge_documents' table...")
    
    # Check current data type
    result = connection.execute(text(
        "SELECT DATA_TYPE FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'knowledge_documents' AND COLUMN_NAME = 'content'"
    ), {"db": os.getenv('DB_NAME')}).scalar()
    
    if result and result.lower() != 'longtext':
        print(f"🚀 Altering 'content' column from {result} to LONGTEXT...")
        connection.execute(text(
            "ALTER TABLE knowledge_documents MODIFY COLUMN content LONGTEXT NOT NULL"
        ))
        print("✅ Column 'content' converted to LONGTEXT successfully!")
    else:
        print(f"✅ Column 'content' is already {result}. No action needed.")

    # Also ensure pinecone_ids is MEDIUMTEXT or LONGTEXT if huge
    p_result = connection.execute(text(
        "SELECT DATA_TYPE FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'knowledge_documents' AND COLUMN_NAME = 'pinecone_ids'"
    ), {"db": os.getenv('DB_NAME')}).scalar()
    if p_result and p_result.lower() == 'text':
        print("🚀 Altering 'pinecone_ids' to LONGTEXT...")
        connection.execute(text(
            "ALTER TABLE knowledge_documents MODIFY COLUMN pinecone_ids LONGTEXT NULL"
        ))
        print("✅ Column 'pinecone_ids' converted to LONGTEXT successfully!")

    connection.commit()

except Exception as e:
    print(f"❌ Error during migration: {str(e)}")
finally:
    connection.close()
