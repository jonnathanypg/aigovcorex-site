"""
Asistencia Agent - Handles attendance management via natural language
"""
from typing import Dict, List
from agents.llm_interface import get_llm
from models import db
from models.child import Child
from models.attendance import Attendance
from datetime import date


class AsistenciaAgent:
    """
    Agent specialized in attendance management
    Example: "Hoy asistieron: María, Juan, Pedro. Faltó Sofía"
    """
    
    def __init__(self, tenant_id: int, user_id: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()
    
    def process(self, message: str, context: Dict) -> Dict:
        """Process attendance message"""
        try:
            # Extract attendance data
            attendance_data = self._extract_attendance(message)
            
            if not attendance_data.get('children'):
                return {
                    'response': 'No pude identificar nombres de niños en el mensaje. Por favor, especifica quiénes asistieron o faltaron.',
                    'success': False,
                    'agent_used': 'asistencia'
                }
            
            # Process attendance
            results = self._process_attendance_list(attendance_data['children'])
            
            # Generate response
            response = self._generate_response(results)
            
            return {
                'response': response,
                'success': True,
                'agent_used': 'asistencia',
                'action': 'attendance_registration',
                'confidence': attendance_data.get('confidence', 0.8)
            }
            
        except Exception as e:
            return {
                'response': f'Error al procesar asistencia: {str(e)}',
                'success': False,
                'error': str(e),
                'agent_used': 'asistencia'
            }
    
    def _extract_attendance(self, message: str) -> Dict:
        """Extract attendance information from message"""
        system_prompt = """Extrae información de asistencia del mensaje.

Identifica:
- Niños que asistieron (status: presente)
- Niños que faltaron (status: ausente)
- Niños con justificación (status: justificado)
- Niños que llegaron tarde (status: tardanza)

Responde con JSON:
{
    "children": [
        {"name": "María", "status": "presente"},
        {"name": "Juan", "status": "ausente"}
    ],
    "confidence": 0.9
}"""
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': message}
        ]
        
        response = self.llm.chat_completion(messages, temperature=0.2, max_tokens=500)
        return self.llm.extract_json(response)
    
    def _process_attendance_list(self, children_data: List[Dict]) -> Dict:
        """Process list of children and their attendance status"""
        results = {
            'registered': [],
            'not_found': [],
            'errors': []
        }
        
        today = date.today()
        
        for child_data in children_data:
            child_name = child_data.get('name')
            status = child_data.get('status', 'presente')
            
            # Find child
            child = self._find_child(child_name)
            
            if not child:
                results['not_found'].append(child_name)
                continue
            
            try:
                # Check if attendance already exists
                existing = Attendance.query.filter_by(
                    child_id=child.id,
                    date=today
                ).first()
                
                if existing:
                    # Update existing
                    existing.status = status
                    existing.registered_by_id = self.user_id
                else:
                    # Create new
                    attendance = Attendance(
                        tenant_id=self.tenant_id,
                        child_id=child.id,
                        date=today,
                        status=status,
                        registered_by_id=self.user_id
                    )
                    db.session.add(attendance)
                
                results['registered'].append({
                    'name': child.full_name,
                    'status': status
                })
                
            except Exception as e:
                results['errors'].append(f"{child_name}: {str(e)}")
        
        db.session.commit()
        return results
    
    def _find_child(self, child_name: str) -> Child:
        """Find child by name"""
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
    
    def _generate_response(self, results: Dict) -> str:
        """Generate human-readable response"""
        response_parts = []
        
        if results['registered']:
            response_parts.append("✅ Asistencia registrada:")
            for item in results['registered']:
                response_parts.append(f"  • {item['name']}: {item['status']}")
        
        if results['not_found']:
            response_parts.append("\n⚠️ No encontrados:")
            for name in results['not_found']:
                response_parts.append(f"  • {name}")
        
        if results['errors']:
            response_parts.append("\n❌ Errores:")
            for error in results['errors']:
                response_parts.append(f"  • {error}")
        
        return "\n".join(response_parts) if response_parts else "No se registró ninguna asistencia."
