from app import create_app
from models.child import Child
from services.db_service import db
import sys

try:
    app = create_app()
    with app.app_context():
        # Consultamos todos los niños dados de baja recientemente para ver qué pasa
        children = Child.query.order_by(Child.id.desc()).limit(30).all()
        print("Últimos 30 Niños en BD:")
        for c in children:
            print(f"ID: {c.id} | Ced: {c.cedula or 'None'} | Nombre: {c.first_name} {c.last_name} | Est: {c.status} | Tenant: {c.tenant_id}")
            
except Exception as e:
    print("Error:", e)
    sys.exit(1)
