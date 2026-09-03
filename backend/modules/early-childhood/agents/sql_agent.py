from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from config import get_config

# Import Team Members
from agents.sql_team.reader import SQLReader
from agents.sql_team.writer import SQLWriter

class SQLAgent:
    """
    SQL TEAM MANAGER (Coordinador)
    Delegates tasks to Reader or Writer specialists based on intent.
    """
    
    def __init__(self, user):
        self.user = user
        self.config = get_config()
        # Router LLM (can be a smaller model for speed if available, using standard for now)
        self.llm = ChatOpenAI(
            model_name=self.config.OPENAI_MODEL,
            temperature=0, 
            api_key=self.config.OPENAI_API_KEY
        )
        self.parser = JsonOutputParser()
        
        # Initialize Squad
        self.reader = SQLReader(user)
        self.writer = SQLWriter(user)
        
    def process_query(self, user_query: str) -> dict:
        """
        Manager Logic:
        1. Classify Intent (Read vs Write)
        2. Delegate
        3. Return Result
        """
        print(f"\n{'='*40}\n [SQLManager] 🚦 ROUTING REQUEST\n{'='*40}")
        
        # 1. Classification Step
        classification_prompt = f"""
        Eres el SQL Team Manager. Tu trabajo es CLASIFICAR la petición del usuario.
        
        PETICIÓN: "{user_query}"
        
        SALIDA ESPERADA (JSON):
        {{
            "type": "read" | "write" | "mixed",
            "reason": "explicación breve"
        }}
        
        - "read": Consultas, análisis, reportes, ver datos, buscar.
        - "write": Registrar, crear, actualizar, borrar, modificar, cambiar, eliminar.
        - "mixed": Si pide ambas, prioriza dividir o marca como "mixed" (el manager ejecutará secuencialmente si se implementa, por ahora asume write si hay cualquier cambio).
        
        Si hay duda, asume "read".
        """
        
        try:
            route_resp = (self.llm | self.parser).invoke([HumanMessage(content=classification_prompt)])
            action_type = route_resp.get('type', 'read').lower()
            print(f" [SQLManager] Routing to: {action_type.upper()} ({route_resp.get('reason')})")
            
            # 2. Delegation
            if action_type == 'write' or action_type == 'mixed':
                # Delegate to Writer (who can also read if needed for context within its scope)
                return self.writer.execute_change(user_query)
            else:
                # Default to Reader
                return self.reader.execute_analysis(user_query)
                
        except Exception as e:
            print(f" [SQLManager] ⚠️ Routing Failed: {e}. Falling back to Reader.")
            return self.reader.execute_analysis(user_query)
