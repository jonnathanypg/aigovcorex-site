"""
Tests F4 — informe mensual multi-rol + exports + intake (§Fase 4 del plan).
python3 tests/test_cmci_f4.py  (o pytest tests/test_cmci_f4.py)
"""
import os
import sys
from datetime import date

_HERE = os.path.dirname(os.path.abspath(__file__))
_MOD = os.path.dirname(_HERE)  # backend/modules/early-childhood
if _MOD not in sys.path:
    sys.path.insert(0, _MOD)

from flask import Flask
from models import db

import models.license  # noqa: F401 (FK tenants.license_id)
import models.tenant  # noqa: F401
import models.user  # noqa: F401
import models.child  # noqa: F401
import models.attendance  # noqa: F401
import models.nutrition  # noqa: F401
import models.health  # noqa: F401
import models.milestone  # noqa: F401
import models.planning  # noqa: F401
import models.intervention  # noqa: F401
import models.report  # noqa: F401
import models.cmci  # noqa: F401


def make_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app


def seed(app):
    from models.tenant import Tenant
    from models.user import User, Role
    from models.child import Child, Family
    from models.planning import LudicPlanning
    from models.attendance import Attendance

    role = Role(name='educadora', description='Educadora')
    db.session.add(role)
    db.session.flush()
    tenant = Tenant(name='CMCI Bahía', city='Guayaquil')
    db.session.add(tenant)
    db.session.flush()
    edu = User(tenant_id=tenant.id, role_id=role.id, email='edu@test.ec',
               first_name='Test', last_name='Educadora')
    edu.set_password('x')
    db.session.add(edu)
    db.session.flush()
    fam = Family(tenant_id=tenant.id, address='Calle 1')
    db.session.add(fam)
    db.session.flush()
    children = []
    for i in range(3):
        c = Child(tenant_id=tenant.id, family_id=fam.id,
                  first_name=f'Nino{i}', last_name='Prueba',
                  birth_date=date(2023, 5, 1), gender='masculino',
                  enrollment_date=date(2026, 4, 1), status='activo',
                  assigned_educator_id=edu.id)
        db.session.add(c)
        children.append(c)
    db.session.flush()
    for w in range(4):  # 4 planificaciones semanales del mes
        p = LudicPlanning(tenant_id=tenant.id, educator_id=edu.id,
                          planning_date=date(2026, 5, 3 + w * 7),
                          age_group='24-36 meses',
                          nombre_actividad=f'Actividad {w}',
                          tema_integrador='Tema')
        db.session.add(p)
    for c in children:
        a = Attendance(tenant_id=tenant.id, child_id=c.id,
                       date=date(2026, 5, 4), status='presente',
                       registered_by_id=edu.id)
        db.session.add(a)
    db.session.commit()
    return tenant, edu, children


def test_compose_educadora():
    from services.monthly_report_service import MonthlyReportService
    app = make_app()
    with app.app_context():
        db.create_all()
        tenant, edu, children = seed(app)
        built = MonthlyReportService.compose(
            educator_id=edu.id, report_type='educadora',
            period_start=date(2026, 5, 1), period_end=date(2026, 5, 31),
            tenant_id=tenant.id, educator_notes='Avance general del grupo.',
            redact_with_llm=False)
        assert built['payload']['n_planificaciones'] == 4, built['payload']
        assert built['payload']['n_usuarios'] == 3
        assert built['payload']['asistencia']['tasa'] == 100.0
        assert 'conclusions_auto' in built and len(built['conclusions_auto']) > 20
        # persistencia + print view firmable en papel
        rep = MonthlyReportService.compose_and_save(
            educator_id=edu.id, report_type='educadora',
            period_start=date(2026, 5, 1), period_end=date(2026, 5, 31),
            tenant_id=tenant.id, redact_with_llm=False)
        pv = MonthlyReportService.print_view(rep)
        assert pv['firmas'] and 'papel' in pv['nota']
        # notas >500 palabras rechaza
        try:
            MonthlyReportService.compose(
                educator_id=edu.id, report_type='auxiliar',
                period_start=date(2026, 5, 1), period_end=date(2026, 5, 31),
                tenant_id=tenant.id, educator_notes='palabra ' * 501,
                redact_with_llm=False)
            raise AssertionError('debió rechazar >500 palabras')
        except ValueError:
            pass
        # los 5 roles componen
        for rt in ('auxiliar', 'trabajo_social', 'coordinacion', 'asistente'):
            b = MonthlyReportService.compose(
                educator_id=edu.id, report_type=rt,
                period_start=date(2026, 5, 1), period_end=date(2026, 5, 31),
                tenant_id=tenant.id, redact_with_llm=False)
            assert b['payload']['report_type'] == rt
    print('test_compose_educadora OK')


