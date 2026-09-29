"use client";
/** Lista de conversaciones (port de aikrofy ConversationList)
 *  Tabs: Todas / Por atender (handover) / Abiertas / Completadas
 *  Search con debounce, chips de canal, badges IA/Humano/Resuelto
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Filter, ChevronDown, MessageSquare, Bot, CheckCircle2, XCircle,
  AlertTriangle, Clock, Users, Send, Loader2, MoreVertical
} from "lucide-react";
import { ChannelBadge } from "./ChannelBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type ConversationItem = {
  id: number;
  channel_id: number;
  program_id?: number;
  external_id?: string;
  contact_name?: string;
  contact_phone?: string;
  conversation_type: string;
  status: string;
  current_step?: string;
  last_message_at?: string;
  messages_count?: number;
  is_ai_active?: boolean;
  handover_status?: string;
  tags?: string[];
  channel_type?: string;
};

export type Tab = "all" | "handover" | "open" | "completed";

interface Props {
  conversations: ConversationItem[];
  selectedConversation: ConversationItem | null;
  onSelect: (c: ConversationItem | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedChannel: "all" | "whatsapp" | "telegram" | "email" | "webchat";
  setSelectedChannel: (c: "all" | "whatsapp" | "telegram" | "email" | "webchat") => void;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelect,
  onRefresh,
  isLoading,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  selectedChannel,
  setSelectedChannel,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = conversations;
    // Tab
    if (activeTab === "handover") {
      list = list.filter(c => c.handover_status && ["human_taken", "human_listening"].includes(c.handover_status));
    } else if (activeTab === "open") {
      list = list.filter(c => c.status === "open" || c.status === "in_progress");
    } else if (activeTab === "completed") {
      list = list.filter(c => c.status === "completed");
    }
    // Canal
    if (selectedChannel !== "all") {
      list = list.filter(c => c.channel_type === selectedChannel);
    }
    // Búsqueda
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c =>
        (c.contact_name ?? "").toLowerCase().includes(q) ||
        (c.contact_phone ?? "").toLowerCase().includes(q) ||
        (c.external_id ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, activeTab, selectedChannel, searchTerm]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const getRelativeTime = (iso?: string) => {
    if (!iso) return "—";
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
    } catch {
      return iso.slice(0, 16).replace("T", " ");
    }
  };

  const statusBadge = (c: ConversationItem) => {
    if (c.status === "completed") return <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Completada</Badge>;
    if (c.status === "abandoned") return <Badge variant="destructive" className="text-[10px]"><XCircle className="w-2.5 h-2.5 mr-1" />Abandonada</Badge>;
    return <Badge variant="outline" className="text-[10px]"><MessageSquare className="w-2.5 h-2.5 mr-1" />Abierta</Badge>;
  };

  const handoverBadge = (c: ConversationItem) => {
    if (c.handover_status === "human_taken") return <Badge variant="default" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-1" />Humano</Badge>;
    if (c.handover_status === "human_listening") return <Badge variant="secondary" className="text-[10px]"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Escuchando</Badge>;
    if (c.handover_status === "resolved") return <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Resuelto</Badge>;
    if (!c.is_ai_active) return <Badge variant="destructive" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />IA Pausada</Badge>;
    return <Badge variant="outline" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />IA Activa</Badge>;
  };

  return (
    <div className="flex flex-col h-full border-r bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="p-3 border-b flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Conversaciones <Badge variant="secondary" className="ml-1">{filtered.length}</Badge></h3>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading} title="Actualizar lista" aria-label="Actualizar">
            <Loader2 className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar contacto o teléfono…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "whatsapp", "telegram", "email", "webchat"] as const).map(ch => (
              <Button
                key={ch}
                variant={selectedChannel === ch ? "default" : "ghost"}
                size="sm"
                className="px-2 py-1 text-xs"
                onClick={() => setSelectedChannel(ch)}
              >
                {ch === "all" ? "Todos" : <ChannelBadge type={ch} />}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-t pt-2">
          {([
            { id: "all" as Tab, label: "Todas", icon: <MessageSquare className="w-3 h-3" /> },
            { id: "handover" as Tab, label: "Por atender", icon: <Users className="w-3 h-3" /> },
            { id: "open" as Tab, label: "Abiertas", icon: <MessageSquare className="w-3 h-3" /> },
            { id: "completed" as Tab, label: "Completadas", icon: <CheckCircle2 className="w-3 h-3" /> },
          ]).map(t => (
            <Button
              key={t.id}
              variant={activeTab === t.id ? "default" : "ghost"}
              size="sm"
              className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5"
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Sin conversaciones</p>
            <p className="text-xs opacity-60">Ajusta filtros o crea una nueva</p>
          </div>
        ) : (
          <div className="divide-y divide-muted/50">
            {filtered.map(c => {
              const isSelected = selectedConversation?.id === c.id;
              const unread = c.handover_status === "human_taken" || c.handover_status === "human_listening";
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`w-full text-left p-3 transition-colors flex flex-col gap-1.5 ${
                    isSelected ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{c.contact_name ?? c.contact_phone ?? `Conv. ${c.id}`}</span>
                        <ChannelBadge type={c.channel_type as any} />
                        {c.conversation_type && <Badge variant="secondary" className="text-[9px]">{c.conversation_type}</Badge>}
                        {c.current_step && <Badge variant="secondary" className="text-[9px]">{c.current_step}</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-muted-foreground">
                        <span className="truncate">{c.contact_phone ?? "—"}</span>
                        {c.tags && c.tags.length > 0 && (
                          <span className="flex gap-1">
                            {c.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] h-4 px-1.5">{tag}</Badge>
                            ))}
                            {c.tags.length > 3 && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">+{c.tags.length - 3}</Badge>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {statusBadge(c)}
                        {handoverBadge(c)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {c.last_message_at ? getRelativeTime(c.last_message_at) : "—"}
                      </span>
                      {(unread || c.messages_count && c.messages_count > 0) && (
                        <Badge variant={unread ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">
                          {c.messages_count ?? 0}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}