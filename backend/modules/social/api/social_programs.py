"""
Social Programs & Dynamic Forms API
AI GovCoreX OS — Motor Dinámico de Programas Sociales y Fichas Personalizadas

Permite personalizar campos, secciones, reglas de elegibilidad y flujos de postulación
tanto visuales (Web Wizard) como conversacionales (Web Widget, WhatsApp, Telegram).
El Agente Copiloto puede crear programas y armar la estructura completa del formulario
con IA en lenguaje natural.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.social_program import SocialProgram, ProgramFormDefinition, ProgramBeneficiary
from models.inter_org import OrgProgramMembership, ProgramTeamMember
from models.organization import Organization
from models.user import User
import logging
import json
import re
from datetime import datetime

logger = logging.getLogger(__name__)

# Registered with url_prefix='/api/social' in app.py
social_programs_bp = Blueprint('social_programs', __name__)


@social_programs_bp.before_request
def _migrate_sections_once():
    """Garantiza la columna sections antes de cualquier SELECT del blueprint."""
    _ensure_sections_column()


# ═══════════════════════════════════════════════════════════════════════════════
# 0. HELPERS: normalización, validación estricta conversacional y auto-migración
# ═══════════════════════════════════════════════════════════════════════════════

import unicodedata


def _norm(s: str) -> str:
    """Minúsculas sin acentos, espacios colapsados. Para matching fuzzy."""
    if s is None:
        return ''
    s = str(s).strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s)


_NOISE_PATTERNS = {
    'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
    'que', 'qué', 'cmo', 'como', 'cómo', 'porque', 'por qué', 'por que',
    'no se', 'no entiendo', 'no entendi', 'qué?', 'que?', 'cmo?', 'hola?',
    'si', 'no', 'ok', 'vale', 'dale', '?', '??', '...', '.', 'xfa',
}

_CONVERSATIONAL_FILLER_PATTERNS = [
    r'\bya\s+(?:te\s+)?(?:lo\s+)?(?:di|dije|pase|mande|envie|puse)\b',
    r'\bya\s+esta\b',
    r'\bya\s+lo\s+hice\b',
    r'\bya\s+te\s+respondi\b',
    r'\bte\s+dije\b',
    r'\bte\s+lo\s+di\b',
    r'\bte\s+lo\s+dije\b',
    r'\bya\s+te\s+lo\s+di\s+pues\b',
    r'\bno\s+quiero\b',
    r'\by\s+si\s+no\s+(?:quiero|tengo|puedo)\b',
    r'\bno\s+tengo\b',
    r'\bno\s+se\b',
    r'\bno\s+entiendo\b',
    r'\bcomo\s+asi\b',
    r'\bque\s+cosa\b',
    r'\bque\s+pasa\b',
    r'\bque\s+te\s+pasa\b',
    r'\bque\s+quieres\b',
    r'\bpara\s+que\s+(?:quieres|necesitas|pides)\b',
    r'\bpor\s+que\s+(?:quieres|necesitas|pides)\b',
]

_COMMON_SPANISH_FUNCTION_WORDS = {
    'ya', 'te', 'lo', 'la', 'los', 'las', 'le', 'les', 'me', 'se', 'nos',
    'di', 'dije', 'dio', 'dijiste', 'pues', 'que', 'como', 'porque', 'cuando', 'donde', 'quien',
    'si', 'no', 'mi', 'tu', 'su', 'es', 'son', 'fue', 'era', 'un', 'una', 'uno', 'unos', 'unas',
    'por', 'para', 'con', 'sin', 'sobre', 'pero', 'mas', 'aunque', 'hola', 'buenas', 'chao',
    'adios', 'gracias', 'favor', 'mira', 'oye', 'espera', 'dame', 'tengo', 'puedo', 'quiero',
    'bien', 'mal', 'muy', 'tan', 'asi', 'aqui', 'alla', 'ahi', 'esto', 'eso', 'aquello',
    'cosa', 'nada', 'algo', 'otro', 'otra', 'otros', 'otras', 'todo', 'toda', 'todos', 'todas'
}


def _is_noise(text: str) -> bool:
    t = _norm(text).strip(' ?¡!.,')
    if not t or len(t) < 2:
        return True
    if t in _NOISE_PATTERNS:
        return True
    # Mensajes de 1 sola palabra muy corta sin dígitos no son datos válidos
    if len(t) <= 3 and not re.search(r'\d', t):
        return True
    for pat in _CONVERSATIONAL_FILLER_PATTERNS:
        if re.search(pat, t):
            return True
    return False


def _validate_ecuador_cedula(ced: str) -> bool:
    """Algoritmo módulo 10 para cédula ecuatoriana."""
    if not re.fullmatch(r'\d{10}', ced or ''):
        return False
    try:
        digits = [int(d) for d in ced]
        total = 0
        for i in range(9):
            v = digits[i] * (2 if i % 2 == 0 else 1)
            if v >= 10:
                v -= 9
            total += v
        check = (10 - (total % 10)) % 10
        return check == digits[9]
    except Exception:
        return False


def _try_parse_date(text: str):
    """Acepta dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, '12 de marzo de 2020'. Retorna yyyy-mm-dd o None."""
    if not text:
        return None
    t = str(text).strip()
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d/%m/%y', '%d-%m-%y'):
        try:
            return datetime.strptime(t, fmt).strftime('%Y-%m-%d')
        except Exception:
            pass
    m = re.search(r'(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+|\s+)(\d{4})', _norm(t))
    if m:
        meses = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
                 'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9, 'octubre': 10,
                 'noviembre': 11, 'diciembre': 12}
        try:
            d, mon, y = int(m.group(1)), meses.get(m.group(2), 0), int(m.group(3))
            if mon and 1 <= d <= 31 and 1900 <= y <= datetime.utcnow().year:
                return f"{y:04d}-{mon:02d}-{d:02d}"
        except Exception:
            pass
    m2 = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', t)
    if m2:
        try:
            return datetime(int(m2.group(1)), int(m2.group(2)), int(m2.group(3))).strftime('%Y-%m-%d')
        except Exception:
            pass
    m3 = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', t)
    if m3:
        try:
            return datetime(int(m3.group(3)), int(m3.group(2)), int(m3.group(1))).strftime('%Y-%m-%d')
        except Exception:
            pass
    return None


_SKIP_WORDS = {'no tengo', 'no aplica', 'omitir', 'saltar', 'ninguno', 'n/a', 'na', 'no'}


def _validate_field_value(field: dict, raw_text: str):
    """
    Valida el texto del usuario contra el tipo del campo.
    Retorna (ok: bool, cleaned_value, error_hint: str|None).
    Si ok=False el llamador NO debe avanzar al siguiente campo.
    """
    ftype = (field.get('type') or 'text').lower()
    label = field.get('label') or field.get('id')
    required = field.get('required', True)
    validation = field.get('validation') or {}
    text = (raw_text or '').strip()
    tnorm = _norm(text)

    # Skip explícito en opcionales
    if not required and tnorm in _SKIP_WORDS:
        return True, None, None

    # Ruido genérico: nunca aceptarlo como dato
    if _is_noise(text):
        ex = field.get('placeholder') or ('0912345678' if ftype == 'cedula' else ('Juan Pérez' if ftype == 'text' else ''))
        ex_str = f" Ejemplo: {ex}." if ex else ""
        return False, None, f"No logré identificar el dato solicitado para {label}.{ex_str}"

    if ftype == 'text':
        cleaned = re.sub(r'\s+', ' ', text).strip()
        if len(cleaned) < 3:
            return False, None, f"Su {label} parece muy corto. Escríbalo completo (mínimo 3 letras)."
        # Campos de nombre: exigir al menos nombre + apellido
        fid = (field.get('id') or '').lower()
        if fid in ('full_name', 'child_full_name', 'nombre', 'representante', 'nombre_nino') or 'nombre' in fid or 'apellido' in _norm(label):
            # No puede tener números ni puntuaciones extrañas
            if re.search(r'\d|[?!¿¡@#$%^&*()_+={}\[\]:;"<>,/|\\]', cleaned):
                return False, None, f"Por favor ingrese únicamente letras para {label}. Ejemplo: Carlos Andrade."
            parts = [p for p in re.split(r'\s+', cleaned) if len(p) >= 2]
            if len(parts) < 2:
                return False, None, (
                    f"Por favor indique su {label} completo (nombres y apellidos). "
                    f"Ejemplo: Carlos Alberto Mendoza."
                )
            # Verificar que no sean palabras funcionales/conversacionales
            words_lower = [_norm(p) for p in parts]
            func_count = sum(1 for w in words_lower if w in _COMMON_SPANISH_FUNCTION_WORDS)
            if func_count >= len(words_lower) * 0.4 or any(w in ('ya', 'te', 'lo', 'di', 'dije', 'pues', 'no', 'si') for w in words_lower):
                return False, None, f"No logré identificar un nombre de persona válido en '{cleaned}'. Por favor proporcione los nombres y apellidos reales."
        return True, cleaned, None

    if ftype == 'cedula':
        nums = re.findall(r'\d+', text)
        joined = ''.join(nums)
        m10 = re.findall(r'\b\d{10}\b', joined) or re.findall(r'\b\d{10}\b', text)
        cand = m10[0] if m10 else (joined if len(joined) == 10 else None)
        if not cand:
            return False, None, "La cédula debe tener exactamente 10 dígitos numéricos. Ejemplo: 0912345678. Inténtelo de nuevo."
        if not _validate_ecuador_cedula(cand):
            return False, None, f"El número {cand} no pasa la validación de cédula ecuatoriana (dígito verificador). Revíselo e ingréselo de nuevo."
        return True, cand, None

    if ftype in ('number', 'currency'):
        nums = re.findall(r'\d+(?:[.,]\d+)?', text.replace('$', ''))
        if not nums:
            return False, None, f"Necesito un número para {label}. Ejemplo: {field.get('placeholder') or '2'}. Solo el número, por favor."
        try:
            val = float(nums[0].replace(',', '.'))
        except Exception:
            return False, None, f"No entendí el número para {label}. Ejemplo: {field.get('placeholder') or '2'}."
        vmin, vmax = validation.get('min'), validation.get('max')
        fid = (field.get('id') or '').lower()
        # Rangos de sentido común por campo
        if fid in ('peso', 'weight', 'peso_actual', 'child_weight') and not (1 <= val <= 300):
            return False, None, "El peso debe estar entre 1 y 300 kg. Ejemplo: 12.5. Indíquelo de nuevo."
        if fid in ('talla', 'height', 'talla_actual', 'child_height') and not (20 <= val <= 250):
            return False, None, "La talla debe estar entre 20 y 250 cm. Ejemplo: 85. Indíquela de nuevo."
        if vmin is not None and val < vmin:
            return False, None, f"El valor mínimo para {label} es {vmin}."
        if vmax is not None and val > vmax:
            return False, None, f"El valor máximo para {label} es {vmax}."
        return True, int(val) if val.is_integer() and ftype == 'number' else val, None

    if ftype == 'date':
        parsed = _try_parse_date(text)
        if not parsed:
            return False, None, f"Necesito la fecha de {label} en formato día/mes/año. Ejemplo: 15/03/2021."
        try:
            dt = datetime.strptime(parsed, '%Y-%m-%d').date()
            if dt > datetime.utcnow().date():
                return False, None, "La fecha no puede ser futura. Revísela (día/mes/año)."
        except Exception:
            pass
        return True, parsed, None

    if ftype == 'select':
        options = field.get('options') or []
        if not options:
            return True, text, None
        # Match exacto o fuzzy sin acentos
        for opt in options:
            if _norm(opt) == tnorm or tnorm in _norm(opt) or _norm(opt) in tnorm:
                return True, opt, None
        # Intento por número de opción ("la 2", "opción 1")
        mnum = re.search(r'\d+', text)
        if mnum:
            try:
                idx = int(mnum.group(0)) - 1
                if 0 <= idx < len(options):
                    return True, options[idx], None
            except Exception:
                pass
        opts_txt = ', '.join(options)
        return False, None, f"Elija una opción válida para {label}: {opts_txt}."

    if ftype == 'boolean':
        yes = {'si', 'sí', 'claro', 'afirmativo', 'correcto', 'verdad', 'tengo', 'tiene', 'hay', 'mucho', 'bastante'}
        no_ = {'no', 'ninguno', 'ninguna', 'nada', 'tampoco', 'jamas', 'nunca'}
        if tnorm in yes or any(w in tnorm.split() for w in ['si', 'sí']):
            # Evitar que "si ..." ambiguo pase sin más; exigir afirmación clara
            return True, True, None
        if tnorm in no_ or tnorm.startswith('no '):
            return True, False, None
        return False, None, f"Responda Sí o No para: {label}."

    if ftype == 'file':
        return False, None, f"Para {label} adjunte el archivo en el formulario web. Si no lo tiene ahora escriba 'omitir'."

    # Fallback genérico
    if len(text.strip()) < 2:
        return False, None, f"Su respuesta para {label} es muy corta. Amplíela, por favor."
    return True, text.strip(), None


def _generate_human_conversational_retry(program_name: str, field: dict, user_message: str, validation_hint: str) -> str:
    """
    Genera una respuesta natural, empática y comprensiva cuando la validación determinista falla.
    Si el usuario saluda, pregunta por qué se le pide el dato, o expresa confusión, el asistente
    le responde con calidez humana y le explica con paciencia, sin avanzar al siguiente campo.
    """
    label = field.get('label') or field.get('id')
    ftype = (field.get('type') or 'text').lower()
    prompt_q = field.get('conversational_prompt') or f"Por favor indíqueme su {label}."
    placeholder = field.get('placeholder') or ('10 dígitos numéricos' if ftype == 'cedula' else '')

    # Intentar usar el LLM configurado (OpenAI / Gemini)
    try:
        from agents.llm_interface import get_llm
        llm = get_llm()
        system_prompt = (
            "Eres el asistente oficial empático, servicial y humano del programa gubernamental: "
            f"'{program_name}'. Estás guiando a un ciudadano en su proceso de postulación paso a paso.\n\n"
            "SITUACIÓN ACTUAL:\n"
            f"- Dato obligatorio que necesitas registrar: '{label}' (tipo: {ftype}).\n"
            f"- Pregunta estándar: '{prompt_q}'.\n"
            f"- Validación requerida: '{validation_hint}'.\n"
            f"- Mensaje reciente del ciudadano: \"{user_message}\".\n\n"
            "INSTRUCCIONES CLAVE:\n"
            "1. Responde con lenguaje 100% natural, cálido, empático y humano (como un servidor público amable).\n"
            "2. NUNCA respondas con plantillas robóticas como 'Disculpe, No pude identificar...'.\n"
            "3. Si el usuario saluda ('hola', 'buenas'), salúdalo afectuosamente y dale la bienvenida.\n"
            "4. Si el usuario muestra duda o extrañeza ('qué?', 'cómo?', 'por qué?'), explícale con amabilidad y en lenguaje sencillo por qué este dato es indispensable para registrar su ficha en el sistema.\n"
            "5. Pídele amablemente que te indique el dato solicitado, dando un ejemplo real y claro (por ejemplo, si es cédula, menciona un número de 10 dígitos como 0912345678; si es nombre, un nombre y apellido; etc.). NUNCA uses el nombre del campo como ejemplo.\n"
            "6. Mantén tu respuesta breve (2 a 3 frases) y en tono cercano y servicial."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        response = llm.chat_completion(messages, temperature=0.6, max_tokens=150)
        if response and len(response.strip()) > 10:
            return response.strip()
    except Exception as e:
        logger.warning(f"Error invoking LLM for human conversational retry: {e}")

    # Fallback conversacional humano en caso de fallo de red o cuota del LLM
    tnorm = _norm(user_message).strip(' ?¡!.,')
    greetings = {'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'}
    if tnorm in greetings or any(user_message.lower().startswith(g) for g in ['hola', 'buenas']):
        return (
            f"¡Hola! Un gusto saludarte. Para poder iniciar y avanzar con tu postulación en el programa "
            f"*{program_name}*, primero necesitamos registrar tu {label}. ¿Podrías indicármelo, por favor?"
        )
    if tnorm in {'que', 'que?', 'como', 'como?', 'por que', 'para que'} or '?' in user_message:
        return (
            f"Te explico con mucho gusto: para registrar tu solicitud en el sistema y verificar los requisitos, "
            f"es indispensable contar con tu {label}. {validation_hint}. {prompt_q}"
        )
    return f"Comprendo. {validation_hint}. {prompt_q}"


_SECTIONS_MIGRATED = False


def _ensure_sections_column():
    """Auto-migración idempotente: agrega sections JSON a program_form_definitions si falta.
    Se ejecuta una sola vez por proceso; llamada al inicio de cada endpoint de
    formularios ANTES de leer program.form_definition para que el SELECT no falle
    en instalaciones aún sin la columna."""
    global _SECTIONS_MIGRATED
    if _SECTIONS_MIGRATED:
        return
    try:
        from sqlalchemy import text as _stext
        with db.engine.connect() as conn:
            try:
                conn.execute(_stext("ALTER TABLE program_form_definitions ADD COLUMN sections JSON NULL"))
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass  # ya existe o motor sin soporte IF NOT EXISTS
    except Exception:
        pass
    _SECTIONS_MIGRATED = True


def _get_form_sections(form_def) -> list:
    """Lee sections tolerando instalaciones sin la columna (usa field_ids por defecto)."""
    try:
        secs = getattr(form_def, 'sections', None)
        if secs:
            return secs
    except Exception:
        pass
    fields = getattr(form_def, 'fields', None) or []
    return [{'id': 'default_section', 'title': 'Información de Postulación',
             'description': 'Complete todos los campos requeridos',
             'field_ids': [f.get('id') for f in fields]}]


def _set_form_sections(form_def, sections) -> None:
    _ensure_sections_column()
    try:
        form_def.sections = sections
    except Exception as e:
        logger.warning(f"Could not persist sections (migration pending): {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. HELPER: Heuristic & AI Dynamic Form Schema Generator
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_default_social_form(program_name: str, category: str = 'social', description: str = '') -> dict:
    """Generador base de estructura de formulario con secciones y campos dinámicos"""
    return {
        "form_title": f"Ficha de Postulación: {program_name}",
        "form_description": description or f"Proceso de registro y calificación socioeconómica para {program_name}.",
        "sections": [
            {
                "id": "datos_titular",
                "title": "1. Datos del Solicitante / Titular",
                "description": "Información personal y de contacto del jefe de hogar",
                "field_ids": ["full_name", "cedula", "phone", "email", "province", "canton", "address"]
            },
            {
                "id": "composicion_hogar",
                "title": "2. Composición Familiar & Vulnerabilidad",
                "description": "Cargas familiares y condiciones especiales",
                "field_ids": ["household_members", "children_count", "elderly_count", "has_disabilities"]
            },
            {
                "id": "socioeconomico",
                "title": "3. Situación Socioeconómica & Vivienda",
                "description": "Ingresos mensuales, ocupación y tenencia de vivienda",
                "field_ids": ["monthly_income", "employment_status", "housing_type", "electricity_code"]
            }
        ],
        "fields": [
            {
                "id": "full_name",
                "label": "Nombre Completo",
                "type": "text",
                "required": True,
                "placeholder": "Nombres y apellidos completos",
                "conversational_prompt": "¿Cuál es su nombre y apellido completo?",
                "section_id": "datos_titular"
            },
            {
                "id": "cedula",
                "label": "Número de Cédula de Identidad",
                "type": "cedula",
                "required": True,
                "placeholder": "10 dígitos numéricos",
                "conversational_prompt": "Por favor indíqueme su número de cédula (10 dígitos).",
                "validation": {"min_length": 10, "max_length": 10},
                "section_id": "datos_titular"
            },
            {
                "id": "phone",
                "label": "Teléfono Móvil / WhatsApp",
                "type": "text",
                "required": True,
                "placeholder": "0991234567",
                "conversational_prompt": "¿A qué número de celular o WhatsApp podemos contactarlo?",
                "section_id": "datos_titular"
            },
            {
                "id": "email",
                "label": "Correo Electrónico (Opcional)",
                "type": "text",
                "required": False,
                "placeholder": "ejemplo@correo.com",
                "conversational_prompt": "¿Tiene un correo electrónico de contacto? (opcional)",
                "section_id": "datos_titular"
            },
            {
                "id": "province",
                "label": "Provincia",
                "type": "select",
                "required": True,
                "options": ["Guayas", "Pichincha", "Manabí", "Azuay", "Los Ríos", "El Oro", "Esmeraldas", "Santa Elena", "Otra"],
                "conversational_prompt": "¿En qué provincia reside actualmente?",
                "section_id": "datos_titular"
            },
            {
                "id": "canton",
                "label": "Cantón / Ciudad",
                "type": "text",
                "required": True,
                "placeholder": "Ej: Guayaquil, Quito, Durán",
                "conversational_prompt": "¿En qué cantón o ciudad vive?",
                "section_id": "datos_titular"
            },
            {
                "id": "address",
                "label": "Dirección Domiciliaria",
                "type": "text",
                "required": True,
                "placeholder": "Calle, número y referencia",
                "conversational_prompt": "¿Cuál es la dirección exacta de su domicilio?",
                "section_id": "datos_titular"
            },
            {
                "id": "household_members",
                "label": "Número de Personas en el Hogar",
                "type": "number",
                "required": True,
                "placeholder": "Ej: 4",
                "conversational_prompt": "¿Cuántas personas viven y comen en su hogar?",
                "scoring_weight": 15,
                "section_id": "composicion_hogar"
            },
            {
                "id": "children_count",
                "label": "Hijos Menores de Edad",
                "type": "number",
                "required": True,
                "placeholder": "Ej: 2",
                "conversational_prompt": "¿Cuántos hijos menores de 18 años viven con usted?",
                "scoring_weight": 25,
                "section_id": "composicion_hogar"
            },
            {
                "id": "has_disabilities",
                "label": "¿Alguien en el hogar tiene discapacidad o enfermedad catastrófica?",
                "type": "boolean",
                "required": False,
                "conversational_prompt": "¿Existe algún miembro en su hogar con discapacidad severa o enfermedad catastrófica?",
                "scoring_weight": 25,
                "section_id": "composicion_hogar"
            },
            {
                "id": "monthly_income",
                "label": "Ingreso Familiar Mensual Aproximado ($)",
                "type": "currency",
                "required": True,
                "placeholder": "0.00",
                "conversational_prompt": "¿A cuánto asciende aproximadamente el ingreso mensual total de su hogar?",
                "scoring_weight": 35,
                "section_id": "socioeconomico"
            },
            {
                "id": "housing_type",
                "label": "Condición de la Vivienda",
                "type": "select",
                "required": True,
                "options": ["Propia", "Arrendada", "Prestada / Cedida", "Asentamiento precario"],
                "conversational_prompt": "¿Su vivienda es propia, arrendada o prestada?",
                "scoring_weight": 10,
                "section_id": "socioeconomico"
            }
        ],
        "eligibility_rules": [
            {"field": "monthly_income", "operator": "<=", "value": 250, "points": 35},
            {"field": "children_count", "operator": ">=", "value": 2, "points": 25},
            {"field": "has_disabilities", "operator": "==", "value": True, "points": 25},
            {"field": "housing_type", "operator": "in", "value": ["Prestada / Cedida", "Asentamiento precario"], "points": 15}
        ],
        "min_eligibility_score": 50,
        "conversational_instructions": (
            f"Eres el Asistente Virtual especializado del programa {program_name}. "
            "Guía a la familia con empatía, lenguaje claro y respetuoso. Si el usuario proporciona "
            "varios datos en un solo mensaje (ej: 'Me llamo Juan, cédula 0912... y tengo 3 hijos'), "
            "asigna todos los datos correspondientes y continúa con las preguntas faltantes."
        ),
        "success_message": (
            f"✅ ¡Muchas gracias! Su postulación para '{program_name}' ha sido registrada exitosamente. "
            "Nuestro equipo social revisará la información y le contactará por WhatsApp o llamada telefónica."
        )
    }


# ── Generación inteligente en base al prompt/TDR (punto 1) ──

_BASE_IDENTITY_FIELDS = [
    {"id": "full_name", "label": "Nombres y Apellidos del Solicitante", "type": "text",
     "required": True, "placeholder": "Nombres y apellidos completos",
     "conversational_prompt": "Para comenzar, ¿cuál es su nombre y apellido completo?",
     "scoring_weight": 5, "section_id": "datos_titular"},
    {"id": "cedula", "label": "Número de Cédula de Identidad", "type": "cedula",
     "required": True, "placeholder": "10 dígitos numéricos",
     "conversational_prompt": "Por favor indíqueme su número de cédula (10 dígitos).",
     "validation": {"min_length": 10, "max_length": 10}, "scoring_weight": 5, "section_id": "datos_titular"},
    {"id": "phone", "label": "Teléfono Móvil / WhatsApp", "type": "text",
     "required": True, "placeholder": "0991234567",
     "conversational_prompt": "¿A qué número de celular o WhatsApp podemos contactarlo?",
     "scoring_weight": 5, "section_id": "datos_titular"},
]

# Mapa keyword (normalizado) -> campos extra. Permite que el detalle del usuario sí genere campos.
_SMART_FIELD_CATALOG = [
    (['nino', 'nina', 'hijo', 'infantil', 'nutric', 'desarrollo infantil', 'menor de', 'pediat'],
     [
        {"id": "child_full_name", "label": "Nombres y Apellidos del Niño/a", "type": "text", "required": True,
         "placeholder": "Nombres y apellidos del niño/a",
         "conversational_prompt": "Por favor indíqueme los Nombres y Apellidos del Niño/a:",
         "scoring_weight": 10, "section_id": "datos_nino"},
        {"id": "birth_date", "label": "Fecha de Nacimiento", "type": "date", "required": True,
         "placeholder": "dd/mm/aaaa",
         "conversational_prompt": "Por favor indíqueme su Fecha de Nacimiento (día/mes/año, ejemplo 15/03/2021):",
         "scoring_weight": 10, "section_id": "datos_nino"},
        {"id": "child_weight", "label": "Peso Actual (kg)", "type": "number", "required": True,
         "placeholder": "Ej: 12.5",
         "conversational_prompt": "Por favor indíqueme su Peso Actual en kilogramos (solo el número, ejemplo 12.5):",
         "validation": {"min": 1, "max": 300}, "scoring_weight": 15, "section_id": "datos_nino"},
        {"id": "child_height", "label": "Talla Actual (cm)", "type": "number", "required": True,
         "placeholder": "Ej: 85",
         "conversational_prompt": "Por favor indíqueme su Talla Actual en centímetros (solo el número, ejemplo 85):",
         "validation": {"min": 20, "max": 250}, "scoring_weight": 15, "section_id": "datos_nino"},
     ]),
    (['adulto mayor', 'tercera edad', 'geriatr', 'anciano'],
     [
        {"id": "elderly_count", "label": "Adultos Mayores en el Hogar", "type": "number", "required": True,
         "placeholder": "Ej: 1", "conversational_prompt": "¿Cuántos adultos mayores viven en su hogar?",
         "scoring_weight": 20, "section_id": "composicion_hogar"},
        {"id": "elderly_care", "label": "¿Requiere cuidado permanente?", "type": "boolean", "required": False,
         "conversational_prompt": "¿El adulto mayor requiere cuidado permanente? (Sí/No)",
         "scoring_weight": 15, "section_id": "composicion_hogar"},
     ]),
    (['discapac', 'catastr', 'vulnerab'],
     [
        {"id": "has_disabilities", "label": "¿Alguien en el hogar tiene discapacidad o enfermedad catastrófica?",
         "type": "boolean", "required": False,
         "conversational_prompt": "¿Existe algún miembro en su hogar con discapacidad severa o enfermedad catastrófica? (Sí/No)",
         "scoring_weight": 25, "section_id": "composicion_hogar"},
        {"id": "disability_type", "label": "Tipo de discapacidad / enfermedad", "type": "text", "required": False,
         "placeholder": "Ej: motriz, visual, diabetes",
         "conversational_prompt": "¿Qué tipo de discapacidad o enfermedad es?",
         "scoring_weight": 5, "section_id": "composicion_hogar"},
     ]),
    (['ingreso', 'sueldo', 'salario', 'pobreza', 'socioeconom', 'empleo', 'trabajo', 'ocupacion', 'emprend'],
     [
        {"id": "monthly_income", "label": "Ingreso Familiar Mensual Aproximado ($)", "type": "currency",
         "required": True, "placeholder": "0.00",
         "conversational_prompt": "¿A cuánto asciende aproximadamente el ingreso mensual total de su hogar? (solo el número)",
         "scoring_weight": 35, "section_id": "socioeconomico"},
        {"id": "employment_status", "label": "Ocupación del Solicitante", "type": "select", "required": False,
         "options": ["Empleado", "Independiente", "Desempleado", "Jubilado", "Ama de casa"],
         "conversational_prompt": "¿Cuál es su ocupación? (Empleado, Independiente, Desempleado, Jubilado, Ama de casa)",
         "scoring_weight": 5, "section_id": "socioeconomico"},
     ]),
    (['vivienda', 'techo', 'casa', 'hogar', 'habitat'],
     [
        {"id": "housing_type", "label": "Condición de la Vivienda", "type": "select", "required": True,
         "options": ["Propia", "Arrendada", "Prestada / Cedida", "Asentamiento precario"],
         "conversational_prompt": "¿Su vivienda es propia, arrendada, prestada o asentamiento precario?",
         "scoring_weight": 10, "section_id": "socioeconomico"},
        {"id": "address", "label": "Dirección Domiciliaria", "type": "text", "required": True,
         "placeholder": "Calle, número y referencia",
         "conversational_prompt": "¿Cuál es la dirección exacta de su domicilio?",
         "scoring_weight": 5, "section_id": "datos_titular"},
     ]),
    (['agua potable', 'agua', 'alcantarill', 'luz', 'electricidad', 'servicios basicos'],
     [
        {"id": "water_access", "label": "¿Tiene acceso a agua potable?", "type": "boolean", "required": True,
         "conversational_prompt": "¿Su hogar tiene acceso a agua potable? (Sí/No)",
         "scoring_weight": 15, "section_id": "socioeconomico"},
        {"id": "electricity_code", "label": "Código de luz / suministro", "type": "text", "required": False,
         "placeholder": "Código de planilla",
         "conversational_prompt": "¿Cuál es el código de su planilla de luz? (si lo tiene)",
         "scoring_weight": 5, "section_id": "socioeconomico"},
     ]),
    (['educacion', 'escuela', 'colegio', 'beca', 'estudio', 'universidad'],
     [
        {"id": "education_level", "label": "Nivel educativo del solicitante", "type": "select", "required": False,
         "options": ["Sin instrucción", "Primaria", "Secundaria", "Superior", "Posgrado"],
         "conversational_prompt": "¿Cuál es su nivel educativo? (Sin instrucción, Primaria, Secundaria, Superior, Posgrado)",
         "scoring_weight": 10, "section_id": "socioeconomico"},
     ]),
    (['salud', 'medico', 'hospital', 'vacuna', 'control medico'],
     [
        {"id": "health_center", "label": "Centro de salud más cercano", "type": "text", "required": False,
         "placeholder": "Nombre del centro de salud",
         "conversational_prompt": "¿Cuál es el centro de salud más cercano a su domicilio?",
         "scoring_weight": 5, "section_id": "socioeconomico"},
     ]),
    (['provincia', 'canton', 'ciudad', 'parroquia', 'territorio', 'cobertura'],
     [
        {"id": "province", "label": "Provincia", "type": "select", "required": True,
         "options": ["Guayas", "Pichincha", "Manabí", "Azuay", "Los Ríos", "El Oro", "Esmeraldas", "Santa Elena", "Otra"],
         "conversational_prompt": "¿En qué provincia reside actualmente?",
         "scoring_weight": 5, "section_id": "datos_titular"},
        {"id": "canton", "label": "Cantón / Ciudad", "type": "text", "required": True,
         "placeholder": "Ej: Guayaquil, Quito, Durán",
         "conversational_prompt": "¿En qué cantón o ciudad vive?",
         "scoring_weight": 5, "section_id": "datos_titular"},
     ]),
]


def _infer_category(instruction: str) -> str:
    t = _norm(instruction or '')
    if any(k in t for k in ['adulto mayor', 'tercera edad']):
        return 'adulto_mayor'
    if any(k in t for k in ['nutric', 'infantil', 'nino', 'nina', 'pediat', 'desarrollo infantil']):
        return 'infancia'
    if any(k in t for k in ['vivienda', 'techo', 'habitat']):
        return 'vivienda'
    if any(k in t for k in ['empleo', 'emprend', 'trabajo', 'microcredito']):
        return 'desarrollo_economico'
    if any(k in t for k in ['salud', 'medico', 'hospital']):
        return 'salud'
    if any(k in t for k in ['educacion', 'beca', 'escuela']):
        return 'educacion'
    return 'social'


def _build_smart_fallback_schema(program_name: str, category: str, prompt_text: str) -> dict:
    """
    Fallback determinístico PERO sensible al prompt: combina identidad base +
    bloques del catálogo cuyos keywords aparecen en el detalle del usuario.
    Garantiza que el detalle SÍ influye aunque el LLM falle.
    """
    tnorm = _norm(prompt_text or '')
    fields = [dict(f) for f in _BASE_IDENTITY_FIELDS]
    seen = {f['id'] for f in fields}
    matched_any = False
    for keywords, extra in _SMART_FIELD_CATALOG:
        if any(k in tnorm for k in keywords):
            matched_any = True
            for f in extra:
                if f['id'] not in seen:
                    fields.append(dict(f))
                    seen.add(f['id'])
    if not matched_any:
        # Sin keywords: conservar comportamiento anterior para no romper programas genéricos
        base = _generate_default_social_form(program_name, category, prompt_text)
        return base
    # Secciones dinámicas según los section_id realmente usados
    order = ['datos_titular', 'datos_nino', 'composicion_hogar', 'socioeconomico']
    titles = {'datos_titular': '1. Datos del Solicitante / Titular',
              'datos_nino': '2. Datos del Niño/a',
              'composicion_hogar': '3. Composición Familiar & Vulnerabilidad',
              'socioeconomico': '4. Situación Socioeconómica & Vivienda'}
    sections = []
    for sid in order:
        ids = [f['id'] for f in fields if f.get('section_id') == sid]
        if ids:
            sections.append({'id': sid, 'title': titles.get(sid, sid),
                             'description': '', 'field_ids': ids})
    # Reglas: extraer umbrales tipo "ingreso menor a $200" o "más de 2 niños"
    rules = []
    m_inc = re.search(r'ingreso[^0-9]*\$?\s*(\d+(?:[.,]\d+)?)', tnorm)
    if m_inc:
        try:
            thr = float(m_inc.group(1).replace(',', '.'))
            rules.append({"field": "monthly_income", "operator": "<=", "value": thr, "points": 35})
        except Exception:
            pass
    elif any(f['id'] == 'monthly_income' for f in fields):
        rules.append({"field": "monthly_income", "operator": "<=", "value": 250, "points": 35})
    if any(f['id'] == 'has_disabilities' for f in fields):
        rules.append({"field": "has_disabilities", "operator": "==", "value": True, "points": 25})
    if any(f['id'] == 'housing_type' for f in fields):
        rules.append({"field": "housing_type", "operator": "in",
                      "value": ["Prestada / Cedida", "Asentamiento precario"], "points": 15})
    if any(f['id'] == 'water_access' for f in fields):
        rules.append({"field": "water_access", "operator": "==", "value": False, "points": 20})
    return {
        "form_title": f"Ficha de Postulación: {program_name}",
        "form_description": prompt_text or f"Proceso de registro para {program_name}.",
        "sections": sections,
        "fields": fields,
        "eligibility_rules": rules,
        "min_eligibility_score": 50,
        "conversational_instructions": (
            f"Eres el Asistente Virtual especializado del programa {program_name}. "
            "Guía con empatía y lenguaje claro. Valida cada dato antes de avanzar: "
            "si la respuesta no tiene el formato esperado, explícalo con un ejemplo y vuelve a pedirlo. "
            "Nunca aceptes saludos o dudas ('hola', 'qué?') como datos."
        ),
        "success_message": (
            f"✅ ¡Muchas gracias! Su postulación para '{program_name}' ha sido registrada exitosamente. "
            "Nuestro equipo social revisará la información y le contactará por WhatsApp o llamada telefónica."
        ),
    }


def _generate_schema_via_llm(program_name: str, prompt_text: str) -> dict | None:
    """Intenta generar el schema con el LLM respetando los campos pedidos. Retorna None si falla."""
    try:
        from agents.llm_interface import get_llm
        llm = get_llm()
        system_msg = (
            "Eres el Diseñador Agéntico de Formularios Sociales de AI GovCoreX OS. "
            "Respondes SOLO con un objeto JSON válido (sin markdown, sin ```). "
            "Llaves exactas: form_title, form_description, sections, fields, eligibility_rules, "
            "conversational_instructions, success_message. "
            "REGLA CRÍTICA: cada dato que el usuario pida explícitamente en el prompt "
            "(ej: cédula, hijos, ingreso, vivienda, agua potable, discapacidad, peso, talla, fecha nacimiento) "
            "DEBE convertirse en un field. No uses plantillas fijas: deriva los fields del prompt. "
            "Cada field: id (snake_case), label, type ('text'|'number'|'currency'|'select'|'boolean'|'date'|'cedula'|'file'), "
            "required (bool), placeholder, conversational_prompt (pregunta natural en español para WhatsApp, "
            "incluyendo ejemplo de formato), scoring_weight (5-40), section_id, y si aplica options/validation "
            "(min/max para number, min_length/max_length para cedula). "
            "Incluye SIEMPRE full_name, cedula y phone como base salvo que el prompt diga lo contrario."
        )
        user_msg = f"Programa: '{program_name}'. Detalle/TDR del usuario: {prompt_text}. Genera la ficha completa."
        raw_res = llm.chat_completion([
            {'role': 'system', 'content': system_msg},
            {'role': 'user', 'content': user_msg}
        ], temperature=0.3, max_tokens=3500)
        clean = (raw_res or '').strip().replace('```json', '').replace('```', '').strip()
        # Recortar a primer {...} último {...} por si el modelo agrega texto
        start, end = clean.find('{'), clean.rfind('}')
        if start >= 0 and end > start:
            clean = clean[start:end + 1]
        schema = json.loads(clean)
        if not isinstance(schema.get('fields'), list) or not schema['fields']:
            return None
        # Normalizar fields mínimos
        for f in schema['fields']:
            f.setdefault('required', True)
            f.setdefault('section_id', 'datos_titular')
            if not f.get('conversational_prompt'):
                f['conversational_prompt'] = f"Por favor indíqueme su {f.get('label', f.get('id'))}:"
        if not isinstance(schema.get('sections'), list) or not schema['sections']:
            fids = [f.get('id') for f in schema['fields']]
            schema['sections'] = [{'id': 'datos_titular', 'title': '1. Datos de Postulación',
                                   'description': '', 'field_ids': fids}]
        schema.setdefault('eligibility_rules', [])
        schema.setdefault('conversational_instructions', '')
        schema.setdefault('success_message', 'Postulación registrada.')
        return schema
    except Exception as e:
        logger.warning(f"LLM schema generation failed: {e}")
        return None


def _calculate_eligibility_score(form_data: dict, rules: list) -> tuple:
    """Calcula el score de elegibilidad (0 a 100) en base a las reglas configuradas"""
    score = 0.0
    notes = []
    if not rules or not isinstance(rules, list):
        return 75.0, "Evaluación estándar completada."

    for rule in rules:
        field_id = rule.get('field')
        op = rule.get('operator')
        threshold = rule.get('value')
        points = float(rule.get('points', 0))

        val = form_data.get(field_id)
        if val is None:
            continue

        matched = False
        try:
            if op == '<=':
                matched = float(val) <= float(threshold)
            elif op == '>=':
                matched = float(val) >= float(threshold)
            elif op == '<':
                matched = float(val) < float(threshold)
            elif op == '>':
                matched = float(val) > float(threshold)
            elif op == '==':
                matched = str(val).lower() == str(threshold).lower()
            elif op == 'in' and isinstance(threshold, list):
                matched = val in threshold
        except Exception:
            pass

        if matched:
            score += points
            notes.append(f"+{points:.0f} pts por criterio en {field_id}")

    final_score = min(100.0, max(0.0, score))
    return final_score, "; ".join(notes) or "Sin criterios específicos cumplidos."


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CRUD DE PROGRAMAS SOCIALES
# ═══════════════════════════════════════════════════════════════════════════════

@social_programs_bp.route('/programs', methods=['GET'])
@jwt_required()
def list_programs():
    """Lista todos los programas sociales con conteos y estado"""
    try:
        programs = SocialProgram.query.order_by(SocialProgram.created_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [p.to_dict(include_stats=True) for p in programs],
            'count': len(programs)
        }), 200
    except Exception as e:
        logger.error(f'Error listing programs: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/beneficiaries', methods=['GET'])
@jwt_required()
def list_all_beneficiaries():
    """Lista todos los beneficiarios adscritos a programas sociales con filtros y paginación"""
    try:
        program_id = request.args.get('program_id', type=int)
        status = request.args.get('status')
        channel = request.args.get('channel')
        search = request.args.get('search')
        limit = min(request.args.get('limit', default=100, type=int), 200)

        query = ProgramBeneficiary.query
        if program_id:
            query = query.filter(ProgramBeneficiary.program_id == program_id)
        if status:
            query = query.filter(ProgramBeneficiary.status == status)
        if channel:
            query = query.filter(ProgramBeneficiary.intake_channel == channel)
        if search:
            search_like = f"%{search}%"
            query = query.filter(
                (ProgramBeneficiary.full_name.ilike(search_like)) |
                (ProgramBeneficiary.cedula.ilike(search_like)) |
                (ProgramBeneficiary.phone.ilike(search_like))
            )

        beneficiaries = query.order_by(ProgramBeneficiary.created_at.desc()).limit(limit).all()
        data = []
        for b in beneficiaries:
            b_dict = b.to_dict()
            if b.program:
                b_dict['program_name'] = b.program.name
                b_dict['program_category'] = b.program.category
            data.append(b_dict)

        return jsonify({
            'success': True,
            'data': data,
            'count': len(data),
            'total_active': ProgramBeneficiary.query.filter_by(status='active').count(),
            'total_applicants': ProgramBeneficiary.query.filter_by(status='applicant').count(),
            'total_approved': ProgramBeneficiary.query.filter_by(status='approved').count(),
        }), 200
    except Exception as e:
        logger.error(f'Error listing beneficiaries: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>/beneficiaries', methods=['GET'])
@jwt_required()
def list_program_beneficiaries(program_id: int):
    """Lista beneficiarios de un programa social específico"""
    try:
        program = SocialProgram.query.get_or_404(program_id)
        beneficiaries = ProgramBeneficiary.query.filter_by(program_id=program.id).order_by(ProgramBeneficiary.created_at.desc()).all()
        return jsonify({
            'success': True,
            'program': {'id': program.id, 'name': program.name},
            'data': [b.to_dict() for b in beneficiaries],
            'count': len(beneficiaries)
        }), 200
    except Exception as e:
        logger.error(f'Error listing program beneficiaries {program_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs', methods=['POST'])
@jwt_required()
def create_program():
    """Crea un nuevo programa social con su formulario dinámico"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404

        data = request.get_json() or {}
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'El nombre del programa es obligatorio'}), 400

        # Auto-generate short code if missing
        short_code = data.get('short_code')
        if not short_code:
            words = re.findall(r'\b[A-Za-z]', data['name'])
            prefix = ''.join(words[:4]).upper() or 'PROG'
            short_code = f"{prefix}-{datetime.utcnow().year}-{SocialProgram.query.count() + 1}"

        program = SocialProgram(
            license_id=data.get('license_id'),
            lead_org_id=data.get('lead_org_id'),
            created_by_user_id=user_id,
            name=data['name'],
            short_code=short_code,
            category=data.get('category', 'social'),
            description=data.get('description'),
            objectives=data.get('objectives'),
            status=data.get('status', 'active'),
            max_beneficiaries=data.get('max_beneficiaries', 500),
            coverage_country=data.get('coverage_country', 'Ecuador'),
            coverage_regions=data.get('coverage_regions', []),
            inherit_org_channels=data.get('inherit_org_channels', True),
            tags=data.get('tags', []),
        )
        db.session.add(program)
        db.session.flush()

        # Build initial dynamic form definition
        form_fields = data.get('form_fields')
        if not form_fields:
            default_schema = _build_smart_fallback_schema(
                program.name, program.category,
                program.description or program.objectives or program.name)
            form_fields = default_schema.get('fields', [])
            sections = default_schema.get('sections', [])
            eligibility_rules = default_schema.get('eligibility_rules', [])
            conversational_instructions = default_schema.get('conversational_instructions')
            success_message = default_schema.get('success_message')
        else:
            sections = data.get('sections', [])
            eligibility_rules = data.get('eligibility_rules', [])
            conversational_instructions = data.get('conversational_instructions', '')
            success_message = data.get('success_message', 'Postulación recibida.')

        form_def = ProgramFormDefinition(
            program_id=program.id,
            form_title=f'Formulario de Postulación: {program.name}',
            form_description=program.description,
            fields=form_fields,
            eligibility_rules=eligibility_rules,
            conversational_instructions=conversational_instructions,
            success_message=success_message,
            version=1
        )
        db.session.add(form_def)
        db.session.flush()
        _set_form_sections(form_def, sections)
        db.session.commit()

        result = program.to_dict(include_stats=True)
        result['form_definition'] = form_def.to_dict()
        return jsonify({'success': True, 'data': result}), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creating program: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>', methods=['GET'])
