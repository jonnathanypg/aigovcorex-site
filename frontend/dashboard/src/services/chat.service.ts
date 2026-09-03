import api from './api';

// Chat Types
export interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    agentUsed?: string;
    confidence?: number;
    action?: string;
    isLoading?: boolean;
    isStreaming?: boolean;  // New: indicates this is a streaming progress message
    streamType?: 'thinking' | 'progress' | 'tip' | 'almost_ready';  // New: type of streaming message
}

export interface ChatResponse {
    response: string;
    success: boolean;
    agent_used?: string;
    confidence?: number;
    action?: string;
    error?: string;
    using_langgraph?: boolean;
    user_role?: string;
}

// New: SSE Event types
export interface SSEEvent {
    type: 'thinking' | 'progress' | 'tip' | 'almost_ready' | 'result' | 'error';
    message?: string;
    response?: string;
    success?: boolean;
    stage?: string;
    agent_used?: string;
}

export interface ChatTool {
    name: string;
    description: string;
}

export interface ChatStatus {
    status: 'active' | 'error';
    using_langgraph: boolean;
    llm_provider: 'openai' | 'gemini';
    model: string;
    tools_available: boolean;
}

export interface ConversationHistoryItem {
    id: number;
    channel: string;
    message_text: string;
    agent_response: string;
    agent_used: string;
    confidence_score: number;
    database_action: string;
    created_at: string;
}

// New: Callbacks for SSE events
export interface StreamCallbacks {
    onThinking?: () => void;
    onProgress?: (message: string, stage?: string) => void;
    onTip?: (message: string) => void;
    onAlmostReady?: (message: string) => void;
    onResult?: (response: ChatResponse) => void;
    onError?: (error: string) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5010';

export const chatService = {
    /**
     * Send a message to the AI agent system (non-streaming)
     */
    async sendMessage(message: string, channel: string = 'web_chat', tenantId?: number): Promise<ChatResponse> {
        const { data } = await api.post<ChatResponse>('/api/chat/message', {
            message,
            channel,
            tenant_id: tenantId
        });
        return data;
    },

    /**
     * Send a message with SSE streaming for progressive responses
     * This keeps the connection alive and receives real-time updates
     */
    sendMessageStream(
        message: string,
        callbacks: StreamCallbacks,
        channel: string = 'web_chat',
        tenantId?: number
    ): () => void {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

        // Create an AbortController for cleanup
        const controller = new AbortController();

        // Use fetch with streaming instead of EventSource (for POST support)
        const streamRequest = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : '',
                    },
                    body: JSON.stringify({
                        message,
                        channel,
                        tenant_id: tenantId
                    }),
                    signal: controller.signal
                });

                if (!response.ok) {
                    callbacks.onError?.(`HTTP error: ${response.status}`);
                    return;
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                if (!reader) {
                    callbacks.onError?.('No response body');
                    return;
                }

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE events from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6)) as SSEEvent;

                                switch (data.type) {
                                    case 'thinking':
                                        callbacks.onThinking?.();
                                        break;
                                    case 'progress':
                                        callbacks.onProgress?.(data.message || '', data.stage);
                                        break;
                                    case 'tip':
                                        callbacks.onTip?.(data.message || '');
                                        break;
                                    case 'almost_ready':
                                        callbacks.onAlmostReady?.(data.message || '');
                                        break;
                                    case 'result':
                                        callbacks.onResult?.({
                                            response: data.response || '',
                                            success: data.success ?? true,
                                            agent_used: data.agent_used
                                        });
                                        break;
                                    case 'error':
                                        callbacks.onError?.(data.message || 'Error desconocido');
                                        break;
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE event:', parseError);
                            }
                        }
                    }
                }
            } catch (error: unknown) {
                if ((error as Error).name !== 'AbortError') {
                    callbacks.onError?.(`Connection error: ${(error as Error).message}`);
                }
            }
        };

        streamRequest();

        // Return cleanup function
        return () => controller.abort();
    },

    /**
     * Get conversation history for current user
     */
    async getHistory(): Promise<{ history: ConversationHistoryItem[]; total: number }> {
        const { data } = await api.get<{ history: ConversationHistoryItem[]; total: number }>('/api/chat/history');
        return data;
    },

    /**
     * Get list of available tools for the agent
     */
    async getTools(): Promise<{ tools: ChatTool[]; count: number; using_langgraph: boolean }> {
        const { data } = await api.get<{ tools: ChatTool[]; count: number; using_langgraph: boolean }>('/api/chat/tools');
        return data;
    },

    /**
     * Get current agent system status
     */
    async getStatus(): Promise<ChatStatus> {
        const { data } = await api.get<ChatStatus>('/api/chat/status');
        return data;
    },

    /**
     * Send a voice message (audio blob) to the AI agent system
     */
    async sendVoiceMessage(audioBlob: Blob, channel: string = 'web_voice', tenantId?: number): Promise<any> {
        const formData = new FormData();
        formData.append('file', audioBlob);
        formData.append('channel', channel);
        if (tenantId) formData.append('tenant_id', tenantId.toString());

        const { data } = await api.post('/api/voice/interact', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return data;
    },

    /**
     * Get available Spanish voices from Edge TTS
     */
    async getVoices(): Promise<{ voices: any[] }> {
        const { data } = await api.get('/api/voice/voices');
        return data;
    },

    /**
     * Synthesize text to speech
     */
    async synthesizeText(text: string, voice?: string, tenantId?: number): Promise<{ audio_url: string; success: boolean }> {
        const { data } = await api.post('/api/voice/synthesize', {
            text,
            voice,
            tenant_id: tenantId
        });
        return data;
    }
};
