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

import os as _os

def _noop_observe(_fn=None, **kwargs):
    def wrap(fn):
        return fn
    return wrap(_fn) if callable(_fn) else wrap

# Langfuse: solo trazar si está explícitamente habilitado y con host alcanzable.
# El exporter daba Bad Gateway (labmonitor caído) y spameaba logs en prod.
# Para reactivar: LANGFUSE_ENABLED=true + host válido.
if _os.getenv("LANGFUSE_ENABLED", "false").lower() == "true":
    try:
        from langfuse import observe
    except ImportError:  # observabilidad opcional: sin SDK no se traza pero nada se rompe
        observe = _noop_observe
else:
    observe = _noop_observe

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
                 centers_list: list = None, user_full_name: str = None,
                 user_email: str = None, enabled_modules: list = None,
                 programs_list: list = None):
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
        self.user_full_name = user_full_name
        self.user_email = user_email
        # Copiloto multi-módulo: kindicore/social/geo/channels/copilot por licencia.
        # Orgs solo-social (sin kindicore) reciben persona Social AI, no infantil.
        self.enabled_modules = enabled_modules or ['kindicore', 'social', 'geo', 'channels', 'copilot']
        self.programs_list = programs_list or []
        self.config = get_config()

        # Identidad real del usuario (nombre/rol/centro) — evita alucinar "quién soy"
        self._load_user_identity()
        
        # Load center name
        self.center_name = self._load_center_name()
        
        # Load agent personality from license if available
        self._load_agent_personality()
        self.logger.info(f"🎭 Agent Identity Loaded: {self.agent_name} | Role: {self.role} | Context: {self.center_name}")
        
        # Initialize LLM
        self.llm = self._init_llm()
        
        # Get tools (filtradas por rol: public_citizen/padre sin escritura)
        self.tools = self._filter_tools_by_role(get_all_tools())

        # Límite determinista de reintentos de tools (además del recursion_limit=15 del grafo)
        self.max_tool_retries = 2
        
        # Bind tools to LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Build graph
        self.graph = self._build_graph()
    
    def _load_user_identity(self):
        """Carga nombre/email reales del usuario para responder '¿quién soy?' sin alucinar."""
        if self.user_full_name:
            return
        try:
            if self.user_id and int(self.user_id) > 0:
                from models.user import User
                from models import db
                try:
                    db.session.rollback()
                except Exception:
                    pass
                u = User.query.get(int(self.user_id))
                if u:
                    self.user_full_name = u.full_name
                    self.user_email = u.email
                    if not self.role and getattr(u, 'role', None):
                        self.role = u.role.name
        except Exception as e:
            self.logger.warning(f"No se pudo cargar identidad del usuario {self.user_id}: {e}")

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
        """Initialize LLM BYOT por licencia con fallback global."""
        try:
            from services.llm_gateway import resolve_credentials
            creds = resolve_credentials(self.license_id)
            provider = (creds.get("provider") or "openai").lower()
            model = creds.get("model")
            api_key = creds.get("api_key")
            base_url = creds.get("base_url")
            if provider in ("openai", "grok", "nvidia", "openrouter", "groq"):
                kwargs = {"model_name": model or self.config.OPENAI_MODEL, "temperature": 0.7, "api_key": api_key}
                if base_url:
                    kwargs["base_url"] = base_url
                return ChatOpenAI(**kwargs)
            if provider in ("google", "gemini"):
                try:
                    from langchain_google_genai import ChatGoogleGenerativeAI
                    return ChatGoogleGenerativeAI(model=model or self.config.GEMINI_MODEL, temperature=0.7, google_api_key=api_key)
                except ImportError:
                    raise ValueError("Google GenAI no compatible en este entorno. Use OpenAI/BYOT.")
            if provider == "anthropic":
                try:
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model=model or "claude-3-5-sonnet-latest", temperature=0.7, api_key=api_key)
                except ImportError:
                    raise ValueError("Falta langchain-anthropic. Instale o use proveedor OpenAI-compatible.")
            raise ValueError(f"Proveedor no soportado: {provider}")
        except ValueError:
            raise
        except Exception:
            pass
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
        
    def _filter_tools_by_role(self, tools: list) -> list:
        """Filtra herramientas de escritura según el rol (anti-bucle WhatsApp).

        public_citizen/padre (alias parent): sin SendWhatsApp/SendEmail ni
        Manage* de escritura. Conserva lectura (consultas, reportes, contactos,
        identidad, ausencias, capacidades).
        """
        role = (self.role or '').lower()
        if role not in ('public_citizen', 'padre', 'parent'):
            return tools
        blocked_prefixes = ('send_whatsapp', 'send_email', 'send_parent_message', 'manage_', 'record_', 'log_')
        # Lectura siempre permitida (identidad, ausencias, analytics, knowledge, search, capabilities)
        always_allowed = {
            'get_current_user_profile', 'get_assistant_capabilities',
            'get_absent_children', 'get_attendance_today',
            'search_child', 'get_child_summary', 'get_tenant_analytics',
            'analyze_trends', 'run_sql_analysis', 'consult_knowledge_base',
            'get_parent_contact', 'delegate_child_profile', 'delegate_health_nutrition',
            'delegate_development', 'delegate_knowledge_reports',
        }
        filtered = [
            t for t in tools
            if (t.name or '').lower() in always_allowed
            or not (t.name or '').lower().startswith(blocked_prefixes)
        ]
        removed = len(tools) - len(filtered)
        self.logger.info(f"🔒 Tools filtradas por rol '{self.role}': {len(filtered)} activas ({removed} escritura bloqueadas)")
        return filtered

    @staticmethod
    def _tool_result_failed(content) -> bool:
        """True si un ToolMessage indica success==False o error de ejecución."""
        if isinstance(content, dict):
            return content.get('success') is False
        text = str(content or '')
        return ("'success': False" in text or '"success": false' in text
                or '"success": False' in text or text.strip().startswith('Error:'))

    def _is_repeated_tool_failure(self, messages) -> bool:
        """Guarda determinista: mismo tool + mismos args falló max_tool_retries veces.

        Si las últimas `max_tool_retries` invocaciones son idénticas
        (nombre + args normalizados) y cada una fue seguida de un ToolMessage
        con success==False, devuelve True para cortar el bucle sin re-invocar.
        """
        try:
            status_by_call_id = {}
            for m in messages:
                if isinstance(m, ToolMessage) and getattr(m, 'tool_call_id', None):
                    status_by_call_id[m.tool_call_id] = self._tool_result_failed(m.content)
            invocations = []  # (name, args_key, failed_or_None)
            for m in messages:
                tool_calls = getattr(m, 'tool_calls', None) or []
                for tc in tool_calls:
                    name = tc.get('name', '')
                    try:
                        args_key = str(sorted((tc.get('args') or {}).items()))
                    except Exception:
                        args_key = str(tc.get('args'))
                    failed = status_by_call_id.get(tc.get('id'))
                    invocations.append((name, args_key, failed))
            n = self.max_tool_retries
            if len(invocations) < n:
                return False
            recent = invocations[-n:]
            same_call = all((r[0], r[1]) == (recent[0][0], recent[0][1]) for r in recent)
            all_failed = all(r[2] is True for r in recent)
            return same_call and all_failed
        except Exception:
            return False

    def _agent_node(self, state: AgentState) -> AgentState:
        """Agent node that calls the LLM"""
        messages = state["messages"]
        # Guarda determinista anti-bucle: no re-invocar el mismo tool fallido,
        # responder con pregunta aclaratoria (centro/destinatario/contenido).
        if self._is_repeated_tool_failure(messages):
            self.logger.warning("⛔ Bucle de tools detectado: mismo tool+args falló 2 veces. Cortando sin re-invocar.")
            return {
                "messages": [AIMessage(content=(
                    "No pude completar tu solicitud con los datos disponibles "
                    "después de intentarlo dos veces, así que prefiero no seguir "
                    "intentándolo a ciegas. ¿Me confirmas el dato que falta "
                    "(centro, fecha, nombre del niño o destinatario y contenido exacto)?"
                ))]
            }
        self.logger.info(f"🤔 Thinking with {len(messages)} messages context...")
        
        response = self.llm_with_tools.invoke(messages)
        self.logger.info(f"💡 Agent Response: {response.content[:200]}...")
        
        # Inject tenant_id and user_id into tool calls AFTER LLM responds
        if hasattr(response, 'tool_calls') and response.tool_calls:
            from agents.tools._guard import unwrap_tool_kwargs
            for tool_call in response.tool_calls:
                raw_args = tool_call.get('args') or {}
                if isinstance(raw_args, dict):
                    raw_args = unwrap_tool_kwargs(raw_args)
                tool_call['args'] = raw_args
                tool_call['args']['tenant_id'] = state['tenant_id']
                tool_call['args']['user_id'] = state['user_id']
                if state.get('license_id'):
                    tool_call['args']['license_id'] = state['license_id']
                self.logger.info(
                    f"🛠️  Tool Call Prepared: {tool_call['name']} with keys={list(tool_call['args'].keys())}, "
                    f"tenant_id={state['tenant_id']}, user_id={state['user_id']}"
                )
        
        return {
            "messages": [response]
        }


    def _should_use_tools(self, state: AgentState) -> str:
        """Determine if tools should be used"""
        messages = state["messages"]
        # Red de seguridad: si el LLM igual emite el tool fallido repetido, ir a END.
        if self._is_repeated_tool_failure(messages):
            self.logger.warning("⛔ _should_use_tools: bucle detectado → END sin re-invocar.")
            return END
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

            # LEM-V4 pre: bloquea inyeccion/ataques antes de gastar tokens BYOT del cliente
            try:
                from services.lem_v4_validator import pre_validate as _lem_pre
                _pv = _lem_pre(message, self.license_id, self.role)
                if not _pv.get("ok"):
                    blocked_msg = "Bloqueado por LEM-V4 (seguridad): " + str(_pv.get("reason"))
                    self._save_conversation(message, blocked_msg, channel)
                    return {"response": blocked_msg, "success": False, "agent_used": self.agent_name, "blocked": True, "reason": _pv.get("reason")}
            except Exception as _e:
                self.logger.warning(f"LEM pre fallo (fail-open controlado): {_e}")

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
            institutional_structure = f"""
- Estructura Institucional:
  * Entidad Ejecutora / Organización: {self.legal_name or 'Fundación GASIBA GI'} (Fundación sin fines de lucro encargada de la operación y gestión técnica).
  * Entidades Cooperantes / Municipales: DASE EP (Empresa Pública Municipal de Acción Social y Educación) y la M.I. Municipalidad de Guayaquil.
  * Proyecto / Convenio: {self.license_name_info or 'Proyecto CMCI Guayaquil DASE/GASIBA'} (Convenio interinstitucional para la administración integral de los Centros Municipales de Cuidado Infantil: CMCI Bahía, CMCI Guasmo y CMCI Orquídeas).
  * RUC: {self.ruc or '0993366944001'}"""

            if self.role in ('license_admin', 'administrative', 'admin', 'supervisor'):
                 org_context = f"""
- Estás hablando con un ADMINISTRADOR / DIRECTIVO DE LA ORGANIZACIÓN (Rol: {self.role}).
{institutional_structure}
- Centros bajo su mando: {', '.join(self.centers_list)}
- EL USUARIO TIENE ACCESO GLOBAL. No lo limites a un solo centro."""
            else:
                 role_display = self.role.upper() if self.role else "USUARIO"
                 org_context = f"""
- Estás hablando con un {role_display}.
{institutional_structure}
- Centro asignado: {self.center_name}
- El acceso está restringido únicamente a datos de este centro."""

            # Fecha y hora actual (América/Guayaquil) para "hoy/ayer" y contexto temporal
            try:
                from zoneinfo import ZoneInfo
                from datetime import datetime as _dt
                _now_local = _dt.now(ZoneInfo("America/Guayaquil"))
                today_str = _now_local.strftime("%Y-%m-%d")
                time_str = _now_local.strftime("%H:%M:%S")
            except Exception:
                from datetime import datetime as _dt, date as _date
                today_str = str(_date.today())
                time_str = _dt.now().strftime("%H:%M:%S")

            system_prompt = f"""Eres {self.agent_name}, copiloto transversal de la plataforma AI GovCoreX OS
({self.license_name_info or 'la organización'}). Atiendes CUALQUIER módulo habilitado,
no solo cuidado infantil.
            
PERSONALIDAD / INSTRUCCIONES DE COMPORTAMIENTO:
{self.agent_prompt}

MÓDULOS HABILITADOS DE ESTA ORGANIZACIÓN: {', '.join(self.enabled_modules)}
{'IMPORTANTE: esta organización NO usa el módulo kindicore (primera infancia). Eres Social AI: hablas de programas sociales, beneficiarios, postulaciones y convocatorias. NO menciones centros infantiles ni asistencia de niños salvo que te lo pidan.' if 'kindicore' not in (self.enabled_modules or []) else ''}
PROGRAMAS SOCIALES ACTIVOS: {', '.join([p.get('name', '') for p in self.programs_list]) if self.programs_list else 'ninguno registrado'}

CONTEXTO ORGANIZACIONAL Y DE SEGURIDAD:{org_context}

DATOS DEL USUARIO (REAL, NO INVENTAR):
- Nombre real: {self.user_full_name or 'No disponible'}
- Email: {self.user_email or 'No disponible'}
- Usuario ID: {self.user_id}
- Rol: {self.role}
- Fecha actual (America/Guayaquil): {today_str} — usa 'hoy' = {today_str}.
- Hora oficial actual (America/Guayaquil): {time_str} — cualquier respuesta sobre la hora actual o eventos del día debe considerar esta hora oficial de Ecuador.

INSTRUCCIONES CRÍTICAS DE MEMORIA Y HERRAMIENTAS:
1. IDENTIDAD: si preguntan 'quién soy / mi nombre / mi rol / mi centro', USA la herramienta
   'get_current_user_profile' con tu user_id y responde con su 'hint_respuesta'. NUNCA inventes el nombre.
   Ya sabes que el usuario es {self.user_full_name or 'el usuario autenticado'} ({self.role}).
2. CAPACIDADES: si preguntan 'qué puedes hacer / ayuda', USA 'get_assistant_capabilities' y lista eso.
3. AUSENCIAS/ASISTENCIA HOY: para 'quién faltó / no vino / ausentes / quién vino hoy / resumen asistencia hoy',
   USA PRIMERO 'get_absent_children' o 'get_attendance_today' (date='hoy' salvo que pidan otra fecha).
   Solo si piden un análisis complejo distinto usa 'run_sql_analysis'.
4. NIÑO ESPECÍFICO / FICHA 360: para 'info/todo de [nombre]' USA 'delegate_child_profile'.
   (Alternativa manual: 'search_child' + 'get_child_summary' + 'manage_family/view'.)
5. SALUD/NUTRICIÓN / PESO Y TALLA: para 'peso/talla/crecimiento/salud de [nombre]', USA 'delegate_health_nutrition' pasando 'child_name' (o 'manage_health_vaccines' con action='growth' y child_name). Si consultan peso o talla por WhatsApp, responde amablemente con el último peso y talla registrados, o el dato de nacimiento si no hay controles recientes. NUNCA respondas que no tienes autorización si el usuario es educadora o coordinador.
   Desarrollo IDII: 'delegate_development' o 'manage_milestones' (catalog|record|progress|alerts).
6. CMCI/ADMISIÓN: 'delegate_cmci_admission' o 'manage_cmci' (fichas|priorizacion|ml_explain|monthly_list|compose_monthly) + 'manage_applications' (list|approve|reject|waitlist).
7. PERSONAS/ORG: 'delegate_people_org' o directo 'manage_users' (list|get|create|deactivate) + 'manage_centers' (list|get|create|update|stats|global_stats|territorial) + 'manage_monitoring_staff' (kpis|staff_load|delegate).
8. OPERACIÓN/TERRITORIO: 'delegate_operations_geo' o 'manage_geo_channels' (geo_points|geo_create|templates_list|template_create|broadcast) + 'manage_maintenance_task' + 'manage_planning'.
9. NOTIFS/DOCS/KNOWLEDGE/REPORTES: 'manage_notifications' (list|create|read|delete), 'manage_documents_knowledge' (docs_list|knowledge_list|knowledge_delete), 'consult_knowledge_base', 'generate_report', 'delegate_knowledge_reports'.
10. SOCIAL AI: programas/beneficiarios/postulaciones/convocatorias → 'delegate_social' o 'manage_social_programs' (list_programs|create_program|get_form|configure_form|register_applicant|list_beneficiaries|program_stats). Para "cuántos postulantes/estado del programa" usa 'program_stats' o 'list_beneficiaries'. Docs del programa (bases, requisitos, TDR) → 'consult_knowledge_base' con module='social' y el 'program_id' correspondiente. Puedes listar programas y guiar una postulación paso a paso.
11. BASE DE CONOCIMIENTO: 'consult_knowledge_base' para políticas, protocolos, MIES, documentos.
12. ANTES de usar una herramienta, REVISA LA HISTORIA. Si el dato ya está en el historial, NO re-ejecutes.
13. Cuando menciones centro/institución/programa, usa nombres reales, no IDs.
14. SALUDO: Solo saluda EN EL PRIMER MENSAJE (sin historial). Si saludas: "Bienvenido a {self.license_name_info}" (admin) o nombre del centro (coordinador). Después, NO re-saludes.
15. ENVÍO DE MENSAJES WHATSAPP:
    - Cuando el usuario pida enviar un mensaje por WhatsApp a una persona, colaborador, empleado, directivo, educadora o coordinador por su nombre (ej: "envía un mensaje a Gabriela Orellana", "avisa a Jonnathan Peña"): DEBES USAR OBLIGATORIAMENTE 'send_message_to_staff' pasando 'staff_name'. Si la herramienta devuelve opciones por haber múltiples coincidencias, muéstraselas al usuario para que elija.
    - Para enviar a TODOS los empleados o colaboradores de la organización: USA 'send_message_to_staff' con all_staff=true.
    - Para enviar a todos los empleados de un centro específico (ej: "a los empleados de Guasmo", "a las educadoras de Bahía"): USA 'send_message_to_staff' pasando 'center_name' (y 'role_name' si aplica).
    - Para enviar a TODOS los padres de familia o a los padres de un centro específico (ej: "envía un mensaje a los padres de Guasmo", "a todos los padres"): USA 'send_broadcast_to_parents' con 'center_name' o 'all_centers': true.
    - NUNCA uses 'send_whatsapp_message' cuando se mencione el nombre de una persona o grupos. 'send_whatsapp_message' se usa EXCLUSIVAMENTE cuando el usuario proporciona explícitamente los dígitos numéricos del teléfono en su petición actual (ej: "envía al 0991234567").
    - NUNCA reutilices ni asocies números de teléfono que aparezcan en el historial antiguo de la conversación para enviarle a otra persona diferente.
    - Para mensajes a padres de familia por el nombre del niño: USA 'send_parent_message'.

**REGLA #1 - LENGUAJE HUMANO (CERO VARIABLES TÉCNICAS):**
- PROHIBIDO usar nombres de variables internas o de base de datos (ej: `tenant_id`, `child_id`, `snake_case`).
- Usa siempre nombres amigables para el usuario. Ejemplo: "el resumen del niño" en lugar de "child_summary".

**REGLA #2 - SÉ PROACTIVO CON DATOS COMPLETOS:**
- Cuando el usuario diga "hazlo", "procede", "Opción 1", etc., ejecuta la herramienta correspondiente SI dispones de los datos requeridos (destinatario, teléfono, nombre o datos específicos).
- Si el usuario selecciona una opción (ej: "Opción 1: Enviar mensajes a equipos") pero NO hay destinatario o número específico definido aún, o la herramienta devuelve un error indicando falta de parámetros, NO intentes llamar herramientas a ciegas repetidamente. En su lugar, responde amablemente al usuario pidiéndole la confirmación o el detalle que falta (ej: "¿A qué centro o destinatario deseas enviar el mensaje y cuál es el contenido exacto?").

**REGLA #3 - HONESTIDAD TÉCNICA Y LÍMITE DE REINTENTOS:**
- Si una herramienta falla o no devuelve datos, explica la situación con naturalidad. NUNCA reintentes llamar herramientas repetidamente en bucle con los mismos parámetros erróneos.
- Si no hay datos, di simplemente que no existen registros para ese periodo. No inventes excusas técnicas.

**REGLA #4 - PRECISIÓN SEMÁNTICA EN MÉTRICAS Y DATOS:**
- Al reportar datos de asistencia o tendencias (ej: 'analyze_trends', 'get_tenant_analytics'), NUNCA uses la palabra genérica "registros" sin aclarar a qué corresponde.
- Especifica siempre: "X tomas de asistencia registradas en el mes" o "X evaluaciones individuales de asistencia en clase".
- Distingue con total claridad entre: (a) niños matriculados/activos, (b) tomas de asistencia en el aula, y (c) usuarios o colaboradores del sistema. Jamás confundas el número de asistencias evaluadas con la cantidad de niños inscritos.
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

            # LEM-V4 / LEM-Ops Post-Validate con evaluación nativa C99 en disco
            _lem_info: dict = {}
            try:
                from services.lem_v4_validator import post_validate as _lem_post
                # Determinar si el usuario tiene rol que permite PII sin ofuscar
                is_privileged = self.role in ['admin', 'super_admin', 'license_admin', 'director']
                _pv2 = _lem_post(
                    final_response, 
                    self.license_id, 
                    rag_context="", 
                    has_sql_data=True,
                    allow_pii_role=is_privileged
                )
                _lem_info = {
                    "warnings": _pv2.get("warnings", []), 
                    "balance": _pv2.get("balance"), 
                    "blocked": _pv2.get("blocked", False),
                    "energy": _pv2.get("energy", 0.0)
                }

                # Caso 1: Ataque real o patrón vulnerable detectado -> Bloqueo estricto
                if not _pv2.get("ok"):
                    final_response = _pv2.get("text", final_response)
                    self._save_conversation(message, final_response, channel)
                    return {
                        "response": final_response, 
                        "success": False, 
                        "agent_used": self.agent_name, 
                        "blocked": True, 
                        "reason": _pv2.get("reason"), 
                        "lem": _lem_info
                    }

                # Caso 2: PII enmascarada limpiamente por LEM -> Tomar el texto sanitizado
                if _pv2.get("text"):
                    final_response = _pv2.get("text")

                # Caso 3: Bucle de contingencia ante posible alucinación numérica
                if _pv2.get("needs_contingency"):
                    self.logger.info("🔄 [LEM-Contingency] Activando verificación determinista de respaldo...")
                    try:
                        from models.child import Child
                        from agents.tools.analytics_tools import resolve_tenant_ids
                        t_ids = resolve_tenant_ids(self.tenant_id, self.user_id)
                        if t_ids and ("cuántos" in message.lower() or "total" in message.lower() or "niños" in message.lower()):
                            real_count = Child.query.filter(Child.tenant_id.in_(t_ids), Child.status == 'activo').count()
                            final_response += f"\n\n*(Verificación determinista oficial LEM: {real_count} niños activos registrados en el centro).* "
                    except Exception as _c_err:
                        self.logger.debug(f"[LEM-Contingency] check skipped: {_c_err}")

            except Exception as _e:
                self.logger.warning(f"LEM post fallo: {_e}")

            # Save conversation to database
            self._save_conversation(message, final_response, channel)
            
            return {
                'response': final_response,
                'success': True,
                'agent_used': self.agent_name,
                'lem': _lem_info,
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
                
                # Determine user_id to save (NULL for virtual/anonymous users to avoid FK error)
                try:
                    db_user_id = int(self.user_id) if self.user_id and int(self.user_id) > 0 else None
                except (TypeError, ValueError):
                    db_user_id = None
                
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
