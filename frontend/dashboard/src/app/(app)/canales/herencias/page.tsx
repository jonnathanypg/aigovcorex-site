'use client';

import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Network, 
  MessageSquare, 
  Send, 
  ArrowRight, 
  CornerDownRight, 
  Building2, 
  FolderTree,
  RefreshCw,
  Info,
  CheckCircle2,
  Share2,
  Plus,
  Edit,
  Trash2,
  Eye,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsService, ChannelConfigItem } from '@/services/channels.service';
import { socialService, SocialProgram } from '@/services/social.service';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export default function HerenciasCanalPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Create inherited channel dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parentChannelId, setParentChannelId] = useState<number | null>(null);
  const [childChannelName, setChildChannelName] = useState('');
  const [childProgramId, setChildProgramId] = useState('');
  const [childAgentName, setChildAgentName] = useState('');
  const [childIsolationLevel, setChildIsolationLevel] = useState<'strict' | 'partial' | 'open'>('strict');
  const [childAccessLevel, setChildAccessLevel] = useState<'public' | 'program' | 'org' | 'private'>('program');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelConfigItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgentName, setEditAgentName] = useState('');
  const [editIsolationLevel, setEditIsolationLevel] = useState<'strict' | 'partial' | 'open'>('strict');
  const [editAccessLevel, setEditAccessLevel] = useState<'public' | 'program' | 'org' | 'private'>('program');
  const [editProgramId, setEditProgramId] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
      console.error('Error loading inheritance graph:', e);
      toast.error('Error al cargar árbol de herencias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInherited = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentChannelId || !childChannelName.trim() || !childProgramId) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    try {
      setCreating(true);
      await channelsService.createOSChannel({
        channel_type: channels.find(c => c.id === parentChannelId)?.channel_type || 'whatsapp',
        channel_name: childChannelName,
        ownership_type: 'inherited',
        parent_channel_id: parentChannelId,
        program_id: parseInt(childProgramId),
        agent_name: childAgentName || undefined,
        access_level: childAccessLevel,
        data_isolation_level: childIsolationLevel,
        status: 'disconnected',
      });
      toast.success('Canal heredado creado correctamente');
      setCreateDialogOpen(false);
      setChildChannelName('');
      setChildProgramId('');
      setChildAgentName('');
      setChildIsolationLevel('strict');
      setChildAccessLevel('program');
      setParentChannelId(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear canal heredado');
    } finally {
      setCreating(false);
    }
  };

  const handleEditChannel = (ch: ChannelConfigItem) => {
    setEditingChannel(ch);
    setEditName(ch.channel_name || '');
    setEditAgentName(ch.agent_name || '');
    setEditIsolationLevel(ch.data_isolation_level || 'strict');
    setEditAccessLevel(ch.access_level || 'program');
    setEditProgramId(ch.program_id ? String(ch.program_id) : '');
    setEditDialogOpen(true);
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel || !editName.trim()) {
      toast.error('Nombre requerido');
      return;
    }
    try {
      setUpdating(true);
      await channelsService.updateOSChannel(editingChannel.id, {
        channel_name: editName,
        agent_name: editAgentName || undefined,
        data_isolation_level: editIsolationLevel,
        access_level: editAccessLevel,
        program_id: editProgramId ? parseInt(editProgramId) : undefined,
      });
      toast.success('Canal actualizado');
      setEditDialogOpen(false);
      setEditingChannel(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteChannel = async (ch: ChannelConfigItem) => {
    const label = ch.channel_name || `${ch.channel_type.toUpperCase()} #${ch.id}`;
    if (!window.confirm(`¿Eliminar el canal heredado "${label}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      setDeletingId(ch.id);
      await channelsService.deleteOSChannel(ch.id);
      toast.success('Canal heredado eliminado');
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateDialog = (parentId: number) => {
    setParentChannelId(parentId);
    setCreateDialogOpen(true);
  };

  // Parent channels (dedicated or root)
  const rootChannels = channels.filter(c => !c.parent_channel_id && c.ownership_type !== 'inherited');

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <Layers className="w-6 h-6" />
              </div>
              Árbol de Herencias y Distribución de Canales
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Visualización jerárquica de cómo los canales institucionales se comparten y heredan hacia programas sociales
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Diagrama
          </Button>
        </div>

        {/* Concept Alert */}
        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] flex items-start gap-3">
          <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="text-xs text-white/70 space-y-1 leading-relaxed">
            <p className="font-semibold text-white">¿Cómo funciona la Herencia de Canales en GovCore OS?</p>
            <p>
              Una institución (Ministerio, Municipio u ONG) puede conectar un único número de <strong>WhatsApp Institucional</strong> o bot de <strong>Telegram</strong>. Luego, múltiples <strong>Programas Sociales</strong> (ej: Bono de Desarrollo, Alimentación Escolar) pueden heredar dicho canal sin necesidad de adquirir nuevos números telefónicos. La IA aísla los datos mediante <code className="text-violet-300">data_isolation_level</code> y reconoce el flujo del programa automáticamente.
            </p>
          </div>
        </div>

        {/* Inheritance Hierarchical View */}
        <div className="space-y-6">
          {rootChannels.length === 0 ? (
            <Card className="border border-white/10 bg-white/[0.02]">
              <CardContent className="p-12 text-center text-white/40 text-sm">
                <FolderTree className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p>No hay canales raíces configurados aún.</p>
                <p className="text-xs text-white/30 mt-1">Crea un canal raíz en la sección de Conexiones para visualizar su herencia.</p>
              </CardContent>
            </Card>
          ) : (
            rootChannels.map(root => {
              const childChannels = channels.filter(c => c.parent_channel_id === root.id);

              return (
                <Card key={root.id} className="border border-white/10 bg-white/[0.02]">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${root.channel_type === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'}`}>
                          {root.channel_type === 'whatsapp' ? <MessageSquare className="w-6 h-6" /> : <Send className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-white text-base font-bold">{root.channel_name || 'Canal Matriz'}</CardTitle>
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                              CANAL RAÍZ
                            </Badge>
                          </div>
                          <p className="text-xs text-white/40 mt-0.5">
                            {root.phone_number || root.bot_username || 'Canal Oficial del Tenant'} • Nivel: {root.access_level || 'org'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-violet-300 border-violet-500/40 bg-violet-500/10">
                          {childChannels.length} Programas Heredando
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateDialog(root.id)}
                          className="border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Crear Herencia
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    {childChannels.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                        Este canal aún no tiene subprogramas heredando tráfico.
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                          onClick={() => openCreateDialog(root.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Crear primera herencia
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Programas Dependientes:</p>
                        {childChannels.map(child => {
                          const prog = programs.find(p => p.id === child.program_id);

                          return (
                            <div
                              key={child.id}
                              className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5 ml-6 relative before:content-[''] before:absolute before:-left-4 before:top-1/2 before:w-4 before:h-[1px] before:bg-white/20"
                            >
                              <div className="flex items-center gap-3">
                                <CornerDownRight className="w-4 h-4 text-violet-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {child.channel_name || prog?.name || `Programa #${child.program_id}`}
                                  </p>
                                  <p className="text-xs text-white/40">
                                    Agente asignado: <span className="text-violet-300">{child.agent_name || 'Agente Local'}</span> • Aislamiento: {child.data_isolation_level || 'strict'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-white/10 text-white/70 text-[10px]">
                                  HERENCIA DIRECTA
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditChannel(child)}
                                  disabled={updating}
                                  className="text-white/50 hover:text-white"
                                  title="Editar canal heredado"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteChannel(child)}
                                  disabled={deletingId === child.id}
                                  className="text-rose-400 hover:text-rose-300"
                                  title="Eliminar canal heredado"
                                >
                                  {deletingId === child.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Create Inherited Channel Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Crear Canal Heredado</DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Configura un nuevo canal que hereda la conexión de un canal matriz existente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInherited} className="space-y-4 mt-2">
            <input type="hidden" value={parentChannelId} onChange={e => setParentChannelId(Number(e.target.value))} />
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Canal Matriz (Padre)</Label>
              <select
                value={parentChannelId || ''}
                onChange={e => setParentChannelId(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                disabled
              >
                {rootChannels.filter(c => c.id === parentChannelId).map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">
                    {c.channel_name || `${c.channel_type.toUpperCase()} #${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Nombre del Canal Heredado</Label>
              <Input
                placeholder="Ej: WhatsApp Programa BDH"
                value={childChannelName}
                onChange={e => setChildChannelName(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Programa Social <span className="text-rose-400">*</span></Label>
              <Select value={childProgramId} onValueChange={setChildProgramId}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                  <SelectValue placeholder="Seleccionar programa..." />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.short_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Agente IA Asignado</Label>
              <Input
                placeholder="Ej: Agente BDH"
                value={childAgentName}
                onChange={e => setChildAgentName(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Nivel de Aislamiento</Label>
                <Select value={childIsolationLevel} onValueChange={setChildIsolationLevel}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Estricto (datos aislados)</SelectItem>
                    <SelectItem value="partial">Parcial (algunos datos compartidos)</SelectItem>
                    <SelectItem value="open">Abierto (datos visibles)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Nivel de Acceso</Label>
                <Select value={childAccessLevel} onValueChange={setChildAccessLevel}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">Programa</SelectItem>
                    <SelectItem value="org">Organización</SelectItem>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" disabled={creating} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium">
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Crear Canal Heredado
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Editar Canal Heredado</DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Modifica la configuración del canal heredado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateChannel} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Nombre del Canal</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Agente IA Asignado</Label>
              <Input
                placeholder="Ej: Agente BDH"
                value={editAgentName}
                onChange={e => setEditAgentName(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Programa Social</Label>
              <Select value={editProgramId} onValueChange={setEditProgramId}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin asignar</SelectItem>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.short_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Nivel de Aislamiento</Label>
                <Select value={editIsolationLevel} onValueChange={setEditIsolationLevel}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Estricto</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="open">Abierto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Nivel de Acceso</Label>
                <Select value={editAccessLevel} onValueChange={setEditAccessLevel}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">Programa</SelectItem>
                    <SelectItem value="org">Organización</SelectItem>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" disabled={updating} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium">
                {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}