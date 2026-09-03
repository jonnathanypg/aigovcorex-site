"""
Ingestion Service - Bulk CSV Import/Export Engine
Handles template generation and data upload for multiple entities.
"""
import csv
import io
import logging
from datetime import datetime, date
from werkzeug.security import generate_password_hash
from models import db
from models.user import User, Role
from models.child import Child, Family, Representative
from models.attendance import Attendance
from models.nutrition import NutritionDaily, Menu
from models.milestone import Milestone
from models.health import HealthRecord, Vaccine

logger = logging.getLogger(__name__)

# ============================================================
# ENTITY DEFINITIONS
# Each entity defines its CSV columns, required fields,
# valid enum values, and a processor function.
# ============================================================

ENTITY_DEFINITIONS = {
    'usuarios': {
        'label': 'Usuarios',
        'columns': [
            {'name': 'email', 'label': 'Email *', 'required': True, 'example': 'juan@centro.com'},
            {'name': 'first_name', 'label': 'Nombres *', 'required': True, 'example': 'Juan'},
            {'name': 'last_name', 'label': 'Apellidos *', 'required': True, 'example': 'Pérez'},
            {'name': 'cedula', 'label': 'Cédula', 'required': False, 'example': '0912345678'},
            {'name': 'phone', 'label': 'Teléfono', 'required': False, 'example': '0991234567'},
            {'name': 'role', 'label': 'Rol *', 'required': True, 'example': 'coordinator',
             'valid_values': ['coordinator', 'educator', 'viewer']},
            {'name': 'password', 'label': 'Contraseña *', 'required': True, 'example': 'Temporal123!'},
        ],
        'min_role': 'license_admin',
    },
    'ninos': {
        'label': 'Niños/as (con Familia)',
        'columns': [
            {'name': 'first_name', 'label': 'Nombres del Niño *', 'required': True, 'example': 'Ana'},
            {'name': 'last_name', 'label': 'Apellidos del Niño *', 'required': True, 'example': 'López'},
            {'name': 'cedula', 'label': 'Cédula del Niño', 'required': False, 'example': '0954321098'},
            {'name': 'birth_date', 'label': 'Fecha de Nacimiento * (YYYY-MM-DD)', 'required': True, 'example': '2023-05-15'},
            {'name': 'gender', 'label': 'Género * (masculino/femenino)', 'required': True, 'example': 'femenino',
             'valid_values': ['masculino', 'femenino']},
            {'name': 'enrollment_date', 'label': 'Fecha de Matrícula (YYYY-MM-DD)', 'required': False, 'example': '2026-01-10'},
            {'name': 'assigned_group', 'label': 'Grupo Asignado', 'required': False, 'example': 'Sala 1'},
            {'name': 'allergies', 'label': 'Alergias', 'required': False, 'example': 'Ninguna'},
            {'name': 'special_needs', 'label': 'Necesidades Especiales', 'required': False, 'example': ''},
            {'name': 'rep_first_name', 'label': 'Nombres del Representante *', 'required': True, 'example': 'María'},
            {'name': 'rep_last_name', 'label': 'Apellidos del Representante *', 'required': True, 'example': 'López'},
            {'name': 'rep_cedula', 'label': 'Cédula del Representante', 'required': False, 'example': '0912345678'},
            {'name': 'rep_relationship', 'label': 'Parentesco * (madre/padre/tutor_legal/otro)', 'required': True, 'example': 'madre',
             'valid_values': ['madre', 'padre', 'abuelo', 'abuela', 'tio', 'tia', 'tutor_legal', 'otro']},
            {'name': 'rep_phone', 'label': 'Teléfono del Representante', 'required': False, 'example': '0991234567'},
            {'name': 'family_address', 'label': 'Dirección', 'required': False, 'example': 'Av. Principal 123'},
            {'name': 'family_city', 'label': 'Ciudad', 'required': False, 'example': 'Guayaquil'},
        ],
        'min_role': 'coordinator',
    },
    'asistencia': {
        'label': 'Asistencia Diaria',
        'columns': [
            {'name': 'child_cedula', 'label': 'Cédula del Niño *', 'required': True, 'example': '0954321098'},
            {'name': 'date', 'label': 'Fecha * (YYYY-MM-DD)', 'required': True, 'example': '2026-02-23'},
            {'name': 'status', 'label': 'Estado * (presente/ausente/justificado/tardanza)', 'required': True, 'example': 'presente',
             'valid_values': ['presente', 'ausente', 'justificado', 'tardanza']},
            {'name': 'arrival_time', 'label': 'Hora de Llegada (HH:MM)', 'required': False, 'example': '08:00'},
            {'name': 'departure_time', 'label': 'Hora de Salida (HH:MM)', 'required': False, 'example': '16:30'},
            {'name': 'notes', 'label': 'Notas', 'required': False, 'example': ''},
        ],
        'min_role': 'educator',
    },
    'nutricion': {
        'label': 'Nutrición Diaria',
        'columns': [
            {'name': 'child_cedula', 'label': 'Cédula del Niño *', 'required': True, 'example': '0954321098'},
            {'name': 'date', 'label': 'Fecha * (YYYY-MM-DD)', 'required': True, 'example': '2026-02-23'},
            {'name': 'meal_type', 'label': 'Comida * (desayuno/refrigerio_am/almuerzo/refrigerio_pm)', 'required': True, 'example': 'almuerzo',
             'valid_values': ['desayuno', 'refrigerio_am', 'almuerzo', 'refrigerio_pm', 'lactancia']},
            {'name': 'consumption_level', 'label': 'Consumo * (todo/la_mayoria/la_mitad/poco/nada)', 'required': True, 'example': 'todo',
             'valid_values': ['todo', 'la_mayoria', 'la_mitad', 'poco', 'nada']},
            {'name': 'menu_description', 'label': 'Descripción del Menú', 'required': False, 'example': 'Sopa de verduras'},
            {'name': 'notes', 'label': 'Notas', 'required': False, 'example': ''},
        ],
        'min_role': 'educator',
    },
    'hitos': {
        'label': 'Hitos de Desarrollo',
        'columns': [
            {'name': 'child_cedula', 'label': 'Cédula del Niño *', 'required': True, 'example': '0954321098'},
            {'name': 'record_date', 'label': 'Fecha * (YYYY-MM-DD)', 'required': True, 'example': '2026-02-23'},
            {'name': 'domain', 'label': 'Dominio * (vinculacion_emocional/descubrimiento_natural_cultural/expresion_corporal/lenguaje)', 'required': True, 'example': 'lenguaje',
             'valid_values': ['vinculacion_emocional', 'descubrimiento_natural_cultural', 'expresion_corporal', 'lenguaje']},
            {'name': 'milestone_description', 'label': 'Descripción del Hito *', 'required': True, 'example': 'Pronuncia su nombre completo'},
            {'name': 'achievement_level', 'label': 'Nivel * (no_iniciado/en_proceso/adquirido/consolidado)', 'required': True, 'example': 'en_proceso',
             'valid_values': ['no_iniciado', 'en_proceso', 'adquirido', 'consolidado']},
            {'name': 'notes', 'label': 'Notas', 'required': False, 'example': ''},
        ],
        'min_role': 'educator',
    },
    'menu_semanal': {
        'label': 'Menú Semanal',
        'columns': [
            {'name': 'week_start_date', 'label': 'Fecha Inicio Semana * (YYYY-MM-DD, Lunes)', 'required': True, 'example': '2026-02-23'},
            {'name': 'day_of_week', 'label': 'Día * (1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes)', 'required': True, 'example': '1',
             'valid_values': ['1', '2', '3', '4', '5']},
            {'name': 'meal_type', 'label': 'Comida * (desayuno/refrigerio_am/almuerzo/refrigerio_pm)', 'required': True, 'example': 'almuerzo',
             'valid_values': ['desayuno', 'refrigerio_am', 'almuerzo', 'refrigerio_pm']},
            {'name': 'description', 'label': 'Descripción *', 'required': True, 'example': 'Sopa de verduras con pollo'},
            {'name': 'ingredients', 'label': 'Ingredientes (separados por |)', 'required': False, 'example': 'pollo|arroz|zanahoria'},
        ],
        'min_role': 'license_admin',
    },
    'salud': {
        'label': 'Registros de Salud',
        'columns': [
            {'name': 'child_cedula', 'label': 'Cédula del Niño *', 'required': True, 'example': '0954321098'},
            {'name': 'record_date', 'label': 'Fecha * (YYYY-MM-DD)', 'required': True, 'example': '2026-02-23'},
            {'name': 'record_type', 'label': 'Tipo * (control_peso_talla/hemoglobina/valoracion_medica/valoracion_dental/desparasitacion)', 'required': True, 'example': 'control_peso_talla',
             'valid_values': ['control_peso_talla', 'hemoglobina', 'valoracion_medica', 'valoracion_dental', 'desparasitacion']},
            {'name': 'weight', 'label': 'Peso (kg)', 'required': False, 'example': '12.5'},
            {'name': 'height', 'label': 'Talla (cm)', 'required': False, 'example': '85.0'},
            {'name': 'hemoglobin', 'label': 'Hemoglobina (g/dL)', 'required': False, 'example': '11.2'},
            {'name': 'diagnosis', 'label': 'Diagnóstico', 'required': False, 'example': 'Normal para la edad'},
            {'name': 'notes', 'label': 'Notas', 'required': False, 'example': ''},
        ],
        'min_role': 'coordinator',
    },
    'planificacion_ludica': {
        'label': 'Planificaciones Lúdicas',
        'columns': [
            {'name': 'planning_date', 'label': 'Fecha * (YYYY-MM-DD)', 'required': True, 'example': '2026-02-24'},
            {'name': 'age_group', 'label': 'Grupo Etario * (12-18 meses/18-24 meses/24-36 meses)', 'required': True, 'example': '24-36 meses',
             'valid_values': ['12-18 meses', '18-24 meses', '24-36 meses']},
            {'name': 'week_number', 'label': 'Número de Semana', 'required': False, 'example': '8'},
            {'name': 'month', 'label': 'Mes', 'required': False, 'example': 'Febrero'},
            {'name': 'year', 'label': 'Año', 'required': False, 'example': '2026'},
            {'name': 'tema_integrador', 'label': 'Tema Integrador', 'required': False, 'example': 'Mi Familia'},
            {'name': 'nombre_actividad', 'label': 'Nombre de la Actividad *', 'required': True, 'example': 'Descubriendo los colores'},
            {'name': 'objetivo', 'label': 'Objetivo de Aprendizaje', 'required': False, 'example': 'Identificar colores primarios mediante el juego'},
            {'name': 'ambito_vinculacion', 'label': 'Ámbito Vinculación', 'required': False, 'example': 'Compartir juguetes con sus pares'},
            {'name': 'ambito_descubrimiento', 'label': 'Ámbito Descubrimiento', 'required': False, 'example': 'Explorar texturas naturales'},
            {'name': 'ambito_expresion', 'label': 'Ámbito Expresión', 'required': False, 'example': 'Cantar canciones cortas'},
            {'name': 'ambito_exploracion', 'label': 'Ámbito Exploración Motriz', 'required': False, 'example': 'Caminar sobre líneas rectas'},
            {'name': 'observaciones', 'label': 'Observaciones', 'required': False, 'example': ''},
            {'name': 'status', 'label': 'Estado (borrador/aprobado/revisado)', 'required': False, 'example': 'borrador',
             'valid_values': ['borrador', 'aprobado', 'revisado']},
        ],
        'min_role': 'educator',
    },
}

