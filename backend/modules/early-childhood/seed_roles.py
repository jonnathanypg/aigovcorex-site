"""
Role Seeding Script
Ensures all required roles exist in the database.
Run: python seed_roles.py
"""
from app import create_app
from models import db
from models.user import Role

REQUIRED_ROLES = [
    {
        'name': 'super_admin',
        'description': 'Super Administrador del Sistema',
        'permissions': ['all']
    },
    {
        'name': 'license_admin',
        'description': 'Administrador de Licencia (multi-centro)',
        'permissions': ['manage_license', 'manage_centers', 'manage_users', 'view_reports', 'manage_admissions']
    },
    {
        'name': 'supervisor',
        'description': 'Supervisor de Licencia (multi-centro, vista global)',
        'permissions': ['manage_centers', 'manage_users', 'view_reports', 'manage_admissions']
    },
    {
        'name': 'center_coordinator',
        'description': 'Coordinadora de Centro',
        'permissions': ['manage_center', 'manage_users', 'view_reports', 'manage_admissions']
    },
    {
        'name': 'coordinator',
        'description': 'Coordinadora (alias)',
        'permissions': ['manage_center', 'manage_users', 'view_reports', 'manage_admissions']
    },
    {
        'name': 'educadora',
        'description': 'Educadora de Centro',
        'permissions': ['view_children', 'manage_attendance', 'manage_nutrition']
    },
    {
        'name': 'educator',
        'description': 'Educadora (alias inglés)',
        'permissions': ['view_children', 'manage_attendance', 'manage_nutrition']
    },
    {
        'name': 'doctor',
        'description': 'Médico (universal, multi-centro)',
        'permissions': ['view_children', 'manage_health', 'view_reports']
    },
    {
        'name': 'nutritionist',
        'description': 'Nutricionista (universal, multi-centro)',
        'permissions': ['view_children', 'manage_nutrition', 'view_reports']
    },
    {
        'name': 'psychologist',
        'description': 'Psicóloga (universal, multi-centro)',
        'permissions': ['view_children', 'manage_health', 'view_reports']
    },
    {
        'name': 'social_worker',
        'description': 'Trabajadora Social (universal, multi-centro)',
        'permissions': ['view_children', 'manage_admissions', 'view_reports']
    },
    {
        'name': 'administrative',
        'description': 'Administrativo (universal, multi-centro)',
        'permissions': ['view_reports', 'manage_admissions']
    },
]

app = create_app()
with app.app_context():
    print("🔧 Seeding roles...")
    created = 0
    updated = 0

    for role_def in REQUIRED_ROLES:
        existing = Role.query.filter_by(name=role_def['name']).first()
        if not existing:
            role = Role(
                name=role_def['name'],
                description=role_def['description'],
                permissions=role_def['permissions']
            )
            db.session.add(role)
            created += 1
            print(f"  ✅ Created: {role_def['name']}")
        else:
            # Update description/permissions if missing
            changed = False
            if not existing.description and role_def['description']:
                existing.description = role_def['description']
                changed = True
            if not existing.permissions and role_def['permissions']:
                existing.permissions = role_def['permissions']
                changed = True
            if changed:
                updated += 1
                print(f"  🔄 Updated: {role_def['name']}")
            else:
                print(f"  ⏭️  Exists: {role_def['name']}")

    db.session.commit()
    print(f"\n✅ Seeding complete. Created: {created}, Updated: {updated}")

    # Verify
    all_roles = Role.query.all()
    print(f"\n📋 All roles in DB ({len(all_roles)}):")
    for r in all_roles:
        print(f"   [{r.id}] {r.name}: {r.description or '(no description)'}")
