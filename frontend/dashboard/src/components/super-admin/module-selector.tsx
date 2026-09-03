"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Baby, Map, MessageSquare, Brain, ClipboardList, CheckCircle2, Circle } from "lucide-react";

export interface ModuleConfig {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: any;
  color: string;
  bgGradient: string;
  border: string;
  textColor: string;
  badge: string;
}

export const SYSTEM_MODULES: ModuleConfig[] = [
  {
    id: 'kindicore',
    label: 'KindiCore AI — Primera Infancia',
    shortLabel: 'KindiCore',
    description: 'Gestión CDI, IDII, Asistencia, Salud & Nutrición, Curvas OMS, Fichas de Desarrollo',
    icon: Baby,
    color: '#f97316',
    bgGradient: 'from-amber-500/15 via-orange-500/10 to-transparent',
    border: 'border-amber-500/40',
    textColor: 'text-amber-400',
    badge: 'CDI / NIÑEZ',
  },
  {
    id: 'social',
    label: 'Programas Sociales & Bienestar',
    shortLabel: 'SocialCore',
    description: 'Convocatorias públicas, Postulaciones, Padrón de Beneficiarios, Red Interinstitucional',
    icon: ClipboardList,
    color: '#0ea5e9',
    bgGradient: 'from-sky-500/15 via-blue-500/10 to-transparent',
    border: 'border-sky-500/40',
    textColor: 'text-sky-400',
    badge: 'BENEFICIARIOS',
  },
  {
    id: 'geo',
    label: 'GeoInteligencia & Ojo de Dios',
    shortLabel: 'GeoInt',
    description: 'Mapas GIS, Zonas de Calor de Vulnerabilidad, Cercos Digitales, Grafos de Convenios',
    icon: Map,
    color: '#10b981',
    bgGradient: 'from-emerald-500/15 via-green-500/10 to-transparent',
    border: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    badge: 'TERRITORIO',
  },
  {
    id: 'channels',
    label: 'Canales Omnicanal (WhatsApp & Telegram)',
    shortLabel: 'Canales',
    description: 'Gateway de notas de voz, chatbots 24/7, derivación a programas, atención a familias',
    icon: MessageSquare,
    color: '#8b5cf6',
    bgGradient: 'from-violet-500/15 via-purple-500/10 to-transparent',
    border: 'border-violet-500/40',
    textColor: 'text-violet-400',
    badge: 'OMNICANAL',
  },
  {
    id: 'copilot',
    label: 'Copiloto RAG & Agentes IA',
    shortLabel: 'Copiloto RAG',
    description: 'Orquestación multi-agente LangGraph, base de conocimiento RAG, carga masiva desde chat',
    icon: Brain,
    color: '#ec4899',
    bgGradient: 'from-pink-500/15 via-rose-500/10 to-transparent',
    border: 'border-pink-500/40',
    textColor: 'text-pink-400',
    badge: 'AGÉNTICO',
  },
];

interface ModuleSelectorProps {
  selected: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
}

export function ModuleSelector({ selected, onChange, disabled }: ModuleSelectorProps) {
  const toggleModule = (id: string) => {
    if (disabled) return;
    if (selected.includes(id)) {
      if (selected.length <= 1) return; // Prevent 0 modules
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onChange(SYSTEM_MODULES.map(m => m.id));
  };

  const selectMinimal = () => {
    if (disabled) return;
    onChange(['kindicore']);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Módulos del Sistema Operativo
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Elige qué módulos estarán disponibles para los usuarios de esta organización
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Habilitar Todos ({SYSTEM_MODULES.length})
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            type="button"
            onClick={selectMinimal}
            disabled={disabled}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Básico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {SYSTEM_MODULES.map((mod) => {
          const isSelected = selected.includes(mod.id);
          const Icon = mod.icon;

          return (
            <div
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
              className={cn(
                "relative flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? `bg-gradient-to-r ${mod.bgGradient} ${mod.border} shadow-sm`
                  : "bg-muted/20 border-border/30 opacity-60 hover:opacity-80 hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: isSelected ? `${mod.color}25` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isSelected ? mod.color + '50' : 'rgba(255,255,255,0.1)'}`
                }}
              >
                <Icon className="w-5 h-5" style={{ color: isSelected ? mod.color : 'currentColor' }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold leading-tight", isSelected ? mod.textColor : "text-foreground/80")}>
                    {mod.label}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: `${mod.color}15`,
                      color: mod.color,
                      border: `1px solid ${mod.color}30`
                    }}
                  >
                    {mod.badge}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5 truncate">
                  {mod.description}
                </p>
              </div>

              {/* Status Indicator */}
              <div className="shrink-0 flex items-center justify-center pl-1">
                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: mod.color }} />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground">
          <strong className="text-foreground">{selected.length}</strong> de {SYSTEM_MODULES.length} módulos habilitados
        </span>
        <span className="text-[11px] text-muted-foreground/60 italic">
          Los módulos inhabilitados quedan invisibles y bloqueados para la organización
        </span>
      </div>
    </div>
  );
}
