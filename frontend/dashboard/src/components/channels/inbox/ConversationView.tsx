"use client";
/** Vista de hilo + composer (port de aikrofy ConversationView)
 *  Burbujas user/assistant, adjuntos, hora, autoscroll, composer con pausa-IA
 */
import React, { useEffect, useRef, useState } from "react";
import { Send, Bot, CheckCircle2, XCircle, AlertTriangle, Users, Paperclip, Loader2, RotateCcw, MessageSquare, LayoutDashboard } from "lucide-react";
import { ChannelBadge } from "./ChannelBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type Message = {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  channel?: string;
  media_url?: string;
  media_type?: string;
  tool_calls?: any;
  created_at?: string;
};

interface ConversationData {
  id: number;
  contact_name?: string;
  contact_phone?: string;
  channel_type?: string;
  handover_status?: string;
  is_ai_active?: boolean;
  tags?: string[];
  messages?: Message[];
}

interface Props {
  conversation: ConversationData | null;
  onSend: (content: string, pauseAI: boolean) => Promise<void>;
  onToggleResolved: (resolved: boolean) => Promise<void>;
  onToggleAI: (active: boolean) => Promise<void>;
  isSending: boolean;
  isResolved: boolean;
  isAIActive: boolean;
  showSidebar: boolean;
  onToggleSidebar: () => void;
}

export function ConversationView({
  conversation,
  onSend,
  onToggleResolved,
  onToggleAI,
  isSending,
  isResolved,
  isAIActive,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [pauseAI, setPauseAI] = useState(true);
  const [showAttach, setShowAttach] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [conversation?.messages?.length]);
  useEffect(() => { if (conversation?.messages) scrollToBottom(); }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;
    await onSend(content.trim(), pauseAI);
    setContent("");
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    try { return format(new Date(iso), "HH:mm", { locale: es }); } catch { return iso.slice(11, 16); }
  };

  const statusBadge = () => {
    if (isResolved) return <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Resuelto</Badge>;
    return <Badge variant="outline" className="text-[10px]"><MessageSquare className="w-2.5 h-2.5 mr-1" />Abierta</Badge>;
  };

  const aiBadge = () => {
    if (isAIActive) return <Badge variant="outline" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />IA Activa</Badge>;
    return <Badge variant="destructive" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />IA Pausada</Badge>;
  };

  const handoverBadge = (c: ConversationData) => {
    if (c.handover_status === "human_taken") return <Badge variant="default" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-1" />Humano</Badge>;
    if (c.handover_status === "human_listening") return <Badge variant="secondary" className="text-[10px]"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Escuchando</Badge>;
    if (c.handover_status === "resolved") return <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Resuelto</Badge>;
    return null;
  };

  if (!conversation) {
    return (
      <div className="flex flex-col h-full bg-muted/30 items-center justify-center text-muted-foreground">
        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-center">Selecciona una conversación</p>
      </div>
    );
  }

  const messages = conversation.messages ?? [];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="p-3 border-b flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <ChannelBadge type={conversation.channel_type as any} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{conversation.contact_name ?? conversation.contact_phone ?? `Conv. ${conversation.id}`}</h3>
              <p className="text-xs text-muted-foreground">{conversation.contact_phone ?? "Sin teléfono"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">{statusBadge()}{handoverBadge(conversation)}{aiBadge()}</div>
            <Button variant="outline" size="sm" onClick={() => onToggleResolved(!isResolved)} disabled={isSending}>
              {isResolved ? (
                <> <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir </>
              ) : (
                <> <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolver </>
              )}
            </Button>
          </div>
        </div>

<div className="flex items-center gap-3 flex-wrap pt-1 border-t">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground mr-1">Pausar IA</Label>
          <Switch checked={pauseAI} onCheckedChange={setPauseAI} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAttach(!showAttach)}>
            <Paperclip className="w-3.5 h-3.5 mr-1" /> Adjuntar
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-muted-foreground hover:text-foreground"
            aria-label={showSidebar ? "Ocultar panel de contacto" : "Mostrar panel de contacto"}
            title={showSidebar ? "Ocultar panel de contacto" : "Mostrar panel de contacto"}
          >
            <LayoutDashboard className={`w-4 h-4 transition-transform ${showSidebar ? "rotate-0" : "rotate-180"}`} />
          </Button>
        </div>
      </div>
      </div>

      {/* Hilo de mensajes */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3" ref={messagesEndRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center p-4">
              <MessageSquare className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">Sin mensajes aún</p>
              <p className="text-xs opacity-60">El primer mensaje aparecerá aquí</p>
            </div>
          ) : (
            messages.map(m => {
              const bubbleClass = `max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : m.role === "assistant"
                    ? "bg-muted rounded-bl-none"
                    : "bg-muted/50 text-center text-muted-foreground italic rounded"
              }`;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === "assistant" ? "justify-end" : "justify-start"}`}
                >
                  <div className={bubbleClass}>
                    {m.media_url && m.media_type && (
                      <div className="mb-1">
                        <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="underline text-xs">
                          📎 {m.media_type} ({m.media_type})
                        </a>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-60">
                      <span>{m.created_at ? format(new Date(m.created_at), "HH:mm", { locale: es }) : ""}</span>
                      {m.role === "assistant" && <CheckCircle2 className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para salto)"
              className="min-h-[44px] max-h-[120px] resize-none pr-8"
              rows={1}
              disabled={isSending}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 bottom-1"
              disabled={!content.trim() || isSending}
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}