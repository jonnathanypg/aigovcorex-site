"""
Role Helper Utilities
Centralized role-checking functions for multi-center access patterns.
"""


def is_multi_center_role(user):
    """
    Check if a user has a role that grants multi-center visibility.
    Includes super_admin, license_admin, supervisor, coordinator, doctor, nutritionist, social_worker, administrative.
    """
    if not user or not user.role:
        return False
    return user.role.name in (
        'super_admin', 'license_admin', 'supervisor', 'coordinator',
        'doctor', 'nutritionist', 'social_worker', 'administrative', 'admin'
    )


def get_license_id_for_user(user):
    """
    Resolve the license_id for a user regardless of their role.
    """
    # Attempt to resolve from license_admins table first
    from models.license import LicenseAdmin, License
    la = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
    if la:
        return la.license_id
        
    # Fallback to resolving from the user's specific tenant
    if user.tenant_id:
        from models.tenant import Tenant
        tenant = Tenant.query.get(user.tenant_id)
        if tenant and tenant.license_id:
            return tenant.license_id
            
    # Fallback for universal global roles without specific tenant: return first active license
    active_lic = License.query.filter_by(status='active').first()
    if active_lic:
        return active_lic.id

    return None



def get_tenant_ids_for_user(user):
    """
    Get all tenant IDs a user has access to.
    - Multi-center roles: All tenants under their license
    - Other roles: Just their own tenant_id
    Returns list of tenant IDs.
    """
    if is_multi_center_role(user):
        license_id = get_license_id_for_user(user)
        if license_id:
            from models.tenant import Tenant
            return [t.id for t in Tenant.query.filter_by(license_id=license_id, is_active=True).all()]
    elif user.tenant_id:
        return [user.tenant_id]
    return []
