from app import create_app, db
from models.user import User, Role

def restore_super_admin():
    app = create_app()
    with app.app_context():
        email = 'jonnathan.ypg@gmail.com'
        
        # Check if user exists
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"✅ User {email} already exists with ID {user.id}")
            # Ensure safe role and unlinked tenant
            role = Role.query.filter_by(name='super_admin').first()
            if user.role_id != role.id:
                print(f"⚠️ Updating role to super_admin...")
                user.role_id = role.id
            if user.tenant_id is not None:
                print(f"⚠️ Unlinking from tenant {user.tenant_id}...")
                user.tenant_id = None
            db.session.commit()
            print("✨ User checks passed.")
            return

        print(f"❌ User {email} NOT FOUND. Restoring...")
        
        # Get Super Admin Role
        role = Role.query.filter_by(name='super_admin').first()
        if not role:
            print("❌ Error: 'super_admin' role not found in DB.")
            return

        # Create User
        new_user = User(
            email=email,
            first_name='Jonnathan',
            last_name='Peña',
            role_id=role.id,
            is_active=True,
            tenant_id=None # Super Admin belongs to no tenant
        )
        new_user.set_password('SUPER ADMIN') # Password requested by user
        
        db.session.add(new_user)
        db.session.commit()
        
        print(f"🎉 SUCCESSS: User {email} restored with ID {new_user.id}")
        print("🔑 Password: SUPER ADMIN")

if __name__ == '__main__':
    restore_super_admin()
