'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Target,
  DollarSign,
  Users,
  FileCode2,
  Calendar,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SocialProgram } from '@/services/social.service';

interface ProgramDetailsDialogProps {
  program: SocialProgram | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFormPreview?: (program: SocialProgram, mode: 'web_form' | 'conversational') => void;
}

export function ProgramDetailsDialog({
  program,
  open,
  onOpenChange,
  onOpenFormPreview,
}: ProgramDetailsDialogProps) {
  if (!program) return null;

  const p = program;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-zinc-950 border border-white/10 text-white p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  {p.name}
                </DialogTitle>
                <p className="text-xs text-white/50">
                  Código: <span className="font-mono text-sky-300 font-bold">{p.short_code}</span> • ID #{p.id}
                </p>
              </div>
            </div>
            <div>
              <Badge
                className={
                  p.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }
              >
                {p.status === 'active' ? 'Programa Activo' : p.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Métricas clave */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <span className="text-[10px] text-sky-400 block font-semibold">Beneficiarios Registrados</span>
              <p className="text-xl font-bold text-white mt-0.5">
                {p.beneficiaries_count || p.current_beneficiaries || 0}
                {p.max_beneficiaries ? <span className="text-xs text-white/40 font-normal"> / {p.max_beneficiaries} cupos</span> : null}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[10px] text-indigo-400 block font-semibold">Campos en Ficha Dinámica</span>
              <p className="text-xl font-bold text-white mt-0.5">
                {p.form_definition?.fields?.length || 10} campos
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 block font-semibold">Cobertura Territorial</span>
              <p className="text-sm font-bold text-white mt-1">
                {p.coverage_country || 'Ecuador'}
              </p>
            </div>
          </div>

          {/* Descripción & Objetivos */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-400" />
              Objetivos & Población Objetivo
            </h4>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
              <div>
                <span className="text-white/40 block text-[10px]">Descripción:</span>
                <p className="text-white/80 mt-0.5">{p.description || 'Sin descripción detallada registrada.'}</p>
              </div>
              {p.objectives && (
                <div>
                  <span className="text-white/40 block text-[10px]">Metas de Impacto:</span>
                  <p className="text-white/80 mt-0.5">{p.objectives}</p>
                </div>
              )}
            </div>
          </div>

          {/* Configuración de Ingesta y Ficha Dinámica */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-indigo-400" />
              Mecanismos de Captación & Ficha Dinámica
            </h4>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Versión del Formulario Schema:</span>
                <Badge variant="outline" className="font-mono text-sky-400 border-sky-500/30">
                  v{p.form_definition?.version || 1}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Canales Vinculados de la Organización:</span>
                <span className="text-emerald-400 font-semibold">
                  {p.inherit_org_channels !== false ? 'Habilitados (WhatsApp, Web, Bot)' : 'Personalizados'}
                </span>
              </div>

              {onOpenFormPreview && (
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenFormPreview(p, 'web_form');
                    }}
                    className="flex-1 text-xs border-white/10 hover:bg-sky-500/10 text-white gap-1.5"
                  >
                    Abrir Ficha Web (Wizard) <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenFormPreview(p, 'conversational');
                    }}
                    className="flex-1 text-xs border-white/10 hover:bg-emerald-500/10 text-white gap-1.5"
                  >
                    Simular Ingesta Chatbot 24/7 <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Footer de información */}
          <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/10">
            <span>Fecha de Creación: {p.created_at ? new Date(p.created_at).toLocaleDateString('es-EC') : 'Reciente'}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-white/60 hover:text-white"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
