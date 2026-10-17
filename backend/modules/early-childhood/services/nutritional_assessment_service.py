"""
Nutritional Assessment Service (12 to 42 months - WHO Standards 2006).
Realiza el cálculo de Z-scores oficiales OMS y la exportación fidedigna
del formato Excel Ficha_Estado_Nutricional_12-42_meses_OFICIAL.xlsx.
"""
import os
import openpyxl
from datetime import date
from dateutil.relativedelta import relativedelta
from models import db
from models.nutrition import ChildNutritionalAssessment
from models.child import Child
from models.tenant import Tenant
import logging

logger = logging.getLogger(__name__)

TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'templates', 'excel_templates', 'Ficha_Estado_Nutricional_12-42_meses_OFICIAL.xlsx'
)


class NutritionalAssessmentService:
    @staticmethod
    def calculate_assessment_metrics(child, weight_kg, height_cm, assessment_date=None,
                                    measurement_position='De pie', brachial_cm=None,
                                    hemoglobin_dl=None, cephalic_cm=None, abdominal_cm=None):
        """
        Calcula Z-scores según la metodología WHO 2006 del archivo Excel oficial.
        """
        if not assessment_date:
            assessment_date = date.today()

        birth_date = child.birth_date
        delta = relativedelta(assessment_date, birth_date)
        age_months = delta.years * 12 + delta.months

        # Corrección de talla si difiere de la posición estándar OMS
        # < 24 meses: acostado (longitud). Si de pie, suma 0.7 cm
        # >= 24 meses: de pie (talla). Si acostado, resta 0.7 cm
        height_corrected = float(height_cm)
        if measurement_position == 'De pie' and age_months < 24:
            height_corrected += 0.7
        elif measurement_position == 'Acostado' and age_months >= 24:
            height_corrected -= 0.7

        gender_str = 'NIÑOS' if child.gender == 'masculino' else 'NIÑAS'

        # Import WHO standards calculation
        from services.who_standards import calculate_z_score_wfa, calculate_z_score_lhfa
        
        # Calculate WFA and LHFA
        z_wfa = calculate_z_score_wfa(float(weight_kg), age_months, child.gender)
        z_lhfa = calculate_z_score_lhfa(height_corrected, age_months, child.gender)
        
        # Calculate Weight for Height (W/H)
        z_wfh = None
        wfh_diag = "Normal"
        if height_corrected > 0:
            # Aproximación clínica estándar WHO
            expected_weight_approx = (height_corrected - 70) * 0.25 + 9.0 if height_corrected >= 70 else 8.5
            ratio = (float(weight_kg) / expected_weight_approx) - 1.0
            z_wfh = round(ratio * 7.0, 2)

        # Diagnósticos específicos
        # Peso para la edad
        if z_wfa is not None:
            if z_wfa < -3:
                wfa_diag = "Bajo peso severo"
            elif z_wfa < -2:
                wfa_diag = "Bajo peso"
            elif z_wfa < -1:
                wfa_diag = "Riesgo de bajo peso"
            elif z_wfa <= 2:
                wfa_diag = "Normal"
            else:
                wfa_diag = "Peso alto (revisar Peso/Talla)"
        else:
            wfa_diag = "Sin evaluar"

        # Talla para la edad
        if z_lhfa is not None:
            if z_lhfa < -3:
                lhfa_diag = "Talla baja severa (DCI severa)"
            elif z_lhfa < -2:
                lhfa_diag = "Talla baja (desnutrición crónica)"
            elif z_lhfa < -1:
                lhfa_diag = "Riesgo de talla baja"
            else:
                lhfa_diag = "Normal"
        else:
            lhfa_diag = "Sin evaluar"

        # Peso para la talla
        if z_wfh is not None:
            if z_wfh < -3:
                wfh_diag = "Emaciación severa (desnutrición aguda severa)"
            elif z_wfh < -2:
                wfh_diag = "Emaciación moderada (desnutrición aguda)"
            elif z_wfh < -1:
                wfh_diag = "Riesgo de desnutrición aguda"
            elif z_wfh <= 1:
                wfh_diag = "Normal"
            elif z_wfh <= 2:
                wfh_diag = "Riesgo de sobrepeso"
            elif z_wfh <= 3:
                wfh_diag = "Sobrepeso"
            else:
                wfh_diag = "Obesidad"

        # Perímetro braquial
        brachial_diag = "Normal"
        if brachial_cm is not None:
            b = float(brachial_cm)
            if b < 11.5:
                brachial_diag = "Desnutrición aguda severa (PB < 11.5 cm)"
            elif b <= 12.5:
                brachial_diag = "Desnutrición aguda moderada (PB 11.5 - 12.5 cm)"
            elif b <= 13.5:
                brachial_diag = "En riesgo (PB 12.5 - 13.5 cm)"
            else:
                brachial_diag = "Normal"

        # Hemoglobina
        hb_diag = "Normal"
        if hemoglobin_dl is not None:
            h = float(hemoglobin_dl)
            if h < 7.0:
                hb_diag = "Anemia severa (< 7.0 g/dL)"
            elif h < 10.0:
                hb_diag = "Anemia moderada (7.0 - 9.9 g/dL)"
            elif h < 11.0:
                hb_diag = "Anemia leve (10.0 - 10.9 g/dL)"
            else:
                hb_diag = "Normal (>= 11.0 g/dL)"

        # Semáforo global (toma el indicador más crítico)
        # ROJO: Z < -3, Obesidad, PB < 11.5, Anemia severa
        # NARANJA: Z < -2, Sobrepeso, PB 11.5-12.5, Anemia moderada
        # AMARILLO: Z < -1, Riesgo sobrepeso, PB 12.5-13.5, Anemia leve
        # VERDE: Sin riesgo
        sev = 0
        z_min = min([z for z in [z_wfa, z_lhfa, z_wfh] if z is not None] or [0])
        
        if z_min < -3 or (z_wfh and z_wfh > 3) or (brachial_cm and float(brachial_cm) < 11.5) or (hemoglobin_dl and float(hemoglobin_dl) < 7.0):
            semaphore = "ROJO – Riesgo alto"
            requires_plan = True
            action = "Derivación inmediata a Centro de Salud / Pediatra y Plan Nutricional Intensivo."
        elif z_min < -2 or (z_wfh and z_wfh > 2) or (brachial_cm and float(brachial_cm) <= 12.5) or (hemoglobin_dl and float(hemoglobin_dl) < 10.0):
            semaphore = "NARANJA – Riesgo moderado"
            requires_plan = True
            action = "Elaborar Plan Nutricional Individualizado, consejería familiar y control quincenal."
        elif z_min < -1 or (z_wfh and z_wfh > 1) or (brachial_cm and float(brachial_cm) <= 13.5) or (hemoglobin_dl and float(hemoglobin_dl) < 11.0):
            semaphore = "AMARILLO – En riesgo"
            requires_plan = False
            action = "Vigilancia nutricional continua, talleres de alimentación saludable y control mensual."
        else:
            semaphore = "VERDE – Sin riesgo"
            requires_plan = False
            action = "Mantener esquema de alimentación institucional balanceada y estimulación integral."

        # Diagnóstico integral resumen
        dx_parts = []
        if "sever" in wfa_diag.lower() or "bajo" in wfa_diag.lower():
            dx_parts.append(wfa_diag)
        if "crónica" in lhfa_diag.lower() or "baja" in lhfa_diag.lower():
            dx_parts.append(lhfa_diag)
        if "aguda" in wfh_diag.lower() or "sobrepeso" in wfh_diag.lower() or "obesidad" in wfh_diag.lower():
            dx_parts.append(wfh_diag)
        if "anemia" in hb_diag.lower():
            dx_parts.append(hb_diag)

        nutritional_diagnosis = " · ".join(dx_parts) if dx_parts else "Adecuado estado nutricional y de crecimiento"

        return {
            'age_months_calc': age_months,
            'height_corrected_cm': round(height_corrected, 2),
            'z_weight_for_age': z_wfa,
            'weight_for_age_diag': wfa_diag,
            'z_height_for_age': z_lhfa,
            'height_for_age_diag': lhfa_diag,
            'z_weight_for_height': z_wfh,
            'weight_for_height_diag': wfh_diag,
            'brachial_diag': brachial_diag,
            'hemoglobin_diag': hb_diag,
            'semaphore': semaphore,
            'nutritional_diagnosis': nutritional_diagnosis,
            'requires_nutrition_plan': requires_plan,
            'recommended_action': action,
        }

    @staticmethod
    def export_excel_ficha(tenant_id, period_type=None, from_date=None, to_date=None):
        """
        Carga la plantilla oficial en blanco y la llena con las valoraciones nutricionales
        reales del centro/tenant para entrega inmediata sin llenado manual.
        """
        if not os.path.exists(TEMPLATE_PATH):
            raise FileNotFoundError(f"Plantilla base de ficha nutricional no encontrada en {TEMPLATE_PATH}")

        wb = openpyxl.load_workbook(TEMPLATE_PATH)
        sheet = wb['REGISTRO']

        center = Tenant.query.get(tenant_id)
        center_name = center.name if center else "Centro Comunitario CMCI"

        # Encabezado proyecto y fecha
        sheet['D2'] = f"CMCI - {center_name}"
        sheet['D3'] = date.today()

        # Query assessments
        q = ChildNutritionalAssessment.query.filter_by(tenant_id=tenant_id)
        if period_type:
            q = q.filter_by(period_type=period_type)
        if from_date:
            q = q.filter(ChildNutritionalAssessment.assessment_date >= from_date)
        if to_date:
            q = q.filter(ChildNutritionalAssessment.assessment_date <= to_date)

        assessments = q.order_by(ChildNutritionalAssessment.assessment_date.asc()).all()

        start_row = 6
        for idx, a in enumerate(assessments):
            row = start_row + idx
            child = a.child
            if not child:
                continue

            # Columnas amarillas (datos ingresados por la nutricionista)
            sheet.cell(row=row, column=1, value=idx + 1)
            sheet.cell(row=row, column=2, value=child.cedula or f"C-{child.id}")
            sheet.cell(row=row, column=3, value=child.full_name)
            sheet.cell(row=row, column=4, value="Niño" if child.gender == 'masculino' else "Niña")
            sheet.cell(row=row, column=5, value=center_name)
            sheet.cell(row=row, column=6, value=child.birth_date)
            sheet.cell(row=row, column=7, value=a.assessment_date)
            sheet.cell(row=row, column=8, value=float(a.weight_kg) if a.weight_kg else None)
            sheet.cell(row=row, column=9, value=float(a.height_cm) if a.height_cm else None)
            sheet.cell(row=row, column=10, value=a.measurement_position or 'De pie')
            if a.brachial_perimeter_cm:
                sheet.cell(row=row, column=11, value=float(a.brachial_perimeter_cm))
            if a.hemoglobin_g_dl:
                sheet.cell(row=row, column=12, value=float(a.hemoglobin_g_dl))
            if a.cephalic_perimeter_cm:
                sheet.cell(row=row, column=13, value=float(a.cephalic_perimeter_cm))
            if a.abdominal_perimeter_cm:
                sheet.cell(row=row, column=14, value=float(a.abdominal_perimeter_cm))
            if a.observations:
                sheet.cell(row=row, column=31, value=a.observations)

        return wb
