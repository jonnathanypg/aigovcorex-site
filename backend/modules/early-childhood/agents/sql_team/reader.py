"""
SQL Reader Specialist
Part of the SQL Team. Handles complex data retrieval and analysis.
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from services.context_service import ContextService
from services.sql_executor import SQLExecutor
from config import get_config

class SQLReader:
    """
    Specialist agent for reading and analyzing data.
    """
    
    def __init__(self, user):
        self.user = user
        self.config = get_config()
        self.llm = ChatOpenAI(
            model_name=self.config.OPENAI_MODEL,
            temperature=0, 
            api_key=self.config.OPENAI_API_KEY
        )
        self.parser = JsonOutputParser()
        
    def execute_analysis(self, query_text: str) -> dict:
        """
        Generates and executes read-only SQL for analysis.
        """
        # 1. Context & Scope
        # Reusing the robust system prompt from Phase 3/5
        system_prompt_template = ContextService.build_agent_context(self.user, intent="sql_analysis")
        data_scope = ContextService.get_data_scope(self.user)
        
        # Reader acts strictly within read scope
        # Override allowed actions to ONLY select for this agent, 
        # but respect user's row-level security (tenant_id)
        read_scope = data_scope.copy()
        read_scope['allowed_actions'] = ['select'] 
        
        # Inject constraint hint safely using the pre-computed SQL filter from ContextService
        constraint_hint = ""
        if data_scope.get('filter_sql') and data_scope.get('filter_sql') != "1=1":
            constraint_hint = f" MANDATORY FILTER: WHERE {data_scope['filter_sql']}"
            
        system_prompt = system_prompt_template + "\n" + constraint_hint
        
        # Inject specialist role reminder (las reglas detalladas están en sql_analyst.md)
        system_prompt += """
        \n### ROL: ESPECIALISTA EN LECTURA DE DATOS (SQL READER)
        Tu objetivo es generar UNA SOLA consulta SELECT precisa y eficiente.
        
        RECORDATORIO CRÍTICO:
        - Genera EXACTAMENTE una query SQL (NO múltiples queries separadas)
        - Usa sintaxis MySQL/MariaDB (GROUP_CONCAT, DATE_FORMAT, IFNULL)
        - SIEMPRE cierra todos los paréntesis y termina con punto y coma (;)
        - El JSON de salida DEBE ser válido y parseable
        """
        
        print(f"\n{'='*40}\n [SQLReader] 🔎 ANALIZANDO DATOS\n{'='*40}")
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query_text)
        ]
        
        try:
            # 2. LLM Generation
            chain = self.llm | self.parser
            agent_output = chain.invoke(messages)
            
            sql_query = agent_output.get('sql')
            intent = agent_output.get('intent')
            reasoning = agent_output.get('reasoning')
            
            print(f" [SQLReader] 🧠 Thinking: {intent}")
            print(f" [SQLReader] 📝 Generated SQL: {sql_query}")
            
            if not sql_query:
                return {
                    "success": False,
                    "text": f"No se pudo generar una consulta de lectura válida. Razón: {reasoning}",
                    "data": None
                }
            
            # 3. Execution
            # SQLExecutor handles the connection and retries
            result = SQLExecutor.execute_query(sql_query, read_scope)
            
            if result['success']:
                print(f" [SQLReader] ✅ Success! Fetched {result['count']} rows.")
                return {
                    "success": True,
                    "text": f"Análisis completo: {intent}",
                    "data": result['data'],
                    "sql": sql_query
                }
            else:
                # Ocultar errores técnicos del usuario final
                error_msg = result.get('error', '').lower()
                print(f" [SQLReader] ❌ DB Error: {result.get('error')}")
                
                # Detectar tipo de error para respuesta apropiada
                if 'syntax' in error_msg or 'sql' in error_msg:
                    return {
                        "success": False,
                        "text": "Tuve un problema procesando la consulta. Intentando con un enfoque más simple...",
                        "data": None,
                        "retry_hint": True
                    }
                elif 'connection' in error_msg or 'gone away' in error_msg or 'lost' in error_msg:
                    return {
                        "success": False,
                        "text": "Hubo un problema de conexión momentáneo. ¿Puedes intentar de nuevo?",
                        "data": None
                    }
                else:
                    return {
                        "success": False,
                        "text": "No pude obtener los datos solicitados. ¿Podrías reformular tu pregunta?",
                        "data": None
                    }
                
        except Exception as e:
            print(f" [SQLReader] 💥 Critical Error: {str(e)}")
            error_str = str(e).lower()
            
            # Mapear errores técnicos a mensajes amigables
            if 'json' in error_str or 'parse' in error_str:
                user_msg = "Tuve un problema interpretando la respuesta. ¿Puedes reformular tu pregunta?"
            elif 'timeout' in error_str:
                user_msg = "La consulta tomó demasiado tiempo. Intenta con un período más corto."
            elif 'connection' in error_str:
                user_msg = "Problema de conexión temporal. Por favor intenta de nuevo."
            else:
                user_msg = "No pude completar el análisis. ¿Podrías intentarlo de nuevo?"
            
            return {
                "success": False,
                "text": user_msg,
                "data": None
            }

