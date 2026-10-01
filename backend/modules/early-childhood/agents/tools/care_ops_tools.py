"""
Care & Ops Tools — IDII/hitos, salud/vacunas, raciones, CMCI, monitoreo,
notificaciones, documentos/knowledge, geo y canales/plantillas/broadcast.
"""
from langchain.tools import BaseTool
from datetime import date
import logging

logger = logging.getLogger(__name__)


def _scope_ids(tenant_id, user_id):
    from agents.tools.analytics_tools import resolve_tenant_ids
    return resolve_tenant_ids(tenant_id, user_id)


class ManageMilestonesTool(BaseTool):
    name: str = "manage_milestones"
    description: str = (
        "Gestiona seguimiento IDII/hitos: catálogo, registrar, progreso del niño, alertas/rezagados. "
        "Input: {'action':'catalog|record|progress|alerts', 'tenant_id':1, 'user_id':1, "
        "'child_name':'...', 'milestone_description':'...', 'domain':'lenguaje|vinculacion_emocional|"
        "descubrimiento_natural_cultural|expresion_corporal', "
        "'achievement_level':'adquirido|consolidado|en_proceso|no_iniciado'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.milestone import Milestone
        from models.child import Child
        action = (kwargs.get("action") or "progress").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            if action == "catalog":
                try:
                    from services.milestones_catalog import get_catalog  # type: ignore
                    return {"success": True, "catalogo": get_catalog()}
                except Exception:
                    rows = db.session.query(Milestone.domain, Milestone.milestone_description).distinct().limit(100).all()
                    return {"success": True, "catalogo": [{"dominio": r[0], "hito": r[1]} for r in rows]}
            # ubicar niño si se da nombre
            child = None
            nm = (kwargs.get("child_name") or "").strip().lower()
            if nm:
                for c in Child.query.filter(Child.tenant_id.in_(target_ids), Child.status == "activo").all():
                    if nm in c.first_name.lower() or nm in c.full_name.lower():
                        child = c
                        break
            if action == "record":
                if not child:
                    return {"success": False, "error": "Indícame el nombre del niño para registrar el hito."}
                desc = kwargs.get("milestone_description") or kwargs.get("description")
                if not desc:
                    return {"success": False, "error": "Falta milestone_description."}
                valid_domains = {"vinculacion_emocional", "descubrimiento_natural_cultural",
                                 "expresion_corporal", "lenguaje"}
                valid_levels = {"no_iniciado", "en_proceso", "adquirido", "consolidado"}
                domain = (kwargs.get("domain") or "lenguaje")
                if domain not in valid_domains:
                    return {"success": False, "error": f"domain inválido. Use uno de: {sorted(valid_domains)}"}
                level = (kwargs.get("achievement_level") or "adquirido")
                if level not in valid_levels:
                    return {"success": False, "error": f"achievement_level inválido. Use uno de: {sorted(valid_levels)}"}
                reg_id = kwargs.get("user_id")
                try:
                    reg_id = int(reg_id) if reg_id and int(reg_id) > 0 else None
                except (TypeError, ValueError):
                    reg_id = None
                m = Milestone(tenant_id=child.tenant_id, child_id=child.id, record_date=date.today(),
                              domain=domain, milestone_description=desc,
                              achievement_level=level,
                              registered_by_id=reg_id)
                db.session.add(m)
                db.session.commit()
                return {"success": True, "message": f"Hito registrado a {child.full_name}: {desc}."}
            if action == "progress":
                if not child:
                    return {"success": False, "error": "Indícame el nombre del niño para ver su progreso."}
                recs = Milestone.query.filter_by(child_id=child.id).order_by(Milestone.record_date.desc()).limit(30).all()
                return {"success": True, "nino": child.full_name, "total": len(recs),
                        "hitos": [{"fecha": str(r.record_date), "dominio": r.domain,
                                   "hito": r.milestone_description, "nivel": r.achievement_level} for r in recs]}
            if action == "alerts":
                q = Milestone.query.filter(Milestone.tenant_id.in_(target_ids),
                                           Milestone.achievement_level.in_(["no_iniciado", "en_proceso"]))
                if child:
                    q = q.filter_by(child_id=child.id)
                rows = q.order_by(Milestone.record_date.desc()).limit(50).all()
                return {"success": True, "count": len(rows), "alertas": [
                    {"child_id": r.child_id, "hito": r.milestone_description, "nivel": r.achievement_level,
                     "fecha": str(r.record_date)} for r in rows]}
            return {"success": False, "error": "Use: catalog|record|progress|alerts"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageHealthVaccinesTool(BaseTool):
    name: str = "manage_health_vaccines"
    description: str = (
        "Salud y vacunas: pendientes, crecimiento del niño, registrar evento, perfil médico. "
        "Input: {'action':'pending|growth|record|profile', 'tenant_id':1, 'user_id':1, "
        "'child_name':'...', 'record_type':'vacunacion|crecimiento|enfermedad|incidente', "
        "'vaccine_name':'BCG', 'weight':10.5, 'height':80}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.health import HealthRecord, Vaccine, MedicalProfile
        from models.child import Child
        action = (kwargs.get("action") or "pending").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            child = None
            nm = (kwargs.get("child_name") or "").strip().lower()
            if nm:
                for c in Child.query.filter(Child.tenant_id.in_(target_ids), Child.status == "activo").all():
                    if nm in c.first_name.lower() or nm in c.full_name.lower():
                        child = c
                        break
            if action == "pending":
                q = Vaccine.query.filter(Vaccine.tenant_id.in_(target_ids))
                try:
                    q = q.filter(Vaccine.status == "pendiente")
                except Exception:
                    pass
                if child:
                    q = q.filter_by(child_id=child.id)
                rows = q.limit(50).all()
                return {"success": True, "count": len(rows), "pendientes": [
                    {"child_id": v.child_id, "vacuna": v.vaccine_name, "dosis": getattr(v, "dose_number", None),
                     "proxima": str(getattr(v, "next_dose_date", "") or "")} for v in rows]}
            if action == "growth":
                if not child:
                    return {"success": False, "error": "Indícame el nombre del niño."}
                recs = HealthRecord.query.filter_by(child_id=child.id, record_type="crecimiento").order_by(
                    HealthRecord.record_date.desc()).limit(10).all()
                return {"success": True, "nino": child.full_name, "controles": [
                    {"fecha": str(r.record_date), "peso": float(r.weight) if r.weight else None,
                     "talla": float(r.height) if r.height else None} for r in recs]}
            if action == "profile":
                if not child:
                    return {"success": False, "error": "Indícame el nombre del niño."}
                p = MedicalProfile.query.filter_by(child_id=child.id).first()
                return {"success": True, "nino": child.full_name,
                        "perfil": {"alergias": getattr(p, "allergies", None), "cronicas": getattr(p, "chronic_conditions", None),
                                   "pediatra": getattr(p, "pediatrician_name", None)} if p else "Sin perfil médico."}
            if action == "record":
                if not child:
                    return {"success": False, "error": "Indícame el nombre del niño."}
                try:
                    reg_id = int(kwargs.get("user_id")) if kwargs.get("user_id") else None
                    reg_id = reg_id if reg_id and reg_id > 0 else None
                except (TypeError, ValueError):
                    reg_id = None
                r = HealthRecord(tenant_id=child.tenant_id, child_id=child.id, record_date=date.today(),
                                 record_type=kwargs.get("record_type", "crecimiento"),
                                 weight=kwargs.get("weight"), height=kwargs.get("height"),
                                 symptoms=kwargs.get("symptoms"), notes=kwargs.get("notes", ""),
                                 registered_by_id=reg_id)
                db.session.add(r)
                db.session.commit()
                return {"success": True, "message": f"Registro {r.record_type} guardado para {child.full_name}."}
            return {"success": False, "error": "Use: pending|growth|record|profile"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageRationsTool(BaseTool):
    name: str = "manage_rations"
    description: str = (
        "Nutrición operativa: menú de hoy, raciones del día, registrar ración/bulk, alertas de consumo. "
        "Input: {'action':'menu_today|day|create|bulk|alerts', 'tenant_id':1, 'user_id':1, "
        "'meal_type':'almuerzo', 'child_name':'...', 'consumption_level':'todo|poco|nada'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.nutrition import NutritionDaily, Menu, NutritionAlert
        from models.child import Child
        action = (kwargs.get("action") or "day").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            today = date.today()
            if action == "menu_today":
                menus = Menu.query.filter(Menu.tenant_id.in_(target_ids)).limit(20).all()
                return {"success": True, "menus": [
                    {"id": m.id, "comida": getattr(m, "meal_type", None), "descripcion": getattr(m, "description", None)} for m in menus]}
            if action == "day":
                rows = NutritionDaily.query.filter(NutritionDaily.tenant_id.in_(target_ids),
                                                   NutritionDaily.date == today).limit(100).all()
                return {"success": True, "fecha": str(today), "count": len(rows), "raciones": [
                    {"child_id": r.child_id, "comida": r.meal_type, "consumo": r.consumption_level} for r in rows]}
            if action == "alerts":
                rows = NutritionAlert.query.filter(NutritionAlert.tenant_id.in_(target_ids)).order_by(
                    NutritionAlert.id.desc()).limit(30).all() if hasattr(NutritionAlert, "id") else []
                low = NutritionDaily.query.filter(NutritionDaily.tenant_id.in_(target_ids),
                                                  NutritionDaily.date == today,
                                                  NutritionDaily.consumption_level.in_(["poco", "nada"])).limit(50).all()
                return {"success": True, "bajo_consumo_hoy": [
                    {"child_id": r.child_id, "comida": r.meal_type, "consumo": r.consumption_level} for r in low],
                    "alertas": len(rows)}
            if action in ("create", "bulk"):
                items = kwargs.get("items") or [kwargs]
                try:
                    reg_id = int(kwargs.get("user_id")) if kwargs.get("user_id") else None
                    reg_id = reg_id if reg_id and reg_id > 0 else None
                except (TypeError, ValueError):
                    reg_id = None
                created = 0
                for it in items:
                    nm = (it.get("child_name") or "").strip().lower()
                    child = None
                    if it.get("child_id"):
                        child = Child.query.get(int(it.get("child_id")))
                    elif nm:
                        for c in Child.query.filter(Child.tenant_id.in_(target_ids), Child.status == "activo").all():
                            if nm in c.first_name.lower() or nm in c.full_name.lower():
                                child = c
                                break
                    if not child:
                        continue
                    db.session.add(NutritionDaily(tenant_id=child.tenant_id, child_id=child.id, date=today,
                                                 meal_type=it.get("meal_type", "almuerzo"),
                                                 consumption_level=it.get("consumption_level", "todo"),
                                                 notes=it.get("notes", ""), registered_by_id=reg_id))
                    created += 1
                db.session.commit()
                return {"success": True, "message": f"{created} raciones registradas."}
            return {"success": False, "error": "Use: menu_today|day|create|bulk|alerts"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageCMCITool(BaseTool):
    name: str = "manage_cmci"
    description: str = (
        "CMCI admisión: listar fichas, priorización, explicación ML, reportes mensuales, exportar matriz. "
        "Input: {'action':'fichas|priorizacion|ml_explain|monthly_list|compose_monthly|export', "
        "'tenant_id':1, 'user_id':1, 'assessment_id':7, 'matrix':'socioeconomica|vulnerabilidad'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        action = (kwargs.get("action") or "fichas").lower()
        try:
            from models.cmci import VulnerabilityAssessment, SocioeconomicAssessment, MonthlyReport
            if action == "fichas":
                matrix = (kwargs.get("matrix") or "vulnerabilidad").lower()
                Model = VulnerabilityAssessment if "vuln" in matrix else SocioeconomicAssessment
                rows = Model.query.filter(Model.tenant_id.in_(target_ids)).order_by(Model.id.desc()).limit(30).all() \
                    if hasattr(Model, "tenant_id") else Model.query.order_by(Model.id.desc()).limit(30).all()
                return {"success": True, "count": len(rows),
                        "fichas": [{"id": r.id, "puntaje": getattr(r, "vulnerability_score", getattr(r, "score", None))} for r in rows]}
            if action == "priorizacion":
                try:
                    from services.priority_service import rank_families  # type: ignore
                    return {"success": True, "priorizacion": rank_families(target_ids)}
                except Exception:
                    rows = VulnerabilityAssessment.query.order_by(VulnerabilityAssessment.id.desc()).limit(20).all() \
                        if hasattr(VulnerabilityAssessment, "id") else []
                    return {"success": True, "priorizacion": [{"id": r.id} for r in rows],
                            "nota": "Ranking básico (priority_service no disponible)."}
            if action == "ml_explain":
                aid = kwargs.get("assessment_id")
                if not aid:
                    return {"success": False, "error": "assessment_id requerido."}
                try:
                    from services.ml_calibrator import explain  # type: ignore
                    return {"success": True, "explicacion": explain(int(aid))}
                except Exception as e:
                    return {"success": False, "error": f"ML no disponible: {e}"}
            if action == "monthly_list":
                rows = MonthlyReport.query.order_by(MonthlyReport.id.desc()).limit(20).all()
                return {"success": True, "reportes": [{"id": r.id, "periodo": getattr(r, "period", None)} for r in rows]}
            if action == "compose_monthly":
                try:
                    from services.monthly_report_service import compose  # type: ignore
                    return {"success": True, "reporte": compose(target_ids, kwargs.get("period"))}
                except Exception as e:
                    return {"success": False, "error": f"No se pudo componer: {e}"}
            if action == "export":
                return {"success": True, "hint": "Descarga la matriz desde Reportes > Exportar. Matrix: " + str(kwargs.get("matrix", "socioeconomica"))}
            return {"success": False, "error": "Use: fichas|priorizacion|ml_explain|monthly_list|compose_monthly|export"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageMonitoringStaffTool(BaseTool):
    name: str = "manage_monitoring_staff"
    description: str = (
        "Monitoreo y delegación: KPIs, tendencia asistencia, comparativa centros, carga educadoras, delegar tarea. "
        "Input: {'action':'kpis|attendance_trend|centers_compare|staff_load|delegate', 'tenant_id':1, "
        "'user_id':1, 'assignee':'Ana', 'task':'...'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models.child import Child
        from models.attendance import Attendance
        from models.user import User
        from datetime import timedelta
        action = (kwargs.get("action") or "kpis").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            today = date.today()
            if action == "kpis":
                activos = Child.query.filter(Child.tenant_id.in_(target_ids), Child.status == "activo").count()
                hoy = Attendance.query.filter(Attendance.tenant_id.in_(target_ids), Attendance.date == today).all()
                presentes = sum(1 for a in hoy if a.status == "presente")
                return {"success": True, "activos": activos, "registros_hoy": len(hoy),
                        "presentes_hoy": presentes, "cobertura_hoy": f"{round(presentes / activos * 100, 1)}%" if activos else "0%"}
            if action == "attendance_trend":
                start = today - timedelta(days=14)
                rows = Attendance.query.filter(Attendance.tenant_id.in_(target_ids), Attendance.date >= start).all()
                por_dia: dict = {}
                for r in rows:
                    por_dia.setdefault(str(r.date), {"total": 0, "presentes": 0})
                    por_dia[str(r.date)]["total"] += 1
                    if r.status == "presente":
                        por_dia[str(r.date)]["presentes"] += 1
                return {"success": True, "tendencia_14d": por_dia}
            if action == "centers_compare":
                out = []
                for cid in target_ids:
                    activos = Child.query.filter_by(tenant_id=cid, status="activo").count()
                    out.append({"center_id": cid, "activos": activos})
                return {"success": True, "comparativa": out}
            if action == "staff_load":
                staff = User.query.filter(User.tenant_id.in_(target_ids), User.is_active == True).limit(50).all()  # noqa
                rows = []
                for u in staff:
                    n = Child.query.filter_by(assigned_educator_id=u.id, status="activo").count()
                    rows.append({"id": u.id, "nombre": u.full_name, "rol": u.role.name if u.role else None, "ninos": n})
                return {"success": True, "staff": sorted(rows, key=lambda x: x["ninos"], reverse=True)}
            if action == "delegate":
                return {"success": True, "message": f"Tarea delegada a {kwargs.get('assignee', 'equipo')}: {kwargs.get('task', '')}. Regístrala en Operaciones para seguimiento."}
            return {"success": False, "error": "Use: kpis|attendance_trend|centers_compare|staff_load|delegate"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageNotificationsTool(BaseTool):
    name: str = "manage_notifications"
    description: str = (
        "Notificaciones: listar, crear, marcar leída, eliminar. "
        "Input: {'action':'list|create|read|delete', 'tenant_id':1, 'user_id':1, "
        "'notif_id':4, 'title':'...', 'description':'...'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.notification import Notification
        action = (kwargs.get("action") or "list").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            if action == "list":
                rows = Notification.query.filter(Notification.tenant_id.in_(target_ids)).order_by(
                    Notification.id.desc()).limit(30).all()
                return {"success": True, "notificaciones": [
                    {"id": n.id, "titulo": n.title, "leida": n.read} for n in rows]}
            if action == "create":
                n = Notification(tenant_id=int(target_ids[0]), title=kwargs.get("title", "Aviso"),
                                 description=kwargs.get("description", ""), user_id=kwargs.get("user_id"),
                                 created_by_id=kwargs.get("user_id"))
                db.session.add(n)
                db.session.commit()
                return {"success": True, "message": "Notificación creada.", "notif_id": n.id}
            nid = kwargs.get("notif_id")
            n = Notification.query.get(int(nid)) if nid else None
            if not n or (n.tenant_id not in target_ids):
                return {"success": False, "error": "Notificación fuera de alcance."}
            if action == "read":
                n.read = True
                db.session.commit()
                return {"success": True, "message": "Marcada como leída."}
            if action == "delete":
                db.session.delete(n)
                db.session.commit()
                return {"success": True, "message": "Notificación eliminada."}
            return {"success": False, "error": "Use: list|create|read|delete"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageDocumentsKnowledgeTool(BaseTool):
    name: str = "manage_documents_knowledge"
    description: str = (
        "Documentos y base de conocimiento: listar docs, listar knowledge, eliminar knowledge. "
        "(Subir archivos se hace desde el widget con adjunto.) "
        "Input: {'action':'docs_list|knowledge_list|knowledge_delete', 'tenant_id':1, 'user_id':1, 'doc_id':3}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.document import Document
        from models.knowledge import KnowledgeDocument
        action = (kwargs.get("action") or "knowledge_list").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        try:
            if action == "docs_list":
                rows = Document.query.order_by(Document.id.desc()).limit(30).all()
                return {"success": True, "documentos": [{"id": d.id, "nombre": getattr(d, "filename", getattr(d, "title", d.id))} for d in rows]}
            if action == "knowledge_list":
                rows = KnowledgeDocument.query.order_by(KnowledgeDocument.id.desc()).limit(30).all()
                return {"success": True, "knowledge": [
                    {"id": d.id, "titulo": getattr(d, "title", d.id)} for d in rows]}
            if action == "knowledge_delete":
                d = KnowledgeDocument.query.get(int(kwargs.get("doc_id"))) if kwargs.get("doc_id") else None
                if not d:
                    return {"success": False, "error": "doc_id requerido."}
                db.session.delete(d)
                db.session.commit()
                return {"success": True, "message": "Documento de conocimiento eliminado."}
            return {"success": False, "error": "Use: docs_list|knowledge_list|knowledge_delete"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ManageGeoChannelsTool(BaseTool):
    name: str = "manage_geo_channels"
    description: str = (
        "Geo + canales + plantillas + broadcast: puntos/capas/cercas, estado whatsapp/telegram, "
        "plantillas (listar/crear), difundir mensaje. Input: {'action':'geo_points|geo_create|channels_status|"
        "templates_list|template_create|broadcast', 'tenant_id':1, 'user_id':1, 'message':'...', "
        "'name':'...', 'latitude':-2.1, 'longitude':-79.9}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        action = (kwargs.get("action") or "channels_status").lower()
        target_ids = _scope_ids(kwargs.get("tenant_id"), kwargs.get("user_id"))
        if not target_ids:
            return {"success": False, "error": "Sin centros asignados."}
        try:
            if action == "geo_points":
                from models.geo_intelligence import GeoPoint
                rows = GeoPoint.query.limit(50).all()
                return {"success": True, "puntos": [
                    {"id": p.id, "nombre": p.name, "lat": p.latitude, "lng": p.longitude} for p in rows]}
            if action == "geo_create":
                from models.geo_intelligence import GeoPoint
                if kwargs.get("latitude") is None or kwargs.get("longitude") is None:
                    return {"success": False, "error": "latitude y longitude requeridos."}
                p = GeoPoint(name=kwargs.get("name", "Punto"), tenant_id=int(target_ids[0]),
                             latitude=float(kwargs.get("latitude")), longitude=float(kwargs.get("longitude")),
                             point_type=kwargs.get("point_type", "custom"), description=kwargs.get("description", ""))
                db.session.add(p)
                db.session.commit()
                return {"success": True, "message": "Punto geo creado.", "point_id": p.id}
            if action == "channels_status":
                return {"success": True, "hint": "Ver estado en Canales > Dashboard. WhatsApp/Telegram se gestionan con manage_channels."}
            if action == "templates_list":
                try:
                    from models.channel_template import ChannelTemplate
                    rows = ChannelTemplate.query.limit(30).all()
                    return {"success": True, "plantillas": [{"id": t.id, "nombre": getattr(t, "name", t.id)} for t in rows]}
                except Exception:
                    return {"success": True, "plantillas": [], "nota": "Sin tabla de plantillas."}
            if action == "template_create":
                try:
                    from models.channel_template import ChannelTemplate
                    from utils.role_helpers import get_license_id_for_user
                    from services.identity_resolver import IdentityResolver
                    me = IdentityResolver.get_user_or_virtual(int(kwargs.get("user_id"))) if kwargs.get("user_id") else None
                    lic_id = kwargs.get("license_id") or (get_license_id_for_user(me) if me else None)
                    t = ChannelTemplate(name=kwargs.get("name", "Plantilla"),
                                        description=kwargs.get("description", ""),
                                        content=kwargs.get("message", ""),
                                        channel=kwargs.get("channel", "whatsapp"),
                                        license_id=int(lic_id) if lic_id else None,
                                        is_active=True)
                    db.session.add(t)
                    db.session.commit()
                    return {"success": True, "message": "Plantilla creada."}
                except Exception as e:
                    return {"success": False, "error": f"No se pudo crear plantilla: {e}"}
            if action == "broadcast":
                msg = (kwargs.get("message") or "").strip()
                if not msg:
                    return {"success": False, "error": "message requerido para difundir."}
                try:
                    from agents.tools.messaging_tools import SendWhatsAppMessageTool  # noqa
                except Exception:
                    pass
                return {"success": True, "message": f"Broadcast preparado para {len(target_ids)} centro(s). Confirma destinatarios (padres/equipo) y lo envío por WhatsApp.",
                        "texto": msg}
            return {"success": False, "error": "Use: geo_points|geo_create|channels_status|templates_list|template_create|broadcast"}
        except Exception as e:
            return {"success": False, "error": str(e)}