@jwt_required()
def get_program(program_id: int):
    """Obtiene detalles de un programa con su formulario dinámico"""
    try:
        program = SocialProgram.query.get_or_404(program_id)
        data = program.to_dict(include_stats=True)
        if program.form_definition:
            data['form_definition'] = program.form_definition.to_dict()
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f'Error getting program {program_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>', methods=['PUT'])
@jwt_required()
def update_program(program_id: int):
    """Actualiza un programa social"""
    try:
        program = SocialProgram.query.get_or_404(program_id)
        data = request.get_json() or {}

        updatable = [
            'name', 'short_code', 'category', 'description', 'objectives',
            'status', 'max_beneficiaries', 'coverage_country', 'coverage_regions',
            'inherit_org_channels', 'tags', 'logo_url', 'banner_url',
        ]
        for field in updatable:
            if field in data:
                setattr(program, field, data[field])

        db.session.commit()
        return jsonify({'success': True, 'data': program.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error updating program {program_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GESTIÓN DEL FORMULARIO DINÁMICO & GENERADOR CON COPILOTO IA
# ═══════════════════════════════════════════════════════════════════════════════

@social_programs_bp.route('/programs/<int:program_id>/form', methods=['GET'])
@jwt_required()
def get_program_form(program_id: int):
    """Obtiene la definición del formulario dinámico de un programa"""
    try:
        program = SocialProgram.query.get_or_404(program_id)
        form_def = program.form_definition
        if not form_def:
            # Crear formulario base si no existe
            default_schema = _build_smart_fallback_schema(
                program.name, program.category, program.description or program.objectives or program.name)
            form_def = ProgramFormDefinition(
                program_id=program.id,
                form_title=default_schema['form_title'],
                form_description=default_schema['form_description'],
                fields=default_schema['fields'],
                eligibility_rules=default_schema['eligibility_rules'],
                conversational_instructions=default_schema['conversational_instructions'],
                success_message=default_schema['success_message'],
            )
            db.session.add(form_def)
            db.session.flush()
            _set_form_sections(form_def, default_schema.get('sections', []))
            db.session.commit()

        payload = form_def.to_dict()
        payload['sections'] = _get_form_sections(form_def)
        return jsonify({'success': True, 'data': payload}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>/form', methods=['PUT'])
@jwt_required()
def update_program_form(program_id: int):
    """Guarda o actualiza la definición dinámica del formulario (campos, secciones, reglas)"""
    try:
        program = SocialProgram.query.get_or_404(program_id)
        data = request.get_json() or {}

        form_def = program.form_definition
        if not form_def:
            form_def = ProgramFormDefinition(program_id=program.id, fields=[])
            db.session.add(form_def)

        if 'form_title' in data: form_def.form_title = data['form_title']
        if 'form_description' in data: form_def.form_description = data['form_description']
        if 'fields' in data: form_def.fields = data['fields']
        if 'sections' in data: _set_form_sections(form_def, data['sections'] or [])
        if 'eligibility_rules' in data: form_def.eligibility_rules = data['eligibility_rules']
        if 'conversational_instructions' in data: form_def.conversational_instructions = data['conversational_instructions']
        if 'success_message' in data: form_def.success_message = data['success_message']
        if 'is_active' in data: form_def.is_active = data['is_active']
        form_def.version = (form_def.version or 1) + 1

        db.session.commit()
        payload = form_def.to_dict()
        payload['sections'] = _get_form_sections(form_def)
        return jsonify({'success': True, 'data': payload}), 200
        return jsonify({'success': True, 'data': form_def.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>/generate-form-ai', methods=['POST'])
@jwt_required()
def generate_form_ai(program_id: int):
    """
    COPILOTO IA: Genera automáticamente el esquema del formulario dinámico
    en base a un prompt, objetivos o texto de TDR de la convocatoria.
    Prioridad: LLM (respeta campos pedidos) -> fallback inteligente por keywords -> default.
    """
    try:
        program = SocialProgram.query.get_or_404(program_id)
        data = request.get_json() or {}
        prompt_text = data.get('prompt') or program.description or program.objectives or program.name

        generated_schema = _generate_schema_via_llm(program.name, prompt_text)
        if not generated_schema:
            generated_schema = _build_smart_fallback_schema(program.name, program.category, prompt_text)

        # Aplicar el esquema al formulario del programa
        form_def = program.form_definition
        if not form_def:
            form_def = ProgramFormDefinition(program_id=program.id, fields=[])
            db.session.add(form_def)

        form_def.form_title = generated_schema.get('form_title', f'Ficha: {program.name}')
        form_def.form_description = generated_schema.get('form_description', prompt_text)
        form_def.fields = generated_schema.get('fields', [])
        form_def.eligibility_rules = generated_schema.get('eligibility_rules', [])
        form_def.conversational_instructions = generated_schema.get('conversational_instructions', '')
        form_def.success_message = generated_schema.get('success_message', 'Postulación registrada.')
        form_def.version = (form_def.version or 1) + 1
        db.session.flush()
        _set_form_sections(form_def, generated_schema.get('sections', []))

        db.session.commit()

        payload = form_def.to_dict()
        payload['sections'] = _get_form_sections(form_def)
        return jsonify({
            'success': True,
            'message': 'Formulario generado exitosamente por Copiloto IA',
            'data': payload
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in generate_form_ai: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/ai-create-full', methods=['POST'])
@jwt_required()
def ai_create_full_program():
    """
    COPILOTO IA: Crea un programa social y genera todo su formulario dinámico
    en una sola instrucción desde el chat o la interfaz.
    Respeta el nombre que el usuario escribe; la categoría se infiere.
    El formulario se deriva del detalle (LLM -> fallback inteligente).
    """
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        instruction = data.get('instruction') or data.get('prompt') or ''
        if not instruction:
            return jsonify({'success': False, 'error': 'Instrucción requerida'}), 400

        # Respetar el nombre dado por el usuario; solo inferir si no vino
        provided_name = (data.get('name') or '').strip()
        category = data.get('category') or _infer_category(instruction)
        if provided_name:
            name = provided_name
        else:
            tnorm = _norm(instruction)
            if 'adulto mayor' in tnorm:
                name = "Bono y Cuidado del Adulto Mayor"
            elif 'nutric' in tnorm or 'infantil' in tnorm:
                name = "Beca de Nutrición y Salud Infantil"
            elif 'vivienda' in tnorm:
                name = "Mejoramiento y Techo Digno"
            elif 'empleo' in tnorm or 'emprend' in tnorm:
                name = "Fondo de Impulso al Emprendimiento Local"
            else:
                # Extraer un nombre corto de las primeras palabras significativas
                words = [w for w in re.split(r'\s+', instruction.strip()) if len(w) > 3][:6]
                name = ' '.join(words).capitalize()[:120] or "Programa Social de Asistencia Focalizada"

        # Unique short code
        short_code = f"PROG-{datetime.utcnow().strftime('%y%m%d%H%M')}"

        program = SocialProgram(
            created_by_user_id=user_id,
            name=name,
            short_code=short_code,
            category=category,
            description=instruction,
            status='active',
            max_beneficiaries=1000,
        )
        db.session.add(program)
        db.session.flush()

        # Build dynamic form: LLM primero, fallback inteligente después
        schema = _generate_schema_via_llm(name, instruction)
        if not schema:
            schema = _build_smart_fallback_schema(name, category, instruction)
        form_def = ProgramFormDefinition(
            program_id=program.id,
            form_title=schema['form_title'],
            form_description=schema['form_description'],
            fields=schema['fields'],
            eligibility_rules=schema['eligibility_rules'],
            conversational_instructions=schema['conversational_instructions'],
            success_message=schema['success_message'],
        )
        db.session.add(form_def)
        db.session.flush()
        _set_form_sections(form_def, schema.get('sections', []))
        db.session.commit()

        result = program.to_dict(include_stats=True)
        payload = form_def.to_dict()
        payload['sections'] = _get_form_sections(form_def)
        result['form_definition'] = payload
        return jsonify({
            'success': True,
            'message': f"Programa '{name}' creado y configurado con su formulario dinámico",
            'data': result
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 4. POSTULACIÓN & INTAKE CONVERSACIONAL (MÉTODO A: WEB FORM, MÉTODO B: CHAT)
# ═══════════════════════════════════════════════════════════════════════════════

@social_programs_bp.route('/programs/<int:program_id>/submit', methods=['POST'])
def submit_program_form(program_id: int):
    """
    MÉTODO A: Recepción del Formulario Web (Multi-step Wizard o público).
    Valida los campos obligatorios, calcula el score y guarda en ProgramBeneficiary.
    """
    try:
        program = SocialProgram.query.get_or_404(program_id)
        form_def = program.form_definition
        data = request.get_json() or {}

        form_data = data.get('form_data', {})
        intake_channel = data.get('intake_channel', 'web_form')

        # Validación servidor de requeridos (el wizard ya valida, esto es doble seguro)
        if form_def and form_def.fields:
            missing = [f.get('label') or f.get('id') for f in form_def.fields
                       if f.get('required') and (form_data.get(f.get('id')) in (None, ''))]
            if missing:
                return jsonify({'success': False,
                                'error': f"Faltan campos obligatorios: {', '.join(missing)}"}), 400

        # Extraer campos clave
        full_name = data.get('full_name') or form_data.get('full_name') or 'Postulante'
        cedula = data.get('cedula') or form_data.get('cedula')
        phone = data.get('phone') or form_data.get('phone')
        email = data.get('email') or form_data.get('email')
        address = data.get('address') or form_data.get('address')

        # Calcular score de elegibilidad con las reglas configuradas
        rules = form_def.eligibility_rules if form_def else []
        score, notes = _calculate_eligibility_score(form_data, rules)

        beneficiary = ProgramBeneficiary(
            program_id=program.id,
            full_name=full_name,
            cedula=cedula,
            phone=phone,
            email=email,
            address=address,
            intake_channel=intake_channel,
            form_data=form_data,
            status='applicant' if score < 70 else 'approved',
            eligibility_score=score,
            eligibility_notes=notes,
            monthly_income=form_data.get('monthly_income'),
            household_members=form_data.get('household_members'),
            has_disabilities=bool(form_data.get('has_disabilities')),
        )
        db.session.add(beneficiary)
        db.session.commit()

        success_msg = form_def.success_message if form_def else "Postulación registrada con éxito."
        return jsonify({
            'success': True,
            'message': success_msg,
            'beneficiary_id': beneficiary.id,
            'eligibility_score': score,
            'status': beneficiary.status,
            'data': beneficiary.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error submitting program form: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@social_programs_bp.route('/programs/<int:program_id>/conversational-step', methods=['POST'])
def conversational_step(program_id: int):
    """
    MÉTODO B: Motor de Intake Conversacional para Web Widget, WhatsApp y Telegram.
    VALIDACIÓN ESTRICTA: nunca acepta saludos/dudas ("hola", "qué?", "cmo?") como datos.
    Cada respuesta se valida por tipo; si falla, se re-pregunta con ejemplo sin avanzar.
    """
    try:
        program = SocialProgram.query.get_or_404(program_id)
        form_def = program.form_definition
        if not form_def or not form_def.fields:
            return jsonify({
                'success': True,
                'completed': False,
                'response': f"Bienvenido/a al programa {program.name}. Cuéntame tu situación para evaluar tu postulación."
            }), 200

        data = request.get_json() or {}
        user_message = (data.get('message') or '').strip()
        current_data = data.get('collected_data') or {}
        history = data.get('history') or []
        # Limpiar meta interno si el frontend lo devuelve
        current_data = {k: v for k, v in current_data.items() if not k.startswith('_meta')}
        sender_phone = data.get('phone') or ''

        fields = form_def.fields or []

        def _is_answered(f):
            fid = f.get('id')
            v = current_data.get(fid)
            return v is not None and v != ''

        remaining_fields = [f for f in fields if f.get('required', True) and not _is_answered(f)]

        # Sin mensaje (apertura): preguntar el primer pendiente
        if not user_message:
            if not remaining_fields:
                pass  # caerá a finalización
            else:
                nxt = remaining_fields[0]
                q = nxt.get('conversational_prompt') or f"Por favor indíqueme su {nxt.get('label')}:"
                pct = int(((len(fields) - len(remaining_fields)) / max(len(fields), 1)) * 100)
                return jsonify({'success': True, 'completed': False, 'response': q,
                                'current_field': nxt.get('id'), 'progress_percent': pct,
                                'collected_data': current_data}), 200

        current_field = remaining_fields[0] if remaining_fields else None

        if user_message and current_field:
            # 1. Chequeo determinista inicial
            ok, cleaned, hint = _validate_field_value(current_field, user_message)

            # 2. Delegar en PostulacionAgent (Sistema Multiagente) para procesamiento con contexto histórico
            from agents.postulacion_agent import PostulacionAgent
            postulacion_agent = PostulacionAgent(tenant_id=1, user_id=1)
            agent_result = postulacion_agent.process_step(
                program_name=program.name,
                current_field=current_field,
                user_message=user_message,
                collected_data=current_data,
                history=history,
                deterministic_validation=(ok, cleaned, hint)
            )

            if not agent_result.get('valid'):
                # NO avanzar al siguiente campo: devolver la respuesta empática del agente
                pct = int(((len(fields) - len(remaining_fields)) / max(len(fields), 1)) * 100)
                return jsonify({'success': True, 'completed': False,
                                'response': agent_result.get('response'),
                                'current_field': current_field.get('id'),
                                'progress_percent': pct,
                                'collected_data': current_data,
                                'validation_error': hint,
                                'agent_used': 'postulacion_agent'}), 200

            # Válido: guardar el valor limpio y actualizar campos restantes
            saved_val = agent_result.get('cleaned_value') or cleaned
            current_data[current_field.get('id')] = saved_val
            remaining_fields = [f for f in remaining_fields if f.get('id') != current_field.get('id')]

        # Si ya no quedan campos pendientes: Finalizar registro
        if not remaining_fields:
            # Calcular score de elegibilidad y guardar en DB
            rules = form_def.eligibility_rules or []
            score, notes = _calculate_eligibility_score(current_data, rules)

            beneficiary = ProgramBeneficiary(
                program_id=program.id,
                full_name=current_data.get('full_name') or data.get('user_name') or 'Postulante Conversacional',
                cedula=current_data.get('cedula'),
                phone=current_data.get('phone') or sender_phone,
                intake_channel=data.get('channel', 'web_chat_conversational'),
                form_data=current_data,
                status='applicant' if score < 70 else 'approved',
                eligibility_score=score,
                eligibility_notes=notes,
            )
            db.session.add(beneficiary)
            db.session.commit()

            success_response = form_def.success_message or (
                f"✅ ¡Excelente! He recolectado todos los datos necesarios para su postulación al programa "
                f"*{program.name}*. Su ficha ha sido registrada con el código #{beneficiary.id}."
            )
            return jsonify({
                'success': True,
                'completed': True,
                'response': success_response,
                'beneficiary_id': beneficiary.id,
                'collected_data': current_data
            }), 200

        # Si aún faltan campos: confirmar el dato guardado y formular la siguiente pregunta
        next_field = remaining_fields[0]
        question = next_field.get('conversational_prompt') or f"Por favor indíqueme su {next_field.get('label')}:"

        progress_pct = int(((len(fields) - len(remaining_fields)) / max(len(fields), 1)) * 100)

        # Eco de confirmación del último dato válido (evita la sensación de "no escucha")
        ack = ''
        if user_message and current_data:
            last_saved = list(current_data.items())[-1] if current_data else None
            if last_saved:
                ack = f"Perfecto, registré _{last_saved[1]}_. "
        return jsonify({
            'success': True,
            'completed': False,
            'response': f"{ack}{question}" if ack else question,
            'current_field': next_field.get('id'),
            'progress_percent': progress_pct,
            'collected_data': current_data
        }), 200

    except Exception as e:
        logger.error(f"Conversational step error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ENDPOINTS PÚBLICOS PARA EMBEBER EN SITIOS WEB
# ═══════════════════════════════════════════════════════════════════════════════

@social_programs_bp.route('/public/programs/<int:program_id>/form', methods=['GET'])
def get_public_program_form(program_id: int):
    """Obtiene el formulario público de un programa (sin JWT) para landing pages o widgets"""
    try:
        program = SocialProgram.query.filter_by(id=program_id, status='active').first()
        if not program:
            return jsonify({'error': 'Programa no encontrado o inactivo'}), 404

        form_def = program.form_definition
        if not form_def:
            default_schema = _build_smart_fallback_schema(
                program.name, program.category, program.description or program.name)
            return jsonify({
                'program': {'id': program.id, 'name': program.name, 'description': program.description},
                'form': default_schema
            }), 200

        payload = form_def.to_dict()
        payload['sections'] = _get_form_sections(form_def)
        return jsonify({
            'program': {'id': program.id, 'name': program.name, 'description': program.description},
            'form': payload
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
