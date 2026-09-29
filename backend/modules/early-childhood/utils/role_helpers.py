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


# ── F5 · Matriz RBAC CMCI (§10.7 plan; sin firma electrónica: la
# aprobación es firma física sobre papel impreso, fuera del sistema) ──
# Central global (lectura todo) / Coordinadora revisa en papel (lectura
# centro, no crea fichas) / Educadora crea / Auxiliar apoyo (crea) /
# Catering solo menú+ingesta diaria.
# Nombres tolerantes a variantes ES/EN (coordinator/coordinadora...).

def _role_name(user):
    role = getattr(user, "role", None)
    return (getattr(role, "name", "") or "").lower()


def is_central_global(user):
    """Central DASE/MDH + admins: visibilidad global (lectura)."""
    return _role_name(user) in (
        "super_admin", "license_admin", "supervisor", "admin",
        "central", "central_dase", "central_mdh", "coordinador_general",
    )


def is_coordinadora(user):
    return _role_name(user) in ("coordinator", "coordinadora",
                                "coordinadora_centro")


def is_educadora(user):
    return _role_name(user) in ("educadora", "educador", "teacher")


def is_auxiliar(user):
    rn = _role_name(user)
    return rn.startswith("auxiliar") or rn in ("asistente", "assistant",
                                               "auxiliar_parvulos",
                                               "auxiliar_servicios")


def is_catering(user):
    rn = _role_name(user)
    return rn.startswith("catering") or rn in ("cocina", "alimentacion")


def is_admin_override(user):
    """super/license admin: bypass operativo (evita lockout)."""
    return _role_name(user) in ("super_admin", "license_admin")


def can_create_ficha(user):
    """Educadora crea, Auxiliar apoya (crea), admin override. Coordinadora
    revisa en papel impreso (no crea en sistema); Central solo lectura;
    Catering solo menú/ingesta."""
    if is_admin_override(user):
        return True
    return is_educadora(user) or is_auxiliar(user)


def can_view_cmci_global(user):
    """Central ve todos los centros; resto solo su tenant."""
    return is_central_global(user) or is_admin_override(user) \
        or is_multi_center_role(user)
