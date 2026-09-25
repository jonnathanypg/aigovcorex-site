'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Send, 
  Network, 
  CheckCircle2, 
  Clock, 
  Radio, 
  Layers, 
  Plus, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsService, ChannelConfigItem } from '@/services/channels.service';

export default function CanalesDashboardPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [stats, setStats] = useState<{
    channels: { total: number; whatsapp: number; telegram: number; connected: number };
    conversations: { total: number; open: number; completed: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [chList, statsData] = await Promise.all([
        channelsService.listOSChannels().catch(() => []),
        channelsService.getOSStats().catch(() => null)
      ]);
      setChannels(chList);
      setStats(statsData);
    } catch (e) {
      console.error('Error loading channels dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <MessageSquare className="w-6 h-6" />
            </div>
            Canales de Comunicación y Multicanalidad
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión unificada de WhatsApp, Telegram, herencia a programas sociales y asistentes agénticos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/canales/conexiones">
            <Button className="bg-violet-600 hover:bg-violet-500 text-white font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Conexión
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Canales Registrados</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.channels?.total || channels.length || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Network className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/[0.02]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Instancias Conectadas</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {stats?.channels?.connected || channels.filter(c => c.status === 'connected').length || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/[0.02]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Conversaciones Activas</p>
              <p className="text-2xl font-bold text-sky-400 mt-1">{stats?.conversations?.open || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Radio className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-white/[0.02]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Herencias Activas</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">
                {channels.filter(c => c.ownership_type === 'inherited').length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/canales/whatsapp" className="group">
          <Card className="border border-white/10 bg-white/[0.02] hover:bg-emerald-500/[0.04] hover:border-emerald-500/30 transition-all p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-white font-bold text-base">WhatsApp Institucional</h3>
            <p className="text-xs text-white/50 mt-1">Conecta sesiones Baileys por QR, configura números admin y webhook.</p>
          </Card>
        </Link>

        <Link href="/canales/telegram" className="group">
          <Card className="border border-white/10 bg-white/[0.02] hover:bg-sky-500/[0.04] hover:border-sky-500/30 transition-all p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
                <Send className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-white font-bold text-base">Telegram Oficial</h3>
            <p className="text-xs text-white/50 mt-1">Vincula bots mediante Token, asigna comandos y enlaza cuentas de personal.</p>
          </Card>
        </Link>

        <Link href="/canales/herencias" className="group">
          <Card className="border border-white/10 bg-white/[0.02] hover:bg-violet-500/[0.04] hover:border-violet-500/30 transition-all p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400">
                <Layers className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-white font-bold text-base">Árbol de Herencias</h3>
            <p className="text-xs text-white/50 mt-1">Permite a los subprogramas usar el canal matriz sin costo adicional de líneas.</p>
          </Card>
        </Link>
      </div>

      {/* Active Channels List */}
      <Card className="border border-white/10 bg-white/[0.02]">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-base">Canales y Programas Vinculados</CardTitle>
            <CardDescription className="text-white/50 text-xs">Estado en tiempo real de los canales activos en la entidad</CardDescription>
          </div>
          <Link href="/canales/conexiones" className="text-xs text-violet-400 hover:underline flex items-center gap-1">
            Ver todos los canales <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="text-center py-8 text-xs text-white/40">
              No hay canales registrados. Ve a <Link href="/canales/whatsapp" className="text-emerald-400 underline">WhatsApp</Link> o <Link href="/canales/telegram" className="text-sky-400 underline">Telegram</Link> para conectar el primero.
            </div>
          ) : (
            <div className="space-y-3">
              {channels.slice(0, 5).map(ch => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${ch.channel_type === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                      {ch.channel_type === 'whatsapp' ? <MessageSquare className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{ch.channel_name || `Canal #${ch.id}`}</p>
                      <p className="text-xs text-white/40">
                        {ch.phone_number || ch.bot_username || 'Canal compartido'} • Modalidad: <span className="capitalize text-white/60">{ch.ownership_type}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-[10px] ${ch.status === 'connected' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-zinc-500/40 text-zinc-400'}`}>
                      {ch.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
