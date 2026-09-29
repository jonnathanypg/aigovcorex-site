"""
Monthly Report Service — F4 (§10.2 + Fase 4 del plan).
Builder multi-rol SIN firma electrónica: educadora|auxiliar|trabajo_social|coordinacion|asistente.
compose(educator_id|user_id, report_type, period_start/end):
  jala plannings 4 semanas + attendance + niños assigned + casos riesgo +
  capacitaciones/talleres; conclusions_auto = template con agregados +
  LLM solo para redacción (tono PostulacionAgent); educator_notes máx 500
  palabras aparte. Guarda MonthlyReport + print view firmable en papel.
"""
import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

REPORT_TYPES = ('educadora', 'auxiliar', 'trabajo_social', 'coordinacion', 'asistente')

# Plantilla por rol: qué secciones lleva cada informe (ejemplos TTHH reales).
ROLE_SECTIONS = {
    'educadora': ['encabezado', 'planificaciones', 'gestion_integral', 'conclusiones', 'firmas'],
    'auxiliar': ['encabezado', 'rutinas_cuidado_higiene', 'gestion_integral', 'conclusiones', 'firmas'],
    'trabajo_social': ['encabezado', 'visitas_informes', 'casos_riesgo', 'gestion_integral', 'conclusiones', 'firmas'],
    'coordinacion': ['encabezado', 'consolidado_centro', 'gestion_integral', 'conclusiones', 'firmas'],
    'asistente': ['encabezado', 'apoyo_administrativo', 'gestion_integral', 'conclusiones', 'firmas'],
}

ROLE_TITLES = {
    'educadora': 'INFORME MENSUAL DE ACTIVIDADES — EDUCADORA',
    'auxiliar': 'INFORME MENSUAL — AUXILIAR DE PÁRVULOS',
    'trabajo_social': 'INFORME MENSUAL — TRABAJADORA SOCIAL',
    'coordinacion': 'INFORME TÉCNICO MENSUAL — COORDINACIÓN',
    'asistente': 'INFORME MENSUAL — ASISTENTE ADMINISTRATIVO',
}

MAX_NOTES_WORDS = 500


def validate_educator_notes(notes: Optional[str]) -> str:
    """Valida campo editable aparte: máx 500 palabras. Retorna texto limpio."""
    if not notes:
        return ''
    words = str(notes).split()
    if len(words) > MAX_NOTES_WORDS:
        raise ValueError(
            f'Campo editable supera 500 palabras ({len(words)}). Recórtelo.'
        )
    return str(notes).strip()


def _llm_redact(template_text: str) -> str:
    """
    LLM SOLO para redacción (tono PostulacionAgent: cercano, ecuatoriano, claro).
    Si no hay LLM disponible, devuelve el template determinista tal cual.
    Nunca inventa cifras: solo redacta el template con agregados ya calculados.
    """
    try:
        from agents.llm_interface import get_llm
        llm = get_llm()
        messages = [
            {"role": "system", "content": (
                "Eres el redactor del informe mensual CMCI. Reescribe el texto "
                "con tono cercano y profesional ecuatoriano, SIN cambiar ninguna "
                "cifra, fecha ni nombre. Máximo 200 palabras. Solo devuelves el texto."
            )},
            {"role": "user", "content": template_text},
        ]
        out = llm.chat_completion(messages, temperature=0.4, max_tokens=400)
        if out and len(out.strip()) > 20:
            return out.strip()
    except Exception as e:
        logger.warning(f"LLM redact no disponible, uso template: {e}")
    return template_text