# Role hierarchy for permission checks
ROLE_HIERARCHY = {
    'super_admin': 5,
    'license_admin': 4,
    'supervisor': 4,
    'coordinator': 3,
    'educator': 2,
    'viewer': 1,
}


# ============================================================
# TEMPLATE GENERATION
# ============================================================

# Multiple example rows for each entity, showing all valid
# enum values so the user knows exactly what text to enter.
ENTITY_EXAMPLES = {
    'usuarios': [
        {'email': 'coord1@centro.com', 'first_name': 'María', 'last_name': 'González', 'cedula': '0912345678', 'phone': '0991234567', 'role': 'coordinator', 'password': 'Temporal123!'},
        {'email': 'edu1@centro.com', 'first_name': 'Ana', 'last_name': 'Pérez', 'cedula': '0923456789', 'phone': '0992345678', 'role': 'educator', 'password': 'Temporal123!'},
        {'email': 'obs1@centro.com', 'first_name': 'Carlos', 'last_name': 'Ruiz', 'cedula': '0934567890', 'phone': '0993456789', 'role': 'viewer', 'password': 'Temporal123!'},
    ],
    'ninos': [
        {'first_name': 'Ana', 'last_name': 'López', 'cedula': '0954321001', 'birth_date': '2023-05-15', 'gender': 'femenino', 'enrollment_date': '2026-01-10', 'assigned_group': 'Sala 1', 'allergies': 'Ninguna', 'special_needs': '', 'rep_first_name': 'María', 'rep_last_name': 'López', 'rep_cedula': '0912345678', 'rep_relationship': 'madre', 'rep_phone': '0991234567', 'family_address': 'Av. Principal 123', 'family_city': 'Guayaquil'},
        {'first_name': 'Pedro', 'last_name': 'García', 'cedula': '0954321002', 'birth_date': '2022-11-20', 'gender': 'masculino', 'enrollment_date': '2026-02-01', 'assigned_group': 'Sala 2', 'allergies': 'Leche', 'special_needs': '', 'rep_first_name': 'José', 'rep_last_name': 'García', 'rep_cedula': '0923456789', 'rep_relationship': 'padre', 'rep_phone': '0992345678', 'family_address': 'Calle 10 de Agosto', 'family_city': 'Quito'},
        {'first_name': 'Lucía', 'last_name': 'Mendoza', 'cedula': '0954321003', 'birth_date': '2024-03-08', 'gender': 'femenino', 'enrollment_date': '2026-03-01', 'assigned_group': 'Sala 1', 'allergies': '', 'special_needs': '', 'rep_first_name': 'Rosa', 'rep_last_name': 'Mendoza', 'rep_cedula': '0934567890', 'rep_relationship': 'abuela', 'rep_phone': '0993456789', 'family_address': 'Km 5 vía Daule', 'family_city': 'Guayaquil'},
        {'first_name': 'Mateo', 'last_name': 'Torres', 'cedula': '0954321004', 'birth_date': '2023-01-25', 'gender': 'masculino', 'enrollment_date': '2026-01-15', 'assigned_group': 'Sala 3', 'allergies': '', 'special_needs': 'Terapia de lenguaje', 'rep_first_name': 'Laura', 'rep_last_name': 'Torres', 'rep_cedula': '0945678901', 'rep_relationship': 'tutor_legal', 'rep_phone': '0994567890', 'family_address': 'Cdla. Las Acacias', 'family_city': 'Cuenca'},
    ],
    'asistencia': [
        {'child_cedula': '0954321001', 'date': '2026-02-23', 'status': 'presente', 'arrival_time': '08:00', 'departure_time': '16:30', 'notes': ''},
        {'child_cedula': '0954321002', 'date': '2026-02-23', 'status': 'ausente', 'arrival_time': '', 'departure_time': '', 'notes': 'Enfermo'},
        {'child_cedula': '0954321003', 'date': '2026-02-23', 'status': 'justificado', 'arrival_time': '', 'departure_time': '', 'notes': 'Cita médica'},
        {'child_cedula': '0954321004', 'date': '2026-02-23', 'status': 'tardanza', 'arrival_time': '09:15', 'departure_time': '16:30', 'notes': 'Llegó tarde por tráfico'},
    ],
    'nutricion': [
        {'child_cedula': '0954321001', 'date': '2026-02-23', 'meal_type': 'desayuno', 'consumption_level': 'todo', 'menu_description': 'Leche con pan integral', 'notes': ''},
        {'child_cedula': '0954321001', 'date': '2026-02-23', 'meal_type': 'refrigerio_am', 'consumption_level': 'la_mayoria', 'menu_description': 'Frutas picadas', 'notes': ''},
        {'child_cedula': '0954321001', 'date': '2026-02-23', 'meal_type': 'almuerzo', 'consumption_level': 'la_mitad', 'menu_description': 'Sopa de verduras con pollo', 'notes': 'No le gustó la sopa'},
        {'child_cedula': '0954321001', 'date': '2026-02-23', 'meal_type': 'refrigerio_pm', 'consumption_level': 'poco', 'menu_description': 'Yogur con galletas', 'notes': ''},
        {'child_cedula': '0954321002', 'date': '2026-02-23', 'meal_type': 'desayuno', 'consumption_level': 'nada', 'menu_description': 'Leche con pan integral', 'notes': 'Rechazó todo el desayuno'},
    ],
    'hitos': [
        {'child_cedula': '0954321001', 'record_date': '2026-02-23', 'domain': 'vinculacion_emocional', 'milestone_description': 'Comparte juguetes con otros niños', 'achievement_level': 'consolidado', 'notes': ''},
        {'child_cedula': '0954321001', 'record_date': '2026-02-23', 'domain': 'descubrimiento_natural_cultural', 'milestone_description': 'Identifica colores básicos', 'achievement_level': 'adquirido', 'notes': ''},
        {'child_cedula': '0954321002', 'record_date': '2026-02-23', 'domain': 'expresion_corporal', 'milestone_description': 'Salta con ambos pies', 'achievement_level': 'en_proceso', 'notes': 'Necesita más práctica'},
        {'child_cedula': '0954321003', 'record_date': '2026-02-23', 'domain': 'lenguaje', 'milestone_description': 'Pronuncia oraciones de 3 palabras', 'achievement_level': 'no_iniciado', 'notes': 'Derivar a terapia de lenguaje'},
    ],
    'menu_semanal': [
        {'week_start_date': '2026-02-23', 'day_of_week': '1', 'meal_type': 'desayuno', 'description': 'Leche con pan integral y mantequilla', 'ingredients': 'leche|pan integral|mantequilla'},
        {'week_start_date': '2026-02-23', 'day_of_week': '1', 'meal_type': 'refrigerio_am', 'description': 'Frutas picadas de temporada', 'ingredients': 'manzana|plátano|uvas'},
        {'week_start_date': '2026-02-23', 'day_of_week': '1', 'meal_type': 'almuerzo', 'description': 'Sopa de verduras con pollo y arroz', 'ingredients': 'pollo|arroz|zanahoria|papa|brócoli'},
        {'week_start_date': '2026-02-23', 'day_of_week': '1', 'meal_type': 'refrigerio_pm', 'description': 'Yogur natural con galletas integrales', 'ingredients': 'yogur|galletas integrales'},
        {'week_start_date': '2026-02-23', 'day_of_week': '2', 'meal_type': 'desayuno', 'description': 'Colada de avena con huevo revuelto', 'ingredients': 'avena|huevo|leche'},
        {'week_start_date': '2026-02-23', 'day_of_week': '3', 'meal_type': 'desayuno', 'description': 'Batido de fresa con tostada', 'ingredients': 'fresa|leche|pan|queso'},
        {'week_start_date': '2026-02-23', 'day_of_week': '4', 'meal_type': 'almuerzo', 'description': 'Arroz con menestra y carne asada', 'ingredients': 'arroz|lenteja|carne|ensalada'},
        {'week_start_date': '2026-02-23', 'day_of_week': '5', 'meal_type': 'almuerzo', 'description': 'Seco de pollo con arroz y ensalada', 'ingredients': 'pollo|arroz|tomate|lechuga'},
    ],
    'salud': [
        {'child_cedula': '0954321001', 'record_date': '2026-02-23', 'record_type': 'control_peso_talla', 'weight': '12.5', 'height': '85.0', 'hemoglobin': '', 'diagnosis': 'Normal para la edad', 'notes': ''},
        {'child_cedula': '0954321002', 'record_date': '2026-02-23', 'record_type': 'hemoglobina', 'weight': '', 'height': '', 'hemoglobin': '11.2', 'diagnosis': 'Hemoglobina normal', 'notes': ''},
        {'child_cedula': '0954321003', 'record_date': '2026-02-23', 'record_type': 'valoracion_medica', 'weight': '10.8', 'height': '78.5', 'hemoglobin': '', 'diagnosis': 'Resfriado común', 'notes': 'Recetado paracetamol'},
        {'child_cedula': '0954321001', 'record_date': '2026-02-23', 'record_type': 'valoracion_dental', 'weight': '', 'height': '', 'hemoglobin': '', 'diagnosis': 'Dentadura sana', 'notes': ''},
        {'child_cedula': '0954321004', 'record_date': '2026-02-23', 'record_type': 'desparasitacion', 'weight': '13.1', 'height': '88.2', 'hemoglobin': '', 'diagnosis': 'Desparasitación completada', 'notes': 'Albendazol dosis única'},
    ],
    'planificacion_ludica': [
        {'planning_date': '2026-02-24', 'age_group': '24-36 meses', 'week_number': '8', 'month': 'Febrero', 'year': '2026', 'tema_integrador': 'Mi Familia', 'nombre_actividad': 'Descubriendo los colores', 'objetivo': 'Identificar colores primarios mediante el juego', 'ambito_vinculacion': 'Compartir juguetes con sus pares', 'ambito_descubrimiento': 'Explorar texturas naturales', 'ambito_expresion': 'Cantar canciones cortas', 'ambito_exploracion': 'Caminar sobre líneas rectas', 'observaciones': '', 'status': 'borrador'},
        {'planning_date': '2026-02-25', 'age_group': '18-24 meses', 'week_number': '8', 'month': 'Febrero', 'year': '2026', 'tema_integrador': 'Los Animales', 'nombre_actividad': 'Jugando con los sonidos de animales', 'objetivo': 'Reconocer sonidos de animales domésticos', 'ambito_vinculacion': 'Juego cooperativo en grupo', 'ambito_descubrimiento': 'Clasificar animales por tamaño', 'ambito_expresion': 'Imitar sonidos onomatopéyicos', 'ambito_exploracion': 'Gatear siguiendo un camino', 'observaciones': 'Incluir material didáctico', 'status': 'borrador'},
        {'planning_date': '2026-02-26', 'age_group': '12-18 meses', 'week_number': '8', 'month': 'Febrero', 'year': '2026', 'tema_integrador': 'Mi Cuerpo', 'nombre_actividad': 'Explorando mis manos', 'objetivo': 'Estimular motricidad fina a través de la manipulación', 'ambito_vinculacion': 'Interacción con el adulto cuidador', 'ambito_descubrimiento': 'Tocar diferentes texturas', 'ambito_expresion': 'Balbuceo dirigido', 'ambito_exploracion': 'Agarrar objetos pequeños', 'observaciones': '', 'status': 'aprobado'},
    ],
}


