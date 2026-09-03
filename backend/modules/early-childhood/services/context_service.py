"""
Context Service for AI Agents
Handles dynamic system prompt generation and RBAC data scoping
"""
from models.user import User
from models.child import Child
import os

class ContextService:
    """
    Core security layer ensuring agents only access permitted data.
    Maps User Roles -> Prompt Templates + SQL Filters
    """
    
    # Role Definitions (Normalized)
    ROLE_SUPER_ADMIN = 'super_admin'
    ROLE_LICENSE_ADMIN = 'license_admin'
    ROLE_COORDINATOR = 'coordinator'
    ROLE_EDUCATOR = 'educator'
    ROLE_PARENT = 'parent'
    
    @staticmethod
    def get_data_scope(user: User) -> dict:
        """
        Define mandatory SQL filters based on role.
        The SQL Agent MUST inject these into every query.
        """
        role_name = user.role.name if user.role else 'unknown'
        scope = {}
        
        if role_name == ContextService.ROLE_SUPER_ADMIN:
            # God mode
            scope['filter_sql'] = "1=1" 
            scope['access_level'] = 'global'
            scope['allowed_actions'] = ['select', 'insert', 'update', 'delete']
            
        elif role_name == ContextService.ROLE_LICENSE_ADMIN:
            # Full CRUD for License Admin across all their centers
            from utils.role_helpers import get_license_id_for_user
            from models.tenant import Tenant
            license_id = get_license_id_for_user(user)
            
            if license_id:
                tenants = Tenant.query.filter_by(license_id=license_id, is_active=True).all()
                tenant_ids = [str(t.id) for t in tenants]
                if tenant_ids:
                    scope['filter_sql'] = f"tenant_id IN ({','.join(tenant_ids)})"
                    scope['tenant_id'] = tenant_ids[0] # Legacy fallback for tools expecting one
                    scope['tenant_ids'] = [int(t) for t in tenant_ids]
                else:
                    scope['filter_sql'] = "1=0"
            else:
                scope['filter_sql'] = f"tenant_id = {user.tenant_id}" 
                scope['tenant_id'] = user.tenant_id
                
            scope['access_level'] = 'custom_multi_tenant'
            scope['allowed_actions'] = ['select', 'insert', 'update', 'delete']
            
        elif role_name in [ContextService.ROLE_COORDINATOR, 'center_coordinator']:
            # Coordinator: full center scope
            scope['filter_sql'] = f"tenant_id = {user.tenant_id}"
            scope['access_level'] = 'tenant_full'
            scope['allowed_actions'] = ['select', 'insert', 'update']
            scope['tenant_id'] = user.tenant_id

        elif role_name in [ContextService.ROLE_EDUCATOR, 'educadora']:
            # Educator: ONLY assigned children (child_ids from assigned_educator_id)
            child_ids = [c.id for c in Child.query.filter_by(
                tenant_id=user.tenant_id,
                assigned_educator_id=user.id,
                status='activo'
            ).all()]
            if not child_ids:
                scope['filter_sql'] = "1=0"
                scope['access_level'] = 'none'
                scope['allowed_actions'] = []
            else:
                if len(child_ids) == 1:
                    scope['filter_sql'] = f"child_id = {child_ids[0]}"
                else:
                    scope['filter_sql'] = f"child_id IN ({','.join(map(str, child_ids))})"
                scope['access_level'] = 'child_specific'
                scope['allowed_actions'] = ['select', 'insert', 'update']
                scope['child_id'] = child_ids[0]
                scope['child_ids'] = child_ids
                scope['tenant_id'] = user.tenant_id
            
        elif role_name == ContextService.ROLE_PARENT:
            # Read Only for Parents
            # Use pre-fetched child_ids from IdentityResolver (supports Real & Virtual users)
            if hasattr(user, 'child_ids') and user.child_ids:
                child_ids = user.child_ids
                # For basic SQL scope, we just pick the first one or build an IN clause?
                # The prompt generator handles list description, but for strict SQL filter:
                if len(child_ids) == 1:
                    scope['filter_sql'] = f"child_id = {child_ids[0]}"
                else:
                    scope['filter_sql'] = f"child_id IN ({','.join(map(str, child_ids))})"
                    
                scope['access_level'] = 'child_specific'
                scope['allowed_actions'] = ['select']
                scope['child_id'] = child_ids[0] # Legacy compatibility
                scope['child_ids'] = child_ids
            else:
                # Fallback: Try to fetch for Real Users if not populated (Safety net)
                from services.identity_resolver import IdentityResolver
                c_ids = IdentityResolver._get_parent_children(user.id)
                if c_ids:
                     scope['filter_sql'] = f"child_id IN ({','.join(map(str, c_ids))})"
                     scope['access_level'] = 'child_specific'
                     scope['allowed_actions'] = ['select']
                     scope['child_id'] = c_ids[0] 
                else:
                    scope['filter_sql'] = "1=0" 
                    scope['access_level'] = 'none'
                    scope['allowed_actions'] = []
        
        else:
            # Default Deny
            scope['filter_sql'] = "1=0"
            scope['access_level'] = 'none'
            scope['allowed_actions'] = []
            
        return scope

    @staticmethod
    def build_agent_context(user: User, intent: str = "general") -> str:
        """
        Load the appropriate system prompt based on Role and Intent
        """
        prompt_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prompts')
        role_name = user.role.name if user.role else 'unknown'
        
        # Select Base Prompt File
        if role_name == ContextService.ROLE_PARENT:
            filename = 'child_profile.md'
        elif intent == "sql_analysis":
            filename = 'sql_analyst.md'  # Prompt mejorado con schema real (renombrado)
        else:
            # Default Orchestrator router
            filename = 'orchestrator_system.md'
            
        try:
            with open(os.path.join(prompt_dir, filename), 'r') as f:
                template = f.read()
                
            # Dynamic Injection of Permissions
            scope = ContextService.get_data_scope(user)
            actions = ", ".join([a.upper() for a in scope.get('allowed_actions', [])])
            
            # Simple replace to update security rules text dynamically if placeholder exists,
            # or append it. Ideally we should have {{PERMISSIONS}} in the md.
            # For now, let's append a capability line.
            injected_prompt = template + f"\n\n### TUS PERMISOS ACTUALES:\nUsuario rol: {role_name}\nAcciones permitidas: {actions}\nSi la acción está en esta lista, PUEDES generarla. Ignora la restricción de 'SOLO SELECT' del prompt base si conflictuar."
            
            # Dynamic Full Schema Injection for SQL intents
            if intent == "sql_analysis":
                try:
                    from models import db
                    schema_lines = ["\n\n### DICCIONARIO DE DATOS EN TIEMPO REAL (TODAS LAS TABLAS)"]
                    for table_name, table in db.metadata.tables.items():
                        schema_lines.append(f"\n#### Tabla: `{table_name}`")
                        schema_lines.append("| Columna | Tipo | Detalles |")
                        schema_lines.append("|---------|------|----------|")
                        for col in table.columns:
                            pk = "PK" if col.primary_key else ""
                            fk = "FK" if col.foreign_keys else ""
                            nullable = "NULL" if col.nullable else "NOT NULL"
                            details = ", ".join(filter(None, [pk, fk, nullable]))
                            schema_lines.append(f"| `{col.name}` | {str(col.type)} | {details} |")
                    injected_prompt += "\n".join(schema_lines)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to inject dynamic schema: {e}")
            
            return injected_prompt
            
        except FileNotFoundError:
            return "System Error: Prompt configuration missing."
