from app import create_app
from models import db
from models.user import User, Role
from models.license import License, LicenseAdmin

app = create_app()
with app.app_context():
    print("🚀 Starting User Data Repair v2")
    
    # 1. Identify roles that should be universal
    universal_role_names = ['doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor']
    
    # 2. Find orphaned users or those with universal roles that need license-wide access
    # Specifically targeting users identified in analysis
    target_emails = [
        'medico.cmci@gasiba.org',
        'asistenteadmin.cmci.bahia@gasiba.org',
        'psicosocial.cmci.bahia@gasiba.org'
    ]
    
    users_to_repair = User.query.filter(User.email.in_(target_emails)).all()
    
    # Default license for these users (Gasiba/MIES License ID 1 based on analysis)
    target_license_id = 1 
    
    for user in users_to_repair:
        print(f"Checking user: {user.email} (Role: {user.role.name})")
        
        # Check if already linked to LicenseAdmin
        existing_link = LicenseAdmin.query.filter_by(user_id=user.id, license_id=target_license_id).first()
        
        if not existing_link:
            print(f"Creating LicenseAdmin link for {user.email} to License {target_license_id}")
            new_link = LicenseAdmin(
                license_id=target_license_id,
                user_id=user.id,
                can_create_centers=False,
                can_delete_centers=False,
                can_manage_users=False,
                is_active=True,
                assigned_at=db.func.current_timestamp()
            )
            db.session.add(new_link)
        else:
            print(f"User {user.email} already linked.")
            
    # 3. Handle ID 23 (doctor) specifically if not in list
    doctor = User.query.filter_by(id=23).first()
    if doctor and not LicenseAdmin.query.filter_by(user_id=23).first():
        print(f"Repairing ID 23: {doctor.email}")
        new_link = LicenseAdmin(
            license_id=target_license_id,
            user_id=23,
            can_create_centers=False,
            can_delete_centers=False,
            can_manage_users=False,
            is_active=True
        )
        db.session.add(new_link)

    db.session.commit()
    print("✅ Repair complete.")
