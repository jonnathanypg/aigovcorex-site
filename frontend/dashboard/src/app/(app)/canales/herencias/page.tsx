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
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsService, ChannelConfigItem } from '@/services/channels.service';
import { socialService, SocialProgram } from '@/services/social.service';
import { toast } from 'sonner';

export default function HerenciasCanalPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Parent channels (dedicated or root)
  const rootChannels = channels.filter(c => !c.parent_channel_id && c.ownership_type !== 'inherited');

  return (
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
                    <Badge variant="outline" className="text-xs text-violet-300 border-violet-500/40 bg-violet-500/10">
                      {childChannels.length} Programas Heredando
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {childChannels.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                      Este canal aún no tiene subprogramas heredando tráfico.
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
  );
}
