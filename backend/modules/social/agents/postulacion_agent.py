"""
PostulacionAgent - Specialized Agent for Conversational Program Intake & Admissions
AI GovCoreX OS — Multi-Agent Architecture
"""
import logging
import json
import re
from typing import Dict, List, Optional, Tuple
from agents.llm_interface import get_llm
from models import db

logger = logging.getLogger(__name__)


class PostulacionAgent:
    """
    Agente Especializado en Postulación Ciudadana y Admisiones para Programas Sociales.
    
    Responsabilidades:
    1. Interpretar el lenguaje natural del ciudadano (respuestas casuales, saludos, dudas,
       preguntas de contexto '¿para qué?', '¿por qué?', o explicaciones de su situación personal).
    2. Mantener la memoria y el hilo conversacional histórico del chat y de los datos ya guardados.
    3. Extraer valores estructurados para el campo requerido, aplicando validación de tipo y reglas.
    4. Producir respuestas 100% naturales, empáticas y context-aware (evita sonar robótico,
       repetitivo o de plantilla). Si el usuario duda repetidamente o se confunde con datos anteriores,
       le orienta de forma humana y clara.
    5. Nunca salta al siguiente campo si el dato obligatorio actual no es válido.
    6. Nunca confunde quejas, dudas ni reclamos ("ya te lo di", "que?", "para que") con valores de datos.
    """

    def __init__(self, tenant_id: int = 1, user_id: int = 1):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()

    def process_step(
        self,
        program_name: str,
        current_field: dict,
        user_message: str,
        collected_data: Dict,
        history: Optional[List[Dict]] = None,
        deterministic_validation: Optional[Tuple[bool, any, Optional[str]]] = None
    ) -> Dict:
        """
        Procesa el turno conversacional para el campo actual.
        """
        from api.social_programs import _validate_field_value

        history = history or []
        label = current_field.get('label') or current_field.get('id')
        ftype = (current_field.get('type') or 'text').lower()

        # 1. Si la validación determinista pasó Y el valor sigue siendo válido bajo _validate_field_value
        if deterministic_validation and deterministic_validation[0]:
            cleaned = deterministic_validation[1]
            # Doble chequeo de seguridad
            recheck_ok, recheck_val, _ = _validate_field_value(current_field, str(cleaned))
            if recheck_ok:
                return {
                    'valid': True,
                    'cleaned_value': recheck_val if recheck_val is not None else cleaned,
                    'response': f"Excelente, registré {label}: _{cleaned}_.",
                    'confidence': 1.0,
                    'agent_used': 'postulacion_agent'
                }

        validation_hint = deterministic_validation[2] if deterministic_validation else None

        # 2. Razonamiento agéntico con LLM
        extracted_data = self._llm_extract_and_reason(
            program_name=program_name,
            field=current_field,
            user_message=user_message,
            collected_data=collected_data,
            history=history,
            validation_hint=validation_hint
        )

        return extracted_data

    def _llm_extract_and_reason(
        self,
        program_name: str,
        field: dict,
        user_message: str,
        collected_data: Dict,
        history: List[Dict],
        validation_hint: Optional[str]
    ) -> Dict:
        """
        Ejecuta un ciclo de razonamiento agéntico:
        1. Evalúa si el usuario proporcionó el dato de forma indirecta en su mensaje.
        2. Valida estrictamente cualquier valor extraído antes de aceptarlo.
        3. Si NO lo proporcionó (o es duda, queja, reclamo o confusión), genera una respuesta
           humana, empática, contextualizada con el dato actual y el progreso previo.
        """
        from api.social_programs import _validate_field_value

        label = field.get('label') or field.get('id')
        ftype = (field.get('type') or 'text').lower()
        placeholder = field.get('placeholder') or ''

        # Historial reciente de diálogo
        recent_dialogue = []
        for msg in history[-8:]:
            role_label = "Ciudadano" if msg.get('role') == 'user' else "Asistente"
            recent_dialogue.append(f"{role_label}: {msg.get('content')}")
        dialogue_context = "\n".join(recent_dialogue) if recent_dialogue else "Inicio de la conversación."

        # Resumen de datos ya recolectados
        collected_items = []
        for k, v in (collected_data or {}).items():
            collected_items.append(f"- {k}: {v}")
        collected_context = "\n".join(collected_items) if collected_items else "Ninguno aún (este es el primer campo)."

        # Guía de formato según tipo de dato
        format_guide = "Respuesta en texto claro y coherente."
        if ftype == 'cedula':
            format_guide = "Número de cédula ecuatoriana de 10 dígitos (ej. 0912345678)."
        elif ftype in ('number', 'currency'):
            format_guide = "Cantidad numérica o monto (ej. 12.5 o 350)."
        elif ftype == 'date':
            format_guide = "Fecha de nacimiento en formato día/mes/año (ej. 15/05/2021 o '15 de marzo de 2021')."
        elif ftype == 'text' and any(n in (field.get('id') or '').lower() for n in ['name', 'nombre', 'nino', 'solicitante']):
            format_guide = "Nombres y apellidos completos de la persona (ej. Carlos Alberto Mendoza)."
        elif ftype == 'boolean':
            format_guide = "Respuesta afirmativa (Sí) o negativa (No)."

        system_prompt = f"""Eres un facilitador social humano del programa oficial "{program_name}".
Atiendes en vivo por chat a ciudadanos para registrar su postulación paso a paso.

REGLAS DE TONO Y ESTILO (OBLIGATORIAS):
- NUNCA uses introducciones cliché como "Entiendo que...", "Entiendo tus dudas...", "Es un placer saludarte...", "Bienvenido...". Varía tu vocabulario de forma espontánea.
- Habla con tono ecuatoriano/latino, cálido, respetuoso y humano.
- Sé breve y conciso (máximo 2 oraciones).
- NUNCA confundas preguntas, dudas, quejas o reclamos con datos válidos.

ESTADO ACTUAL DEL PROCESO:
Datos ya registrados con éxito en la sesión:
{collected_context}

DATO QUE ESTAMOS REGISTRANDO EN ESTE PASO:
- Campo actual requerido: "{label}" (tipo: {ftype})
- Formato esperado: {format_guide}

HISTORIAL DEL CHAT:
{dialogue_context}

ÚLTIMO MENSAJE DEL CIUDADANO:
"{user_message}"

INSTRUCCIONES CLAVE DE DECISIÓN:
1. EXTRACCIÓN DE DATOS:
   - Solo marca "value_provided": true si el ciudadano realmente escribió el dato correspondiente a "{label}".
   - Si el mensaje contiene expresiones de confusión, reclamo, queja o duda (por ejemplo: "ya te lo di", "ya te dije", "como?", "que?", "porque?", "no quiero", "y si no tengo"), DEBES marcar "value_provided": false.
   - NUNCA extraigas frases conversacionales como datos de la postulación.

2. RESPUESTA CONVERSACIONAL (cuando "value_provided": false):
   - Si el usuario dice "ya te lo di", "ya te dije", "ya te lo pasé" o similar:
     Aclárale con amabilidad que su dato previo ya quedó registrado en el sistema, pero que ahora estamos en el siguiente paso para anotar su "{label}".
   - Si el usuario pregunta "¿cómo?", "¿qué?" o muestra confusión:
     Explícale con total sencillez qué dato le estás pidiendo en este momento ("{label}") y dale un ejemplo amigable.
     IMPORTANTE: No hables de cédula a menos que "{label}" sea la cédula. Enfócate siempre en el campo actual: "{label}".
   - Si el usuario pregunta "¿por qué?" o "¿para qué?":
     Explícale brevemente la razón por la que el programa necesita registrar "{label}".
   - Si el usuario duda sobre entregar el dato:
     Explica con transparencia por qué este dato es indispensable para evaluar el beneficio y que su información está protegida.

RESPONDE ÚNICAMENTE EN FORMATO JSON:
{{
    "value_provided": true/false,
    "extracted_value": "valor limpio si value_provided=true, sino null",
    "conversational_reply": "tu respuesta humana y contextual"
}}"""

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Mensaje del ciudadano: {user_message}"}
            ]
            raw_response = self.llm.chat_completion(messages, temperature=0.5, max_tokens=300)
            parsed = self.llm.extract_json(raw_response)

            if parsed.get('value_provided') and parsed.get('extracted_value'):
                candidate = str(parsed['extracted_value']).strip()
                # Validación estricta con el validador del backend
                val_ok, cleaned_val, _ = _validate_field_value(field, candidate)
                if val_ok:
                    return {
                        'valid': True,
                        'cleaned_value': cleaned_val if cleaned_val is not None else candidate,
                        'response': f"Excelente, registré {label}: _{cleaned_val or candidate}_.",
                        'confidence': 0.95,
                        'agent_used': 'postulacion_agent'
                    }
                else:
                    # El LLM creyó que era un valor pero falló la validación real
                    logger.info(f"PostulacionAgent: candidate '{candidate}' rejected by _validate_field_value")

            reply = parsed.get('conversational_reply')
            if reply and len(reply.strip()) > 8:
                return {
                    'valid': False,
                    'cleaned_value': None,
                    'response': reply.strip(),
                    'confidence': 0.85,
                    'agent_used': 'postulacion_agent'
                }

        except Exception as e:
            logger.error(f"Error in PostulacionAgent reasoning: {e}")

        # Fallback conversacional contextualizado
        return {
            'valid': False,
            'cleaned_value': None,
            'response': (
                f"Para continuar con tu postulación en *{program_name}*, "
                f"necesitamos registrar {label}. ¿Me podrías indicar este dato? "
                f"{('Ejemplo: ' + placeholder) if placeholder else ''}"
            ).strip(),
            'confidence': 0.6,
            'agent_used': 'postulacion_agent'
        }
