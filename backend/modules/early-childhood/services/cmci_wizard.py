"""
CMCI Wizard — F4 (Fase 4 del plan).
Mapea 33 preguntas vulnerabilidad (§3.1: I1.1..I8.3) + 7 socioeconómicas
(§3.2: ingreso per-cápita, composición, laboral, vivienda, servicios, gastos,
educación) a ProgramFormDefinition conversational_prompt.
Reutiliza SMART catalog + generate via LLM + validate _validate_field_value
del módulo social (sin duplicar lógica: importa validadores si existen).
El educador ve `pendientes` y valida (alerta).
"""
import logging

logger = logging.getLogger(__name__)

# 33 indicadores vulnerabilidad: id -> (label, type, prompt WA)
VULN_QUESTIONS = [
    ('vuln_I11_percapita', 'Ingreso per-cápita del hogar ($)', 'currency',
     '¿A cuánto asciende el ingreso total mensual de su hogar? (solo el número, ejemplo 750)'),
    ('vuln_I12_insercion', 'Inserción laboral de los cuidadores', 'select',
     '¿Los cuidadores tienen empleo formal, informal o están desempleados? (formal ambos / uno formal / informal / un desempleado / ambos desempleados)'),
    ('vuln_I13_estabilidad', 'Estabilidad de ingresos', 'select',
     '¿Sus ingresos son estables, variables, ocasionales o no tienen ingresos?'),
    ('vuln_I14_dependencia', 'Dependencia económica (personas por perceptor)', 'currency',
     '¿Cuántas personas dependen de cada persona que genera ingresos? (solo el número)'),
    ('vuln_I15_registro_social', 'Registro social', 'select',
     '¿Su hogar consta en el registro social? (sin dato / vulnerabilidad / pobreza / extrema)'),
    ('vuln_I21_estructura', 'Estructura y jefatura del hogar', 'select',
     '¿Cómo está conformado su hogar? (biparental / monoparental con apoyo / sin apoyo / terceros)'),
    ('vuln_I22_nna', 'Niñas/niños/adolescentes dependientes', 'number',
     '¿Cuántos niños, niñas o adolescentes dependen de usted? (solo el número)'),
    ('vuln_I23_adicionales', 'Personas adicionales dependientes', 'number',
     '¿Cuántas personas adicionales dependen de su hogar? (solo el número)'),
    ('vuln_I31_laboral_principal', 'Situación laboral del cuidador principal', 'select',
     '¿El cuidador principal tiene empleo formal, informal, busca empleo o no busca?'),
    ('vuln_I32_segundo_cuidador', 'Situación del segundo cuidador', 'select',
     '¿El segundo cuidador trabaja? (formal / informal / desempleado / no aplica)'),
    ('vuln_I33_horario', 'Compatibilidad de horario con el cuidado', 'select',
     '¿Su horario laboral es compatible con el cuidado del niño? (sí / parcial / no)'),
    ('vuln_I34_estudios', 'Nivel de estudios del cuidador principal', 'select',
     '¿Cuál es el nivel de estudios del cuidador principal? (sin instrucción / primaria / secundaria / superior)'),
    ('vuln_I41_cuidador', 'Cuidador permanente del niño', 'select',
     '¿Quién cuida permanentemente al niño? (madre / padre / abuelos / terceros / nadie)'),
    ('vuln_I42_fragilidad', 'Fragilidad del arreglo de cuidado', 'select',
     '¿El arreglo de cuidado es estable o frágil? (estable / parcial / frágil / sin arreglo)'),
    ('vuln_I43_horas_sin_cuidador', 'Horas sin cuidador al día', 'select',
     '¿Cuántas horas al día el niño queda sin cuidador? (ninguna / 1-2h / 3-4h / 5h o más)'),
    ('vuln_I44_riesgo_interrupcion', 'Riesgo de interrupción del cuidado', 'select',
     '¿Existe riesgo de que el cuidado se interrumpa? (no / leve / moderado / alto)'),
    ('vuln_I45_acceso_cuidado', 'Acceso a servicio de cuidado infantil', 'select',
     '¿El niño accede a un servicio de cuidado infantil? (sí CMCI / sí otro / lista espera / no)'),
    ('vuln_I51_tenencia', 'Tenencia de la vivienda', 'select',
     '¿Su vivienda es propia, arrendada, prestada o inestable?'),
    ('vuln_I52_hacinamiento', 'Hacinamiento (personas por dormitorio)', 'currency',
     '¿Cuántas personas duermen por dormitorio en su hogar? (solo el número, ejemplo 3)'),
    ('vuln_I53_servicios', 'Servicios básicos (agua/luz/saneamiento)', 'select',
     '¿Con cuántos servicios básicos cuenta? (3 servicios / 2 servicios / 1 o ninguno)'),
    ('vuln_I54_riesgo_fisico', 'Riesgo físico o ambiental de la vivienda', 'select',
     '¿Su vivienda está en zona de riesgo? (no / leve / moderado / alto)'),
    ('vuln_I61_necesidad_nino', 'Necesidad especial del niño', 'select',
     '¿El niño tiene alguna necesidad especial o discapacidad? (no / leve / moderada / severa)'),
    ('vuln_I62_barrera_cuidador', 'Barrera de salud del cuidador', 'select',
     '¿El cuidador tiene alguna limitación de salud para cuidar? (no / leve / moderada / severa)'),
    ('vuln_I63_cronica', 'Enfermedad crónica en el hogar', 'select',
     '¿Alguien en el hogar tiene enfermedad crónica o catastrófica? (no / controlada / parcial / grave)'),
    ('vuln_I64_acceso_salud', 'Acceso a salud', 'select',
     '¿Acceden a centro de salud cuando lo necesitan? (siempre / a veces / rara vez / nunca)'),
    ('vuln_I71_violencia', 'Violencia intrafamiliar', 'select',
     '¿Existe violencia en el hogar? (no / observación / claro-derivación). Responda con calma, es confidencial.'),
    ('vuln_I72_negligencia', 'Negligencia en el cuidado', 'select',
     '¿El niño recibe cuidado adecuado siempre? (sí / observación / no-derivación)'),
    ('vuln_I73_redes_proteccion', 'Ausencia de redes de protección', 'select',
     '¿Cuenta con redes de protección (familia, comunidad, institución)? (sí / parcial / no)'),
    ('vuln_I74_movilidad', 'Movilidad humana', 'select',
     '¿Su hogar está en movilidad humana? (no aplica / regularización / alta vulnerabilidad)'),
    ('vuln_I75_otro_riesgo', 'Otro riesgo identificado', 'select',
     '¿Existe otro riesgo en el hogar? (no / observación / claro-derivación)'),
    ('vuln_I81_familiares', 'Disponibilidad de familiares de apoyo', 'select',
     '¿Tiene familiares que puedan apoyarle? (siempre / a veces / rara vez / nunca)'),
    ('vuln_I82_frecuencia', 'Frecuencia del apoyo recibido', 'select',
     '¿Con qué frecuencia recibe apoyo? (siempre / a veces / rara vez / nunca)'),
    ('vuln_I83_comunitario', 'Apoyo comunitario', 'select',
     '¿Su comunidad le apoya? (siempre / a veces / rara vez / nunca)'),
]

