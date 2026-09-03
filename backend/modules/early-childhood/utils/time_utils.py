from datetime import datetime
import pytz
from flask import g
from models.license import LicenseAdmin
from models.user import User
from models.tenant import Tenant
from middleware.tenant_context import TenantContext

DEFAULT_TZ = 'America/Guayaquil'

def get_db_timezone(user=None):
    """
    Determina la zona horaria correcta basada en la licencia del contexto actual.
    
    Logic:
    1. Si se pasa 'user', se usa ese usuario. Si no, se intenta sacar del TenantContext (g.current_user).
    2. Si el usuario es 'license_admin', busca su licencia y usa su timezone.
    3. Si el usuario es 'coordinator', 'educator', etc., busca su tenant -> license -> timezone.
    4. Si falla, fallback a DEFAULT_TZ ('America/Guayaquil').
    """
    try:
        # 1. Resolve User
        if not user:
            user = TenantContext.get_current_user()
            if not user:
                # Intento fallback manual si no estamos en contexto de request protegido
                # (Raro, pero defensivo)
                return pytz.timezone(DEFAULT_TZ)

        # 2. Case: License Admin
        if user.role.name == 'license_admin':
            # Intentar obtener de relación cargada o query
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin and lic_admin.license:
                return pytz.timezone(lic_admin.license.timezone or DEFAULT_TZ)

        # 3. Case: Tenant User (Coordinator, Educator, etc.)
        # El tenant_id está en el usuario o en el contexto
        tenant_id = getattr(user, 'tenant_id', None) or TenantContext.get_current_tenant_id()
        
        if tenant_id:
            tenant = Tenant.query.get(tenant_id)
            if tenant and tenant.license:
                return pytz.timezone(tenant.license.timezone or DEFAULT_TZ)

        # 4. Fallback (Super Admin o casos borde)
        return pytz.timezone(DEFAULT_TZ)

    except Exception:
        # Log error in production
        return pytz.timezone(DEFAULT_TZ)

def get_current_time(user=None):
    """Retorna datetime.now() localizado"""
    tz = get_db_timezone(user)
    return datetime.now(tz)

def get_today_date(user=None):
    """Retorna date.today() localizado"""
    return get_current_time(user).date()
