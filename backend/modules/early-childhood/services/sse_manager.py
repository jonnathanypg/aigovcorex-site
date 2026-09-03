"""
SSE Manager - Server-Sent Events for Progressive Responses
Manages streaming connections and engagement messages during long-running tasks
"""
import json
import time
import threading
from typing import Generator, Callable, Optional
from queue import Queue, Empty
import random

class SSEManager:
    """
    Manages Server-Sent Events for real-time communication with frontend.
    Provides engagement messages while background tasks execute.
    """
    
    # Engagement tips to show during long operations
    ENGAGEMENT_TIPS = [
        "💡 ¿Sabías que puedes preguntar por un niño específico usando su nombre?",
        "📊 Los análisis detallados incluyen métricas de salud, nutrición y crecimiento.",
        "🎯 Puedes pedir información de fechas específicas: 'datos de enero 2026'",
        "📋 Intenta preguntar: '¿Cuántos niños tienen vacunas al día?'",
        "🔍 Para búsquedas rápidas, menciona el nombre del niño directamente.",
        "📈 Puedo comparar datos entre diferentes periodos si me lo pides.",
        "✨ Consulta 'resumen semanal' para ver un dashboard rápido.",
    ]
    
    # Progress messages for different stages
    PROGRESS_STAGES = {
        'routing': "🔄 Analizando tu consulta...",
        'sql_generation': "📝 Preparando la consulta a la base de datos...",
        'sql_execution': "⚡ Ejecutando consulta en la base de datos...",
        'data_processing': "🔢 Procesando los datos obtenidos...",
        'humanizing': "✍️ Generando respuesta humanizada...",
        'almost_ready': "🎉 ¡Ya casi! Finalizando el análisis...",
    }
    
    @staticmethod
    def format_sse(data: dict, event: str = None) -> str:
        """Format data as SSE message"""
        msg = ""
        if event:
            msg += f"event: {event}\n"
        msg += f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
        return msg
    
    @staticmethod
    def create_thinking_event() -> str:
        """Create initial thinking event"""
        return SSEManager.format_sse({
            "type": "thinking",
            "message": "🤔 Procesando tu solicitud..."
        }, "thinking")
    
    @staticmethod
    def create_progress_event(stage: str, custom_message: str = None) -> str:
        """Create progress update event"""
        message = custom_message or SSEManager.PROGRESS_STAGES.get(stage, "Procesando...")
        return SSEManager.format_sse({
            "type": "progress",
            "stage": stage,
            "message": message
        }, "progress")
    
    @staticmethod
    def create_tip_event() -> str:
        """Create engagement tip event"""
        tip = random.choice(SSEManager.ENGAGEMENT_TIPS)
        return SSEManager.format_sse({
            "type": "tip",
            "message": tip
        }, "tip")
    
    @staticmethod
    def create_almost_ready_event() -> str:
        """Create almost ready notification"""
        return SSEManager.format_sse({
            "type": "almost_ready",
            "message": "🎉 ¡Ya casi tenemos listo el análisis!"
        }, "almost_ready")
    
    @staticmethod
    def create_result_event(response: str, metadata: dict = None) -> str:
        """Create final result event"""
        data = {
            "type": "result",
            "response": response,
            "success": True
        }
        if metadata:
            data.update(metadata)
        return SSEManager.format_sse(data, "result")
    
    @staticmethod
    def create_error_event(error_message: str) -> str:
        """Create error event"""
        return SSEManager.format_sse({
            "type": "error",
            "message": error_message,
            "success": False
        }, "error")


class StreamingOrchestrator:
    """
    Wraps the orchestrator to provide streaming progress updates.
    Runs the actual processing in a background thread while
    yielding progress events to the client.
    """
    
    def __init__(self, orchestrator, flask_app=None):
        self.orchestrator = orchestrator
        self.flask_app = flask_app  # Flask app for context in background thread
        self.result_queue = Queue()
        self.progress_queue = Queue()
        self.is_complete = False
        self.error = None
        
    def _run_processing(self, message: str, channel: str):
        """Run the actual processing in background thread"""
        try:
            # CRITICAL: Push Flask app context for background thread
            # Without this, SQLAlchemy queries fail with "Working outside of application context"
            if self.flask_app:
                with self.flask_app.app_context():
                    self._do_processing(message, channel)
            else:
                self._do_processing(message, channel)
        except Exception as e:
            self.error = str(e)
            import traceback
            traceback.print_exc()
        finally:
            self.is_complete = True
    
    def _do_processing(self, message: str, channel: str):
        """Actual processing logic (runs inside app context)"""
        # Emit progress at key points
        self.progress_queue.put(('routing', None))
        
        # Process the message
        result = self.orchestrator.process_message(message, channel)
        
        self.progress_queue.put(('almost_ready', None))
        time.sleep(0.5)  # Brief pause for UX
        
        self.result_queue.put(result)
    
    def stream_response(self, message: str, channel: str) -> Generator[str, None, None]:
        """
        Generator that yields SSE events while processing runs in background.
        """
        # Start background processing
        thread = threading.Thread(target=self._run_processing, args=(message, channel))
        thread.start()
        
        # Emit initial thinking event
        yield SSEManager.create_thinking_event()
        
        tip_interval = 8  # Show a tip every 8 seconds
        last_tip_time = time.time()
        start_time = time.time()
        sent_tips = 0
        max_tips = 3  # Don't overwhelm with tips
        
        while not self.is_complete or not self.progress_queue.empty():
            # Check for progress updates
            try:
                stage, custom_msg = self.progress_queue.get_nowait()
                yield SSEManager.create_progress_event(stage, custom_msg)
            except Empty:
                pass
            
            # Send engagement tips periodically
            current_time = time.time()
            if (current_time - last_tip_time > tip_interval and 
                sent_tips < max_tips and 
                not self.is_complete):
                yield SSEManager.create_tip_event()
                last_tip_time = current_time
                sent_tips += 1
            
            # Small sleep to prevent busy waiting
            if not self.is_complete:
                time.sleep(0.5)
        
        # Wait for thread to complete
        thread.join(timeout=5)
        
        # Check for errors
        if self.error:
            yield SSEManager.create_error_event(self.error)
            return
        
        # Get the result
        try:
            result = self.result_queue.get_nowait()
            yield SSEManager.create_result_event(
                response=result.get('response', ''),
                metadata={
                    'agent_used': result.get('agent_used'),
                    'using_langgraph': result.get('using_langgraph'),
                    'debug_sql': result.get('debug_sql')
                }
            )
        except Empty:
            yield SSEManager.create_error_event("No se pudo obtener el resultado del análisis.")