def generate_csv_template(entity_key):
    """Generate a CSV template with headers and multiple example rows
    showing all valid enum/select values for clarity."""
    definition = ENTITY_DEFINITIONS.get(entity_key)
    if not definition:
        return None, None

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    headers = [col['name'] for col in definition['columns']]
    writer.writerow(headers)

    # Multiple example rows from ENTITY_EXAMPLES
    examples = ENTITY_EXAMPLES.get(entity_key, [])
    for example_row in examples:
        writer.writerow([example_row.get(h, '') for h in headers])

    # If no examples defined, fall back to single row from column definitions
    if not examples:
        writer.writerow([col.get('example', '') for col in definition['columns']])

    output.seek(0)
    return output.getvalue(), f"plantilla_{entity_key}.csv"



# ============================================================
# CSV PROCESSING ENGINE
# ============================================================

def process_csv_upload(entity_key, file_stream, user, tenant_id=None):
    """
    Process a CSV file upload for a given entity.
    Returns a dict: {success: int, errors: [{row: int, field: str, message: str}]}
    """
    definition = ENTITY_DEFINITIONS.get(entity_key)
    if not definition:
        return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': f'Entidad desconocida: {entity_key}'}]}

    # Check role permission
    user_role = user.role.name if user.role else 'viewer'
    min_role = definition.get('min_role', 'coordinator')
    if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(min_role, 0):
        return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': f'Permiso insuficiente. Se requiere rol: {min_role}'}]}

    # Read CSV
    try:
        content = file_stream.read().decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(content))
    except Exception as e:
        return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': f'Error leyendo CSV: {str(e)}'}]}

    rows = list(reader)
    if not rows:
        return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': 'El archivo CSV está vacío'}]}

    # Validate all rows first
    all_errors = []
    validated_rows = []

    for idx, row in enumerate(rows, start=2):  # Row 2 because row 1 is header
        row_errors = _validate_row(row, definition['columns'], idx)
        if row_errors:
            all_errors.extend(row_errors)
        else:
            validated_rows.append((idx, row))

    # If there are validation errors, return them without processing
    if all_errors:
        return {'success': 0, 'errors': all_errors, 'total_rows': len(rows)}

    # Process valid rows
    processor = PROCESSORS.get(entity_key)
    if not processor:
        return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': f'Procesador no implementado para: {entity_key}'}]}

    success_count = 0
    process_errors = []

    for row_num, row in validated_rows:
        try:
            processor(row, user, tenant_id)
            success_count += 1
        except Exception as e:
            db.session.rollback()
            process_errors.append({'row': row_num, 'field': '', 'message': str(e)})
            logger.error(f"Ingestion error row {row_num}: {e}")

    if success_count > 0:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return {'success': 0, 'errors': [{'row': 0, 'field': '', 'message': f'Error guardando datos: {str(e)}'}]}

    return {'success': success_count, 'errors': process_errors, 'total_rows': len(rows)}


