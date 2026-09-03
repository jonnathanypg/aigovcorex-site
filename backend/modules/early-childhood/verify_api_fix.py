from app import create_app
from models import db
from models.user import User
from models.license import LicenseAdmin

app = create_app()
with app.app_context():
    # Simulate being the License Admin with ID 1 (jgastiaburo@gasiba.org)
    # This admin belongs to License 1
    admin_user = User.query.get(1)
    license_admin = LicenseAdmin.query.filter_by(user_id=1).first()
    
    print(f"Simulating request for License Admin: {admin_user.email} (License ID: {license_admin.license_id})")
    
    from sqlalchemy import or_
    from models.user import Role
    from models.tenant import Tenant
    
    # 1. Query for STAFF (Center-based or Multi-center/Universal)
    # This is the logic I just implemented in license_admin.py
    staff_query = User.query.outerjoin(Tenant).outerjoin(LicenseAdmin, User.id == LicenseAdmin.user_id).join(Role).filter(
        or_(
            Tenant.license_id == license_admin.license_id,
            LicenseAdmin.license_id == license_admin.license_id
        ),
        Role.name.notin_(['super_admin', 'license_admin'])
    ).distinct()
    
    staff_users = staff_query.all()
    
    print(f"\nFound {len(staff_users)} staff users:")
    for u in staff_users:
        print(f"ID: {u.id}, Email: {u.email}, Role: {u.role.name}, Tenant: {u.tenant_id}")
    
    # Check if our target users are in the list
    target_emails = [
        'medico.cmci@gasiba.org',
        'asistenteadmin.cmci.bahia@gasiba.org',
        'psicosocial.cmci.bahia@gasiba.org'
    ]
    
    found_targets = [u.email for u in staff_users if u.email in target_emails]
    print(f"\nTarget users found in staff list: {found_targets}")
    
    if len(found_targets) == len(target_emails):
        print("\n✅ Verification SUCCESS: All universal users are now visible in the list!")
    else:
        print("\n❌ Verification FAILED: Some universal users are still missing.")
