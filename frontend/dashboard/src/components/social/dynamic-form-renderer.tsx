'use client';

import React, { useState, useEffect } from 'react';
import {
    ClipboardList,
    CheckCircle2,
    Send,
    Bot,
    User,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    FileText,
    AlertCircle,
    Loader2,
    MessageSquare,
    Check,
    Layers,
    SlidersHorizontal,
    RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
    socialService,
    type ProgramFormDefinition,
    type FormField,
    type FormSection
} from '@/services/social.service';

interface DynamicFormRendererProps {
    programId: number;
    programName: string;
    formDefinition: ProgramFormDefinition;
    initialMode?: 'web_form' | 'conversational';
    onSubmitted?: (beneficiaryId: number) => void;
}

export function DynamicFormRenderer({
    programId,
    programName,
    formDefinition,
    initialMode = 'web_form',
    onSubmitted,
}: DynamicFormRendererProps) {
    const [mode, setMode] = useState<'web_form' | 'conversational'>(initialMode);

    // ──────────────────────────────────────────────────────────────────────────
    // METHOD A: Multi-Step Web Wizard State
    // ──────────────────────────────────────────────────────────────────────────
    const sections: FormSection[] = formDefinition.sections && formDefinition.sections.length > 0
        ? formDefinition.sections
        : [
            {
                id: 'default_section',
                title: 'Información de Postulación',
                description: 'Complete todos los campos requeridos',
                field_ids: (formDefinition.fields || []).map(f => f.id)
            }
        ];

    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState<{
        beneficiaryId: number;
        score: number;
        message: string;
    } | null>(null);

    const currentSection = sections[currentSectionIndex] || sections[0];
    const currentSectionFields = (formDefinition.fields || []).filter(f =>
        currentSection.field_ids.includes(f.id)
    );

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const validateCurrentSection = (): boolean => {
        for (const field of currentSectionFields) {
            if (field.required) {
                const val = formData[field.id];
                if (val === undefined || val === null || val === '') {
                    toast.error(`El campo '${field.label}' es obligatorio.`);
                    return false;
                }
                if (field.type === 'cedula' && String(val).trim().length !== 10) {
                    toast.error(`La cédula debe contener exactamente 10 dígitos.`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleNextSection = () => {
        if (!validateCurrentSection()) return;
        if (currentSectionIndex < sections.length - 1) {
            setCurrentSectionIndex(prev => prev + 1);
        } else {
            handleFinalSubmit();
        }
    };

    const handlePrevSection = () => {
        if (currentSectionIndex > 0) {
            setCurrentSectionIndex(prev => prev - 1);
        }
    };

    const handleFinalSubmit = async () => {
        try {
            setIsSubmitting(true);
            const res = await socialService.submitForm(programId, {
                full_name: formData['full_name'] || 'Postulante Web',
                cedula: formData['cedula'],
                phone: formData['phone'],
                email: formData['email'],
                address: formData['address'],
                form_data: formData,
                intake_channel: 'web_form_wizard'
            });

            setSubmissionResult({
                beneficiaryId: res.beneficiary_id,
                score: res.eligibility_score,
                message: res.message
            });
            toast.success('Postulación enviada exitosamente');
            if (onSubmitted) onSubmitted(res.beneficiary_id);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al enviar la postulación');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // METHOD B: Conversational Simulator State (WhatsApp / Widget)
    // ──────────────────────────────────────────────────────────────────────────
    const getInitialGreeting = () => {
        const firstField = formDefinition.fields && formDefinition.fields[0];
        const firstPrompt = firstField?.conversational_prompt || (firstField?.label ? `Por favor, ¿cuál es tu ${firstField.label}?` : '¿cuál es tu nombre y apellido completo?');
        return `¡Hola! Soy el Asistente del programa *${programName}*. Te ayudaré a registrar tu postulación paso a paso de forma rápida y sencilla.\n\nPara comenzar, ${firstPrompt}`;
    };

    const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'assistant' | 'user'; content: string }>>([
        {
            id: 'init',
            role: 'assistant',
            content: getInitialGreeting()
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatCollectedData, setChatCollectedData] = useState<Record<string, any>>({});
    const [chatLoading, setChatLoading] = useState(false);
    const [chatProgress, setChatProgress] = useState(10);
    const [chatCompleted, setChatCompleted] = useState(false);

    const handleRestartChat = () => {
        setChatMessages([
            {
                id: `init-${Date.now()}`,
                role: 'assistant',
                content: getInitialGreeting()
            }
        ]);
        setChatInput('');
        setChatCollectedData({});
        setChatLoading(false);
        setChatProgress(10);
        setChatCompleted(false);
    };

    const handleSendChatMessage = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;

        const userMsg = { id: `u-${Date.now()}`, role: 'user' as const, content: text };
        const updatedHistory = [...chatMessages, userMsg];
        setChatMessages(updatedHistory);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await socialService.conversationalStep(programId, {
                message: text,
                session_id: `sim_${Date.now()}`,
                collected_data: chatCollectedData,
                history: updatedHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
                channel: 'chat_simulator'
            });

            if (res.collected_data) {
                setChatCollectedData(res.collected_data);
            }
            if (res.progress_percent !== undefined) {
                setChatProgress(res.progress_percent);
            }

            setChatMessages(prev => [
                ...prev,
                { id: `a-${Date.now()}`, role: 'assistant', content: res.response }
            ]);

            if (res.completed) {
                setChatCompleted(true);
                toast.success('¡Postulación conversacional completada!');
            }
        } catch {
            setChatMessages(prev => [
                ...prev,
                { id: `err-${Date.now()}`, role: 'assistant', content: 'Disculpa, no pude procesar tu respuesta. Por favor intenta de nuevo.' }
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Mode Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-md">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-sky-400" />
                        {formDefinition.form_title || `Formulario: ${programName}`}
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                        Versión {formDefinition.version || 1} · {formDefinition.fields?.length || 0} campos configurados
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-zinc-950/60 p-1 rounded-xl border border-white/10">
                    <button
                        type="button"
                        onClick={() => setMode('web_form')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            mode === 'web_form'
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Método A: Formulario Web (Paso a Paso)
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('conversational')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            mode === 'conversational'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Método B: Conversacional (WhatsApp / Widget)
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* METHOD A: STEP-BY-STEP WEB WIZARD */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {mode === 'web_form' && (
                <div className="max-w-3xl mx-auto">
                    {submissionResult ? (
                        <Card className="bg-zinc-900/80 border-emerald-500/30 text-white p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-white">¡Postulación Registrada con Éxito!</h3>
                                <p className="text-sm text-white/70 max-w-md mx-auto">
                                    {submissionResult.message}
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-4 py-2">
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-sm px-3 py-1">
                                    Score de Elegibilidad: {submissionResult.score.toFixed(0)} / 100
                                </Badge>
                                <Badge variant="outline" className="border-white/20 text-white/70 text-sm">
                                    Expediente #{submissionResult.beneficiaryId}
                                </Badge>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSubmissionResult(null);
                                    setFormData({});
                                    setCurrentSectionIndex(0);
                                }}
                                className="border-white/20 text-white hover:bg-white/10 text-xs"
                            >
                                Registrar otra postulación
                            </Button>
                        </Card>
                    ) : (
                        <Card className="bg-zinc-900/60 border-white/10 backdrop-blur-md text-white">
                            <CardHeader className="border-b border-white/5 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 mb-2">
                                            Paso {currentSectionIndex + 1} de {sections.length}
                                        </Badge>
                                        <CardTitle className="text-base font-bold text-white">
                                            {currentSection.title}
                                        </CardTitle>
                                        {currentSection.description && (
                                            <CardDescription className="text-xs text-white/50 mt-0.5">
                                                {currentSection.description}
                                            </CardDescription>
                                        )}
                                    </div>
                                    <span className="text-xs font-mono text-white/40">
                                        {Math.round(((currentSectionIndex + 1) / sections.length) * 100)}%
                                    </span>
                                </div>
                                <Progress
                                    value={((currentSectionIndex + 1) / sections.length) * 100}
                                    className="h-1.5 mt-3 bg-zinc-950/60"
                                />
                            </CardHeader>

                            <CardContent className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {currentSectionFields.map((field) => {
                                        const val = formData[field.id] ?? '';
                                        const isFullWidth = ['textarea', 'address'].includes(field.type);

                                        return (
                                            <div
                                                key={field.id}
                                                className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}
                                            >
                                                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                                                    <span>
                                                        {field.label}{' '}
                                                        {field.required && (
                                                            <span className="text-rose-400">*</span>
                                                        )}
                                                    </span>
                                                    {field.scoring_weight && (
                                                        <span className="text-[10px] text-amber-400/80 font-mono">
                                                            {field.scoring_weight} pts
                                                        </span>
                                                    )}
                                                </label>

                                                {/* Text / Cedula / Phone */}
                                                {['text', 'cedula'].includes(field.type) && (
                                                    <Input
                                                        type="text"
                                                        placeholder={field.placeholder || `Ingrese ${field.label}`}
                                                        value={val}
                                                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                        className="bg-zinc-950/60 border-white/10 text-white text-xs h-10"
                                                    />
                                                )}

                                                {/* Number / Currency */}
                                                {['number', 'currency'].includes(field.type) && (
                                                    <div className="relative">
                                                        {field.type === 'currency' && (
                                                            <span className="absolute left-3 top-2.5 text-xs text-white/40">
                                                                $
                                                            </span>
                                                        )}
                                                        <Input
                                                            type="number"
                                                            placeholder={field.placeholder || '0.00'}
                                                            value={val}
                                                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                            className={`bg-zinc-950/60 border-white/10 text-white text-xs h-10 ${
                                                                field.type === 'currency' ? 'pl-7' : ''
                                                            }`}
                                                        />
                                                    </div>
                                                )}

                                                {/* Select Dropdown */}
                                                {field.type === 'select' && (
                                                    <select
                                                        value={val}
                                                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                        className="w-full h-10 px-3 rounded-md bg-zinc-950/60 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    >
                                                        <option value="">Seleccione una opción...</option>
                                                        {(field.options || []).map((opt) => (
                                                            <option key={opt} value={opt} className="bg-zinc-900 text-white">
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}

                                                {/* Boolean Switch */}
                                                {field.type === 'boolean' && (
                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-white/5">
                                                        <span className="text-xs text-white/70">
                                                            {val ? 'Sí, confirmado' : 'No'}
                                                        </span>
                                                        <Switch
                                                            checked={Boolean(val)}
                                                            onCheckedChange={(c) => handleFieldChange(field.id, c)}
                                                        />
                                                    </div>
                                                )}

                                                {/* Date */}
                                                {field.type === 'date' && (
                                                    <Input
                                                        type="date"
                                                        value={val}
                                                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                        className="bg-zinc-950/60 border-white/10 text-white text-xs h-10"
                                                    />
                                                )}

                                                {/* Conversational prompt hint */}
                                                {field.conversational_prompt && (
                                                    <p className="text-[10px] text-white/40 italic">
                                                        💡 Pregunta bot: &ldquo;{field.conversational_prompt}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Step Navigation Buttons */}
                                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePrevSection}
                                        disabled={currentSectionIndex === 0 || isSubmitting}
                                        className="border-white/10 text-white hover:bg-white/10 text-xs gap-1.5"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Anterior
                                    </Button>

                                    <Button
                                        type="button"
                                        onClick={handleNextSection}
                                        disabled={isSubmitting}
                                        className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold gap-1.5 px-6 shadow-md"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluando...
                                            </>
                                        ) : currentSectionIndex < sections.length - 1 ? (
                                            <>
                                                Siguiente Sección <ArrowRight className="w-3.5 h-3.5" />
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-3.5 h-3.5" /> Finalizar Postulación
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* METHOD B: INTERACTIVE CONVERSATIONAL SIMULATOR (WhatsApp / Widget) */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {mode === 'conversational' && (
                <div className="max-w-2xl mx-auto">
                    <Card className="bg-zinc-900/70 border-emerald-500/20 backdrop-blur-md text-white shadow-2xl overflow-hidden">
                        {/* Chat Header */}
                        <div className="p-4 bg-gradient-to-r from-emerald-600/30 via-zinc-900 to-zinc-900 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                        Simulador Conversacional Omnicanal
                                        <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                                            WhatsApp & Telegram Ready
                                        </Badge>
                                    </h3>
                                    <p className="text-[11px] text-white/50">
                                        Motor agéntico activo para: {programName}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRestartChat}
                                    title="Reiniciar conversación"
                                    className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2 text-xs flex items-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reiniciar
                                </Button>
                                <div className="text-right">
                                    <span className="text-xs font-mono text-emerald-400">{chatProgress}%</span>
                                    <Progress value={chatProgress} className="w-20 h-1 mt-1 bg-zinc-950" />
                                </div>
                            </div>
                        </div>

                        {/* Chat Messages Log */}
                        <div className="p-4 h-[380px] overflow-y-auto space-y-3 bg-zinc-950/40">
                            {chatMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-sky-600 text-white rounded-br-none'
                                                : 'bg-zinc-800/80 text-white/90 border border-white/5 rounded-bl-none'
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-7 h-7 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex gap-2.5 items-center text-xs text-white/40 italic">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                    El copiloto está procesando los datos y evaluando la elegibilidad...
                                </div>
                            )}
                        </div>

                        {/* Chat Input */}
                        <div className="p-3 border-t border-white/10 bg-zinc-900/90 flex items-center gap-2">
                            <Input
                                placeholder={chatCompleted ? "Postulación finalizada" : "Escribe tu respuesta..."}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                                disabled={chatLoading || chatCompleted}
                                className="bg-zinc-950/60 border-white/10 text-white text-xs h-10"
                            />
                            <Button
                                onClick={handleSendChatMessage}
                                disabled={!chatInput.trim() || chatLoading || chatCompleted}
                                size="icon"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-10 w-10 shadow-md"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
