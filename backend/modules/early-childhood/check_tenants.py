from app import create_app
from models import db
from models.tenant import Tenant

app = create_app()
with app.app_context():
    tenants = Tenant.query.all()
    for t in tenants:
        print(f"ID: {t.id}, Name: {t.name}, License ID: {t.license_id}")
