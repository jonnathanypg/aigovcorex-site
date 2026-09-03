"""
Simple Orchestrator without LangGraph
Uses direct OpenAI/Gemini API calls
"""
from typing import Dict
from datetime import datetime
import json
import os
from models.license import License


class SimpleOrchestrator:
    """
    Simplified orchestrator using direct LLM APIs
    No LangChain/LangGraph dependencies
    """
    
    def __init__(self, tenant_id: int, user_id: int, license_id: int = None):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.license_id = license_id
        self.llm_provider = self._detect_llm_provider()
    
    def _get_custom_prompt(self) -> str | None:
        """Fetch custom agent personality from the license"""
        if not self.license_id:
            return None
        try:
            license_obj = License.query.get(self.license_id)
            if license_obj and license_obj.agent_personality:
                print(f" [SimpleOrchestrator] Found custom personality for license {self.license_id}")
                return license_obj.agent_personality
        except Exception as e:
            print(f"Error fetching custom prompt for license {self.license_id}: {e}")
        return None

    def _detect_llm_provider(self):
        """Detect which LLM provider to use"""
        if os.getenv('OPENAI_API_KEY'):
            return 'openai'
        elif os.getenv('GOOGLE_API_KEY'):
            return 'gemini'
        else:
            raise ValueError("No LLM API key configured")
    
    def _call_llm(self, messages: list, temperature: float = 1.0) -> str:
        """Call LLM API directly"""
        if self.llm_provider == 'openai':
            return self._call_openai(messages, temperature)
        else:
            return self._call_gemini(messages, temperature)
    
    def _call_openai(self, messages: list, temperature: float) -> str:
        """Call OpenAI API"""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            
            response = client.chat.completions.create(
                model=os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview'),
                messages=messages,
                temperature=temperature
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling OpenAI: {str(e)}"
    
    def _call_gemini(self, messages: list, temperature: float) -> str:
        """Call Google Gemini API"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
            
            model = genai.GenerativeModel(os.getenv('GEMINI_MODEL', 'gemini-pro'))
            
            # Convert messages to Gemini format
            prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
            
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature
                )
            )
            
            return response.text
        except Exception as e:
            return f"Error calling Gemini: {str(e)}"
    
    def process_message(self, message: str, channel: str = 'web_chat') -> Dict:
        """
        Process user message
        
        Args:
            message: User message text
            channel: Communication channel
        
        Returns:
            Response dict with agent_response
        """
        try:
            # Create system prompt
            system_prompt = """Eres un asistente virtual para un Centro de Desarrollo Infantil (CDI) en Ecuador.

Ayudas a educadoras, coordinadores y personal administrativo con:
- Registro de asistencia de niños
- Registro de nutrición (comidas)
- Registro de salud (peso, talla, incidentes)
- Consultas sobre niños y familias
- Generación de resúmenes

Sé amable, profesional y conciso en español."""

            # Get and append custom personality
            custom_personality = self._get_custom_prompt()
            if custom_personality:
                system_prompt += f"\n\n**Personalidad Adicional del Asistente:**\n{custom_personality}"
            
            print(f" [SimpleOrchestrator] Processing message: {message}")
            
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': message}
            ]
            
            # Call LLM
            print(f" [SimpleOrchestrator] Calling LLM Provider: {self.llm_provider}...")
            response_text = self._call_llm(messages, temperature=1.0)
            print(f" [SimpleOrchestrator] LLM Response received (len={len(response_text)})")
            
            # Save conversation
            self._save_conversation(message, response_text, channel)
            
            return {
                'response': response_text,
                'success': True,
                'agent_used': 'simple_orchestrator',
                'llm_provider': self.llm_provider
            }
            
        except Exception as e:
            return {
                'response': f'Lo siento, ocurrió un error: {str(e)}',
                'success': False,
                'error': str(e)
            }
    
    def _save_conversation(self, message: str, response: str, channel: str):
        """Save conversation to database with retry logic"""
        max_retries = 3
        fn_name = "SimpleOrchestrator._save_conversation"
        
        for attempt in range(max_retries):
            try:
                from models import db
                from sqlalchemy import text
                
                # Ensure session is active
                try:
                    db.session.execute(text("SELECT 1"))
                except Exception:
                    db.session.rollback()
                
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
                    'response': response,
                    'agent': 'simple_orchestrator',
                    'confidence': 0.8,
                    'action': ''
                })
                
                db.session.commit()
                return # Success
                
            except Exception as e:
                print(f"Error saving conversation ({fn_name}) - Attempt {attempt+1}/{max_retries}: {e}")
                try:
                    db.session.rollback()
                except:
                    pass
                    
                if attempt == max_retries - 1:
                    print(f"Failed to save conversation after {max_retries} attempts.")
