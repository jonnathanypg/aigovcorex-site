"""
SQL Writer Specialist
Part of the SQL Team. Handles data modification (Insert, Update, Delete).
Strictly controlled by RBAC.
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from services.context_service import ContextService
from services.sql_executor import SQLExecutor
from config import get_config

class SQLWriter:
    """
    Specialist agent for modifying data.
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
        
    def execute_change(self, query_text: str) -> dict:
        """
        Generates and executes SQL for data modification.
        """
        # 1. Permission Check (Fail fast)
        data_scope = ContextService.get_data_scope(self.user)
        user_actions = data_scope.get('allowed_actions', [])
        
        # Check if user has ANY write permission
        if not any(act in user_actions for act in ['insert', 'update', 'delete']):
             return {
                "success": False,
                "text": "⛔ Acceso Denegado: Tu rol no tiene permisos para modificar datos.",
                "data": None
            }
            
        # 2. Context & Scope
        # Build specific writer prompt
        # We reuse the base context but inject WRITER instructions
        base_prompt = ContextService.build_agent_context(self.user, intent="sql_analysis")
        
        # Extract the exact SQL filter rule
        filter_rule = data_scope.get('filter_sql', '1=0')
        
        writer_instructions = f"""
        \n### ROL: ESPECIALISTA EN ESCRITURA (SQL WRITER)
        Tu tarea es generar sentencias `INSERT`, `UPDATE` o `DELETE` seguras.
        
        REGLAS DE ORO:
        1. VALIDACIÓN DE INTEGRIDAD: Asegura que los IDs existan (ej: no insertes attendance para child_id inexistente).
        2. MANDATORY FILTER (SCOPE): TODA cláusula WHERE debe cumplir con la siguiente restricción de acceso: {filter_rule}
        3. No asumas parámetros binding como `:tenant_id` a menos que estés seguro de la sintaxis y tengas un solo tenant id explícito. Utiliza los valores directamente o el filtro inyectado.
        
        ACCIONES PERMITIDAS PARA ESTE USUARIO: {", ".join(user_actions).upper()}
        """
        
        system_prompt = base_prompt + writer_instructions
        
        print(f"\n{'='*40}\n [SQLWriter] ✏️ MODIFICANDO DATOS\n{'='*40}")
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query_text)
        ]
        
        try:
            # 3. LLM Generation
            chain = self.llm | self.parser
            agent_output = chain.invoke(messages)
            
            sql_query = agent_output.get('sql')
            intent = agent_output.get('intent')
            reasoning = agent_output.get('reasoning')
            
            print(f" [SQLWriter] 🧠 Intent: {intent}")
            print(f" [SQLWriter] 📝 Generated SQL: {sql_query}")
            
            if not sql_query:
                return {
                    "success": False,
                    "text": f"No pude generar la sentencia de modificación. {reasoning}",
                    "data": None
                }
            
            # 4. Execution
            # Pass the user's full permissions so Executor allows the write
            result = SQLExecutor.execute_query(sql_query, data_scope)
            
            if result['success']:
                print(f" [SQLWriter] ✅ Success! {result['data']}")
                return {
                    "success": True,
                    "text": f"Operación realizada exitosamente: {intent}",
                    "data": result['data'],
                    "sql": sql_query
                }
            else:
                print(f" [SQLWriter] ❌ DB Error: {result.get('error')}")
                return {
                    "success": False,
                    "text": f"Error al modificar datos: {result.get('error')}",
                    "data": None
                }
                
        except Exception as e:
            print(f" [SQLWriter] 💥 Critical Error: {str(e)}")
            return {
                "success": False,
                "text": f"Error interno en el escritor SQL: {str(e)}",
                "data": None
            }
