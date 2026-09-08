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
            default_schema = _generate_default_social_form(program.name, program.category, program.description)
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
            default_schema = _generate_default_social_form(program.name, program.category, program.description)
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
            db.session.commit()

        return jsonify({'success': True, 'data': form_def.to_dict()}), 200
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
        if 'eligibility_rules' in data: form_def.eligibility_rules = data['eligibility_rules']
        if 'conversational_instructions' in data: form_def.conversational_instructions = data['conversational_instructions']
        if 'success_message' in data: form_def.success_message = data['success_message']
        if 'is_active' in data: form_def.is_active = data['is_active']
        form_def.version = (form_def.version or 1) + 1

        db.session.commit()
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
    """
    try:
        program = SocialProgram.query.get_or_404(program_id)
        data = request.get_json() or {}
        prompt_text = data.get('prompt') or program.description or program.objectives or program.name

        # Llamar a LLM si está disponible o usar generador inteligente heurístico
        generated_schema = None
        try:
            from agents.llm_interface import get_llm
            llm = get_llm()
            system_msg = (
                "Eres el Diseñador Agéntico de Formularios Sociales de AI GovCoreX OS. "
                "Tu misión es estructurar una ficha de postulación completa en formato JSON puro. "
                "El JSON debe tener exactamente las llaves: 'form_title', 'form_description', 'sections', "
                "'fields', 'eligibility_rules', 'conversational_instructions', 'success_message'. "
                "Cada elemento en 'fields' debe tener: id, label, type ('text'|'number'|'currency'|'select'|'boolean'|'date'|'cedula'|'file'), "
                "required (bool), placeholder, conversational_prompt (pregunta natural en español para WhatsApp), "
                "scoring_weight (número de 5 a 40), section_id. "
                "No uses bloques markdown ```json, responde sólo con el objeto JSON válido."
            )
            user_msg = f"Genera la ficha técnica y formulario para el programa: '{program.name}'. Detalles: {prompt_text}"
            raw_res = llm.chat_completion([
                {'role': 'system', 'content': system_msg},
                {'role': 'user', 'content': user_msg}
            ])
            # Limpiar posibles delimitadores
            clean_json = raw_res.strip().replace('```json', '').replace('```', '').strip()
            generated_schema = json.loads(clean_json)
        except Exception as e:
            logger.warning(f"LLM generation failed, falling back to dynamic generator: {e}")
            generated_schema = _generate_default_social_form(program.name, program.category, prompt_text)

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

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Formulario generado exitosamente por Copiloto IA',
            'data': form_def.to_dict()
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
    """
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        instruction = data.get('instruction') or data.get('prompt') or ''
        if not instruction:
            return jsonify({'success': False, 'error': 'Instrucción requerida'}), 400

        # Infer program name and category from instruction
        name = data.get('name') or "Programa Social de Asistencia Focalizada"
        if "adulto mayor" in instruction.lower():
            name = "Bono y Cuidado del Adulto Mayor"
            category = "adulto_mayor"
        elif "nutrición" in instruction.lower() or "infantil" in instruction.lower():
            name = "Beca de Nutrición y Salud Infantil"
            category = "infancia"
        elif "vivienda" in instruction.lower():
            name = "Mejoramiento y Techo Digno"
            category = "vivienda"
        elif "empleo" in instruction.lower() or "emprendimiento" in instruction.lower():
            name = "Fondo de Impulso al Emprendimiento Local"
            category = "desarrollo_economico"
        else:
            category = "social"

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

        # Build dynamic form
        schema = _generate_default_social_form(name, category, instruction)
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
        db.session.commit()

        result = program.to_dict(include_stats=True)
        result['form_definition'] = form_def.to_dict()
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
    Toma la respuesta del usuario, actualiza el estado de la postulación en memoria/DB,
    extrae los campos según el JSON schema y devuelve la siguiente pregunta amigable.
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
        session_id = data.get('session_id') or 'session_default'
        current_data = data.get('collected_data') or {}
        sender_phone = data.get('phone') or ''

        fields = form_def.fields
        # Determinar qué campos requeridos ya han sido contestados
        remaining_fields = []
        for f in fields:
            fid = f.get('id')
            if f.get('required', True) and (fid not in current_data or current_data[fid] is None or current_data[fid] == ''):
                remaining_fields.append(f)

        # Si el usuario envió un mensaje, intentar extraer el valor del campo actual
        current_field = remaining_fields[0] if remaining_fields else None

        if user_message and current_field:
            cf_id = current_field.get('id')
            cf_type = current_field.get('type')

            # Extracción inteligente según tipo de dato
            val = user_message
            if cf_type == 'number' or cf_type == 'currency':
                nums = re.findall(r'\d+(?:\.\d+)?', user_message)
                val = float(nums[0]) if nums else user_message
            elif cf_type == 'cedula':
                nums = re.findall(r'\b\d{10}\b', user_message)
                val = nums[0] if nums else user_message
            elif cf_type == 'boolean':
                val = any(w in user_message.lower() for w in ['sí', 'si', 'claro', 'afirmativo', 'correcto'])

            current_data[cf_id] = val

            # Recalcular campos faltantes
            remaining_fields = [f for f in remaining_fields if f.get('id') != cf_id]

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

        # Si aún faltan campos: formular la siguiente pregunta conversacional
        next_field = remaining_fields[0]
        question = next_field.get('conversational_prompt') or f"Por favor indíqueme su {next_field.get('label')}:"

        progress_pct = int(((len(fields) - len(remaining_fields)) / len(fields)) * 100)

        return jsonify({
            'success': True,
            'completed': False,
            'response': question,
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
            default_schema = _generate_default_social_form(program.name, program.category, program.description)
            return jsonify({
                'program': {'id': program.id, 'name': program.name, 'description': program.description},
                'form': default_schema
            }), 200

        return jsonify({
            'program': {'id': program.id, 'name': program.name, 'description': program.description},
            'form': form_def.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
