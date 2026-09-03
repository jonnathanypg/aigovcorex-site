"""
Ingesta Agent - Transforms natural language to structured database records
Handles: nutrition, health, activities, observations
"""
from typing import Dict
from agents.llm_interface import get_llm
from models import db
from models.child import Child
from models.nutrition import NutritionDaily
from models.health import HealthRecord
from datetime import datetime, date


class IngestaAgent:
    """
    Agent specialized in data ingestion from natural language
    Example: "Daniel comió todo su almuerzo pero tuvo diarrea"
    """
    
    def __init__(self, tenant_id: int, user_id: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()
        self.confidence_threshold = 0.7
    
    def process(self, message: str, context: Dict) -> Dict:
        """
        Process natural language message and extract structured data
        
        Args:
            message: Natural language message
            context: Conversation context (may contain child reference)
        
        Returns:
            Response dict with extracted data and database action
        """
        try:
            # Extract structured data from message
            extracted_data = self._extract_data(message, context)
            
            if extracted_data['confidence'] < self.confidence_threshold:
                return {
                    'response': 'No estoy seguro de haber entendido correctamente. ¿Podrías ser más específico?',
                    'success': False,
                    'confidence': extracted_data['confidence'],
                    'agent_used': 'ingesta'
                }
            
            # Find child
            child = self._find_child(extracted_data.get('child_name'), context)
            
            if not child:
                return {
                    'response': f"No encontré al niño/niña '{extracted_data.get('child_name')}'. ¿Podrías verificar el nombre?",
                    'success': False,
                    'agent_used': 'ingesta'
                }
            
            # Save to database
            saved_records = []
            
            if extracted_data.get('nutrition'):
                nutrition_record = self._save_nutrition(child, extracted_data['nutrition'])
                if nutrition_record:
                    saved_records.append('nutrición')
            
            if extracted_data.get('health'):
                health_record = self._save_health(child, extracted_data['health'])
                if health_record:
                    saved_records.append('salud')
            
            # Generate response
            response = f"✅ Registrado para {child.full_name}:\n"
            if saved_records:
                response += "- " + "\n- ".join(saved_records)
            else:
                response += "No se registraron datos nuevos."
            
            return {
                'response': response,
                'success': True,
                'confidence': extracted_data['confidence'],
                'agent_used': 'ingesta',
                'action': 'data_ingestion',
                'context_update': {'last_child_id': child.id, 'last_child_name': child.full_name}
            }
            
        except Exception as e:
            return {
                'response': f'Error al procesar: {str(e)}',
                'success': False,
                'error': str(e),
                'agent_used': 'ingesta'
            }
    
    def _extract_data(self, message: str, context: Dict) -> Dict:
        """Extract structured data from natural language"""
        system_prompt = """Eres un experto en extraer información estructurada sobre niños en un CDI.

Extrae la siguiente información del mensaje:
- child_name: Nombre del niño/niña
- nutrition: Información de alimentación (meal_type, consumption_level, notes)
- health: Información de salud (symptoms, incident_description, notes)

Tipos de comida válidos: desayuno, refrigerio_am, almuerzo, refrigerio_pm, lactancia
Niveles de consumo válidos: todo, la_mayoria, la_mitad, poco, nada

Responde SOLO con JSON:
{
    "child_name": "nombre",
    "nutrition": {
        "meal_type": "almuerzo",
        "consumption_level": "todo",
        "notes": "observaciones"
    },
    "health": {
        "symptoms": "síntomas",
        "incident_description": "descripción",
        "notes": "notas"
    },
    "confidence": 0.95
}

Si no hay información de nutrición o salud, omite esos campos."""
        
        # Add context about last mentioned child
        context_info = ""
        if context.get('last_child_name'):
            context_info = f"\nÚltimo niño mencionado: {context['last_child_name']}"
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Mensaje: "{message}"{context_info}'}
        ]
        
        response = self.llm.chat_completion(messages, temperature=0.2, max_tokens=500)
        data = self.llm.extract_json(response)
        
        return data
    
    def _find_child(self, child_name: str, context: Dict) -> Child:
        """Find child by name within tenant"""
        if not child_name:
            # Try to use last mentioned child from context
            if context.get('last_child_id'):
                return Child.query.filter_by(
                    id=context['last_child_id'],
                    tenant_id=self.tenant_id,
                    status='activo'
                ).first()
            return None
        
        # Search by name (first name or full name)
        children = Child.query.filter_by(
            tenant_id=self.tenant_id,
            status='activo'
        ).all()
        
        child_name_lower = child_name.lower()
        
        for child in children:
            if (child_name_lower in child.first_name.lower() or
                child_name_lower in child.full_name.lower()):
                return child
        
        return None
    
    def _save_nutrition(self, child: Child, nutrition_data: Dict) -> NutritionDaily:
        """Save nutrition record"""
        try:
            record = NutritionDaily(
                tenant_id=self.tenant_id,
                child_id=child.id,
                date=date.today(),
                meal_type=nutrition_data.get('meal_type', 'almuerzo'),
                meal_time=datetime.now().time(),
                consumption_level=nutrition_data.get('consumption_level', 'todo'),
                registered_by_id=self.user_id,
                notes=nutrition_data.get('notes', '')
            )
            
            db.session.add(record)
            db.session.commit()
            
            return record
            
        except Exception as e:
            db.session.rollback()
            print(f"Error saving nutrition: {e}")
            return None
    
    def _save_health(self, child: Child, health_data: Dict) -> HealthRecord:
        """Save health record"""
        try:
            record = HealthRecord(
                tenant_id=self.tenant_id,
                child_id=child.id,
                record_date=date.today(),
                record_type='enfermedad' if health_data.get('symptoms') else 'incidente',
                symptoms=health_data.get('symptoms', ''),
                incident_description=health_data.get('incident_description', ''),
                registered_by_id=self.user_id,
                notes=health_data.get('notes', '')
            )
            
            db.session.add(record)
            db.session.commit()
            
            return record
            
        except Exception as e:
            db.session.rollback()
            print(f"Error saving health: {e}")
            return None
