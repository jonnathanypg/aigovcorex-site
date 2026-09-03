from app import create_app
from models import db
from models.user import User, Role
from models.license import LicenseAdmin

app = create_app()
with app.app_context():
    # List all users and their tenant/role/license_admin link
    results = []
    users = User.query.all()
    for u in users:
        la = LicenseAdmin.query.filter_by(user_id=u.id).first()
        results.append({
            'id': u.id,
            'email': u.email,
            'role': u.role.name,
            'tenant_id': u.tenant_id,
            'license_admin_id': la.id if la else None,
            'license_id': la.license_id if la else None
        })
    print("USERS:")
    for r in results:
        print(r)
    
    # List all roles
    print("\nROLES:")
    roles = Role.query.all()
    for r in roles:
        print(f"ID: {r.id}, Name: {r.name}")