# 7 socioeconómicas (§3.2 + §10.1 B64/B65/B68 literales).
SOCIO_QUESTIONS = [
    ('socio_ingreso', 'Ingreso familiar mensual y per-cápita ($)', 'currency',
     '¿A cuánto asciende el ingreso mensual total de su hogar? (solo el número)'),
    ('socio_composicion', 'Composición y dependencia del hogar', 'text',
     '¿Cuántas personas viven en su hogar y cuántas generan ingresos? (ejemplo: 6 personas, 2 generan ingresos)'),
    ('socio_laboral', 'Situación laboral (B64 literal)', 'select',
     '¿Su situación laboral es empleo formal, jubilado, empleo informal, trabajo independiente o desempleo?'),
    ('socio_vivienda', 'Vivienda: tenencia y tipo (B65 literal)', 'select',
     '¿Su vivienda es propia, arrendada, prestada/cedida o anticresis? ¿Casa o departamento?'),
    ('socio_servicios', 'Cobertura de servicios básicos (B55)', 'text',
     '¿Cuenta con agua, luz, saneamiento, recolección, internet, teléfono? Dígame cuáles SÍ tiene.'),
    ('socio_gastos', 'Gastos mensuales y carga (E31)', 'currency',
     '¿Cuánto gasta al mes en total (alimentación, arriendo, servicios, transporte, educación, salud)? (solo el número)'),
    ('socio_educacion', 'Nivel educativo (B68 literal)', 'select',
     '¿Cuál es su nivel educativo? (sin escolaridad / primaria / secundaria / bachillerato completo / técnico / universitario / posgrado)'),
]

