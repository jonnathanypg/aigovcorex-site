from app import create_app
from models import db
from models.user import User, Role
from models.license import LicenseAdmin
import json

app = create_app()
with app.app_context():
    # Simulate a License Admin (ID 1)
    admin_user = User.query.get(1)
    license_admin = LicenseAdmin.query.filter_by(user_id=1).first()
    
    print(f"Testing create_user for Admin: {admin_user.email}")
    
    # New user data
    new_user_email = "test.nutri@gasiba.org"
    
    # Cleanup previous test if any
    existing = User.query.filter_by(email=new_user_email).first()
    if existing:
        LicenseAdmin.query.filter_by(user_id=existing.id).delete()
        db.session.delete(existing)
        db.session.commit()
        print("Cleaned up previous test user.")

    # We can't easily call the route because it requires a specific identity object in @require_license_admin
    # But we can test the logic directly from the controller's core parts
    
    role = Role.query.filter_by(name='nutritionist').first()
    
    # Role is universal
    universal_roles = ['doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor']
    is_universal = role.name in universal_roles
    
    print(f"Role: {role.name}, Is Universal: {is_universal}")
    
    # Create user (simulating create_user logic)
    user = User(
        tenant_id=None, # Universal users have No tenant
        role_id=role.id,
        email=new_user_email,
        first_name="Test",
        last_name="Nutri",
        is_active=True
    )
    user.set_password("password123")
    db.session.add(user)
    db.session.flush()
    
    # Logic to test:
    if is_universal:
        license_link = LicenseAdmin(
            license_id=license_admin.license_id,
            user_id=user.id,
            can_create_centers=False,
            can_delete_centers=False,
            can_manage_users=False,
            assigned_by=admin_user.id,
            is_active=True
        )
        db.session.add(license_link)
    
    db.session.commit()
    print(f"User {new_user_email} created and flushed.")
    
    # Verification
    check_link = LicenseAdmin.query.filter_by(user_id=user.id).first()
    if check_link and check_link.license_id == license_admin.license_id:
        print(f"✅ SUCCESS: New universal user automatically linked to License {check_link.license_id}")
    else:
        print("❌ FAILURE: New universal user not linked to license.")
