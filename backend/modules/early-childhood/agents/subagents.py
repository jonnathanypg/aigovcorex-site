"""
Subagentes supervisores — patrón delegate.
Cada Delegate compone 2-4 tools base en UNA llamada determinista,
para que el admin pida "gestiona/analiza/delega X" y el LLM solo elija 1 ruta.
"""
from langchain.tools import BaseTool
import logging

logger = logging.getLogger(__name__)


def _call(tool_cls, **kw):
    try:
        return tool_cls()._run(**kw)  # type: ignore
    except Exception as e:
        return {"success": False, "error": str(e)}


class DelegateChildProfile(BaseTool):
    name: str = "delegate_child_profile"
    description: str = (
        "SUBAGENTE Ficha 360 del niño: resumen + familia + progreso IDII. "
        "Úsalo para 'dame todo de [niño]', 'ficha completa'. Input: {'child_name':'...', 'tenant_id':1, 'user_id':1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.langchain_tools import SearchChildTool, GetChildSummaryTool
        from agents.tools.org_admin_tools import ManageFamilyTool
        from agents.tools.care_ops_tools import ManageMilestonesTool
        tid, uid, nm = kwargs.get("tenant_id"), kwargs.get("user_id"), kwargs.get("child_name", "")
        out: dict = {"success": True, "nino": nm}
        out["busqueda"] = _call(SearchChildTool, name=nm, tenant_id=tid, user_id=uid)
        out["resumen"] = _call(GetChildSummaryTool, name=nm, tenant_id=tid, user_id=uid)
        out["familia"] = _call(ManageFamilyTool, action="view", child_name=nm, tenant_id=tid, user_id=uid)
        out["desarrollo"] = _call(ManageMilestonesTool, action="progress", child_name=nm, tenant_id=tid, user_id=uid)
        return out


class DelegateHealthNutrition(BaseTool):
    name: str = "delegate_health_nutrition"
    description: str = (
        "SUBAGENTE Salud+Nutrición: crecimiento + vacunas pendientes + raciones del día + alertas. "
        "Input: {'child_name':'...' (opcional), 'tenant_id':1, 'user_id':1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.care_ops_tools import ManageHealthVaccinesTool, ManageRationsTool
        tid, uid, nm = kwargs.get("tenant_id"), kwargs.get("user_id"), kwargs.get("child_name", "")
        return {"success": True,
                "crecimiento": _call(ManageHealthVaccinesTool, action="growth", child_name=nm, tenant_id=tid, user_id=uid) if nm else None,
                "vacunas_pendientes": _call(ManageHealthVaccinesTool, action="pending", child_name=nm, tenant_id=tid, user_id=uid),
                "raciones_hoy": _call(ManageRationsTool, action="day", tenant_id=tid, user_id=uid),
                "alertas_consumo": _call(ManageRationsTool, action="alerts", tenant_id=tid, user_id=uid)}


class DelegateDevelopment(BaseTool):
    name: str = "delegate_development"
    description: str = (
        "SUBAGENTE Desarrollo IDII: progreso + alertas rezagados. Input: {'child_name':'...' (opcional), 'tenant_id':1, 'user_id':1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.care_ops_tools import ManageMilestonesTool
        tid, uid, nm = kwargs.get("tenant_id"), kwargs.get("user_id"), kwargs.get("child_name", "")
        return {"success": True,
                "progreso": _call(ManageMilestonesTool, action="progress", child_name=nm, tenant_id=tid, user_id=uid) if nm else None,
                "alertas": _call(ManageMilestonesTool, action="alerts", child_name=nm, tenant_id=tid, user_id=uid)}


class DelegateCMCIAdmission(BaseTool):
    name: str = "delegate_cmci_admission"
    description: str = (
        "SUBAGENTE CMCI+Admisión: fichas + priorización + solicitudes pendientes. Input: {'tenant_id':1, 'user_id':1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.care_ops_tools import ManageCMCITool
        from agents.tools.org_admin_tools import ManageApplicationsTool
        tid, uid = kwargs.get("tenant_id"), kwargs.get("user_id")
        return {"success": True,
                "fichas": _call(ManageCMCITool, action="fichas", tenant_id=tid, user_id=uid),
                "priorizacion": _call(ManageCMCITool, action="priorizacion", tenant_id=tid, user_id=uid),
                "solicitudes": _call(ManageApplicationsTool, action="list", tenant_id=tid, user_id=uid)}


class DelegateOperationsGeo(BaseTool):
    name: str = "delegate_operations_geo"
    description: str = (
        "SUBAGENTE Operaciones+Territorio: KPIs + staff + tareas + puntos geo + canales. Input: {'tenant_id':1, 'user_id':1}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.care_ops_tools import ManageMonitoringStaffTool, ManageGeoChannelsTool
        tid, uid = kwargs.get("tenant_id"), kwargs.get("user_id")
        return {"success": True,
                "kpis": _call(ManageMonitoringStaffTool, action="kpis", tenant_id=tid, user_id=uid),
                "staff": _call(ManageMonitoringStaffTool, action="staff_load", tenant_id=tid, user_id=uid),
                "geo": _call(ManageGeoChannelsTool, action="geo_points", tenant_id=tid, user_id=uid),
                "canales": _call(ManageGeoChannelsTool, action="channels_status", tenant_id=tid, user_id=uid)}


class DelegateSocial(BaseTool):
    name: str = "delegate_social"
    description: str = (
        "SUBAGENTE Programas sociales: deriva a manage_social_programs. Input: igual que manage_social_programs + tenant_id/user_id."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.management_tools import ManageSocialProgramsTool
        return _call(ManageSocialProgramsTool, **kwargs)


class DelegatePeopleOrg(BaseTool):
    name: str = "delegate_people_org"
    description: str = (
        "SUBAGENTE Personas+Org: usuarios + centros + carga staff. Para 'quién trabaja', 'crea usuario', 'centros'. "
        "Input: {'tenant_id':1, 'user_id':1} + acción de manage_users/manage_centers."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.org_admin_tools import ManageUsersTool, ManageCentersTool
        from agents.tools.care_ops_tools import ManageMonitoringStaffTool
        tid, uid = kwargs.get("tenant_id"), kwargs.get("user_id")
        return {"success": True,
                "usuarios": _call(ManageUsersTool, action="list", tenant_id=tid, user_id=uid),
                "centros": _call(ManageCentersTool, action="list", tenant_id=tid, user_id=uid),
                "carga": _call(ManageMonitoringStaffTool, action="staff_load", tenant_id=tid, user_id=uid)}


class DelegateKnowledgeReports(BaseTool):
    name: str = "delegate_knowledge_reports"
    description: str = (
        "SUBAGENTE Conocimiento+Reportes: busca en base + KPIs + genera reporte. "
        "Input: {'query':'...', 'tenant_id':1, 'user_id':1, 'report_type':'attendance'}."
    )

    def _run(self, *args, **kwargs) -> dict:
        from agents.tools.rag_tools import ConsultKnowledgeTool
        from agents.tools.care_ops_tools import ManageMonitoringStaffTool
        from agents.tools.report_tools import GenerateReportTool
        tid, uid, q = kwargs.get("tenant_id"), kwargs.get("user_id"), kwargs.get("query", "")
        out: dict = {"success": True}
        if q:
            out["conocimiento"] = _call(ConsultKnowledgeTool, query=q, tenant_id=tid, user_id=uid)
        out["kpis"] = _call(ManageMonitoringStaffTool, action="kpis", tenant_id=tid, user_id=uid)
        if kwargs.get("report_type"):
            out["reporte"] = _call(GenerateReportTool, report_type=kwargs.get("report_type"), tenant_id=tid, user_id=uid)
        return out


DELEGATES = [DelegateChildProfile, DelegateHealthNutrition, DelegateDevelopment,
             DelegateCMCIAdmission, DelegateOperationsGeo, DelegateSocial,
             DelegatePeopleOrg, DelegateKnowledgeReports]