def _validate_row(row, columns, row_num):
    """Validate a single CSV row against column definitions."""
    errors = []
    for col in columns:
        value = (row.get(col['name'], '') or '').strip()

        # Required check
        if col.get('required') and not value:
            errors.append({'row': row_num, 'field': col['name'], 'message': f"Campo obligatorio vacío: {col['label']}"})
            continue

        # Enum check
        if value and col.get('valid_values') and value.lower() not in [v.lower() for v in col['valid_values']]:
            errors.append({
                'row': row_num,
                'field': col['name'],
                'message': f"Valor inválido '{value}' para {col['label']}. Opciones: {', '.join(col['valid_values'])}"
            })

        # Date format check
        if value and 'YYYY-MM-DD' in col.get('label', ''):
            try:
                datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                errors.append({'row': row_num, 'field': col['name'], 'message': f"Formato de fecha inválido: '{value}'. Use YYYY-MM-DD"})

    return errors


# ============================================================
# ENTITY PROCESSORS
# Each creates DB records from a validated CSV row.
# ============================================================

def _process_usuario(row, user, tenant_id):
    """Create a User from a CSV row."""
    role = Role.query.filter_by(name=row['role'].strip().lower()).first()
    if not role:
        raise ValueError(f"Rol no encontrado: {row['role']}")

    # Check for duplicates
    existing = User.query.filter_by(email=row['email'].strip(), tenant_id=tenant_id).first()
    if existing:
        raise ValueError(f"Ya existe un usuario con email: {row['email']}")

    new_user = User(
        tenant_id=tenant_id,
        role_id=role.id,
        email=row['email'].strip(),
        first_name=row['first_name'].strip(),
        last_name=row['last_name'].strip(),
        cedula=row.get('cedula', '').strip() or None,
        phone=row.get('phone', '').strip() or None,
        is_active=True,
    )
    new_user.set_password(row['password'].strip())
    db.session.add(new_user)


