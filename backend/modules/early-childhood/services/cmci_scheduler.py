"""
CMCI Scheduler — F4 (Fase 4 del plan).
Cron cierre mensual: día 22 08:00 (timezone por país) avisa cierre día 24;
día 24 23:59 snapshot solo-lectura; alerta incompletos a doctores
(deadline configurable). Timezone se lee de CountryConfig (nunca hardcode).
Sin firma electrónica: el snapshot es congelamiento de datos, la aprobación
es firma física en papel fuera del sistema.
"""
import logging
import os
from datetime import datetime, date, time

logger = logging.getLogger(__name__)

REMINDER_DAY = int(os.getenv('CMCI_REMINDER_DAY', '22'))
CLOSING_DAY = int(os.getenv('CMCI_CLOSING_DAY', '24'))
DOCTOR_DEADLINE = os.getenv('CMCI_DOCTOR_DEADLINE', '')  # ej. 2026-10-01 (configurable)


def country_timezone(country_iso='EC'):
    """Timezone por país desde CountryConfig; fallback America/Guayaquil."""
    try:
        from models.cmci import CountryConfig
        cfg = CountryConfig.query.filter_by(country_iso=country_iso).first()
        if cfg and cfg.timezone:
            return cfg.timezone
    except Exception as e:
        logger.warning(f"country_timezone fallback: {e}")
    return os.getenv('TIMEZONE', 'America/Guayaquil')


def now_in_tz(country_iso='EC'):
    """Hora actual en el timezone del país (zoneinfo stdlib)."""
    from zoneinfo import ZoneInfo
    tz = country_timezone(country_iso)
    try:
        return datetime.now(ZoneInfo(tz))
    except Exception:
        return datetime.now()


def due_actions(today=None, now_time=None, country_iso='EC'):
    """
    Decide acciones del cron para una fecha dada (testeable sin reloj).
    Retorna {'remind_closing': bool, 'freeze_snapshot': bool}.
    - remind_closing: día 22 (avisa cierre día 24 a coordinadoras+educadoras+doctores).
    - freeze_snapshot: día 24 a las 23:59 (snapshot solo-lectura del periodo).
    """
    today = today or date.today()
    return {
        'remind_closing': today.day == REMINDER_DAY,
        'freeze_snapshot': today.day == CLOSING_DAY and (now_time or time(0, 0)) >= time(23, 59),
    }


def incomplete_profiles(center_id=None):
    """
    Perfiles incompletos para alerta a doctores: niños activos sin valoración
    médica vigente o sin IDII. Retorna lista dicts {child_id, nombre, faltantes}.
    Deadline configurable vía CMCI_DOCTOR_DEADLINE.
    """
    from models.child import Child
    from models.health import HealthRecord
    from models.milestone import Milestone

    q = Child.query.filter_by(status='activo')
    if center_id:
        q = q.filter_by(tenant_id=center_id)
    out = []
    for child in q.all():
        missing = []
        has_health = HealthRecord.query.filter_by(child_id=child.id).first()
        if not has_health:
            missing.append('valoracion_medica')
        has_idii = Milestone.query.filter_by(child_id=child.id).first()
        if not has_idii:
            missing.append('idii')
        if missing:
            out.append({'child_id': child.id, 'nombre': child.full_name,
                        'faltantes': missing,
                        'deadline': DOCTOR_DEADLINE or None})
    return out


def freeze_period_snapshot(center_id, period_start, period_end):
    """
    Congela periodo día 24 23:59: marca MonthlyReport del periodo como
    'congelado' (solo-lectura app-level) y food_intake del periodo como snapshot.
    Retorna conteo afectado.
    """
    from models import db
    from models.cmci import MonthlyReport, FoodIntakeReception

    n = 0
    reports = MonthlyReport.query.filter(
        MonthlyReport.center_id == center_id,
        MonthlyReport.period_start >= period_start,
        MonthlyReport.period_end <= period_end,
        MonthlyReport.status != 'congelado').all()
    for r in reports:
        r.status = 'congelado'
        n += 1
    intakes = FoodIntakeReception.query.filter(
        FoodIntakeReception.center_id == center_id,
        FoodIntakeReception.date >= period_start,
        FoodIntakeReception.date <= period_end,
        FoodIntakeReception.is_snapshot.is_(False)).all()
    for i in intakes:
        i.is_snapshot = True
        n += 1
    db.session.commit()
    logger.info(f"freeze snapshot centro={center_id}: {n} registros congelados")
    return n
