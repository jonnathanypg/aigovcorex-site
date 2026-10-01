"""
Org Admin Tools — gestión de personas, centros, familias y solicitudes.
Cobertura: api/users.py, api/license_admin.py, api/children.py (familia),
api/applications.py. Solo lectura/escritura con RBAC por rol.
"""
from langchain.tools import BaseTool
import logging

logger = logging.getLogger(__name__)


def _scope_ids(tenant_id, user_id):
    from agents.tools.analytics_tools import resolve_tenant_ids
    return resolve_tenant_ids(tenant_id, user_id)


def _is_admin(user) -> bool:
    role = (getattr(getattr(user, "role", None), "name", "") or "").lower()
    return role in ("super_admin", "license_admin", "admin")


class ManageUsersTool(BaseTool):
    name: str = "manage_users"
    description: str = (
        "Gestiona usuarios/staff: listar, ver perfil, crear, desactivar/activar. "
        "Input: {'action':'list|get|create|deactivate|activate', 'tenant_id':1, 'user_id':1, "
        "'target_user_id':2, 'email':'a@b.com', 'first_name':'Ana', 'last_name':'Paz', "
        "'role':'educator', 'phone':'099...'} Roles válidos: educator, coordinator, "
        "nutritionist, doctor, social_worker, administrative, supervisor."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.user import User, Role
        from services.identity_resolver import IdentityResolver

        action = (kwargs.get("action") or "list").lower()
        user_id = kwargs.get("user_id")
        tenant_id = kwargs.get("tenant_id")
        me = IdentityResolver.get_user_or_virtual(int(user_id)) if user_id else None
        if not me:
            return {"success": False, "error": "user_id inválido."}
        target_ids = _scope_ids(tenant_id, user_id)
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}

        try:
            if action == "list":
                users = User.query.filter(User.tenant_id.in_(target_ids), User.is_active == True).limit(100).all()  # noqa
                return {"success": True, "count": len(users),
                        "users": [{"id": u.id, "nombre": u.full_name, "email": u.email,
                                   "rol": u.role.name if u.role else None, "tenant_id": u.tenant_id} for u in users]}
            if action == "get":
                tid = kwargs.get("target_user_id")
                u = User.query.get(int(tid)) if tid else None
                if not u or (u.tenant_id not in target_ids):
                    return {"success": False, "error": "Usuario no encontrado en tu alcance."}
                return {"success": True, "user": u.to_dict()}
            if action in ("create", "deactivate", "activate"):
                if not _is_admin(me):
                    return {"success": False, "error": "Solo administradores (super_admin/license_admin) pueden modificar usuarios."}
                if action == "create":
                    email = (kwargs.get("email") or "").strip()
                    if not email:
                        return {"success": False, "error": "email es requerido."}
                    if User.query.filter_by(email=email).first():
                        return {"success": False, "error": "Ese email ya existe."}
                    role = Role.query.filter_by(name=kwargs.get("role", "educator")).first()
                    if not role:
                        return {"success": False, "error": "Rol inválido."}
                    u = User(tenant_id=int(target_ids[0]), role_id=role.id, email=email,
                             first_name=kwargs.get("first_name", "Nuevo"), last_name=kwargs.get("last_name", "Usuario"),
                             phone=kwargs.get("phone"), password_hash="!", is_active=True)
                    u.set_password("Cambiar123*")
                    db.session.add(u)
                    db.session.commit()
                    return {"success": True, "message": f"Usuario {u.full_name} creado (clave temporal: Cambiar123*).", "user_id": u.id}
                tid = kwargs.get("target_user_id")
                u = User.query.get(int(tid)) if tid else None
                if not u or (u.tenant_id not in target_ids):
                    return {"success": False, "error": "Usuario fuera de alcance."}
                u.is_active = (action == "activate")
                db.session.commit()
                return {"success": True, "message": f"Usuario {u.full_name} {'activado' if u.is_active else 'desactivado'}."}
            return {"success": False, "error": f"Acción '{action}' no soportada. Use: list|get|create|deactivate|activate"}
        except Exception as e:
            try:
                from models import db as _db
                _db.session.rollback()
            except Exception:
                pass
            return {"success": False, "error": str(e)}