class MonthlyReportService:
    """Compose + persistencia + print view de informes mensuales multi-rol."""

    @staticmethod
    def compose(educator_id=None, user_id=None, report_type='educadora',
                period_start=None, period_end=None, tenant_id=None,
                educator_notes='', redact_with_llm=True):
        """
        Arma el informe mensual. educator_id|user_id alias del mismo autor.
        Retorna dict serializable (no persiste; ver compose_and_save).
        """
        from models import db
        from models.planning import LudicPlanning
        from models.attendance import Attendance
        from models.child import Child, Family
        from models.intervention import FamilyIntervention
        from models.milestone import Milestone
        from models.health import HealthRecord
        from models.nutrition import NutritionDaily
        from models.user import User
        from models.tenant import Tenant

        author_id = educator_id or user_id
        if not author_id:
            raise ValueError('educator_id|user_id requerido')
        if report_type not in REPORT_TYPES:
            raise ValueError(f'report_type inválido: {report_type}')
        if not period_start or not period_end:
            raise ValueError('period_start/end requeridos (periodo editable, ej. corte día 24)')

        author = User.query.get(author_id)
        center_id = tenant_id or (author.tenant_id if author else None)

        # 1. Planificaciones del periodo (4 semanas típico; educadora las aporta)
        plannings = LudicPlanning.query.filter(
            LudicPlanning.educator_id == author_id,
            LudicPlanning.planning_date >= period_start,
            LudicPlanning.planning_date <= period_end,
        ).order_by(LudicPlanning.planning_date.asc()).all()

        # 2. Niños asignados a la educadora (cobertura 9 niños/educadora, 72/centro)
        children = Child.query.filter_by(
            assigned_educator_id=author_id, status='activo'
        ).all() if author_id else []
        if not children and center_id:
            children = Child.query.filter_by(
                tenant_id=center_id, status='activo'
            ).limit(9).all()
        child_ids = [c.id for c in children]

        # 3. Asistencia del periodo (sus niños o su centro)
        att_q = Attendance.query.filter(
            Attendance.date >= period_start, Attendance.date <= period_end)
        if child_ids:
            att_q = att_q.filter(Attendance.child_id.in_(child_ids))
        elif center_id:
            att_q = att_q.filter(Attendance.tenant_id == center_id)
        attendances = att_q.all()
        n_present = sum(1 for a in attendances if a.status == 'presente')
        att_rate = round(n_present / len(attendances) * 100, 1) if attendances else 0.0

        # 4. Casos riesgo: intervenciones + familias con riesgos sociales
        interventions = []
        risk_cases = 0
        if center_id:
            interventions = FamilyIntervention.query.filter(
                FamilyIntervention.tenant_id == center_id,
                FamilyIntervention.date >= period_start,
                FamilyIntervention.date <= period_end,
            ).all()
            risk_families = Family.query.filter(
                Family.tenant_id == center_id).all()
            risk_cases = sum(
                1 for f in risk_families
                if f.social_risks and isinstance(f.social_risks, list) and len(f.social_risks) > 0
            ) + sum(1 for i in interventions if (i.reason or '').strip())

        # 5. Hitos IDII + salud + nutrición del periodo (agregados para conclusiones)
        milestones = Milestone.query.filter(
            Milestone.record_date >= period_start,
            Milestone.record_date <= period_end,
        )
        if center_id:
            milestones = milestones.filter(Milestone.tenant_id == center_id)
        milestones = milestones.all()
        by_level = {}
        for m in milestones:
            by_level[m.achievement_level] = by_level.get(m.achievement_level, 0) + 1

        health_n = 0
        if center_id:
            health_n = HealthRecord.query.filter(
                HealthRecord.tenant_id == center_id,
                HealthRecord.record_date >= period_start,
                HealthRecord.record_date <= period_end,
            ).count()
        nutrition_n = 0
        if child_ids:
            nutrition_n = NutritionDaily.query.filter(
                NutritionDaily.child_id.in_(child_ids),
                NutritionDaily.date >= period_start,
                NutritionDaily.date <= period_end,
            ).count()

        center = Tenant.query.get(center_id) if center_id else None
        payload = {
            'report_type': report_type,
            'title': ROLE_TITLES[report_type],
            'sections': ROLE_SECTIONS[report_type],
            'author': {'id': author_id,
                       'name': author.full_name if author else 'Sin asignar'},
            'center': {'id': center_id, 'name': center.name if center else 'Centro'},
            'period': {'start': period_start.isoformat(),
                       'end': period_end.isoformat()},
            'encabezado_convenio': {
                'nota': 'Convenio, finalidad, población objetivo y servicios (completar por coordinación)',
            },
            'planificaciones': [p.to_dict() for p in plannings],
            'n_planificaciones': len(plannings),
            'ninos': [{'id': c.id, 'nombre': c.full_name,
                       'edad': c.age_display} for c in children],
            'n_usuarios': len(children),
            'asistencia': {'registros': len(attendances),
                           'presentes': n_present,
                           'tasa': att_rate},
            'casos_riesgo': risk_cases,
            'intervenciones': [i.to_dict() for i in interventions],
            'capacitaciones_talleres': [],  # carga manual/operativa futura
            'hitos_por_nivel': by_level,
            'registros_salud': health_n,
            'registros_nutricion': nutrition_n,
        }

        # 6. conclusions_auto: template determinista con agregados
        template = (
            f"Durante el periodo {period_start.isoformat()} al {period_end.isoformat()}, "
            f"se atendió a {len(children)} usuarios con tasa de asistencia del {att_rate}% "
            f"({n_present}/{len(attendances)} registros). Se ejecutaron {len(plannings)} "
            f"planificaciones lúdicas, {len(interventions)} intervenciones familiares y se "
            f"identificaron {risk_cases} casos de riesgo. Evaluaciones de desarrollo: "
            f"{len(milestones)} ({', '.join(f'{k}: {v}' for k, v in by_level.items()) or 'sin registros'}). "
            f"Salud: {health_n} registros. Nutrición: {nutrition_n} registros."
        )
        conclusions_auto = _llm_redact(template) if redact_with_llm else template
        notes_clean = validate_educator_notes(educator_notes)

        return {'payload': payload, 'conclusions_auto': conclusions_auto,
                'educator_notes': notes_clean}

    @staticmethod
    def compose_and_save(educator_id=None, user_id=None, report_type='educadora',
                         period_start=None, period_end=None, tenant_id=None,
                         educator_notes='', redact_with_llm=True,
                         status='borrador'):
        """Compose + persiste MonthlyReport. Retorna el modelo."""
        from models import db
        from models.cmci import MonthlyReport
        from models.user import User

        built = MonthlyReportService.compose(
            educator_id=educator_id, user_id=user_id, report_type=report_type,
            period_start=period_start, period_end=period_end, tenant_id=tenant_id,
            educator_notes=educator_notes, redact_with_llm=redact_with_llm)
        author_id = educator_id or user_id
        author = User.query.get(author_id)
        center_id = tenant_id or (author.tenant_id if author else None)
        report = MonthlyReport(
            educator_id=author_id, center_id=center_id, report_type=report_type,
            period_start=period_start, period_end=period_end,
            payload=built['payload'], conclusions_auto=built['conclusions_auto'],
            educator_notes=built['educator_notes'], status=status)
        db.session.add(report)
        db.session.commit()
        return report

    @staticmethod
    def print_view(report):
        """
        Vista imprimible firmable en papel (sin e-firma): encabezado oficial,
        secciones por rol, conclusiones auto + notas aparte, líneas de firma
        física educadora + coordinadora + fecha. El frontend la renderiza A4.
        """
        p = report.payload or {}
        return {
            'titulo': p.get('title', ROLE_TITLES.get(report.report_type, 'INFORME MENSUAL')),
            'centro': (p.get('center') or {}).get('name', ''),
            'autora': (p.get('author') or {}).get('name', ''),
            'periodo': p.get('period', {}),
            'secciones': p.get('sections', []),
            'resumen': {
                'usuarios': p.get('n_usuarios', 0),
                'planificaciones': p.get('n_planificaciones', 0),
                'tasa_asistencia': (p.get('asistencia') or {}).get('tasa', 0),
                'casos_riesgo': p.get('casos_riesgo', 0),
            },
            'conclusions_auto': report.conclusions_auto or '',
            'educator_notes': report.educator_notes or '',
            'firmas': [
                {'rol': 'Educadora / responsable', 'linea': 'firma + fecha'},
                {'rol': 'Coordinadora (revisa/aprueba en papel)', 'linea': 'firma + fecha'},
            ],
            'nota': 'Documento firmable en papel fuera del sistema. Sin firma electrónica.',
        }
