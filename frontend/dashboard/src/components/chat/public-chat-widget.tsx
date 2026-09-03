"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, X, MessageSquare, Loader2, Minimize2, Maximize2, Sparkles, Phone, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface OrgConfig {
    org_name: string;
    legal_name?: string;
    agent_name: string;
    agent_icon?: string | null;
    whatsapp_phone?: string | null;
    telegram_bot?: string | null;
    active_programs?: { id: number; name: string; description: string }[];
    allow_public_chatbot?: boolean;
}

interface PublicChatWidgetProps {
    orgSlug: string;
    apiBase?: string;
    position?: 'bottom-right' | 'bottom-left';
    primaryColor?: string;
    className?: string;
}

export function PublicChatWidget({
    orgSlug,
    apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5010',
    position = 'bottom-right',
    primaryColor = '#f97316',
    className,
}: PublicChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<PublicMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [orgConfig, setOrgConfig] = useState<OrgConfig | null>(null);
    const [sessionId] = useState(() => `web_pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [userName, setUserName] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [step, setStep] = useState<'intro' | 'chat'>('intro');
    const [fetchError, setFetchError] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load org public configuration
    useEffect(() => {
        if (!orgSlug) return;
        fetch(`${apiBase}/api/public/org/${orgSlug}`)
            .then((r) => {
                if (!r.ok) throw new Error('Org not found');
                return r.json();
            })
            .then((data) => {
                setOrgConfig(data);
                setFetchError(false);
            })
            .catch(() => {
                setFetchError(true);
                setOrgConfig({
                    org_name: 'Organización Pública',
                    agent_name: 'Asistente Ciudadano 24/7',
                });
            });
    }, [orgSlug, apiBase]);

    // Auto scroll
    useEffect(() => {
        if (isOpen && !isMinimized) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isMinimized]);

    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMsg: PublicMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const loadingId = `l-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: loadingId, role: 'assistant', content: '...', timestamp: new Date() }
        ]);

        try {
            const res = await fetch(`${apiBase}/api/public/chat/${orgSlug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    session_id: sessionId,
                    user_name: userName || 'Ciudadano/a',
                    user_phone: userPhone,
                }),
            });

            const data = await res.json();
            setMessages((prev) => [
                ...prev.filter((m) => m.id !== loadingId),
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    content: data.response || 'Disculpa, no pude procesar tu solicitud en este momento.',
                    timestamp: new Date()
                }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev.filter((m) => m.id !== loadingId),
                {
                    id: `err-${Date.now()}`,
                    role: 'assistant',
                    content: 'Hubo una dificultad de conexión. Por favor intenta de nuevo en unos momentos.',
                    timestamp: new Date()
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, orgSlug, apiBase, sessionId, userName, userPhone]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const startChat = () => {
        if (!userName.trim()) return;
        setStep('chat');
        const initialText = `Hola, soy ${userName.trim()}${userPhone ? `, mi número de contacto es ${userPhone.trim()}` : ''}. Quisiera conocer los programas y servicios disponibles.`;
        sendMessage(initialText);
    };

    if (!orgConfig) return null;

    return (
        <div
            className={cn(
                "fixed z-[9999] flex flex-col items-end font-sans",
                position === 'bottom-right' ? "bottom-6 right-6" : "bottom-6 left-6",
                className
            )}
        >
            {/* Main Chat Panel */}
            {isOpen && !isMinimized && (
                <div
                    className="w-[380px] h-[540px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-100px)] bg-background text-foreground rounded-3xl shadow-2xl border border-border/60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        boxShadow: `0 24px 70px ${primaryColor}25, 0 8px 24px rgba(0,0,0,0.2)`
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between p-4 shrink-0 border-b border-white/10"
                        style={{
                            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
                        }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-sm">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-white font-black text-sm truncate">{orgConfig.agent_name}</p>
                                    <Sparkles className="w-3 h-3 text-amber-200 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                    <span className="text-white/85 text-[11px] truncate font-medium">
                                        {orgConfig.org_name} · En Vivo
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsMinimized(true)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all"
                                title="Minimizar"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all"
                                title="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Step 1: Citizen Welcome / Contact Capture */}
                    {step === 'intro' ? (
                        <div className="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
                            <div className="flex flex-col items-center text-center space-y-3 pt-2">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{
                                        background: `${primaryColor}15`,
                                        border: `2px solid ${primaryColor}35`
                                    }}
                                >
                                    <MessageSquare className="w-8 h-8" style={{ color: primaryColor }} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-foreground">
                                        ¡Bienvenido/a a {orgConfig.org_name}!
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Soy {orgConfig.agent_name}. Te ayudo a orientarte sobre los programas activos, requisitos, inscripciones y derivaciones.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 my-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-foreground">Tu Nombre Completo *</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: María Zambrano"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && startChat()}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-foreground">Teléfono / WhatsApp (Opcional)</label>
                                    <input
                                        type="tel"
                                        placeholder="Ej: 0991234567"
                                        value={userPhone}
                                        onChange={(e) => setUserPhone(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && startChat()}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={startChat}
                                    disabled={!userName.trim() || isLoading}
                                    className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:brightness-110 active:scale-98 disabled:opacity-50"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`
                                    }}
                                >
                                    Iniciar Atención Virtual 24/7 →
                                </button>
                            </div>

                            {/* Direct WhatsApp Channel Link */}
                            {orgConfig.whatsapp_phone && (
                                <div className="pt-2 border-t border-border/40 text-center">
                                    <a
                                        href={`https://wa.me/${orgConfig.whatsapp_phone.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                        O chatea directamente al WhatsApp Oficial
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Step 2: Active Conversation */
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex",
                                            msg.role === 'user' ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm",
                                                msg.role === 'user'
                                                    ? "text-white rounded-br-none"
                                                    : "bg-muted/80 text-foreground border border-border/40 rounded-bl-none"
                                            )}
                                            style={
                                                msg.role === 'user'
                                                    ? { background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }
                                                    : {}
                                            }
                                        >
                                            {msg.content === '...' ? (
                                                <span className="flex items-center gap-1.5 py-1 px-1">
                                                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </span>
                                            ) : (
                                                <span className="whitespace-pre-wrap">{msg.content}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input box */}
                            <div className="p-3 border-t border-border/40 bg-card shrink-0 flex items-center gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escribe tu consulta o necesidad..."
                                    disabled={isLoading}
                                    rows={1}
                                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-border/50 bg-muted/40 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                                    style={{ maxHeight: '80px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => sendMessage(input)}
                                    disabled={!input.trim() || isLoading}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all shrink-0 shadow-md hover:scale-105 active:scale-95"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`
                                    }}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Minimized Bubble */}
            {isOpen && isMinimized && (
                <div
                    className="flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl cursor-pointer text-white font-bold text-xs select-none transition-transform hover:scale-105"
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                        boxShadow: `0 10px 30px ${primaryColor}50`
                    }}
                    onClick={() => setIsMinimized(false)}
                >
                    <Bot className="w-4 h-4" />
                    <span>{orgConfig.agent_name}</span>
                    <Maximize2 className="w-3.5 h-3.5 text-white/70" />
                </div>
            )}

            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all text-white relative group"
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                        boxShadow: `0 10px 36px ${primaryColor}55`
                    }}
                    title={`Atención Ciudadana: ${orgConfig.agent_name}`}
                >
                    <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-background animate-pulse" />
                </button>
            )}
        </div>
    );
}