class ManageCentersTool(BaseTool):
    name: str = "manage_centers"
    description: str = (
        "Gestiona centros y organización: listar, ver, crear, actualizar, stats, global-stats, control territorial. "
        "Input: {'action':'list|get|create|update|stats|global_stats|territorial', 'tenant_id':1, 'user_id':1, "
        "'center_id':2, 'name':'CMCI Nuevo', 'city':'Guayaquil', 'max_capacity':50}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.tenant import Tenant
        from models.child import Child
        from models.attendance import Attendance
        from datetime import date
        from services.identity_resolver import IdentityResolver
        from utils.role_helpers import get_license_id_for_user

        action = (kwargs.get("action") or "list").lower()
        user_id = kwargs.get("user_id")
        me = IdentityResolver.get_user_or_virtual(int(user_id)) if user_id else None
        if not me:
            return {"success": False, "error": "user_id inválido."}
        target_ids = _scope_ids(kwargs.get("tenant_id"), user_id)
        if not target_ids and action not in ("global_stats",):
            return {"success": False, "error": "Sin centros asignados."}
        try:
            lic_id = get_license_id_for_user(me)
            if action == "list":
                tenants = Tenant.query.filter(Tenant.id.in_(target_ids)).all()
                return {"success": True, "centros": [
                    {"id": t.id, "nombre": t.name, "ciudad": t.city, "capacidad": t.max_capacity,
                     "inscritos": t.current_enrollment, "ocupacion": t.occupancy_rate()} for t in tenants]}
            if action == "get":
                t = Tenant.query.get(int(kwargs.get("center_id", target_ids[0])))
                if not t or (t.id not in target_ids):
                    return {"success": False, "error": "Centro fuera de alcance."}
                return {"success": True, "centro": t.to_dict()}
            if action in ("create", "update"):
                if not _is_admin(me):
                    return {"success": False, "error": "Solo administradores pueden crear/editar centros."}
                if action == "create":
                    t = Tenant(name=kwargs.get("name", "Nuevo centro"), license_id=lic_id,
                               city=kwargs.get("city"), max_capacity=int(kwargs.get("max_capacity", 50) or 50),
                               is_active=True)
                    db.session.add(t)
                    db.session.commit()
                    return {"success": True, "message": f"Centro {t.name} creado.", "center_id": t.id}
                t = Tenant.query.get(int(kwargs.get("center_id")))
                if not t or (t.id not in target_ids):
                    return {"success": False, "error": "Centro fuera de alcance."}
                for f in ("name", "city", "province", "phone", "email", "address"):
                    if kwargs.get(f) is not None:
                        setattr(t, f, kwargs.get(f))
                if kwargs.get("max_capacity") is not None:
                    t.max_capacity = int(kwargs.get("max_capacity"))
                db.session.commit()
                return {"success": True, "message": f"Centro {t.name} actualizado."}
            if action == "stats":
                cid = int(kwargs.get("center_id", target_ids[0]))
                if cid not in target_ids:
                    return {"success": False, "error": "Centro fuera de alcance."}
                today = date.today()
                activos = Child.query.filter_by(tenant_id=cid, status="activo").count()
                hoy = Attendance.query.filter_by(tenant_id=cid, date=today).all()
                presentes = sum(1 for a in hoy if a.status == "presente")
                return {"success": True, "center_id": cid, "activos": activos,
                        "registros_hoy": len(hoy), "presentes_hoy": presentes,
                        "ausentes_o_sin_registro": max(0, activos - presentes)}
            if action in ("global_stats", "territorial"):
                rows = []
                for cid in target_ids:
                    t = Tenant.query.get(cid)
                    activos = Child.query.filter_by(tenant_id=cid, status="activo").count()
                    rows.append({"center_id": cid, "nombre": t.name if t else cid,
                                 "ciudad": t.city if t else None, "activos": activos,
                                 "ocupacion": t.occupancy_rate() if t else None})
                return {"success": True, "total_centros": len(rows), "centros": rows,
                        "total_activos": sum(r["activos"] for r in rows)}
            return {"success": False, "error": "Acción no soportada. Use: list|get|create|update|stats|global_stats|territorial"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageFamilyTool(BaseTool):
    name: str = "manage_family"
    description: str = (
        "Gestiona familias y representantes: ver familia del niño, listar/actualizar representantes, "
        "actualizar contacto. Input: {'action':'view|reps|update_rep|update_contact', 'tenant_id':1, "
        "'user_id':1, 'child_name':'Juan', 'rep_id':3, 'phone':'099...', 'email':'a@b.com'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.child import Child, Representative, Family
        action = (kwargs.get("action") or "view").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            def _find_child():
                name = (kwargs.get("child_name") or "").strip().lower()
                if not name and kwargs.get("child_id"):
                    return Child.query.get(int(kwargs.get("child_id")))
                if not name:
                    return None
                cands = Child.query.filter(Child.tenant_id.in_(target_ids), Child.status == "activo").all()
                for c in cands:
                    if name in c.first_name.lower() or name in c.full_name.lower():
                        return c
                return None

            child = _find_child()
            if not child:
                return {"success": False, "error": "Indícame el nombre del niño para ubicar su familia."}
            fam = Family.query.get(child.family_id) if child.family_id else None
            reps = Representative.query.filter_by(family_id=child.family_id).all() if child.family_id else []
            if action == "view":
                return {"success": True, "nino": child.full_name,
                        "familia": {"id": fam.id if fam else None, "direccion": getattr(fam, "address", None),
                                    "telefono": getattr(fam, "phone_primary", None),
                                    "nivel": getattr(fam, "socioeconomic_level", None)} if fam else None,
                        "representantes": [{"id": r.id, "nombre": r.full_name, "parentesco": r.relationship,
                                            "telefono": r.phone, "email": r.email, "principal": r.is_primary} for r in reps]}
            if action == "reps":
                return {"success": True, "representantes": [
                    {"id": r.id, "nombre": r.full_name, "parentesco": r.relationship,
                     "telefono": r.phone, "email": r.email} for r in reps]}
            if action in ("update_rep", "update_contact"):
                r = Representative.query.get(int(kwargs.get("rep_id"))) if kwargs.get("rep_id") else (reps[0] if reps else None)
                if not r:
                    return {"success": False, "error": "Representante no encontrado."}
                if kwargs.get("phone"):
                    r.phone = kwargs.get("phone")
                if kwargs.get("email"):
                    r.email = kwargs.get("email")
                if kwargs.get("is_primary") is not None and action == "update_rep":
                    if kwargs.get("is_primary"):
                        for x in reps:
                            x.is_primary = (x.id == r.id)
                db.session.commit()
                return {"success": True, "message": f"Representante {r.full_name} actualizado ({r.phone})."}
            return {"success": False, "error": "Acción no soportada. Use: view|reps|update_rep|update_contact"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageApplicationsTool(BaseTool):
    name: str = "manage_applications"
    description: str = (
        "Gestiona solicitudes de admisión/postulación: listar, ver, aprobar, rechazar, lista de espera. "
        "Input: {'action':'list|get|approve|reject|waitlist', 'tenant_id':1, 'user_id':1, "
        "'application_id':5, 'notes':'...'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.application import Application
        from sqlalchemy import or_
        action = (kwargs.get("action") or "list").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            def _scoped(q):
                # Application usa tenant_id y center_id según origen (CMCI vs admisión)
                cols = [c.name for c in Application.__table__.columns]
                if "tenant_id" in cols:
                    return q.filter(or_(Application.tenant_id.in_(target_ids),
                                        Application.center_id.in_(target_ids) if "center_id" in cols else False))
                return q.filter(Application.center_id.in_(target_ids))
            if action == "list":
                status = kwargs.get("status")
                q = _scoped(Application.query)
                if status:
                    q = q.filter_by(status=status)
                apps = q.order_by(Application.id.desc()).limit(50).all()
                return {"success": True, "count": len(apps), "solicitudes": [
                    {"id": a.id, "estado": getattr(a, "status", None),
                     "nino": f"{getattr(a, 'child_first_name', '')} {getattr(a, 'child_last_name', '')}".strip(),
                     "centro_id": getattr(a, "tenant_id", None) or getattr(a, "center_id", None)} for a in apps]}
            aid = kwargs.get("application_id")
            app = Application.query.get(int(aid)) if aid else None
            cols = [c.name for c in Application.__table__.columns]
            scope_ok = False
            if app is not None:
                tid = getattr(app, "tenant_id", None) if "tenant_id" in cols else None
                cid = getattr(app, "center_id", None) if "center_id" in cols else None
                scope_ok = (tid in target_ids) if tid else (cid in target_ids if cid else False)
            if not app or not scope_ok:
                return {"success": False, "error": "Solicitud no encontrada en tu alcance."}
            if action == "get":
                return {"success": True, "solicitud": {"id": app.id, "estado": getattr(app, "status", None),
                                                       "tenant_id": getattr(app, "tenant_id", getattr(app, "center_id", None))}}
            mapping = {"approve": "approved", "reject": "rejected", "waitlist": "waitlist"}
            if action in mapping:
                if hasattr(app, "status"):
                    app.status = mapping[action]
                notes = kwargs.get("notes")
                if notes:
                    if hasattr(app, "decision_notes"):
                        app.decision_notes = notes
                    elif hasattr(app, "decision_notes") is False and hasattr(app, "notes"):
                        app.notes = notes
                if hasattr(app, "decision_date"):
                    from datetime import datetime as _dt
                    app.decision_date = _dt.utcnow()
                db.session.commit()
                return {"success": True, "message": f"Solicitud {app.id} marcada como {mapping[action]}."}
            return {"success": False, "error": "Acción no soportada. Use: list|get|approve|reject|waitlist"}
        except Exception as e:
            return {"success": False, "error": str(e)}
