from app import create_app
from models import db
import json

app = create_app()
target_tables = ['users', 'tenants', 'licenses', 'license_admins', 'roles']

with app.app_context():
    inspector = db.inspect(db.engine)
    schema = {}
    for table_name in target_tables:
        if table_name in inspector.get_table_names():
            columns = []
            for column in inspector.get_columns(table_name):
                columns.append({
                    'name': column['name'],
                    'type': str(column['type']),
                    'nullable': column['nullable']
                })
            schema[table_name] = columns
    
    print(json.dumps(schema, indent=2))
