"""
Agent Orchestrator - Main coordinator for multi-agent system
Routes messages to appropriate specialized agents
"""
from typing import Dict, List, Optional
from agents.llm_interface import get_llm
from datetime import datetime
import json


class AgentOrchestrator:
    """
    Main orchestrator agent that:
    1. Receives natural language messages
    2. Maintains conversation context
    3. Routes to specialized executor agents
    4. Validates confidence scores
    """
    
    def __init__(self, tenant_id: int, user_id: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()
        self.conversation_history = []
        self.context = {}
    
    def process_message(self, message: str, channel: str = 'web_chat') -> Dict:
        """
        Process incoming message and route to appropriate agent
        
        Args:
            message: User message text
            channel: Communication channel (whatsapp, telegram, web_chat)
        
        Returns:
            Response dict with agent_response, action, confidence
        """
        try:
            # Add message to history
            self.conversation_history.append({
                'role': 'user',
                'content': message,
                'timestamp': datetime.utcnow().isoformat()
            })
            
            # Determine intent and route to agent
            intent = self._classify_intent(message)
            
            # Route to appropriate agent
            if intent['type'] == 'postulacion':
                from agents.postulacion_agent import PostulacionAgent
                agent = PostulacionAgent(self.tenant_id, self.user_id)
                result = {
                    'response': 'Te ayudo con mucho gusto en tu postulación a nuestros programas sociales.',
                    'success': True,
                    'agent_used': 'postulacion_agent',
                    'action': 'program_intake'
                }

            elif intent['type'] == 'ingesta':
                from agents.ingesta_agent import IngestaAgent
                agent = IngestaAgent(self.tenant_id, self.user_id)
                result = agent.process(message, self.context)
            
            elif intent['type'] == 'asistencia':
                from agents.asistencia_agent import AsistenciaAgent
                agent = AsistenciaAgent(self.tenant_id, self.user_id)
                result = agent.process(message, self.context)
            
            elif intent['type'] == 'resumenes':
                from agents.resumenes_agent import ResumenesAgent
                agent = ResumenesAgent(self.tenant_id, self.user_id)
                result = agent.process(message, self.context)
            
            elif intent['type'] == 'contactos':
                from agents.contactos_agent import ContactosAgent
                agent = ContactosAgent(self.tenant_id, self.user_id)
                result = agent.process(message, self.context)
            
            else:
                # General conversation
                result = self._general_response(message)
            
            # Update context
            if result.get('context_update'):
                self.context.update(result['context_update'])
            
            # Add response to history
            self.conversation_history.append({
                'role': 'assistant',
                'content': result['response'],
                'timestamp': datetime.utcnow().isoformat()
            })
            
            # Save to database
            self._save_conversation(message, result, channel)
            
            return result
            
        except Exception as e:
            return {
                'response': f'Lo siento, ocurrió un error: {str(e)}',
                'success': False,
                'error': str(e)
            }
    
    def _classify_intent(self, message: str) -> Dict:
        """
        Classify user intent using LLM
        
        Returns:
            Dict with 'type' and 'confidence'
        """
        system_prompt = """Eres un clasificador de intenciones para un sistema de gestión de CDI (Centro de Desarrollo Infantil).

Clasifica el mensaje del usuario en una de estas categorías:
- postulacion: Consultar, iniciar o postular a programas sociales, ayudas o admisiones
- ingesta: Registrar datos (nutrición, salud, actividades)
- asistencia: Control de asistencia
- resumenes: Solicitar resúmenes o reportes
- contactos: Buscar información de contacto
- general: Conversación general

Responde SOLO con un JSON en este formato:
{
    "type": "categoria",
    "confidence": 0.95,
    "reasoning": "breve explicación"
}"""
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Mensaje: "{message}"'}
        ]
        
        try:
            response = self.llm.chat_completion(messages, temperature=0.3, max_tokens=200)
            intent = self.llm.extract_json(response)
            return intent
        except Exception as e:
            # Default to general if classification fails
            return {'type': 'general', 'confidence': 0.5, 'reasoning': f'Error: {str(e)}'}
    
    def _general_response(self, message: str) -> Dict:
        """Generate general conversational response"""
        system_prompt = """Eres un asistente virtual para un Centro de Desarrollo Infantil (CDI) en Ecuador.
Ayudas a educadoras, coordinadores y personal administrativo.
Sé amable, profesional y conciso."""
        
        messages = [
            {'role': 'system', 'content': system_prompt}
        ]
        
        # Add recent history
        messages.extend(self.conversation_history[-6:])
        
        response = self.llm.chat_completion(messages, temperature=0.7, max_tokens=300)
        
        return {
            'response': response,
            'success': True,
            'agent_used': 'orchestrator',
            'action': 'conversation'
        }
    
    def _save_conversation(self, message: str, result: Dict, channel: str):
        """Save conversation to database"""
        try:
            from models import db
            from models.user import User
            
            # Import here to avoid circular dependency
            from sqlalchemy import text
            
            query = text("""
                INSERT INTO conversation_history 
                (tenant_id, user_id, channel, sender_identifier, message_text, 
                 agent_response, agent_used, confidence_score, database_action)
                VALUES 
                (:tenant_id, :user_id, :channel, :sender, :message, 
                 :response, :agent, :confidence, :action)
            """)
            
            db.session.execute(query, {
                'tenant_id': self.tenant_id,
                'user_id': self.user_id,
                'channel': channel,
                'sender': str(self.user_id),
                'message': message,
                'response': result.get('response', ''),
                'agent': result.get('agent_used', 'orchestrator'),
                'confidence': result.get('confidence', 0.0),
                'action': result.get('action', '')
            })
            
            db.session.commit()
            
        except Exception as e:
            print(f"Error saving conversation: {e}")
            db.session.rollback()
    
    def get_context(self) -> Dict:
        """Get current conversation context"""
        return self.context
    
    def set_context(self, context: Dict):
        """Set conversation context"""
        self.context = context
    
    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
        self.context = {}
