"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    X,
    Send,
    Loader2,
    Bot,
    Sparkles,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Trash2,
    Paperclip,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from './chat-bubble';
import { chatService, ChatMessage } from '@/services/chat.service';
import { authService } from '@/services/auth.service';
import { useLicense } from "@/contexts/license-context";
import { toast } from 'sonner';

const CHAT_HISTORY_KEY = 'kindicore_chat_history';
const MAX_HISTORY_MESSAGES = 50;

// Expose isOpen state so other components (OnboardingChecklistWidget) can react
export let isChatSidebarOpen = false;

export function ChatWidget() {
    const router = useRouter();
    const { setTheme } = useTheme();
    const [isOpen, setIsOpenState] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Voice
    const [isRecording, setIsRecording] = useState(false);
    const [voiceMode, setVoiceMode] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);

    // Textarea auto-resize ref
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // File attachments
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    // Module tracking
    const pathname = usePathname();
    const currentModuleSegment = pathname?.split('/')[1] || 'dashboard';

    // Agent config
    const { selectedCenterId } = useLicense();
    const currentTenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);
    const [agentName, setAgentName] = useState('GovCoreX Copilot');
    const [agentIcon, setAgentIcon] = useState<string | null>(null);

    // Sync module-level flag for OnboardingChecklistWidget to read
    const setIsOpen = (val: boolean) => {
        isChatSidebarOpen = val;
        setIsOpenState(val);
        // Dispatch custom event so other components can react
        window.dispatchEvent(new CustomEvent('kindicore-chat-sidebar-toggle', { detail: { isOpen: val } }));
    };

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5010';
    const getImageUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${API_URL}${path}`;
    };

    // Auth + history + agent config load
    useEffect(() => {
        const checkAuthAndLoad = async () => {
            const user = authService.getStoredUser();
            setIsAuthenticated(!!user);
            if (user && typeof window !== 'undefined') {
                try {
                    const { licenseAdminService } = await import('@/services/license-admin.service');
                    const config = await licenseAdminService.getPublicConfig();
                    setAgentName(config.agent_name || 'KindiCore AI');
                    setAgentIcon(config.agent_icon || null);
                } catch (e) {
                    // silent
                }
                const userKey = `${CHAT_HISTORY_KEY}_${user.id}`;
                const saved = localStorage.getItem(userKey);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setMessages(parsed.map((m: ChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) })));
                    } catch { /* ignore */ }
                }
            }
        };
        checkAuthAndLoad();
        window.addEventListener('storage', checkAuthAndLoad);
        return () => window.removeEventListener('storage', checkAuthAndLoad);
    }, []);

    // Save history
    useEffect(() => {
        if (typeof window !== 'undefined' && messages.length > 0) {
            const user = authService.getStoredUser();
            if (user) {
                const userKey = `${CHAT_HISTORY_KEY}_${user.id}`;
                localStorage.setItem(userKey, JSON.stringify(
                    messages.filter(m => !m.isLoading).slice(-MAX_HISTORY_MESSAGES)
                ));
            }
        }
    }, [messages]);

    // Auto-scroll
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);
    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    // Focus textarea on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Auto-resize textarea: min 2 rows, max 6 rows, scroll after
    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        const lineHeight = 20; // px per line
        const minRows = 2;
        const maxRows = 6;
        const minHeight = lineHeight * minRows;
        const maxHeight = lineHeight * maxRows;
        const scrollH = el.scrollHeight;
        el.style.height = `${Math.min(Math.max(scrollH, minHeight), maxHeight)}px`;
        el.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden';
    };

    // Audio helpers
    const unlockAudio = useCallback(() => {
        const p = audioPlayerRef.current;
        if (!p) return;
        p.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
        p.play().then(() => p.pause()).catch(() => {});
    }, []);

    const playResponseAudio = useCallback((audioUrl: string) => {
        const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${API_URL}${audioUrl}`;
        const p = audioPlayerRef.current;
        if (!p) return;
        p.src = fullUrl;
        p.load();
        p.oncanplaythrough = () => p.play().catch(() => {});
    }, [API_URL]);

    // ──────────────────────────────────────────────────────────────────────────
    // Agent command processor — navigates pages + controls theme in real-time
    // ──────────────────────────────────────────────────────────────────────────
    const processAgentCommands = useCallback((text: string) => {
        if (!text) return;
        const t = text.toLowerCase();

        // ── Theme control ──
        if (t.includes('modo claro') || t.includes('tema claro') || t.includes('light mode') || t.includes('modo luminoso')) {
            setTheme('light');
            toast.success('Tema cambiado a modo claro ☀️');
            return;
        }
        if (t.includes('modo oscuro') || t.includes('tema oscuro') || t.includes('dark mode') || t.includes('modo nocturno')) {
            setTheme('dark');
            toast.success('Tema cambiado a modo oscuro 🌙');
            return;
        }

        // ── Page navigation ──
        const routes = [
            { keywords: ['asistencia', 'marcar entrada', 'marcar salida', 'control de asistencia'], path: '/asistencia' },
            { keywords: ['registro', 'registrar niño', 'registrar niña', 'ficha de niño', 'inscribir', 'registro de niños'], path: '/registro' },
            { keywords: ['admisión', 'admision', 'admitir', 'proceso de admisión'], path: '/admision' },
            { keywords: ['idii', 'seguimiento idii', 'desarrollo infantil', 'evaluación idii'], path: '/seguimiento-idii' },
            { keywords: ['salud', 'nutrición', 'nutricion', 'menú', 'alimentación', 'peso', 'talla', 'salud & nutrición'], path: '/salud-nutricion' },
            { keywords: ['planificación', 'planificaciones', 'planificar', 'actividades pedagógicas'], path: '/planificaciones' },
            { keywords: ['intervención familiar', 'intervencion familiar', 'visita domiciliaria', 'ficha familiar'], path: '/intervencion-familiar' },
            { keywords: ['operaciones', 'proveedores', 'inventario', 'mantenimiento'], path: '/operaciones' },
            { keywords: ['monitoreo', 'auditoría', 'indicadores cdi'], path: '/monitoreo' },
            { keywords: ['reporte', 'reportes', 'exportar pdf', 'informe'], path: '/reportes' },
            { keywords: ['notificación', 'notificaciones', 'mensajes', 'alertas'], path: '/notificaciones' },
            { keywords: ['ingestión', 'ingestion', 'carga masiva', 'importar', 'subir excel'], path: '/ingestion' },
            { keywords: ['knowledge', 'conocimiento', 'base de conocimiento'], path: '/knowledge' },
            { keywords: ['dashboard', 'inicio', 'panel de control', 'resumen general'], path: '/dashboard' },
            // AI GovCoreX OS Modules
            { keywords: ['social', 'programas sociales', 'convocatoria', 'convocatorias'], path: '/social/convocatorias' },
            { keywords: ['postulación', 'postulaciones', 'postulantes', 'solicitudes'], path: '/social/postulaciones' },
            { keywords: ['padrón', 'padron', 'beneficiarios', 'red social'], path: '/social/padron' },
            { keywords: ['mapa', 'gis', 'territorio', 'cobertura territorial'], path: '/geo/mapa' },
            { keywords: ['calor', 'heatmap', 'vulnerabilidad territorial'], path: '/geo/heatmap' },
            { keywords: ['cercas', 'geocercas', 'perímetro'], path: '/geo/cercas' },
            { keywords: ['equipos de campo', 'brigadas', 'técnicos'], path: '/geo/equipos-campo' },
            { keywords: ['canales', 'whatsapp', 'telegram', 'mensajería'], path: '/canales/dashboard' },
            { keywords: ['copiloto', 'agentes', 'inteligencia', 'rag'], path: '/copiloto' },
            { keywords: ['super admin', 'licencias', 'organizaciones'], path: '/super-admin' },
        ];

        for (const route of routes) {
            if (route.keywords.some(k => t.includes(k))) {
                router.push(route.path);
                toast.success(`Navegando a: ${route.path}`);
                break;
            }
        }

        // Trigger data refresh on all subscribed page components
        import('@/hooks/use-agent-refresh').then(({ dispatchAgentDataChanged }) => {
            dispatchAgentDataChanged();
        });
    }, [router, setTheme]);

    // ── Send text message ──
    const handleSend = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;
        if (voiceMode) unlockAudio();

        setInputValue('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }
        setError(null);

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        const streamingId = `streaming-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: streamingId, role: 'assistant',
            content: '🔍 Iniciando investigación y análisis de tu solicitud...',
            timestamp: new Date(), isLoading: true, isStreaming: true, streamType: 'thinking',
        }]);
        setIsLoading(true);

        chatService.sendMessageStream(
            message,
            {
                onThinking: () => setMessages(prev => prev.map(m =>
                    m.id === streamingId ? { ...m, content: '🔍 Iniciando investigación y análisis de tu solicitud...' } : m
                )),
                onProgress: (msg) => setMessages(prev => prev.map(m =>
                    m.id === streamingId ? { ...m, content: msg, streamType: 'progress' } : m
                )),
                onTip: (msg) => setMessages(prev => prev.map(m =>
                    m.id === streamingId ? { ...m, content: msg, streamType: 'tip' } : m
                )),
                onAlmostReady: (msg) => setMessages(prev => prev.map(m =>
                    m.id === streamingId ? { ...m, content: msg, streamType: 'almost_ready' } : m
                )),
                onResult: (response) => {
                    setMessages(prev => [
                        ...prev.filter(m => m.id !== streamingId),
                        {
                            id: `assistant-${Date.now()}`, role: 'assistant',
                            content: response.response, timestamp: new Date(),
                            agentUsed: response.agent_used, isLoading: false, isStreaming: false,
                        },
                    ]);
                    setIsLoading(false);
                    if (voiceMode && response.response) {
                        chatService.synthesizeText(response.response, undefined, currentTenantId)
                            .then(r => { if (r.success && r.audio_url) playResponseAudio(r.audio_url); })
                            .catch(() => {});
                    }
                    if (response.success) processAgentCommands(response.response);
                },
                onError: (err) => {
                    setMessages(prev => prev.filter(m => m.id !== streamingId));
                    setError(err);
                    setIsLoading(false);
                },
            },
            'web_chat',
            currentTenantId
        );
    };

    const handleFileAttach = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowed = [
            'application/pdf', 'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowed.includes(file.type) && !file.name.match(/\.(csv|pdf|xlsx|xls|doc|docx|txt)$/i)) {
            toast.error('Tipo de archivo no soportado. Usa PDF, Excel, CSV o Word.');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            toast.error('El archivo excede el límite de 15MB.');
            return;
        }

        setAttachedFile(file);
        toast.success(`Archivo adjunto: ${file.name}`);
        e.target.value = '';
    };

    const removeAttachedFile = () => {
        setAttachedFile(null);
    };

    const handleSendWithFile = async () => {
        if (!attachedFile) {
            handleSend();
            return;
        }

        const message = inputValue.trim();
        const fileToUpload = attachedFile;
        setAttachedFile(null);
        setInputValue('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }

        const userMsgId = `user-file-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: userMsgId,
            role: 'user',
            content: `📎 [${fileToUpload.name}]\n${message || 'Por favor procesa y analiza este archivo adjunto.'}`,
            timestamp: new Date()
        }]);

        const procId = `proc-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: procId,
            role: 'assistant',
            content: '📊 Analizando archivo adjunto y procesando datos masivos/RAG...',
            timestamp: new Date(),
            isLoading: true
        }]);
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            formData.append('message', message || `Procesa este archivo adjunto: ${fileToUpload.name}`);
            if (currentTenantId) formData.append('tenant_id', String(currentTenantId));

            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/api/ingestion/chat-upload`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });

            const result = await res.json();

            setMessages(prev => [
                ...prev.filter(m => m.id !== procId),
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: result.response || '✅ Archivo procesado correctamente.',
                    timestamp: new Date(),
                    isLoading: false
                }
            ]);

            if (result.response) {
                processAgentCommands(result.response);
            }
        } catch (err: any) {
            setMessages(prev => prev.filter(m => m.id !== procId));
            setError(err.message || 'Error al procesar el archivo adjunto');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter without Shift sends; Shift+Enter inserts newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendWithFile();
        }
    };

    const clearHistory = () => {
        setMessages([]);
        const user = authService.getStoredUser();
        if (user && typeof window !== 'undefined') {
            localStorage.removeItem(`${CHAT_HISTORY_KEY}_${user.id}`);
        }
    };

    // ── Voice recording ──
    const startRecording = async () => {
        unlockAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleVoiceSend(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mr.start();
            setIsRecording(true);
        } catch {
            toast.error('No se pudo acceder al micrófono');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleVoiceSend = async (audioBlob: Blob) => {
        setIsLoading(true);
        setError(null);
        const userId = `user-voice-${Date.now()}`;
        const procId = `proc-${Date.now()}`;
        setMessages(prev => [...prev,
            { id: userId, role: 'user', content: '🎤 Enviando nota de voz...', timestamp: new Date() },
            { id: procId, role: 'assistant', content: '🤔 Transcribiendo...', timestamp: new Date(), isLoading: true },
        ]);
        try {
            const response = await chatService.sendVoiceMessage(audioBlob, 'web_voice', currentTenantId);
            if (response.success) {
                const tx = response.transcription?.trim() || '🎤 (Nota de voz)';
                const ag = response.agent_response?.trim() || '(Sin respuesta)';
                setMessages(prev => [
                    ...prev.filter(m => m.id !== procId).map(m =>
                        m.id === userId ? { ...m, content: tx } : m
                    ),
                    { id: `assistant-${Date.now()}`, role: 'assistant', content: ag, timestamp: new Date(), isLoading: false },
                ]);
                if (response.audio_url) playResponseAudio(response.audio_url);
                else if (voiceMode && ag) {
                    chatService.synthesizeText(ag, undefined, currentTenantId)
                        .then(r => { if (r.success && r.audio_url) playResponseAudio(r.audio_url); })
                        .catch(() => {});
                }
                processAgentCommands(ag);
            } else {
                setMessages(prev => prev.filter(m => m.id !== procId));
                setError(response.error || 'Error al procesar audio');
            }
        } catch (err: any) {
            setMessages(prev => prev.filter(m => m.id !== procId));
            setError(err.message || 'Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <>
            {/* ─── Floating Trigger Button ─── */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "fixed bottom-6 right-6 z-[99] h-14 w-14 rounded-full flex items-center justify-center",
                        "shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95",
                        "bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500",
                        "text-white border border-amber-400/30 shadow-glow-amber-sm"
                    )}
                    title="Consola de Asistente IA"
                    id="kindicore-chat-open-btn"
                >
                    {agentIcon ? (
                        <img src={getImageUrl(agentIcon) || ''} alt="Agent" className="w-full h-full object-cover rounded-full" />
                    ) : (
                        <Sparkles className="h-6 w-6 animate-pulse" />
                    )}
                </button>
            )}

            {/* ─── 100vh Right Sidebar Panel ─── */}
            <div
                className={cn(
                    "fixed top-0 right-0 z-[150] h-screen flex flex-col transition-all duration-300 ease-in-out",
                    "border-l shadow-glass-lg",
                    isOpen
                        ? "w-full sm:w-[420px] translate-x-0"
                        : "w-0 translate-x-full overflow-hidden border-transparent",
                    "bg-background/95 backdrop-blur-xl border-border/50"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-yellow-500/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center overflow-hidden shadow-glow-amber-sm">
                                {agentIcon
                                    ? <img src={getImageUrl(agentIcon) || ''} alt="Agent" className="w-full h-full object-cover" />
                                    : <Bot className="w-5 h-5 text-white" />
                                }
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1">
                                <h2 className="text-sm font-bold text-foreground">{agentName}</h2>
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                Sistema Multi-Agente · En vivo
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {messages.length > 0 && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                onClick={clearHistory} title="Limpiar conversación"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon"
                            className={cn(
                                "h-8 w-8 rounded-xl transition-all border border-transparent",
                                voiceMode
                                    ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                            onClick={() => setVoiceMode(!voiceMode)}
                            title={voiceMode ? "Desactivar voz" : "Activar voz"}
                        >
                            {voiceMode ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            onClick={() => setIsOpen(false)} title="Cerrar consola"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages Feed */}
                <ScrollArea className="flex-1 px-4 py-4">
                    <div ref={scrollRef} className="space-y-4 pr-1">
                        {messages.length === 0 && (
                            <div className="text-center py-12 px-6">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center border border-amber-500/10">
                                    <Bot className="w-8 h-8 text-amber-500 animate-float" />
                                </div>
                                <h3 className="font-extrabold text-lg text-foreground tracking-tight">¡Consola Multi-Agente Activa!</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto mt-2">
                                    Habla conmigo para consultar, editar o navegar. Controlo el frontend y el backend en tiempo real.
                                </p>
                                <div className="mt-5 flex flex-col gap-2 max-w-[260px] mx-auto">
                                    {[
                                        "¿Quién faltó hoy a clases?",
                                        "Llévame al control de asistencia",
                                        "Cambia al tema oscuro",
                                    ].map((s) => (
                                        <button key={s}
                                            onClick={() => {
                                                setInputValue(s);
                                                textareaRef.current?.focus();
                                            }}
                                            className="px-3.5 py-2.5 text-xs rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/20 text-foreground/80 font-medium transition-all text-left"
                                        >{s}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map(m => (
                            <ChatBubble key={m.id} message={m} agentIcon={agentIcon} />
                        ))}

                        {error && (
                            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-fade-in-up">
                                {error}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* ─── Input Area — Auto-expanding Textarea with File Attachments ─── */}
                <div className="p-3.5 border-t border-border/40 bg-card shrink-0 space-y-2">
                    {/* Attachment preview bar */}
                    {attachedFile && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-primary/10 border border-primary/25 text-xs animate-fadeIn">
                            <div className="flex items-center gap-2 min-w-0">
                                {attachedFile.name.match(/\.(xlsx|xls|csv)$/i) ? (
                                    <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />
                                ) : (
                                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                )}
                                <span className="font-semibold text-foreground truncate max-w-[240px]">
                                    {attachedFile.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    ({(attachedFile.size / 1024).toFixed(0)} KB)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={removeAttachedFile}
                                className="w-5 h-5 rounded-full hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelected}
                            accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt"
                            className="hidden"
                        />

                        {/* Attach button */}
                        <Button
                            type="button"
                            onClick={handleFileAttach}
                            disabled={isLoading}
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "h-11 w-11 rounded-xl shrink-0 border transition-all mb-0",
                                attachedFile
                                    ? "bg-primary/15 border-primary/40 text-primary"
                                    : "bg-muted border-border/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            )}
                            title="Adjuntar archivo (Excel, CSV, PDF, Word)"
                        >
                            <Paperclip className="w-4 h-4" />
                        </Button>

                        {/* Auto-expanding textarea */}
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={handleTextareaInput}
                            onKeyDown={handleKeyDown}
                            placeholder={isRecording ? "Escuchando dictado de voz..." : attachedFile ? `Instrucción para ${attachedFile.name}...` : "Escribe un mensaje, comando o adjunta un archivo..."}
                            disabled={isLoading}
                            rows={2}
                            className={cn(
                                "flex-1 px-4 py-3 rounded-xl resize-none",
                                "bg-muted/50 border border-border/40",
                                "text-xs placeholder:text-muted-foreground/60 leading-5",
                                "focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50",
                                "transition-all duration-200",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "scrollbar-thin scrollbar-thumb-amber-300/30 dark:scrollbar-thumb-amber-700/30",
                                "bg-amber-50/40 dark:bg-zinc-900/60",
                                "border-amber-200/40 dark:border-zinc-700/40",
                                "text-foreground"
                            )}
                            style={{ minHeight: '56px', maxHeight: '120px', overflowY: 'hidden' }}
                        />

                        {/* Voice toggle */}
                        <Button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isLoading}
                            size="icon"
                            className={cn(
                                "h-11 w-11 rounded-xl shrink-0 border transition-all mb-0",
                                isRecording
                                    ? "bg-red-500 border-red-400 text-white shadow-lg animate-pulse"
                                    : "bg-muted border-border/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            )}
                            title={isRecording ? "Detener grabación" : "Nota de voz"}
                        >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>

                        {/* Send button */}
                        <Button
                            onClick={handleSendWithFile}
                            disabled={(!inputValue.trim() && !attachedFile) || isLoading}
                            size="icon"
                            className={cn(
                                "h-11 w-11 rounded-xl shrink-0 shadow-md",
                                "bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1">
                        <span>Enter para enviar · Shift+Enter = nueva línea · 📎 Adjuntar</span>
                        <span className="font-mono bg-muted/40 px-1.5 py-0.5 rounded text-[9px]">
                          📍 {currentModuleSegment}
                        </span>
                    </div>
                </div>
            </div>

            {/* Persistent audio element */}
            <audio ref={audioPlayerRef} className="hidden" preload="none" />
        </>
    );
}
