"use client";
/** Bandeja unificada (inbox) estilo aikrofy: 3 columnas
 *  Izq: ConversationList con tabs/filtros
 *  Centro: ConversationView con hilo + composer
 *  Der: ContactProfileSidebar (lg:flex)
 *  Filtros globales: programa (Ver todo / lista), canal, estado
 */
import React, { useEffect, useState } from "react";
import { Inbox, Filter, ChevronDown, RefreshCw, Loader2, Plus, MessageSquare } from "lucide-react";
import { ConversationList, type Tab } from "@/components/channels/inbox/ConversationList";
import { ConversationView } from "@/components/channels/inbox/ConversationView";
import { ContactProfileSidebar } from "@/components/channels/inbox/ContactProfileSidebar";
import { channelsService, ChannelConversationItem, ChannelConfigItem } from "@/services/channels.service";
import { socialService, SocialProgram } from "@/services/social.service";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function BandejaPage() {
  const [conversations, setConversations] = useState<ChannelConversationItem[]>([]);
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ChannelConversationItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"all" | "whatsapp" | "telegram" | "email" | "webchat">("all");
  const [selectedProgram, setSelectedProgram] = useState<string>("all"); // "all" | program_id
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [convs, chs, progs] = await Promise.all([
        channelsService.listAllConversations({
          program_id: selectedProgram === "all" ? undefined : parseInt(selectedProgram),
          channel_id: undefined,
          channel_type: selectedChannel === "all" ? undefined : selectedChannel,
          status: activeTab === "all" ? undefined : (activeTab === "completed" ? "completed" : activeTab),
          search: searchTerm || undefined,
        }),
        channelsService.listOSChannels(),
        socialService.getPrograms(),
      ]);
      setConversations(convs);
      setChannels(chs);
      setPrograms(progs);
    } catch (e) {
      console.error("Error loading bandeja:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedProgram, selectedChannel, activeTab, searchTerm]);

  const handleSend = async (content: string, pauseAI: boolean) => {
    if (!selectedConversation) return;
    setSending(true);
    try {
      await channelsService.replyConversation(selectedConversation.id, content, pauseAI);
      // Recarga la conversación seleccionada para ver el mensaje nuevo
      const updated = await channelsService.getOSConversation(selectedConversation.id);
      if (updated) setSelectedConversation(updated);
    } catch (e) {
      console.error("Error sending:", e);
    } finally {
      setSending(false);
    }
  };

  const handleToggleResolved = async (resolved: boolean) => {
    if (!selectedConversation) return;
    await channelsService.updateConversationStatus(selectedConversation.id, { is_resolved: resolved });
    const updated = await channelsService.getOSConversation(selectedConversation.id);
    if (updated) setSelectedConversation(updated);
  };

  const handleToggleAI = async (active: boolean) => {
    if (!selectedConversation) return;
    await channelsService.updateConversationStatus(selectedConversation.id, { is_ai_active: active });
    const updated = await channelsService.getOSConversation(selectedConversation.id);
    if (updated) setSelectedConversation(updated);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Bandeja Unificada <Inbox className="w-5 h-5 inline ml-1" /></h1>
          <Badge variant="secondary">{conversations.length}</Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Programa */}
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Programa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver todos</SelectItem>
              {programs.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Canal */}
          <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as "all" | "whatsapp" | "telegram" | "email" | "webchat")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="webchat">Web Chat</SelectItem>
            </SelectContent>
          </Select>
          {/* Tab */}
          <div className="flex border rounded-lg bg-muted/50 p-0.5" role="tablist">
            {([
              { id: "all" as Tab, label: "Todas" },
              { id: "handover" as Tab, label: "Por atender" },
              { id: "open" as Tab, label: "Abiertas" },
              { id: "completed" as Tab, label: "Completadas" },
            ]).map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={loadData} disabled={loading} title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 3 columnas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Columna izquierda: Lista */}
        <div className="w-80 lg:w-96 flex-shrink-0 border-r">
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelect={setSelectedConversation}
            onRefresh={loadData}
            isLoading={loading}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedChannel={selectedChannel}
            setSelectedChannel={setSelectedChannel}
          />
        </div>

        {/* Columna centro: Hilo + Composer */}
        <div className="flex-1 min-w-0">
          <ConversationView
            conversation={selectedConversation as any}
            onSend={handleSend}
            onToggleResolved={handleToggleResolved}
            onToggleAI={handleToggleAI}
            isSending={sending}
            isResolved={selectedConversation?.status === "completed"}
            isAIActive={selectedConversation?.is_ai_active !== false}
            showSidebar={showSidebar}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
          />
        </div>

        {/* Columna derecha: Perfil contacto (solo lg, colapsable) */}
        <div className="hidden lg:flex w-80 border-l transition-all duration-300 ease-in-out overflow-hidden" style={{ width: showSidebar ? '320px' : '0' }}>
          {showSidebar && (
            <ContactProfileSidebar
              conversation={selectedConversation}
              onOpenCRM={(customerId) => {
                window.open(`/canales/bandeja/crm/${customerId}`, "_blank");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

