"""
Identity Resolver Service
Resolves user identity from messaging channel identifiers (phone, telegram chat_id)
and determines access permissions based on role.
"""
from models import db
from models.user import User
from models.license import License
from models.tenant import Tenant
from models.child import Child, Representative, Family

class VirtualRole:
    """Mock Role object for VirtualUsers"""
    def __init__(self, name):
        self.name = name

class VirtualUser:
    """
    Acts as a User proxy for Representatives who don't have a real User account.
    This allows the rest of the system (Agents, ContextService) to treat them as normal users.
    """
    def __init__(self, representative: Representative, children: list[Child]):
        self.id = -abs(representative.id)  # Negative ID convention for virtual users
        self.email = representative.email or f"rep_{representative.id}@kindicore.virtual"
        self.first_name = representative.first_name
        self.last_name = representative.last_name
        self.full_name = representative.full_name
        self.phone = representative.phone
        self.role = VirtualRole('padre')
        
        # Virtual users are scoped to their children's tenant (or the first one found)
        self.tenant_id = children[0].tenant_id if children else None
        
        # CRITICAL: Store child IDs for ContextService scoping
        self.child_ids = [c.id for c in children]
        self.is_virtual = True
        self.is_active = True

    @property
    def whatsapp_phone(self):
        return self.phone

    def to_dict(self):
        return {
            'id': self.id,
            'full_name': self.full_name,
            'role': 'padre',
            'is_virtual': True
        }


