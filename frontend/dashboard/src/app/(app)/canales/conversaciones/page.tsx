'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  MessageSquare, 
  Send, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  User,
  Phone,
  RefreshCw,
  Eye,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { channelsService, ChannelConfigItem, ChannelConversationItem } from '@/services/channels.service';
import { toast } from 'sonner';

export default function ConversacionesPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ChannelConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await channelsService.listOSChannels();
      setChannels(data);
      if (data.length > 0 && !selectedChannelId) {
        setSelectedChannelId(data[0].id);
        loadConversations(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Error loading channels:', e);
      setLoading(false);
    }
  };

  const loadConversations = async (channelId: number) => {
    try {
      setLoading(true);
      const convs = await channelsService.listOSConversations(channelId);
      setConversations(convs);
    } catch (e) {
      console.error('Error loading conversations:', e);
      toast.error('No se pudieron cargar las conversaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChannel = (id: number) => {
    setSelectedChannelId(id);
    loadConversations(id);
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = 
      (c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (c.contact_phone?.includes(searchTerm) || '');
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Radio className="w-6 h-6" />
            </div>
            Bandeja de Conversaciones Multicanal
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Supervisión y trazabilidad de interacciones de ciudadanos por WhatsApp y Telegram
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedChannelId && loadConversations(selectedChannelId)}
          className="border-white/10 hover:bg-white/5 text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Chats
        </Button>
      </div>

      {/* Channel selector strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs text-white/40 mr-2 font-medium shrink-0">Canal:</span>
        {channels.length === 0 ? (
          <div className="text-xs text-white/50 italic">No hay canales registrados aún.</div>
        ) : (
          channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => handleSelectChannel(ch.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedChannelId === ch.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 border border-violet-500'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {ch.channel_type === 'whatsapp' ? (
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Send className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{ch.channel_name || ch.phone_number || ch.bot_username || `Canal #${ch.id}`}</span>
            </button>
          ))
        )}
      </div>

      {/* Main Grid: List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: Conversations List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-white/30" />
              <Input
                placeholder="Buscar por nombre o celular..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-md text-xs px-2 py-2"
            >
              <option value="all" className="bg-zinc-900">Todos</option>
              <option value="open" className="bg-zinc-900">Abiertos</option>
              <option value="completed" className="bg-zinc-900">Completados</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredConversations.length === 0 ? (
              <Card className="border border-white/10 bg-white/[0.02]">
                <CardContent className="p-8 text-center text-white/40 text-xs">
                  No se encontraron conversaciones registradas en este canal.
                </CardContent>
              </Card>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  className="p-3.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs">
                        {conv.contact_name ? conv.contact_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white truncate max-w-[140px]">
                          {conv.contact_name || 'Ciudadano'}
                        </p>
                        <p className="text-[11px] text-white/40 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />
                          {conv.contact_phone || 'Sin número'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${conv.status === 'open' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-white/20 text-white/50'}`}>
                      {conv.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/40 border-t border-white/5 pt-2">
                    <span className="capitalize">{conv.conversation_type}</span>
                    <span>{conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right col: Conversation Preview / Auditor */}
        <div className="lg:col-span-2">
          <Card className="border border-white/10 bg-white/[0.02] min-h-[500px] flex flex-col justify-between">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">Asistente Agéntico Autónomo</CardTitle>
                    <p className="text-xs text-white/40">Interacciones orquestadas mediante LLM y flujos de admisión</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Supervisión Activa
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center items-center text-center">
              <div className="max-w-md space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-violet-400">
                  <Eye className="w-7 h-7" />
                </div>
                <h4 className="text-white font-semibold text-sm">Visualizador de Conversación en Tiempo Real</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  Selecciona una conversación del listado izquierdo para auditar los mensajes intercambiados, datos de postulación capturados por la IA y la puntuación de elegibilidad en vivo.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
