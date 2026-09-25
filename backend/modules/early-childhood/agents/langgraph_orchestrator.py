"""
LangGraph Multi-Agent System for CCI Management
Uses state graph to orchestrate specialized agents
"""
from typing import TypedDict, Annotated, Sequence
from concurrent.futures import ThreadPoolExecutor
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
# Lazy import for Google to avoid crashes in Py3.14 if not used
# from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from agents.langchain_tools import get_all_tools
from config import get_config
import operator
from langchain_core.messages import ToolMessage
from models.user import User

try:
    from langfuse import observe
except ImportError:  # observabilidad opcional: sin SDK no se traza pero nada se rompe
    def observe(_fn=None, **kwargs):
        def wrap(fn):
            return fn
        return wrap(_fn) if callable(_fn) else wrap

# State definition
class AgentState(TypedDict):
    """State of the agent system"""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    tenant_id: int
    user_id: int
    license_id: int
    
class LangGraphOrchestrator:
    """
    LangGraph-based orchestrator for multi-agent system
    Uses state graph to manage conversation flow
    """
    
    class Colors:
        HEADER = '\033[95m'
        BLUE = '\033[94m'
        CYAN = '\033[96m'
        GREEN = '\033[92m'
        WARNING = '\033[93m'
        FAIL = '\033[91m'
        ENDC = '\033[0m'
        BOLD = '\033[1m'
    
    def __init__(self, tenant_id: int, user_id: int, license_id: int = None, 
                 role: str = None, license_name: str = None, 
                 legal_name: str = None, ruc: str = None, 
                 centers_list: list = None):
        import logging
        # Setup Logger
        self.logger = logging.getLogger(f"Orchestrator-{tenant_id}")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

        self.tenant_id = tenant_id
        self.user_id = user_id
        self.license_id = license_id
        self.role = role
        self.license_name_info = license_name
        self.legal_name = legal_name
        self.ruc = ruc
        self.centers_list = centers_list or []
        self.config = get_config()
        
        # Load center name
        self.center_name = self._load_center_name()
        
        # Load agent personality from license if available
        self._load_agent_personality()
        self.logger.info(f"🎭 Agent Identity Loaded: {self.agent_name} | Role: {self.role} | Context: {self.center_name}")
        
        # Initialize LLM
        self.llm = self._init_llm()
        
        # Get tools
        self.tools = get_all_tools()
        
        # Bind tools to LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Build graph
        self.graph = self._build_graph()
    
    def _load_center_name(self) -> str:
        """Load the center name from the tenant"""
        if not self.tenant_id:
            # License Admins have no tenant_id (global scope)
            return "Administración de Licencia (Global)"
        try:
            from models.tenant import Tenant
            from models import db
            db.session.remove()  # Force fresh connection from pool
            tenant = Tenant.query.get(self.tenant_id)
            if tenant and tenant.name:
                return tenant.name
        except Exception as e:
            self.logger.error(f"Could not load center name: {e}")
        return f"Centro {self.tenant_id}"
    
    def _load_agent_personality(self):
        """Load custom agent personality from license if available"""
        self.agent_name = "KindiCore AI" # Default
        self.agent_prompt = "Eres un asistente útil y eficiente." # Default fallback
        
        if not self.license_id:
            return None
            
        try:
            from models.license import License
            from models import db
            # Ensure fresh session
            db.session.rollback()
            
            license_record = License.query.get(self.license_id)
            if license_record:
                if license_record.agent_name:
                    self.agent_name = license_record.agent_name
                if license_record.agent_personality:
                    self.agent_prompt = license_record.agent_personality
                    
            return self.agent_prompt

        except Exception as e:
            print(f"[Orchestrator] Could not load agent personality: {e}")
            return None

    def _init_llm(self):
        """Initialize LLM based on available API keys"""
        if self.config.OPENAI_API_KEY:
            return ChatOpenAI(
                model_name=self.config.OPENAI_MODEL,
                temperature=0.7,
                api_key=self.config.OPENAI_API_KEY
            )
        elif self.config.GOOGLE_API_KEY:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=self.config.GEMINI_MODEL,
                    temperature=0.7,
                    google_api_key=self.config.GOOGLE_API_KEY
                )
            except ImportError:
                raise ValueError("Google GenAI libraries not compatible with this environment (Py3.14). Use OpenAI.")
        else:
            raise ValueError("No API key configured for LLM (OpenAI or Google)")
    
    def _build_graph(self):
        """Build the state graph for agent orchestration"""
        workflow = StateGraph(AgentState)
        
        # Use sequential executor (max_workers=1) to prevent DB connection corruption
        # Flask-SQLAlchemy's session is not thread-safe across parallel tool execution
        sequential_executor = ThreadPoolExecutor(max_workers=1)
        tool_node = ToolNode(self.tools, handle_tool_errors=True)
        # Override the default executor
        tool_node.executor = sequential_executor

        # Add nodes
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", tool_node)
        
        # Add edges
        workflow.set_entry_point("agent")
        
        workflow.add_conditional_edges(
            "agent",
            self._should_use_tools,
        )
        
        workflow.add_edge("tools", "agent")
        
        return workflow.compile()
        
    def _agent_node(self, state: AgentState) -> AgentState:
        """Agent node that calls the LLM"""
        messages = state["messages"]
        self.logger.info(f"🤔 Thinking with {len(messages)} messages context...")
        
        response = self.llm_with_tools.invoke(messages)
        self.logger.info(f"💡 Agent Response: {response.content[:200]}...")
        
        # Inject tenant_id and user_id into tool calls AFTER LLM responds
        if hasattr(response, 'tool_calls') and response.tool_calls:
            for tool_call in response.tool_calls:
                tool_call['args']['tenant_id'] = state['tenant_id']
                tool_call['args']['user_id'] = state['user_id']
                if state.get('license_id'):
                    tool_call['args']['license_id'] = state['license_id']
                self.logger.info(f"🛠️  Tool Call Prepared: {tool_call['name']} with tenant_id={state['tenant_id']}, user_id={state['user_id']}")
        
        return {
            "messages": [response]
        }

    def _should_use_tools(self, state: AgentState) -> str:
        """Determine if tools should be used"""
        messages = state["messages"]
        last_message = messages[-1]

        if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
            return END
        
        return "tools"

    @observe()
    def process_message(self, message: str, channel: str = 'web_chat', sender_identifier: str = None) -> dict:
        """
        Process user message through the graph or via specialized sub-agents
        """
        try:
            self.logger.info("================================================================")
            self.logger.info(f"🗣️  USER MESSAGE: {message}")
            self.logger.info("================================================================")

            # Determine Sender Identifier for History Persistence
            # If not provided, fallback to user_id (Backwards compatibility for Web Chat)
            self.sender_identifier = sender_identifier if sender_identifier else str(self.user_id)
            self.logger.info(f"🆔 Conversation Identity: {self.sender_identifier} (Channel: {channel})")

            # Fast path for theme changes and quick navigation to minimize LLM usage and response time
            msg_lower = message.lower().strip()
            # Theme Claro
            if any(kw in msg_lower for kw in ['modo claro', 'tema claro', 'light mode', 'version clara', 'versión clara', 'cambiar a claro', 'cambia a claro', 'cambiar al claro', 'cambia al claro', 'poner claro', 'pon claro', 'tema a la version clara', 'tema a la versión clara']):
                response_text = "¡Por supuesto! He cambiado el tema de la plataforma al modo claro. ☀️"
                self._save_conversation(message, response_text, channel)
                return {
                    'response': response_text,
                    'success': True,
                    'agent_used': self.agent_name,
                }
            # Theme Oscuro
            if any(kw in msg_lower for kw in ['modo oscuro', 'tema oscuro', 'dark mode', 'version oscura', 'versión oscura', 'cambiar a oscuro', 'cambia a oscuro', 'cambiar al oscuro', 'cambia al oscuro', 'poner oscuro', 'pon oscuro']):
                response_text = "¡Por supuesto! He cambiado el tema de la plataforma al modo oscuro. 🌙"
                self._save_conversation(message, response_text, channel)
                return {
                    'response': response_text,
                    'success': True,
                    'agent_used': self.agent_name,
                }

            # Fallback to standard graph for general conversation
            # Initialize state with System Message
            
            # Use dynamic agent identity
            self.logger.info(f"🧠 Routing to Standard LangGraph (Role: {self.role})")
            
            # Construct organizational context string
            org_context = ""
            if self.role == 'license_admin':
                 org_context = f"""
- Estás hablando con un ADMINISTRADOR DE LICENCIA.
- Institución/Licencia: {self.license_name_info}
- Razón Social: {self.legal_name}
- RUC: {self.ruc}
- Centros bajo su mando: {', '.join(self.centers_list)}
- EL USUARIO TIENE ACCESO GLOBAL. No lo limites a un solo centro."""
            else:
                 role_display = self.role.upper() if self.role else "USUARIO"
                 org_context = f"""
- Estás hablando con un {role_display}.
- Centro asignado: {self.center_name}
- El acceso está restringido únicamente a datos de este centro."""

            system_prompt = f"""Eres {self.agent_name}, un asistente inteligente para Centros de Cuidado Infantil.
            
PERSONALIDAD / INSTRUCCIONES DE COMPORTAMIENTO:
{self.agent_prompt}

CONTEXTO ORGANIZACIONAL Y DE SEGURIDAD:{org_context}

DATOS DEL USUARIO:
- Usuario ID: {self.user_id}
- Rol: {self.role}

INSTRUCCIONES CRÍTICAS DE MEMORIA Y HERRAMIENTAS:
1. TIENES ACCESO A LA BASE DE DATOS via la herramienta 'run_sql_analysis'.
2. TIENES ACCESO A LA BASE DE CONOCIMIENTO via la herramienta 'consult_knowledge_base'.
   - Úsala cuando el usuario pregunte sobre políticas, protocolos, regulaciones, normativas MIES, o cualquier documento institucional.
   - La herramienta busca automáticamente en los documentos relevantes según el rol del usuario.
3. ANTES de usar una herramienta, REVISA LA HISTORIA DE LA CONVERSACIÓN.
   - Si el usuario pide un resumen o análisis de datos que YA TE MOSTRÓ una herramienta anterior, NO VUELVAS A EJECUTAR LA HERRAMIENTA.
   - Usa los datos existentes en el historial para responder.
4. Cuando menciones el centro o la institución, usa sus nombres reales, no IDs.
5. SALUDO: Solo saluda al usuario EN EL PRIMER MENSAJE de la conversación (cuando no hay historial previo). Si ya hay mensajes anteriores en el historial, NO vuelvas a saludar, continúa la conversación de forma natural. Si saludas, hazlo de forma institucional: "Bienvenido a {self.license_name_info}" (administrador) o el nombre del centro (coordinador).

**REGLA #1 - LENGUAJE HUMANO (CERO VARIABLES TÉCNICAS):**
- PROHIBIDO usar nombres de variables internas o de base de datos (ej: `tenant_id`, `child_id`, `snake_case`).
- Usa siempre nombres amigables para el usuario. Ejemplo: "el resumen del niño" en lugar de "child_summary".

**REGLA #2 - SÉ PROACTIVO:**
- Cuando el usuario diga "hazlo", "procede", etc., EJECUTA LA HERRAMIENTA INMEDIATAMENTE sin preguntar de nuevo.

**REGLA #3 - HONESTIDAD TÉCNICA:**
- Si no hay datos, di simplemente que no existen registros para ese periodo. No inventes excusas técnicas.
"""

            # Load conversation history
            history_messages = self._load_conversation_history(limit=6)
            
            # Combine: System + History + Current User Message
            final_messages = [SystemMessage(content=system_prompt)] + history_messages + [HumanMessage(content=message)]

            initial_state = {
                "messages": final_messages,
                "tenant_id": self.tenant_id,
                "user_id": self.user_id,
                "license_id": self.license_id,
            }
            
            # Run the graph with a safety circuit breaker
            try:
                final_state = self.graph.invoke(
                    initial_state,
                    config={"recursion_limit": 15}
                )
            except Exception as recursion_err:
                err_msg = str(recursion_err).lower()
                if "recursion" in err_msg or "limit" in err_msg:
                    self.logger.warning(f"⚠️ Circuit Breaker: Agent exceeded max iterations. {recursion_err}")
                    fallback = (
                         "Disculpa, no pude completar tu solicitud porque las herramientas "
                         "no respondieron correctamente después de varios intentos. "
                         "Esto puede ocurrir si no hay datos suficientes o hay un problema de conexión. "
                         "¿Podrías reformular tu pregunta o intentarlo de nuevo?"
                    )
                    self._save_conversation(message, fallback, channel)
                    return {
                        'response': fallback,
                        'success': False,
                        'agent_used': self.agent_name,
                        'error': 'recursion_limit_reached'
                    }
                else:
                    raise

            final_response = final_state['messages'][-1].content
            self.logger.info(f"✅ Final Response Generated:\n{final_response}")

            # Save conversation to database
            self._save_conversation(message, final_response, channel)
            
            return {
                'response': final_response,
                'success': True,
                'agent_used': self.agent_name,
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.logger.error(f"❌ Error in process_message: {e}")
            return {
                'response': f'Lo siento, ocurrió un error: {str(e)}',
                'success': False,
                'agent_used': getattr(self, 'agent_name', 'KindiCore AI'),
                'error': str(e)
            }

    def _load_conversation_history(self, limit: int = 6) -> list:
        """Load recent conversation history from database"""
        try:
            from models import db
            from sqlalchemy import text
            
            # Ensure fresh session
            db.session.rollback()
            
            # Determine Identifier to query
            # If default logic wasn't set yet (backwards compat), set it
            if not hasattr(self, 'sender_identifier'):
                self.sender_identifier = str(self.user_id)
                
            # Use same tenant_id fallback as _save_conversation to ensure LOAD matches SAVE
            db_tenant_id = self.tenant_id or self.license_id or 0
            
            query = text("""
                SELECT message_text, agent_response, created_at 
                FROM conversation_history 
                WHERE sender_identifier = :sender_id AND tenant_id = :tenant_id 
                ORDER BY created_at DESC 
                LIMIT :limit
            """)
            params = {
                'sender_id': self.sender_identifier,
                'tenant_id': db_tenant_id,
                'limit': limit
            }
            
            result = db.session.execute(query, params).fetchall()
            
            history = []
            # Results are newest first, so we reverse them to correct chronological order
            for row in reversed(result):
                if row.message_text:
                    history.append(HumanMessage(content=row.message_text))
                if row.agent_response:
                    history.append(AIMessage(content=row.agent_response))
                    
            return history
            
        except Exception as e:
            self.logger.warning(f"Failed to load history: {e}")
            return []
    
    def _save_conversation(self, message: str, response: str, channel: str):
        """Save conversation to database with robust retry logic for stale connections"""
        max_retries = 3
        fn_name = "LangGraphOrchestrator._save_conversation"
        
        from models import db
        from sqlalchemy import text
        import time
        
        for attempt in range(max_retries):
            try:
                # 1. Proactive check/Ping to ensure connection is alive
                try:
                    db.session.execute(text("SELECT 1"))
                except Exception:
                    # If ping fails, force clear session to get a fresh one
                    db.session.remove()
                
                # Determine user_id to save (NULL for virtual users to avoid FK error)
                db_user_id = self.user_id if self.user_id > 0 else None
                
                # Determine tenant_id: License Admins have None, use license_id as fallback
                db_tenant_id = self.tenant_id or self.license_id or 0
                
                # Use the established sender_identifier
                sender_id = getattr(self, 'sender_identifier', str(self.user_id))
                
                query = text("""
                    INSERT INTO conversation_history 
                    (tenant_id, user_id, channel, sender_identifier, message_text, 
                    agent_response, agent_used, confidence_score, database_action)
                    VALUES 
                    (:tenant_id, :user_id, :channel, :sender, :message, 
                    :response, :agent, :confidence, :action)
                """)
                
                db.session.execute(query, {
                    'tenant_id': db_tenant_id,
                    'user_id': db_user_id,
                    'channel': channel,
                    'sender': sender_id,
                    'message': message,
                    'response': response,
                    'agent': 'langgraph_orchestrator',
                    'confidence': 0.9,
                    'action': '' # No easy way to get tool calls here
                })
                
                db.session.commit()
                return # Success
                
            except Exception as e:
                db.session.rollback()
                error_str = str(e).lower()
                is_conn_err = 'gone away' in error_str or 'broken pipe' in error_str or '2006' in error_str
                
                self.logger.warning(f"⚠️ Error saving conversation (Attempt {attempt+1}/{max_retries}): {e}")
                
                if is_conn_err:
                     self.logger.info("♻️ Connection lost. Refreshing session...")
                     db.session.remove()
                
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                else:
                    self.logger.error(f"❌ Failed to save conversation after {max_retries} attempts.")
