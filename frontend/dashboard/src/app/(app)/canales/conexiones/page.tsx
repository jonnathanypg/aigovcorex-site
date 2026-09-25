'use client';

import React, { useState, useEffect } from 'react';
import { 
  Network, 
  MessageSquare, 
  Send, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sliders,
  Shield,
  Layers,
  Building,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from '@/components/ui/dialog';
import { channelsService, ChannelConfigItem } from '@/services/channels.service';
import { socialService, SocialProgram } from '@/services/social.service';
import { toast } from 'sonner';

export default function ConexionesPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [channelType, setChannelType] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [channelName, setChannelName] = useState('');
  const [ownershipType, setOwnershipType] = useState<'dedicated' | 'inherited' | 'shared'>('dedicated');
  const [programId, setProgramId] = useState<string>('');
  const [parentChannelId, setParentChannelId] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<'program' | 'org' | 'public'>('program');
  const [agentName, setAgentName] = useState('GovCore AI');

  const loadData = async () => {
    try {
      setLoading(true);
      const [chList, prList] = await Promise.all([
        channelsService.listOSChannels(),
        socialService.getPrograms().catch(() => [])
      ]);
      setChannels(chList);
      setPrograms(prList);
    } catch (e) {
      console.error('Error loading connections:', e);
      toast.error('Error al cargar conexiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) {
      toast.error('Por favor indique un nombre para la conexión');
      return;
    }

    try {
      setCreating(true);
      await channelsService.createOSChannel({
        channel_type: channelType,
        channel_name: channelName,
        ownership_type: ownershipType,
        program_id: programId ? parseInt(programId) : undefined,
        parent_channel_id: parentChannelId ? parseInt(parentChannelId) : undefined,
        access_level: accessLevel,
        agent_name: agentName,
        status: ownershipType === 'inherited' ? 'connected' : 'disconnected'
      });
      toast.success('Conexión de canal registrada con éxito');
      setIsDialogOpen(false);
      // Reset
      setChannelName('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear conexión');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Network className="w-6 h-6" />
            </div>
            Conexiones de Canal por Programa y Entidad
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Mapeo de instancias de WhatsApp y Telegram vinculadas a programas sociales o heredadas de la matriz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-500 text-white font-medium">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Conexión
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white text-lg">Vincular Canal de Comunicación</DialogTitle>
                <DialogDescription className="text-white/50 text-xs">
                  Crea un canal dedicado o hereda uno existente para un programa social específico.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateChannel} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Tipo de Canal</Label>
                    <select
                      value={channelType}
                      onChange={(e: any) => setChannelType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="whatsapp" className="bg-zinc-900">WhatsApp</option>
                      <option value="telegram" className="bg-zinc-900">Telegram</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Modalidad</Label>
                    <select
                      value={ownershipType}
                      onChange={(e: any) => setOwnershipType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="dedicated" className="bg-zinc-900">Dedicado (Propio)</option>
                      <option value="inherited" className="bg-zinc-900">Heredado (De Matriz)</option>
                      <option value="shared" className="bg-zinc-900">Compartido</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Nombre Identificador</Label>
                  <Input
                    placeholder="Ej: Canal Oficial MIES o WhatsApp Programa BDH"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Asignar a Programa Social (Opcional)</Label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="" className="bg-zinc-900">Sin asignar (Canal Institucional Matriz)</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        {p.name} ({p.short_code})
                      </option>
                    ))}
                  </select>
                </div>

                {ownershipType === 'inherited' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Heredar de Canal Matriz</Label>
                    <select
                      value={parentChannelId}
                      onChange={(e) => setParentChannelId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="" className="bg-zinc-900">Seleccionar canal padre...</option>
                      {channels.filter(c => c.ownership_type === 'dedicated').map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900">
                          {c.channel_name || `${c.channel_type.toUpperCase()} #${c.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Nombre del Agente IA que Atenderá</Label>
                  <Input
                    placeholder="Ej: Asistente Kindi o Agente BDH"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>

                <div className="pt-3">
                  <Button 
                    type="submit" 
                    disabled={creating}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium"
                  >
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Registrar Conexión
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid of Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-white/10 rounded-2xl bg-white/[0.02]">
            <Network className="w-10 h-10 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">No se encontraron conexiones de canales registradas.</p>
            <p className="text-xs text-white/40 mt-1">Haz clic en "Nueva Conexión" para crear o heredar canales.</p>
          </div>
        ) : (
          channels.map(ch => (
            <Card key={ch.id} className="border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${ch.channel_type === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                      {ch.channel_type === 'whatsapp' ? <MessageSquare className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-white text-sm font-semibold">{ch.channel_name || 'Canal sin nombre'}</CardTitle>
                      <p className="text-[11px] text-white/40 uppercase tracking-wider">{ch.channel_type}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${ch.status === 'connected' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-zinc-500/40 text-zinc-400'}`}>
                    {ch.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-white/60 border-t border-white/5 pt-2">
                  <span>Modalidad:</span>
                  <Badge className="bg-white/10 text-white text-[10px] uppercase">{ch.ownership_type}</Badge>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>Agente IA:</span>
                  <span className="text-white font-medium">{ch.agent_name || 'Predeterminado'}</span>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>Mensajes Procesados:</span>
                  <span className="text-white font-medium">{ch.message_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
