'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Sparkles,
  Bot,
  Variable
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TemplateItem {
  id: string;
  name: string;
  trigger: string;
  channel: 'all' | 'whatsapp' | 'telegram';
  content: string;
  variables: string[];
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([
    {
      id: '1',
      name: 'Bienvenida a Postulante Social',
      trigger: 'Primer mensaje del ciudadano',
      channel: 'all',
      content: '¡Hola {{nombre}}! 👋 Bienvenido al portal de atención ciudadana de {{institucion}}. Soy el asistente agéntico inteligente. Para postular al programa {{programa}}, por favor indícame tu número de cédula.',
      variables: ['nombre', 'institucion', 'programa']
    },
    {
      id: '2',
      name: 'Confirmación de Postulación Aprobada',
      trigger: 'Elegibilidad score >= 70',
      channel: 'whatsapp',
      content: 'Estimado/a {{nombre}}, su solicitud al {{programa}} ha sido pre-aprobada con éxito (ID: {{solicitud_id}}). Un coordinador social se contactará al {{telefono}}.',
      variables: ['nombre', 'programa', 'solicitud_id', 'telefono']
    },
    {
      id: '3',
      name: 'Alerta de Control de Citas y Salud CDI',
      trigger: 'Recordatorio programado',
      channel: 'all',
      content: 'Recordatorio de KindiCore AI: Mañana {{fecha}} corresponde el control de peso y talla para el niño/a {{nombre_infante}} en el centro {{centro_nombre}}.',
      variables: ['fecha', 'nombre_infante', 'centro_nombre']
    }
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Plantilla copiada al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <FileText className="w-6 h-6" />
            </div>
            Plantillas de Mensajería Agéntica
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Respuestas automáticas, notificaciones de elegibilidad y plantillas de bienvenida multicanal
          </p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-500 text-white font-medium">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map(t => (
          <Card key={t.id} className="border border-white/10 bg-white/[0.02] flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-white text-base font-bold">{t.name}</CardTitle>
                  <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    {t.trigger}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-violet-300 border-violet-500/30 bg-violet-500/10 uppercase">
                  {t.channel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70 leading-relaxed font-sans">
                {t.content}
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {t.variables.map(v => (
                    <span key={v} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-white/60 font-mono">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(t.id, t.content)}
                  className="w-full border-white/10 hover:bg-white/5 text-white text-xs"
                >
                  {copiedId === t.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copiar Mensaje
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
