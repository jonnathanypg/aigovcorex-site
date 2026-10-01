"""
Attendance Query Tools — respuesta determinista para "¿quién faltó hoy?"
Evita depender del SQL generado por el LLM para el caso más pedido.
"""
from langchain.tools import BaseTool
from datetime import date, datetime
from sqlalchemy import or_
import logging

logger = logging.getLogger(__name__)


def _parse_target_date(value) -> date:
    if not value or str(value).strip().lower() in ("hoy", "today", "ahora"):
        return date.today()
    v = str(value).strip().lower()
    if v == "ayer":
        from datetime import timedelta
        return date.today() - timedelta(days=1)
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except Exception:
        return date.today()


class GetAbsentChildrenTool(BaseTool):
    """Lista determinista de ausentes (status ausente + sin registro) para una fecha."""
    name: str = "get_absent_children"
    description: str = (
        "Lista los niños que NO asistieron en una fecha (ausentes registrados + sin registro de asistencia). "
        "Úsala SIEMPRE para 'quién faltó', 'quién no vino', 'ausentes de hoy/ayer', 'inasistencia'. "
        "Input: {'tenant_id': 1, 'user_id': 1, 'date': 'hoy' o 'YYYY-MM-DD' o 'ayer'}. "
        "Para license_admin, tenant_id puede omitirse para ver todos sus centros."
    )

    def _run(self, *args, **kwargs) -> dict:
        from models import db
        from models.child import Child
        from models.attendance import Attendance
        from models.tenant import Tenant

        tenant_id = kwargs.get("tenant_id")
        user_id = kwargs.get("user_id")
        target = _parse_target_date(kwargs.get("date"))

        # Resolver scope multi-tenant (unificado con role_helpers)
        try:
            from agents.tools.analytics_tools import resolve_tenant_ids
            target_ids = resolve_tenant_ids(tenant_id, user_id)
        except Exception as e:
            return {"success": False, "error": f"No se pudo resolver el centro: {e}"}

        if not target_ids:
            return {
                "success": False,
                "error": "No se encontraron centros asignados. Verifique que el usuario tiene centros activos.",
            }

        try:
            # Ping para conexiones stale
            try:
                from sqlalchemy import text
                db.session.execute(text("SELECT 1"))
            except Exception:
                db.session.rollback()
                db.session.remove()

            tenants = {t.id: t.name for t in Tenant.query.filter(Tenant.id.in_(target_ids)).all()}

            children = (
                Child.query.filter(
                    Child.tenant_id.in_(target_ids),
                    Child.status == "activo",
                )
                .order_by(Child.last_name, Child.first_name)
                .all()
            )
            if not children:
                return {
                    "success": True,
                    "date": str(target),
                    "scope": f"{len(target_ids)} centro(s)",
                    "total_activos": 0,
                    "ausentes": [],
                    "presentes_count": 0,
                    "text": "No hay niños activos en tu alcance.",
                }

            att_map = {
                a.child_id: a
                for a in Attendance.query.filter(
                    Attendance.tenant_id.in_(target_ids),
                    Attendance.date == target,
                ).all()
            }

            ausentes = []
            presentes = 0
            justificados = 0
            tardanzas = 0
            for c in children:
                a = att_map.get(c.id)
                status = a.status if a else "sin_registro"
                if status == "presente":
                    presentes += 1
                elif status == "justificado":
                    justificados += 1
                elif status == "tardanza":
                    tardanzas += 1
                else:  # ausente o sin_registro
                    ausentes.append(
                        {
                            "id": c.id,
                            "nombre": c.full_name,
                            "grupo": c.assigned_group or "Sin grupo",
                            "centro": tenants.get(c.tenant_id, f"Centro {c.tenant_id}"),
                            "estado": status,  # 'ausente' o 'sin_registro'
                        }
                    )

            return {
                "success": True,
                "date": str(target),
                "scope": f"{len(target_ids)} centro(s)",
                "total_activos": len(children),
                "presentes": presentes,
                "justificados": justificados,
                "tardanzas": tardanzas,
                "ausentes_count": len(ausentes),
                "ausentes": ausentes,
                "nota_sin_registro": "sin_registro = niño activo sin pase de asistencia ese día (presunto ausente).",
            }
        except Exception as e:
            logger.error(f"get_absent_children error: {e}")
            try:
                from models import db as _db
                _db.session.rollback()
            except Exception:
                pass
            return {"success": False, "error": str(e)}


class GetAttendanceTodayTool(BaseTool):
    """Resumen completo de asistencia de una fecha (presentes/ausentes/justificados/tardanzas)."""
    name: str = "get_attendance_today"
    description: str = (
        "Resumen de asistencia de una fecha con conteos y listados por estado. "
        "Úsala para 'resumen de asistencia de hoy', 'quién vino hoy', 'asistencia de hoy'. "
        "Input: {'tenant_id': 1, 'user_id': 1, 'date': 'hoy' o 'YYYY-MM-DD'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        tool = GetAbsentChildrenTool()
        res = tool._run(**kwargs)
        if not res.get("success"):
            return res
        # Re-etiquetar para el LLM: ya trae todo lo necesario
        res["text_hint"] = (
            f"El {res['date']}: {res['presentes']} presentes, {res['ausentes_count']} ausentes/sin registro, "
            f"{res['justificados']} justificados, {res['tardanzas']} tardanzas, sobre {res['total_activos']} activos."
        )
        return res
