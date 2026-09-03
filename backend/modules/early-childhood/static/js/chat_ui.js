// Chat UI Module for Multi-Agent System
// Provides chat interface for all roles

class ChatManager {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
    }

    init() {
        this.createChatWidget();
        this.loadHistory();
        this.checkStatus();
    }

    createChatWidget() {
        // Create floating chat button
        const chatButton = document.createElement('div');
        chatButton.id = 'chat-fab';
        chatButton.className = 'chat-fab';
        chatButton.innerHTML = `
            <button onclick="chatManager.toggleChat()" class="chat-fab-button">
                <span class="chat-icon">💬</span>
                <span class="chat-label">Asistente IA</span>
            </button>
        `;
        document.body.appendChild(chatButton);

        // Create chat container
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chat-container';
        chatContainer.className = 'chat-container';
        chatContainer.style.display = 'none';
        chatContainer.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <span class="chat-avatar">🤖</span>
                    <div>
                        <h4>Asistente KindiCore</h4>
                        <span id="chat-status" class="chat-status">Conectando...</span>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button onclick="chatManager.clearChat()" title="Limpiar"><span>🗑️</span></button>
                    <button onclick="chatManager.toggleChat()" title="Cerrar"><span>✕</span></button>
                </div>
            </div>
            
            <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                    <h4>👋 ¡Hola!</h4>
                    <p>Soy tu asistente virtual para el Centro de Desarrollo Infantil.</p>
                    <p>Puedo ayudarte con:</p>
                    <ul>
                        <li>📝 Registrar asistencia</li>
                        <li>🍽️ Registrar nutrición</li>
                        <li>🏥 Registrar información de salud</li>
                        <li>📊 Consultar datos de niños</li>
                        <li>📋 Generar resúmenes</li>
                    </ul>
                </div>
            </div>
            
            <div class="chat-input-container">
                <input type="text" id="chat-input" placeholder="Escribe tu mensaje..." 
                       onkeypress="if(event.key==='Enter') chatManager.sendMessage()">
                <button onclick="chatManager.sendMessage()" id="chat-send-btn">
                    <span>📤</span>
                </button>
            </div>
            
            <div class="chat-tools-info" id="chat-tools-info" style="display: none;">
                <small>Herramientas activas: <span id="tools-count">0</span></small>
            </div>
        `;
        document.body.appendChild(chatContainer);

        // Add styles
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .chat-fab {
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 9999;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                border-radius: 30px;
                box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1100;
            }
            
            .chat-fab-button {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%);
                color: white;
                border: none;
                padding: 1rem 1.5rem;
                border-radius: 50px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                box-shadow: 0 4px 20px rgba(88, 101, 242, 0.4);
                transition: all 0.3s ease;
            }
            
            .chat-fab-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(88, 101, 242, 0.5);
            }
            
            .chat-container {
                position: fixed;
                bottom: 150px;
                right: 20px;
                width: 400px;
                height: 600px;
                background: #1a1b26;
                border-radius: 20px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 1200;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .chat-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%);
                color: white;
            }
            
            .chat-header-info {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .chat-avatar {
                font-size: 2rem;
            }
            
            .chat-header h4 {
                margin: 0;
                font-size: 1rem;
            }
            
            .chat-status {
                font-size: 0.75rem;
                opacity: 0.9;
            }
            
            .chat-header-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .chat-header-actions button {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .chat-header-actions button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 1rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .chat-welcome {
                text-align: center;
                padding: 1rem;
                background: #24253a;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .chat-welcome h4 {
                margin: 0 0 0.5rem 0;
            }
            
            .chat-welcome ul {
                text-align: left;
                margin: 0.5rem 0 0 0;
                padding-left: 1.5rem;
            }
            
            .chat-welcome li {
                margin: 0.25rem 0;
            }
            
            .chat-message {
                max-width: 85%;
                padding: 0.75rem 1rem;
                border-radius: 12px;
                word-wrap: break-word;
            }
            
            .chat-message.user {
                align-self: flex-end;
                background: var(--primary);
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .chat-message.assistant {
                align-self: flex-start;
                background: #2f3148;
                color: #e0e0e0;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-bottom-left-radius: 4px;
            }
            
            .chat-message.typing {
                background: #2f3148;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .typing-indicator {
                display: flex;
                gap: 4px;
            }
            
            .typing-indicator span {
                width: 8px;
                height: 8px;
                background: #a0a0b0;
                border-radius: 50%;
                animation: typing 1s infinite;
            }
            
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
            }
            
            .chat-input-container {
                display: flex;
                padding: 1rem;
                gap: 0.5rem;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                background: #1f202e;
            }
            
            .chat-input-container input {
                flex: 1;
                padding: 0.75rem 1rem;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: #13141c;
                color: white;
                border-radius: 24px;
                font-size: 0.95rem;
                outline: none;
                transition: border-color 0.2s;
            }
            
            .chat-input-container input:focus {
                border-color: var(--primary);
            }
            
            .chat-input-container button {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: var(--primary);
                color: white;
                border: none;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .chat-input-container button:hover {
                transform: scale(1.05);
            }
            
            .chat-input-container button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .chat-tools-info {
                padding: 0.5rem 1rem;
                text-align: center;
                background: #181926;
                color: #8a8b9e;
                font-size: 0.75rem;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            @media (max-width: 480px) {
                .chat-container {
                    bottom: 0;
                    right: 0;
                    width: 100vw;
                    height: calc(100vh - 60px);
                    border-radius: 0;
                }
                
                .chat-fab {
                    bottom: 10px;
                    right: 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    toggleChat() {
        const container = document.getElementById('chat-container');
        const fab = document.getElementById('chat-fab');

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            container.style.display = 'flex';
            fab.querySelector('.chat-label').textContent = 'Cerrar';
            document.getElementById('chat-input').focus();
        } else {
            container.style.display = 'none';
            fab.querySelector('.chat-label').textContent = 'Asistente IA';
        }
    }

    async checkStatus() {
        try {
            const response = await API.get('/chat/status');
            const statusEl = document.getElementById('chat-status');

            if (response.status === 'active') {
                statusEl.textContent = `✓ Activo (${response.model})`;
                statusEl.style.color = '#4ade80';
            } else {
                statusEl.textContent = '⚠ Desconectado';
                statusEl.style.color = '#fbbf24';
            }

            // Load tools info
            this.loadTools();

        } catch (error) {
            document.getElementById('chat-status').textContent = '⚠ Error de conexión';
        }
    }

    async loadTools() {
        try {
            const response = await API.get('/chat/tools');
            document.getElementById('tools-count').textContent = response.count;
            document.getElementById('chat-tools-info').style.display = 'block';
        } catch (error) {
            console.error('Error loading tools:', error);
        }
    }

    async loadHistory() {
        try {
            const response = await API.get('/chat/history');
            const history = response.history || [];

            if (history.length > 0) {
                const messagesContainer = document.getElementById('chat-messages');
                // Clear welcome message if there's history
                messagesContainer.innerHTML = '';

                // Add messages in reverse order (oldest first)
                history.reverse().forEach(msg => {
                    this.addMessage(msg.message_text, 'user', false);
                    this.addMessage(msg.agent_response, 'assistant', false);
                });
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    addMessage(text, sender, scroll = true) {
        const messagesContainer = document.getElementById('chat-messages');
        const welcome = messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${sender}`;
        messageEl.textContent = text;

        messagesContainer.appendChild(messageEl);

        if (scroll) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    showTyping() {
        const messagesContainer = document.getElementById('chat-messages');

        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message assistant typing';
        typingEl.id = 'typing-indicator';
        typingEl.innerHTML = `
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;

        messagesContainer.appendChild(typingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
        const typingEl = document.getElementById('typing-indicator');
        if (typingEl) typingEl.remove();
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        this.isLoading = true;
        sendBtn.disabled = true;
        input.value = '';

        // Add user message
        this.addMessage(message, 'user');

        // Show typing indicator
        this.showTyping();

        try {
            const response = await API.post('/chat/message', {
                message: message,
                channel: 'web_chat'
            });

            this.hideTyping();

            if (response.success) {
                this.addMessage(response.response, 'assistant');
            } else {
                this.addMessage('Lo siento, ocurrió un error. Intenta de nuevo.', 'assistant');
            }

        } catch (error) {
            this.hideTyping();
            this.addMessage('Error de conexión. Verifica tu conexión e intenta de nuevo.', 'assistant');
        }

        this.isLoading = false;
        sendBtn.disabled = false;
        input.focus();
    }

    clearChat() {
        if (confirm('¿Limpiar la conversación?')) {
            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.innerHTML = `
                <div class="chat-welcome">
                    <h4>👋 ¡Hola!</h4>
                    <p>Soy tu asistente virtual para el Centro de Desarrollo Infantil.</p>
                    <p>Puedo ayudarte con:</p>
                    <ul>
                        <li>📝 Registrar asistencia</li>
                        <li>🍽️ Registrar nutrición</li>
                        <li>🏥 Registrar información de salud</li>
                        <li>📊 Consultar datos de niños</li>
                        <li>📋 Generar resúmenes</li>
                    </ul>
                </div>
            `;
        }
    }
}

// Global instance
const chatManager = new ChatManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Only init if API is available (user is logged in)
    if (typeof API !== 'undefined') {
        chatManager.init();
    }
});