def _process_nino(row, user, tenant_id):
    """Create a Child with Family and Representative from a CSV row."""
    # Try to find existing family by representative cedula
    family = None
    rep_cedula = (row.get('rep_cedula', '') or '').strip()
    if rep_cedula:
        existing_rep = Representative.query.filter_by(cedula=rep_cedula).first()
        if existing_rep:
            family = existing_rep.family

    # Create new family if not found
    if not family:
        family = Family(
            tenant_id=tenant_id,
            address=row.get('family_address', '').strip() or None,
            city=row.get('family_city', '').strip() or None,
        )
        db.session.add(family)
        db.session.flush()  # Get family.id

        # Create representative
        rep = Representative(
            family_id=family.id,
            first_name=row['rep_first_name'].strip(),
            last_name=row['rep_last_name'].strip(),
            cedula=rep_cedula or None,
            relationship=row['rep_relationship'].strip().lower(),
            phone=row.get('rep_phone', '').strip() or None,
            is_primary=True,
        )
        db.session.add(rep)

    # Check child duplicate by cedula
    child_cedula = (row.get('cedula', '') or '').strip()
    if child_cedula:
        existing_child = Child.query.filter_by(cedula=child_cedula).first()
        if existing_child:
            raise ValueError(f"Ya existe un niño con cédula: {child_cedula}")

    enrollment = row.get('enrollment_date', '').strip()
    enrollment_date = datetime.strptime(enrollment, '%Y-%m-%d').date() if enrollment else date.today()

    child = Child(
        tenant_id=tenant_id,
        family_id=family.id,
        first_name=row['first_name'].strip(),
        last_name=row['last_name'].strip(),
        cedula=child_cedula or None,
        birth_date=datetime.strptime(row['birth_date'].strip(), '%Y-%m-%d').date(),
        gender=row['gender'].strip().lower(),
        enrollment_date=enrollment_date,
        assigned_group=row.get('assigned_group', '').strip() or None,
        allergies=row.get('allergies', '').strip() or None,
        special_needs=row.get('special_needs', '').strip() or None,
        status='activo',
    )
    db.session.add(child)


