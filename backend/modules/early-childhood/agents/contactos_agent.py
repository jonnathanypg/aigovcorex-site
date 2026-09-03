"""
Contactos Agent - Retrieves emergency contact information
"""
from typing import Dict
from agents.llm_interface import get_llm
from models.child import Child


class ContactosAgent:
    """
    Agent specialized in retrieving contact information
    Example: "Necesito el contacto de emergencia de María"
    """
    
    def __init__(self, tenant_id: int, user_id: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()
    
    def process(self, message: str, context: Dict) -> Dict:
        """Process contact request"""
        try:
            # Extract child name
            request_data = self._parse_request(message, context)
            
            child_name = request_data.get('child_name')
            if not child_name:
                return {
                    'response': '¿De qué niño/niña necesitas la información de contacto?',
                    'success': False,
                    'agent_used': 'contactos'
                }
            
            # Find child
            child = self._find_child(child_name)
            
            if not child:
                return {
                    'response': f"No encontré al niño/niña '{child_name}'.",
                    'success': False,
                    'agent_used': 'contactos'
                }
            
            # Get contact information
            contact_info = self._get_contact_info(child)
            
            return {
                'response': contact_info,
                'success': True,
                'agent_used': 'contactos',
                'action': 'contact_retrieval'
            }
            
        except Exception as e:
            return {
                'response': f'Error al obtener contactos: {str(e)}',
                'success': False,
                'error': str(e),
                'agent_used': 'contactos'
            }
    
    def _parse_request(self, message: str, context: Dict) -> Dict:
        """Parse contact request"""
        system_prompt = """Extrae el nombre del niño del mensaje.

Responde con JSON:
{
    "child_name": "nombre del niño"
}"""
        
        context_info = ""
        if context.get('last_child_name'):
            context_info = f"\nÚltimo niño mencionado: {context['last_child_name']}"
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'{message}{context_info}'}
        ]
        
        response = self.llm.chat_completion(messages, temperature=0.2, max_tokens=100)
        return self.llm.extract_json(response)
    
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
    
    def _get_contact_info(self, child: Child) -> str:
        """Get formatted contact information"""
        family = child.family
        
        info = f"👤 Información de Contacto - {child.full_name}\n"
        info += f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        # Family contact
        if family:
            if family.phone_primary:
                info += f"📞 Teléfono Principal: {family.phone_primary}\n"
            if family.phone_secondary:
                info += f"📞 Teléfono Secundario: {family.phone_secondary}\n"
            
            info += f"\n🚨 Contacto de Emergencia:\n"
            if family.emergency_contact_name:
                info += f"  Nombre: {family.emergency_contact_name}\n"
            if family.emergency_contact_phone:
                info += f"  Teléfono: {family.emergency_contact_phone}\n"
            if family.emergency_contact_relationship:
                info += f"  Relación: {family.emergency_contact_relationship}\n"
            
            if family.address:
                info += f"\n📍 Dirección: {family.address}\n"
                if family.city:
                    info += f"   Ciudad: {family.city}\n"
        
        # Representatives
        representatives = family.representatives.all() if family else []
        if representatives:
            info += f"\n👨‍👩‍👧 Representantes:\n"
            for rep in representatives:
                info += f"\n  • {rep.full_name} ({rep.relationship})\n"
                if rep.phone:
                    info += f"    Tel: {rep.phone}\n"
                if rep.email:
                    info += f"    Email: {rep.email}\n"
        
        # Medical information
        if child.allergies or child.medical_conditions:
            info += f"\n⚕️ Información Médica:\n"
            if child.allergies:
                info += f"  Alergias: {child.allergies}\n"
            if child.medical_conditions:
                info += f"  Condiciones: {child.medical_conditions}\n"
            if child.blood_type:
                info += f"  Tipo de Sangre: {child.blood_type}\n"
        
        return info


# Initialize agents module
def __init__():
    pass
