'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    FileCode2,
    Plus,
    Sparkles,
    Eye,
    MessageSquare,
    SlidersHorizontal,
    Layers,
    Loader2,
    CheckCircle2,
    ArrowRight,
    RefreshCw,
    Pencil,
    Trash2,
    Save,
    Mic,
    Square,
    Wand2,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { socialService, type SocialProgram, type ProgramFormDefinition, type FormField } from '@/services/social.service';
import { chatService } from '@/services/chat.service';
import { DynamicFormRenderer } from '@/components/social/dynamic-form-renderer';

const FIELD_TYPES: Array<FormField['type']> = ['text', 'number', 'currency', 'select', 'boolean', 'date', 'cedula', 'file'];

export default function FormulariosDinamicosPage() {
    const [programs, setPrograms] = useState<SocialProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProgram, setSelectedProgram] = useState<SocialProgram | null>(null);
    const [activeFormDef, setActiveFormDef] = useState<ProgramFormDefinition | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewMode, setPreviewMode] = useState<'web_form' | 'conversational'>('web_form');

    // AI Copilot Generator State
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiProgramName, setAiProgramName] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Voice dictation state (mic en el textarea del Copiloto IA)
    const [isRecordingPrompt, setIsRecordingPrompt] = useState(false);
    const [isTranscribingPrompt, setIsTranscribingPrompt] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Editor visual de campos (punto 3: editar/agregar/eliminar tras crear con IA)
    const [editOpen, setEditOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<SocialProgram | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editSuccess, setEditSuccess] = useState('');
    const [editFields, setEditFields] = useState<FormField[]>([]);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [regenPrompt, setRegenPrompt] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

    const loadPrograms = async () => {
        try {
            setIsLoading(true);
            const data = await socialService.getPrograms();
            setPrograms(data);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al cargar programas');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPrograms();
    }, []);

    const openPreview = async (prog: SocialProgram, mode: 'web_form' | 'conversational') => {
        try {
            setSelectedProgram(prog);
            setPreviewMode(mode);
            const form = await socialService.getProgramForm(prog.id);
            setActiveFormDef(form);
            setPreviewOpen(true);
        } catch {
            toast.error('Error al cargar la definición del formulario');
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Por favor escribe las instrucciones o perfil del programa para la IA.');
            return;
        }

        try {
            setIsGeneratingAI(true);
            const newProgram = await socialService.aiCreateFullProgram(
                aiPrompt,
                aiProgramName.trim() || undefined
            );

            toast.success(`¡Programa y formulario creados con IA!`);
            setAiModalOpen(false);
            setAiPrompt('');
            setAiProgramName('');
            await loadPrograms();

            // Open preview immediately
            if (newProgram && newProgram.id) {
                openPreview(newProgram, 'web_form');
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error en el generador agéntico');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // ── Dictado por voz del detalle del programa (usa /api/voice/transcribe) ──
    const togglePromptRecording = async () => {
        if (isRecordingPrompt) {
            mediaRecorderRef.current?.stop();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                setIsRecordingPrompt(false);
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size === 0) return;
                try {
                    setIsTranscribingPrompt(true);
                    const res = await chatService.transcribeDictation(blob);
                    const txt = (res?.transcription || '').trim();
                    if (txt) {
                        setAiPrompt((prev) => (prev ? `${prev} ${txt}` : txt));
                        toast.success('Dictado transcrito e insertado');
                    } else {
                        toast.error('No se pudo transcribir el audio');
                    }
                } catch {
                    toast.error('Error al transcribir el dictado');
                } finally {
                    setIsTranscribingPrompt(false);
                }
            };
            mr.start();
            setIsRecordingPrompt(true);
        } catch {
            toast.error('No se pudo acceder al micrófono');
        }
    };

    // ── Editor visual: abrir / manipular / guardar ──
    const openEditor = async (prog: SocialProgram) => {
        try {
            setEditingProgram(prog);
            const form = await socialService.getProgramForm(prog.id);
            setEditTitle(form.form_title || `Formulario: ${prog.name}`);
            setEditDescription(form.form_description || '');
            setEditSuccess(form.success_message || '');
            setEditFields(form.fields || []);
            setRegenPrompt('');
            setEditOpen(true);
        } catch {
            toast.error('Error al cargar el formulario para editar');
        }
    };

    const patchField = (idx: number, patch: Partial<FormField>) => {
        setEditFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

    const addField = () => {
        const nid = `campo_${Date.now().toString(36)}`;
        setEditFields((prev) => [
            ...prev,
            {
                id: nid,
                label: 'Nuevo campo',
                type: 'text',
                required: true,
                placeholder: '',
                conversational_prompt: 'Por favor indíqueme su Nuevo campo:',
                section_id: 'datos_titular',
            },
        ]);
    };

    const removeField = (idx: number) => {
        setEditFields((prev) => prev.filter((_, i) => i !== idx));
    };

    const moveField = (idx: number, dir: -1 | 1) => {
        setEditFields((prev) => {
            const next = [...prev];
            const j = idx + dir;
            if (j < 0 || j >= next.length) return prev;
            [next[idx], next[j]] = [next[j], next[idx]];
            return next;
        });
    };

    const buildSectionsForSave = () => {
        const groups: Record<string, string[]> = {};
        editFields.forEach((f) => {
            const sid = f.section_id || 'datos_titular';
            (groups[sid] = groups[sid] || []).push(f.id);
        });
        const titles: Record<string, string> = {
            datos_titular: '1. Datos del Solicitante / Titular',
            datos_nino: '2. Datos del Niño/a',
            composicion_hogar: '3. Composición Familiar & Vulnerabilidad',
            socioeconomico: '4. Situación Socioeconómica & Vivienda',
        };
        return Object.entries(groups).map(([sid, ids], i) => ({
            id: sid,
            title: titles[sid] || `${i + 1}. ${sid}`,
            description: '',
            field_ids: ids,
        }));
    };

    const saveEditor = async () => {
        if (!editingProgram) return;
        const ids = editFields.map((f) => f.id.trim()).filter(Boolean);
        if (new Set(ids).size !== ids.length) {
            toast.error('Hay IDs de campo duplicados. Cada campo debe tener un ID único.');
            return;
        }
        if (editFields.some((f) => !f.label.trim() || !f.id.trim())) {
            toast.error('Cada campo necesita ID y etiqueta.');
            return;
        }
        try {
            setIsSavingEdit(true);
            await socialService.updateProgramForm(editingProgram.id, {
                form_title: editTitle,
                form_description: editDescription,
                fields: editFields,
                sections: buildSectionsForSave(),
                success_message: editSuccess,
            });
            toast.success('Formulario actualizado');
            setEditOpen(false);
            await loadPrograms();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al guardar el formulario');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleRegenerateEditor = async () => {
        if (!editingProgram || !regenPrompt.trim()) {
            toast.error('Escribe qué quieres cambiar para regenerar con IA.');
            return;
        }
        try {
            setIsRegenerating(true);
            const updated = await socialService.generateFormWithAI(editingProgram.id, regenPrompt);
            setEditTitle(updated.form_title || editTitle);
            setEditDescription(updated.form_description || '');
            setEditSuccess(updated.success_message || '');
            setEditFields(updated.fields || []);
            toast.success('Formulario regenerado con IA. Revísalo y guarda.');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al regenerar con IA');
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileCode2 className="w-6 h-6 text-sky-400" />
                        Formularios Dinámicos & Intake Omnicanal
                    </h1>
                    <p className="text-white/50 text-sm mt-1">
                        Cada programa posee su propio esquema de datos personalizado, autogenerable por el Copiloto IA y operable en Web Wizard o Chat 24/7
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPrograms}
                        className="border-white/10 text-white hover:bg-white/10 text-xs gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                    </Button>
                    <Button
                        onClick={() => setAiModalOpen(true)}
                        className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold gap-1.5 shadow-md"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> Crear Formulario con Copiloto IA
                    </Button>
                </div>
            </div>

            {/* List of Programs & Forms */}
            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-white/50 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <span>Cargando formularios dinámicos...</span>
                </div>
            ) : programs.length === 0 ? (
                <Card className="bg-zinc-900/40 border-white/10 p-12 text-center text-white space-y-3">
                    <Layers className="w-10 h-10 text-sky-400 mx-auto opacity-60" />
                    <h3 className="font-bold text-base">No hay programas sociales registrados</h3>
                    <p className="text-xs text-white/50 max-w-sm mx-auto">
                        Usa el Copiloto IA para generar tu primer programa social y su estructura de formulario dinámico en segundos.
                    </p>
                    <Button
                        onClick={() => setAiModalOpen(true)}
                        className="bg-sky-600 hover:bg-sky-700 text-white text-xs gap-1.5"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> Crear con Copiloto IA
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {programs.map((prog) => {
                        const fieldsCount = prog.form_definition?.fields?.length || 10;
                        const version = prog.form_definition?.version || 1;

                        return (
                            <Card
                                key={prog.id}
                                className="bg-zinc-900/60 border-white/10 backdrop-blur-md text-white hover:border-sky-500/40 transition-all flex flex-col justify-between"
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <Badge variant="outline" className="text-[10px] font-mono border-white/15 text-white/70 mb-1.5">
                                                {prog.short_code}
                                            </Badge>
                                            <CardTitle className="text-base font-bold text-white line-clamp-1">
                                                {prog.name}
                                            </CardTitle>
                                        </div>
                                        <Badge
                                            className={
                                                prog.status === 'active'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                    : 'bg-zinc-800 text-zinc-400'
                                            }
                                        >
                                            {prog.status === 'active' ? 'Activo' : prog.status}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-xs text-white/50 line-clamp-2 mt-1">
                                        {prog.description || 'Sin descripción'}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4 pt-0">
                                    <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-zinc-950/40 border border-white/5 text-white/70">
                                        <div>
                                            <span className="text-white/40 block text-[10px]">Campos Dinámicos:</span>
                                            <span className="font-semibold text-white">{fieldsCount} campos</span>
                                        </div>
                                        <div>
                                            <span className="text-white/40 block text-[10px]">Versión Schema:</span>
                                            <span className="font-semibold text-white">v{version}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons for Dual Representation */}
                                    <div className="space-y-2 pt-1">
                                        <Button
                                            type="button"
                                            onClick={() => openEditor(prog)}
                                            variant="outline"
                                            className="w-full justify-between text-xs border-amber-500/30 text-white hover:bg-amber-500/10 hover:border-amber-500/50 h-9"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Pencil className="w-3.5 h-3.5 text-amber-400" />
                                                Editar campos (agregar / quitar / ajustar)
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-white/40" />
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => openPreview(prog, 'web_form')}
                                            variant="outline"
                                            className="w-full justify-between text-xs border-white/10 text-white hover:bg-sky-500/10 hover:border-sky-500/30 h-9"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5 text-sky-400" />
                                                Método A: Formulario Web (Wizard)
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-white/40" />
                                        </Button>

                                        <Button
                                            type="button"
                                            onClick={() => openPreview(prog, 'conversational')}
                                            variant="outline"
                                            className="w-full justify-between text-xs border-white/10 text-white hover:bg-emerald-500/10 hover:border-emerald-500/30 h-9"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                                Método B: Conversacional (Chatbot)
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-white/40" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL PREVIEW: DUAL METHOD FORM RENDERER */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-4xl bg-zinc-950 border-white/15 text-white p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Layers className="w-5 h-5 text-sky-400" />
                            {selectedProgram?.name} — Ficha de Postulación Dinámica
                        </DialogTitle>
                        <DialogDescription className="text-xs text-white/50">
                            Previsualiza y prueba cómo responderán los postulantes en la web o a través de WhatsApp/Telegram
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProgram && activeFormDef && (
                        <div className="mt-4">
                            <DynamicFormRenderer
                                programId={selectedProgram.id}
                                programName={selectedProgram.name}
                                formDefinition={activeFormDef}
                                initialMode={previewMode}
                                onSubmitted={() => {
                                    loadPrograms();
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: COPILOTO IA — GENERADOR DE PROGRAMAS & FORMULARIOS */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
                <DialogContent className="max-w-xl bg-zinc-950 border-white/15 text-white p-6">
                    <DialogHeader>
                        <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mb-2">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-base font-bold text-white">
                            Generar Programa & Formulario Dinámico con Copiloto IA
                        </DialogTitle>
                        <DialogDescription className="text-xs text-white/50">
                            Describe en lenguaje natural el programa social, objetivos o pega el texto del TDR/convocatoria. El agente estructurará automáticamente los campos, preguntas conversacionales y reglas de elegibilidad.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-white/80">Nombre del Programa (Opcional)</label>
                            <Input
                                placeholder="Ej: Bono Solidario para Familias con Adultos Mayores"
                                value={aiProgramName}
                                onChange={(e) => setAiProgramName(e.target.value)}
                                className="bg-zinc-900 border-white/10 text-white text-xs h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                                <span>Instrucciones o Perfil del Programa para la IA *</span>
                                <button
                                    type="button"
                                    onClick={togglePromptRecording}
                                    disabled={isTranscribingPrompt || isGeneratingAI}
                                    title={isRecordingPrompt ? 'Detener y transcribir' : 'Dictar por voz'}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                        isRecordingPrompt
                                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                                            : 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20'
                                    }`}
                                >
                                    {isTranscribingPrompt ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Transcribiendo...</>
                                    ) : isRecordingPrompt ? (
                                        <><Square className="w-3 h-3" /> Detener y transcribir</>
                                    ) : (
                                        <><Mic className="w-3 h-3" /> Dictar por voz</>
                                    )}
                                </button>
                            </label>
                            <Textarea
                                rows={5}
                                placeholder="Ejemplo: Necesito un programa de asistencia alimentaria para hogares vulnerables con niños menores de 5 años. Necesito preguntar cédula, número de hijos, ingreso mensual, tipo de vivienda, si tienen acceso a agua potable y si algún miembro tiene discapacidad. Las familias con ingreso menor a $200 y más de 2 niños deben tener máxima prioridad... (o dicta con el micrófono)"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                className="bg-zinc-900 border-white/10 text-white text-xs"
                            />
                            <p className="text-[10px] text-white/40">
                                Puedes escribirlo o dictarlo con el micrófono (se transcribe con el servicio de voz de la plataforma).
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                        <Button
                            variant="ghost"
                            onClick={() => setAiModalOpen(false)}
                            disabled={isGeneratingAI}
                            className="text-white/60 hover:text-white text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI || !aiPrompt.trim()}
                            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold gap-1.5 px-5 shadow-md"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Estructurando con IA...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" /> Generar y Activar
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: EDITOR VISUAL DE CAMPOS (editar/agregar/eliminar tras IA) */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-3xl bg-zinc-950 border-white/15 text-white p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-amber-400" />
                            Editar formulario: {editingProgram?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-white/50">
                            Ajusta etiquetas, tipos, obligatoriedad, agrega o elimina campos. Se guarda como nueva versión del schema.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-white/80">Título del formulario</label>
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-zinc-900 border-white/10 text-white text-xs h-10" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-white/80">Mensaje de éxito</label>
                            <Input value={editSuccess} onChange={(e) => setEditSuccess(e.target.value)} className="bg-zinc-900 border-white/10 text-white text-xs h-10" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-semibold text-white/80">Descripción</label>
                            <Textarea rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-zinc-900 border-white/10 text-white text-xs" />
                        </div>
                    </div>

                    {/* Regenerar con IA desde el editor */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
                        <Input
                            placeholder="Ej: agrega peso, talla y fecha de nacimiento del niño; quita email..."
                            value={regenPrompt}
                            onChange={(e) => setRegenPrompt(e.target.value)}
                            className="bg-zinc-900 border-white/10 text-white text-xs h-9"
                        />
                        <Button onClick={handleRegenerateEditor} disabled={isRegenerating || !regenPrompt.trim()} className="bg-sky-600 hover:bg-sky-700 text-white text-xs gap-1.5 shrink-0">
                            {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Regenerar con IA
                        </Button>
                    </div>

                    <div className="space-y-2 mt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white/80">Campos ({editFields.length})</span>
                            <Button onClick={addField} variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/10 text-xs gap-1.5 h-8">
                                <Plus className="w-3.5 h-3.5" /> Agregar campo
                            </Button>
                        </div>
                        {editFields.map((f, idx) => (
                            <div key={`${f.id}-${idx}`} className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/50">ID (único, snake_case)</label>
                                        <Input value={f.id} onChange={(e) => patchField(idx, { id: e.target.value.replace(/\s+/g, '_').toLowerCase() })} className="bg-zinc-950 border-white/10 text-white text-xs h-9 font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/50">Etiqueta</label>
                                        <Input value={f.label} onChange={(e) => patchField(idx, { label: e.target.value })} className="bg-zinc-950 border-white/10 text-white text-xs h-9" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/50">Tipo</label>
                                        <select value={f.type} onChange={(e) => patchField(idx, { type: e.target.value as FormField['type'] })} className="w-full h-9 px-2 rounded-md bg-zinc-950 border border-white/10 text-white text-xs">
                                            {FIELD_TYPES.map((t) => (<option key={t} value={t} className="bg-zinc-900">{t}</option>))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/50">Pregunta conversacional (WhatsApp)</label>
                                        <Input value={f.conversational_prompt || ''} onChange={(e) => patchField(idx, { conversational_prompt: e.target.value })} className="bg-zinc-950 border-white/10 text-white text-xs h-9" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/50">Opciones (solo select, separadas por coma)</label>
                                        <Input
                                            value={(f.options || []).join(', ')}
                                            onChange={(e) => patchField(idx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                                            className="bg-zinc-950 border-white/10 text-white text-xs h-9"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                                        <input type="checkbox" checked={!!f.required} onChange={(e) => patchField(idx, { required: e.target.checked })} className="accent-sky-500" />
                                        Obligatorio
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-white/50 hover:text-white h-7 w-7"><ChevronUp className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => moveField(idx, 1)} disabled={idx === editFields.length - 1} className="text-white/50 hover:text-white h-7 w-7"><ChevronDown className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => removeField(idx)} className="text-rose-400 hover:text-rose-300 h-7 w-7"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {editFields.length === 0 && (
                            <p className="text-xs text-white/40 text-center py-6">Sin campos. Agrega el primero con el botón superior.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10 mt-3">
                        <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={isSavingEdit} className="text-white/60 hover:text-white text-xs">Cancelar</Button>
                        <Button onClick={saveEditor} disabled={isSavingEdit || editFields.length === 0} className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold gap-1.5 px-5">
                            {isSavingEdit ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