def _process_asistencia(row, user, tenant_id):
    """Create an Attendance record from a CSV row."""
    child = Child.query.filter_by(cedula=row['child_cedula'].strip(), tenant_id=tenant_id).first()
    if not child:
        raise ValueError(f"Niño con cédula {row['child_cedula']} no encontrado en este centro")

    record_date = datetime.strptime(row['date'].strip(), '%Y-%m-%d').date()

    # Check for duplicates
    existing = Attendance.query.filter_by(child_id=child.id, date=record_date).first()
    if existing:
        raise ValueError(f"Ya existe asistencia para {child.full_name} en {row['date']}")

    arrival = None
    if row.get('arrival_time', '').strip():
        arrival = datetime.strptime(row['arrival_time'].strip(), '%H:%M').time()

    departure = None
    if row.get('departure_time', '').strip():
        departure = datetime.strptime(row['departure_time'].strip(), '%H:%M').time()

    att = Attendance(
        tenant_id=tenant_id,
        child_id=child.id,
        date=record_date,
        status=row['status'].strip().lower(),
        arrival_time=arrival,
        departure_time=departure,
        registered_by_id=user.id,
        notes=row.get('notes', '').strip() or None,
    )
    db.session.add(att)


def _process_nutricion(row, user, tenant_id):
    """Create a NutritionDaily record from a CSV row."""
    child = Child.query.filter_by(cedula=row['child_cedula'].strip(), tenant_id=tenant_id).first()
    if not child:
        raise ValueError(f"Niño con cédula {row['child_cedula']} no encontrado en este centro")

    record = NutritionDaily(
        tenant_id=tenant_id,
        child_id=child.id,
        date=datetime.strptime(row['date'].strip(), '%Y-%m-%d').date(),
        meal_type=row['meal_type'].strip().lower(),
        consumption_level=row['consumption_level'].strip().lower(),
        menu_description=row.get('menu_description', '').strip() or None,
        registered_by_id=user.id,
        notes=row.get('notes', '').strip() or None,
    )
    db.session.add(record)