class IdentityResolver:
    """
    Resolves user identity and permissions from messaging channel identifiers.
    Utilizes an In-Memory Hash Table Cache (O(1) lookup) with automatic TTL.
    """
    _cache = {}  # Key: (channel, identifier, license_id) -> Value: (timestamp, response_dict)
    _CACHE_TTL = 300  # 5 minutes cache TTL

    @classmethod
    def _get_from_cache(cls, key):
        import time
        if key in cls._cache:
            timestamp, data = cls._cache[key]
            if time.time() - timestamp < cls._CACHE_TTL:
                print(f"[IdentityResolver Cache HIT O(1)]: {key}")
                return data
            else:
                del cls._cache[key]
        return None

    @classmethod
    def _set_cache(cls, key, data):
        import time
        cls._cache[key] = (time.time(), data)

    @classmethod
    def invalidate_cache(cls):
        cls._cache.clear()

    @staticmethod
    def get_user_or_virtual(user_id: int):
        """
        Retrieve a real User OR a VirtualUser based on ID sign.
        Positive IDs -> Real Users
        Negative IDs -> Virtual Users (Representatives)
        """
        try:
            if user_id > 0:
                return User.query.get(user_id)
            else:
                rep_id = abs(user_id)
                rep = Representative.query.get(rep_id)
                if rep:
                    children = Child.query.filter_by(family_id=rep.family_id).all()
                    return VirtualUser(rep, children)
                return None
        except Exception as e:
            print(f"[IdentityResolver] Error fetching user {user_id}: {e}")
            return None

    @staticmethod
    def resolve_from_phone(phone: str, license_id: int) -> dict:
        """
        Resolve user identity from WhatsApp phone number with O(1) Hash Cache.
        """
        phone_clean = phone.replace(" ", "").replace("-", "")
        cache_key = ('whatsapp', phone_clean, license_id)
        cached_result = IdentityResolver._get_from_cache(cache_key)
        if cached_result:
            return cached_result

        db.session.rollback()
        
        phone_search = phone_clean
        print(f"[IdentityResolver] Resolving phone: {phone_search} for License: {license_id}")

        # 1. Check if this is the configured License Admin phone
        license_obj = License.query.get(license_id)
        if license_obj and license_obj.whatsapp_admin_phone:
            admin_phone = license_obj.whatsapp_admin_phone.replace(" ", "").replace("-", "")
            if phone_search.replace("+", "") == admin_phone.replace("+", ""):
                from models.license import LicenseAdmin
                license_admin_record = LicenseAdmin.query.filter_by(license_id=license_id, is_active=True).first()
                if license_admin_record and license_admin_record.user:
                    print(f"[IdentityResolver] Authenticated via License Admin Phone: {phone}")
                    res = IdentityResolver._build_identity_response(license_admin_record.user)
                    IdentityResolver._set_cache(cache_key, res)
                    return res

        
        # 2. Search in System Users (including License Admins)
        tenants = Tenant.query.filter_by(license_id=license_id).all()
        tenant_ids = [t.id for t in tenants]
        
        from sqlalchemy import or_
        from models.license import LicenseAdmin
        
        # Obtener los IDs de usuario de los administradores de esta licencia
        license_admin_user_ids = [
            la.user_id for la in LicenseAdmin.query.filter_by(license_id=license_id, is_active=True).all()
        ]
        
        # El usuario debe pertenecer a uno de los tenants de la licencia O ser un administrador global de ella
        scope_condition = User.tenant_id.in_(tenant_ids) if tenant_ids else False
        if license_admin_user_ids:
            scope_condition = or_(User.tenant_id.in_(tenant_ids), User.id.in_(license_admin_user_ids))
            
        user = User.query.filter(
            or_(
                User.phone.like(f"%{phone_search.replace('+','')}%"), 
                User.whatsapp_phone.like(f"%{phone_search.replace('+','')}%")
            ),
            scope_condition,
            User.is_active == True
        ).first()
        
        if user:
            print(f"[IdentityResolver] Found System User: {user.id}")
            return IdentityResolver._build_identity_response(user)

        # 3. Fallback: Search in Representatives (Implicit Parents)
        print(f"[IdentityResolver] User not found. Searching in Representatives...")
        
        try:
            # Join Representative -> Family to filter by Tenant (License Scope)
            rep = Representative.query.join(Family).filter(
                Representative.phone.like(f"%{phone_search.replace('+','')}%"),
                Family.tenant_id.in_(tenant_ids)
            ).first()
            
            if rep:
                print(f"[IdentityResolver] Found Representative: {rep.full_name} (ID: {rep.id})")
                
                # Fetch children for this representative
                children = Child.query.filter_by(family_id=rep.family_id).all()
                child_ids = [c.id for c in children]
                
                if not child_ids:
                     print(f"[IdentityResolver] Representative found but has no linked children.")
                     return IdentityResolver._not_found_response()
                
                # Create Virtual Identity Response
                return {
                    'found': True,
                    'user_id': -rep.id, # Negative ID
                    'user_name': rep.full_name,
                    'role': 'padre',
                    'tenant_id': rep.family.tenant_id,
                    'permissions': {
                        'can_view_all_centers': False,
                        'can_view_all_children': False,
                        'can_view_attendance': True,
                        'can_view_health': True,
                        'can_view_financials': False,
                        'can_manage_appointments': False,
                        'scope': 'child',
                        'scope_id': child_ids
                    },
                    'child_ids': child_ids,
                    'is_virtual': True
                }
        except Exception as e:
            print(f"[IdentityResolver] Error searching representatives: {e}")

        return IdentityResolver._not_found_response()
    
    @staticmethod
    def _not_found_response():
        return {
            'found': False,
            'user_id': None,
            'role': 'unknown',
            'permissions': IdentityResolver._get_unknown_permissions()
        }

    @staticmethod
    def resolve_from_telegram(chat_id: str) -> dict:
        """Resolve from Telegram Chat ID"""
        db.session.rollback()
        user = User.query.filter(
            User.telegram_chat_id == str(chat_id),
            User.is_active == True
        ).first()
        
        if not user:
            return IdentityResolver._not_found_response()
        
        return IdentityResolver._build_identity_response(user)
    
    @staticmethod
    def link_telegram_account(link_code: str, chat_id: str) -> dict:
        """Link a Telegram chat_id to a user account."""
        db.session.rollback()
        user = User.query.filter(
            User.telegram_link_code == link_code,
            User.is_active == True
        ).first()
        
        if not user:
            return {'success': False, 'error': 'Código inválido'}
        
        existing = User.query.filter(User.telegram_chat_id == str(chat_id), User.id != user.id).first()
        if existing:
            return {'success': False, 'error': 'Cuenta ya vinculada'}
        
        user.telegram_chat_id = str(chat_id)
        user.telegram_link_code = None
        db.session.commit()
        
        return {
            'success': True,
            'user_id': user.id,
            'user_name': user.full_name,
            'role': user.role.name if user.role else 'unknown'
        }
    
    @staticmethod
    def generate_telegram_link_code(user_id: int) -> str:
        import secrets
        db.session.rollback()
        user = User.query.get(user_id)
        if not user: return None
        code = secrets.token_hex(4).upper()
        user.telegram_link_code = code
        db.session.commit()
        return code
    
    @staticmethod
    def _build_identity_response(user: User) -> dict:
        """Build the identity response with permissions based on role."""
        role_name = user.role.name if user.role else 'unknown'
        
        # Get License Info
        license_id = IdentityResolver._get_user_license_id(user)
        license_name = None
        legal_name = None
        ruc = None
        centers_list = []
        
        if license_id:
            license_obj = License.query.get(license_id)
            if license_obj:
                license_name = license_obj.name
                legal_name = license_obj.legal_name
                ruc = license_obj.ruc
                
                # If admin, get all centers
                if role_name == 'license_admin':
                    centers_list = [t.name for t in license_obj.centers.filter_by(is_active=True).all()]
                elif user.tenant_id:
                    # If single center user
                    from models.tenant import Tenant
                    t = Tenant.query.get(user.tenant_id)
                    if t:
                        centers_list = [t.name]

        response = {
            'found': True,
            'user_id': user.id,
            'user_name': user.full_name,
            'role': role_name,
            'tenant_id': user.tenant_id,
            'license_id': license_id,
            'license_name': license_name,
            'legal_name': legal_name,
            'ruc': ruc,
            'centers_list': centers_list,
            'permissions': IdentityResolver._get_permissions_for_role(role_name, user)
        }
        
        if role_name == 'padre':
            response['child_ids'] = IdentityResolver._get_parent_children(user.id)
        if role_name in ['educadora', 'educator']:
            response['child_ids'] = IdentityResolver._get_educator_assigned_children(user.id)
        
        return response
    
    @staticmethod
    def _get_permissions_for_role(role_name: str, user: User) -> dict:
        """Get permission set based on role."""
        universal_roles = ['doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor']
        
        if role_name == 'license_admin' or role_name in universal_roles:
            return {
                'can_view_all_centers': True, 
                'scope': 'license', 
                'scope_id': IdentityResolver._get_user_license_id(user)
            }
        
        if role_name in ['center_coordinator', 'educadora', 'coordinator']:
             return {'can_view_all_centers': False, 'scope': 'center', 'scope_id': user.tenant_id}
        
        if role_name == 'padre':
            return {
                'can_view_all_centers': False,
                'scope': 'child',
                'scope_id': IdentityResolver._get_parent_children(user.id)
            }
        
        return IdentityResolver._get_unknown_permissions()
    
    @staticmethod
    def _get_unknown_permissions() -> dict:
        return {'scope': None, 'scope_id': None}
    
    @staticmethod
    def _get_user_license_id(user: User) -> int:
        # Check license_admins table first (for admins and universal roles)
        from models.license import LicenseAdmin
        admin = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
        if admin:
            return admin.license_id
            
        # Fallback to tenant license if user is center-bound
        if user.tenant_id:
            tenant = Tenant.query.get(user.tenant_id)
            return tenant.license_id if tenant else None
            
        return None
    
    @staticmethod
    def _get_educator_assigned_children(educator_user_id: int) -> list:
        """Get child IDs assigned to this educator (assigned_educator_id)."""
        try:
            children = Child.query.filter_by(
                assigned_educator_id=educator_user_id,
                status='activo'
            ).all()
            return [c.id for c in children]
        except Exception as e:
            print(f"[IdentityResolver] Error getting assigned children for educator {educator_user_id}: {e}")
            return []

    @staticmethod
    def _get_parent_children(parent_user_id: int) -> list:
        """
        Get child IDs for a REAL user who is a parent.
        Since we don't have a direct 'child_parents' table that works, we rely on:
        User.email -> Representative.email -> Family -> Children
        """
        try:
            user = User.query.get(parent_user_id)
            if not user or not user.email:
                return []
                
            # Find representative with this email
            rep = Representative.query.filter_by(email=user.email).first()
            if rep and rep.family:
                children = rep.family.children.all()
                return [c.id for c in children]
            
            return []
        except Exception as e:
            print(f"[IdentityResolver] Error getting children for user {parent_user_id}: {e}")
            return []