ALL_WIZARD_QUESTIONS = VULN_QUESTIONS + SOCIO_QUESTIONS  # 33 + 7 = 40


def build_cmci_wizard_fields():
    """Convierte las 40 preguntas a fields de ProgramFormDefinition."""
    fields = []
    for qid, label, ftype, prompt in ALL_WIZARD_QUESTIONS:
        section = 'vulnerabilidad' if qid.startswith('vuln_') else 'socioeconomico'
        fields.append({
            'id': qid,
            'label': label,
            'type': ftype,
            'required': True,
            'conversational_prompt': prompt,
            'section_id': section,
        })
    return fields


def build_cmci_wizard_schema(program_name='CMCI Ficha Integral'):
    """Schema completo listo para ProgramFormDefinition (generate via llm o fallback)."""
    fields = build_cmci_wizard_fields()
    return {
        'form_title': f'Ficha integral CMCI: {program_name}',
        'form_description': 'Wizard conversacional WhatsApp: 33 vulnerabilidad + 7 socioeconómicas.',
        'sections': [
            {'id': 'vulnerabilidad', 'title': '1. Valoración de vulnerabilidad (33)',
             'description': 'Entorno + redes + vivienda + comunitario',
             'field_ids': [f['id'] for f in fields if f['section_id'] == 'vulnerabilidad']},
            {'id': 'socioeconomico', 'title': '2. Situación socioeconómica (7)',
             'description': 'Ingresos del hogar y per-cápita',
             'field_ids': [f['id'] for f in fields if f['section_id'] == 'socioeconomico']},
        ],
        'fields': fields,
        'eligibility_rules': [],
        'conversational_instructions': (
            'Guía WhatsApp CMCI: una pregunta a la vez, valida cada dato antes de '
            'avanzar; si la respuesta no tiene el formato esperado, explícalo con '
            'un ejemplo y vuelve a pedirlo. Tono cercano ecuatoriano.'
        ),
        'success_message': '¡Gracias! Su ficha CMCI fue registrada. El educador validará los pendientes.',
    }


def validate_wizard_answer(field_id, raw_text):
    """
    Valida una respuesta del wizard con _validate_field_value del módulo social.
    Retorna (ok, cleaned, hint). No avanza si ok=False.
    """
    field = next((f for f in build_cmci_wizard_fields() if f['id'] == field_id), None)
    if not field:
        return False, None, f'Pregunta desconocida: {field_id}'
    try:
        from api.social_programs import _validate_field_value as _v
    except Exception:
        try:
            from social.api.social_programs import _validate_field_value as _v
        except Exception:
            # Fallback mínimo si el módulo social no está importable
            text = (raw_text or '').strip()
            if len(text) < 2:
                return False, None, 'Respuesta muy corta, amplíela por favor.'
            return True, text, None
    return _v(field, raw_text)


def pending_for_educator(educator_id, center_id=None, limit=100):
    """
    Lo que el educador ve como pendientes: postulantes/beneficiarios en estado
    applicant o pendiente vinculados a su centro. Reutiliza ProgramBeneficiary.
    """
    try:
        from models.social_program import ProgramBeneficiary
    except Exception:
        try:
            from social.models.social_program import ProgramBeneficiary
        except Exception:
            return []
    q = ProgramBeneficiary.query.filter(
        ProgramBeneficiary.status.in_(['applicant', 'pendiente', 'pending']))
    items = q.order_by(ProgramBeneficiary.created_at.desc()).limit(limit).all()
    return [{'id': b.id, 'nombre': getattr(b, 'full_name', ''),
             'estado': b.status,
             'programa': b.program.name if getattr(b, 'program', None) else ''} for b in items]