def _process_hitos(row, user, tenant_id):
    """Create a Milestone record from a CSV row."""
    child = Child.query.filter_by(cedula=row['child_cedula'].strip(), tenant_id=tenant_id).first()
    if not child:
        raise ValueError(f"Niño con cédula {row['child_cedula']} no encontrado en este centro")

    milestone = Milestone(
        tenant_id=tenant_id,
        child_id=child.id,
        record_date=datetime.strptime(row['record_date'].strip(), '%Y-%m-%d').date(),
        domain=row['domain'].strip().lower(),
        milestone_description=row['milestone_description'].strip(),
        achievement_level=row['achievement_level'].strip().lower(),
        age_months=child.age_months,
        registered_by_id=user.id,
        notes=row.get('notes', '').strip() or None,
    )
    db.session.add(milestone)


def _process_menu_semanal(row, user, tenant_id):
    """Create a Menu record from a CSV row."""
    from models.license import LicenseAdmin

    # For license_admin, use license_id instead of tenant_id
    license_admin = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
    license_id = license_admin.license_id if license_admin else None

    week_start = datetime.strptime(row['week_start_date'].strip(), '%Y-%m-%d').date()
    day = int(row['day_of_week'].strip())
    meal = row['meal_type'].strip().lower()

    # Upsert: update if exists, create if not
    existing = Menu.query.filter_by(
        license_id=license_id, tenant_id=None,
        week_start_date=week_start, day_of_week=day, meal_type=meal
    ).first()

    ingredients_raw = row.get('ingredients', '').strip()
    ingredients_list = [i.strip() for i in ingredients_raw.split('|') if i.strip()] if ingredients_raw else None

    if existing:
        existing.description = row['description'].strip()
        existing.ingredients = ingredients_list
    else:
        menu = Menu(
            license_id=license_id,
            tenant_id=None,
            week_start_date=week_start,
            day_of_week=day,
            meal_type=meal,
            description=row['description'].strip(),
            ingredients=ingredients_list,
            created_by_id=user.id,
        )
        db.session.add(menu)