def test_export_matrices():
    from services.cmci_export import MATRIX_STYLE, build_matrix_workbook
    assert set(MATRIX_STYLE) == {'matriz-general', 'matriz-posibles', 'matriz-unica',
                                 'matriz-consolidada', 'asistencia'}
    rows = [{'n': 1, 'centro': 'Bahía', 'cedula': '0912345678', 'apellidos': 'P',
             'nombres': 'N', 'sexo': 'M', 'fnac': '2023-05-01', 'edad': '24m',
             'rep': 'R', 'tel': '593991234567', 'dir': 'C1', 'estado': 'activo',
             'puntaje': 61.1}]
    for key in ('matriz-general', 'matriz-posibles', 'matriz-unica', 'matriz-consolidada'):
        buf = build_matrix_workbook(key, [{'a': 1}], center_name='Bahía',
                                    period_label='2026-05-01 al 2026-05-31',
                                    filters_label='center_id=1')
        assert buf.getvalue()[:2] == b'PK', key  # xlsx zip
    buf = build_matrix_workbook('matriz-general', rows, center_name='Bahía',
                                period_label='corte 24', filters_label='f')
    assert len(buf.getvalue()) > 3000
    print('test_export_matrices OK')


def test_intake_eficiencia():
    from models.cmci import FoodIntakeReception
    app = make_app()
    with app.app_context():
        db.create_all()
        tenant, edu, _ = seed(app)
        r = FoodIntakeReception(center_id=tenant.id, date=date(2026, 5, 4),
                                meal_time='almuerzo', ingesta_real=68,
                                cobertura_total=72, olor='Conforme', color='Conforme',
                                sabor='Conforme', aceptabilidad='Buena',
                                entrega='11:00', cumplio_menu=True,
                                registered_by=edu.id)
        db.session.add(r)
        db.session.commit()
        assert r.eficiencia == 94.44, r.eficiencia
        assert r.aporte_cmci_pct == 75.0 and r.aporte_hogar_pct == 25.0
    print('test_intake_eficiencia OK')


def test_scheduler_and_wizard():
    from services.cmci_scheduler import due_actions
    from datetime import time
    from services.cmci_wizard import ALL_WIZARD_QUESTIONS, build_cmci_wizard_schema
    assert due_actions(today=date(2026, 5, 22))['remind_closing'] is True
    assert due_actions(today=date(2026, 5, 24), now_time=time(23, 59))['freeze_snapshot'] is True
    assert due_actions(today=date(2026, 5, 15)) == {'remind_closing': False, 'freeze_snapshot': False}
    assert len(ALL_WIZARD_QUESTIONS) == 40  # 33+7
    schema = build_cmci_wizard_schema()
    assert len(schema['fields']) == 40
    assert all(f.get('conversational_prompt') for f in schema['fields'])
    print('test_scheduler_and_wizard OK')


if __name__ == '__main__':
    test_compose_educadora()
    test_export_matrices()
    test_intake_eficiencia()
    test_scheduler_and_wizard()
    print('F4 ALL GREEN')
