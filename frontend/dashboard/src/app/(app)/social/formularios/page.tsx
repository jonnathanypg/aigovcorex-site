'use client';

import React, { useState, useEffect } from 'react';
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
import { socialService, type SocialProgram, type ProgramFormDefinition } from '@/services/social.service';
import { DynamicFormRenderer } from '@/components/social/dynamic-form-renderer';

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
                            <label className="text-xs font-semibold text-white/80">
                                Instrucciones o Perfil del Programa para la IA *
                            </label>
                            <Textarea
                                rows={5}
                                placeholder="Ejemplo: Necesito un programa de asistencia alimentaria para hogares vulnerables con niños menores de 5 años. Necesito preguntar cédula, número de hijos, ingreso mensual, tipo de vivienda, si tienen acceso a agua potable y si algún miembro tiene discapacidad. Las familias con ingreso menor a $200 y más de 2 niños deben tener máxima prioridad..."
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                className="bg-zinc-900 border-white/10 text-white text-xs"
                            />
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
        </div>
    );
}