def _process_salud(row, user, tenant_id):
    """Create a HealthRecord from a CSV row."""
    child = Child.query.filter_by(cedula=row['child_cedula'].strip(), tenant_id=tenant_id).first()
    if not child:
        raise ValueError(f"Niño con cédula {row['child_cedula']} no encontrado en este centro")

    record = HealthRecord(
        tenant_id=tenant_id,
        child_id=child.id,
        record_date=datetime.strptime(row['record_date'].strip(), '%Y-%m-%d').date(),
        record_type=row['record_type'].strip().lower(),
        weight=float(row['weight']) if row.get('weight', '').strip() else None,
        height=float(row['height']) if row.get('height', '').strip() else None,
        hemoglobin=float(row['hemoglobin']) if row.get('hemoglobin', '').strip() else None,
        diagnosis=row.get('diagnosis', '').strip() or None,
        registered_by_id=user.id,
        notes=row.get('notes', '').strip() or None,
    )
    db.session.add(record)


def _process_planificacion(row, user, tenant_id):
    """Create a LudicPlanning record from a CSV row."""
    from models.planning import LudicPlanning

    planning = LudicPlanning(
        tenant_id=tenant_id,
        educator_id=user.id,
        planning_date=datetime.strptime(row['planning_date'].strip(), '%Y-%m-%d').date(),
        age_group=row['age_group'].strip(),
        week_number=int(row['week_number']) if row.get('week_number', '').strip() else None,
        month=row.get('month', '').strip() or None,
        year=int(row['year']) if row.get('year', '').strip() else None,
        tema_integrador=row.get('tema_integrador', '').strip() or None,
        nombre_actividad=row['nombre_actividad'].strip(),
        objetivo=row.get('objetivo', '').strip() or None,
        ambito_vinculacion=row.get('ambito_vinculacion', '').strip() or None,
        ambito_descubrimiento=row.get('ambito_descubrimiento', '').strip() or None,
        ambito_expresion=row.get('ambito_expresion', '').strip() or None,
        ambito_exploracion=row.get('ambito_exploracion', '').strip() or None,
        observaciones=row.get('observaciones', '').strip() or None,
        status=row.get('status', 'borrador').strip() or 'borrador',
    )
    db.session.add(planning)


# Processor registry
PROCESSORS = {
    'usuarios': _process_usuario,
    'ninos': _process_nino,
    'asistencia': _process_asistencia,
    'nutricion': _process_nutricion,
    'hitos': _process_hitos,
    'menu_semanal': _process_menu_semanal,
    'salud': _process_salud,
    'planificacion_ludica': _process_planificacion,
}


def get_available_entities(user_role):
    """Get list of entities available for a given role."""
    role_level = ROLE_HIERARCHY.get(user_role, 0)
    available = []
    for key, definition in ENTITY_DEFINITIONS.items():
        min_level = ROLE_HIERARCHY.get(definition.get('min_role', 'coordinator'), 0)
        if role_level >= min_level:
            available.append({
                'key': key,
                'label': definition['label'],
                'columns': [{'name': c['name'], 'label': c['label'], 'required': c.get('required', False)} for c in definition['columns']],
            })
    return available
