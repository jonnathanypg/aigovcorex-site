'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Sparkles,
  Bot,
  Variable,
  Loader2,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { channelsService, ChannelTemplateItem } from '@/services/channels.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormData {
  name: string;
  description: string;
  trigger: string;
  channel: 'all' | 'whatsapp' | 'telegram' | 'email' | 'webchat';
  content: string;
  variables: string;
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<ChannelTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChannelTemplateItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    trigger: '',
    channel: 'all',
    content: '',
    variables: '',
  });

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await channelsService.listTemplates({ include_system: true });
      setTemplates(data);
    } catch (e) {
      console.error('Error loading templates:', e);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger: '',
      channel: 'all',
      content: '',
      variables: '',
    });
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (template: ChannelTemplateItem) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      trigger: template.trigger || '',
      channel: template.channel as FormData['channel'],
      content: template.content,
      variables: template.variables.join(', '),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Nombre y contenido son requeridos');
      return;
    }

    try {
      setSaving(true);
      const variables = formData.variables.split(',').map(v => v.trim()).filter(Boolean);
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        trigger: formData.trigger || undefined,
        channel: formData.channel,
        content: formData.content,
        variables,
      };

      if (editingTemplate) {
        await channelsService.updateTemplate(editingTemplate.id, payload);
        toast.success('Plantilla actualizada');
      } else {
        await channelsService.createTemplate(payload);
        toast.success('Plantilla creada');
      }
      setDialogOpen(false);
      resetForm();
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: ChannelTemplateItem) => {
    if (template.is_system) {
      toast.error('Las plantillas del sistema no se pueden eliminar');
      return;
    }
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    try {
      await channelsService.deleteTemplate(template.id);
      toast.success('Plantilla eliminada');
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Plantilla copiada al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await channelsService.seedDefaultTemplates();
      toast.success(res.message);
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear plantillas por defecto');
    }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={loading}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Cargar Plantillas Base
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-500 text-white font-medium">
                <Plus className="w-4 h-4 mr-2" />
                {editingTemplate ? 'Editar' : 'Nueva'} Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  {editingTemplate ? 'Editar Plantilla' : 'Crear Nueva Plantilla'}
                </DialogTitle>
                <DialogDescription className="text-white/50 text-xs">
                  Define el contenido con variables {{variable}} para personalización automática.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Nombre <span className="text-rose-400">*</span></Label>
                  <Input
                    placeholder="Ej: Bienvenida Postulante"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Descripción</Label>
                  <Input
                    placeholder="Cuándo se usa esta plantilla"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Disparador (Trigger)</Label>
                  <Select value={formData.trigger} onValueChange={v => setFormData({ ...formData, trigger: v })}>
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                      <SelectValue placeholder="Ej: first_message, eligibility_approved..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_message">Primer mensaje (first_message)</SelectItem>
                      <SelectItem value="eligibility_approved">Elegibilidad aprobada</SelectItem>
                      <SelectItem value="appointment_reminder">Recordatorio de cita</SelectItem>
                      <SelectItem value="document_ready">Documento listo</SelectItem>
                      <SelectItem value="critical_alert">Alerta crítica</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Canal</Label>
                  <Select value={formData.channel} onValueChange={v => setFormData({ ...formData, channel: v as FormData['channel'] })}>
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos (WhatsApp + Telegram + Email + Web)</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="webchat">Web Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Contenido <span className="text-rose-400">*</span></Label>
                  <Textarea
                    placeholder="Ej: ¡Hola {{nombre}}! Bienvenido a {{institucion}}..."
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    className="bg-white/5 border-white/10 text-white text-xs min-h-[120px] font-sans"
                    rows={5}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">Variables (separadas por coma)</Label>
                  <Input
                    placeholder="nombre, institucion, programa"
                    value={formData.variables}
                    onChange={e => setFormData({ ...formData, variables: e.target.value })}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                  <p className="text-[10px] text-white/40">Ej: nombre, institucion, programa, fecha, centro_nombre</p>
                </div>

                <div className="pt-3 flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="flex-1 border-white/10 hover:bg-white/5 text-white">
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border border-white/10 bg-white/[0.02] animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-white/10 rounded" />
              </CardContent>
            </Card>
          ))
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-12 border border-white/10 rounded-2xl bg-white/[0.02]">
            <FileText className="w-10 h-10 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">No hay plantillas configuradas.</p>
            <p className="text-xs text-white/40 mt-1">Haz clic en "Nueva Plantilla" o "Cargar Plantillas Base" para empezar.</p>
          </div>
        ) : (
          templates.map(t => (
            <Card key={t.id} className="border border-white/10 bg-white/[0.02] flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base font-bold truncate">{t.name}</CardTitle>
                    <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      {t.trigger || 'Sin trigger'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] text-violet-300 border-violet-500/30 bg-violet-500/10 uppercase">
                      {t.channel}
                    </Badge>
                    {t.is_system && (
                      <Badge variant="secondary" className="text-[10px] text-amber-300 border-amber-500/30 bg-amber-500/10">
                        Sistema
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70 leading-relaxed font-sans max-h-32 overflow-y-auto">
                  {t.content}
                </div>

                <div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {t.variables.map(v => (
                      <span key={v} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-white/60 font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                    {t.variables.length === 0 && (
                      <span className="text-[10px] text-white/30 italic">Sin variables</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(t.id, t.content)}
                      className="flex-1 border-white/10 hover:bg-white/5 text-white text-xs"
                    >
                      {copiedId === t.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Copiar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(t)}
                      className="text-white/50 hover:text-white"
                      title="Editar"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    {!t.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(t)}
                        className="text-rose-400 hover:text-rose-300"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}