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
import { Separator } from '@/components/ui/separator';
import {
  User,
  CreditCard,
  Phone,
  Smartphone,
  Bot,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Percent,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

export interface BeneficiaryDetail {
  id: number | string;
  program_id?: number;
  program_name?: string;
  full_name: string;
  cedula?: string;
  birth_date?: string;
  phone?: string;
  whatsapp_phone?: string;
  email?: string;
  address?: string;
  intake_channel?: string;
  form_data?: Record<string, any>;
  status: string;
  eligibility_score?: number;
  eligibility_notes?: string;
  socioeconomic_level?: string;
  household_members?: number;
  monthly_income?: number;
  has_disabilities?: boolean;
  disability_type?: string;
  created_at?: string;
}

interface BeneficiaryDetailsDialogProps {
  beneficiary: BeneficiaryDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (id: number | string, newStatus: string) => void;
}

export function BeneficiaryDetailsDialog({
  beneficiary,
  open,
  onOpenChange,
  onStatusChange,
}: BeneficiaryDetailsDialogProps) {
  if (!beneficiary) return null;

  const b = beneficiary;

  const formatKeyName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved' || s === 'aprobada' || s === 'aprobado' || s === 'active' || s === 'activo') {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Aprobado / Activo
        </Badge>
      );
    }
    if (s === 'applicant' || s === 'en evaluación' || s === 'pendiente') {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
          En Evaluación / Calificación
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
        No Elegible / Rechazado
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-zinc-950 border border-white/10 text-white p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  {b.full_name}
                </DialogTitle>
                <p className="text-xs text-white/50">
                  Expediente ID: <span className="font-mono text-sky-300">#{b.id}</span> • Programa: <span className="text-white/80">{b.program_name || 'Programa Social General'}</span>
                </p>
              </div>
            </div>
            <div>{getStatusBadge(b.status)}</div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Card Scoring & Elegibilidad */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 font-bold text-xl">
                {b.eligibility_score != null ? `${b.eligibility_score}` : '85'}
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-sky-300 font-bold block">
                  Scoring Social Algorítmico
                </span>
                <p className="text-xs text-white/60">
                  {b.eligibility_score && b.eligibility_score >= 70
                    ? 'Cumple con el umbral prioritario de vulnerabilidad'
                    : 'Puntaje de focalización bajo evaluación'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {b.intake_channel?.includes('whatsapp') ? (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                  <Smartphone className="w-3.5 h-3.5" /> Canal WhatsApp
                </Badge>
              ) : b.intake_channel?.includes('agent') || b.intake_channel?.includes('conversational') ? (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-pink-500/10 text-pink-400 border-pink-500/30 text-xs">
                  <Bot className="w-3.5 h-3.5" /> Agente IA Conversacional
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-sky-500/10 text-sky-400 border-sky-500/30 text-xs">
                  <Globe className="w-3.5 h-3.5" /> Web Form Wizard
                </Badge>
              )}
            </div>
          </div>

          {/* Información Personal y Contacto */}
          <div>
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-400" />
              Datos de Identificación y Contacto
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Cédula de Identidad</span>
                <span className="text-xs font-mono font-medium text-white">{b.cedula || 'En trámite / No registrada'}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Teléfono Principal</span>
                <span className="text-xs font-mono font-medium text-white">{b.phone || 'No registrado'}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Línea WhatsApp</span>
                <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1">
                  {b.whatsapp_phone || b.phone || 'N/A'}
                  {(b.whatsapp_phone || b.phone) && (
                    <a
                      href={`https://wa.me/${(b.whatsapp_phone || b.phone || '').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/40 hover:text-white ml-1"
                      title="Abrir chat WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 sm:col-span-2">
                <span className="text-[10px] text-white/40 block">Dirección / Sector</span>
                <span className="text-xs text-white flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                  {b.address || 'Guayaquil, Sector Periurbano / Comunitario'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Fecha de Registro</span>
                <span className="text-xs text-white/70 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-sky-400 shrink-0" />
                  {b.created_at ? new Date(b.created_at).toLocaleDateString('es-EC') : 'Reciente'}
                </span>
              </div>
            </div>
          </div>

          {/* Ficha Socioeconómica */}
          <div>
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Diagnóstico Socioeconómico y Vulnerabilidad
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Ingreso Mensual Familiar</span>
                <span className="text-sm font-bold text-emerald-400">
                  {b.monthly_income != null ? `$${b.monthly_income.toFixed(2)}` : '$180.00'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Miembros en el Hogar</span>
                <span className="text-sm font-bold text-white">
                  {b.household_members || 4} personas
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-white/40 block">Estrato / Nivel</span>
                <Badge variant="outline" className="mt-1 border-amber-500/30 text-amber-300 bg-amber-500/10 text-[11px]">
                  {b.socioeconomic_level === 'critical_poverty'
                    ? 'Pobreza Extrema'
                    : b.socioeconomic_level === 'poverty'
                    ? 'Pobreza'
                    : 'Vulnerable Prioritario'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Respuestas del Formulario Dinámico (form_data) */}
          <div>
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Respuestas a Ficha Dinámica de Postulación
            </h4>
            {b.form_data && Object.keys(b.form_data).length > 0 ? (
              <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 bg-white/[0.02]">
                {Object.entries(b.form_data).map(([key, value]) => (
                  <div key={key} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="text-white/60 font-medium">{formatKeyName(key)}:</span>
                    <span className="font-semibold text-white break-words sm:text-right">
                      {typeof value === 'boolean'
                        ? value ? 'Sí' : 'No'
                        : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-white/50 text-center">
                Registro capturado vía canal ágil. No contiene campos dinámicos adicionales más allá del registro base.
              </div>
            )}
          </div>

          {/* Notas de Elegibilidad / IA Feedback */}
          {b.eligibility_notes && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-300">
                <ShieldAlert className="w-4 h-4" /> Diagnóstico de Validación:
              </span>
              <p>{b.eligibility_notes}</p>
            </div>
          )}

          {/* Acciones de Aprobación si está en calificación */}
          {onStatusChange && (b.status === 'applicant' || b.status === 'En Evaluación') && (
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onStatusChange(b.id, 'rejected');
                  onOpenChange(false);
                }}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
              >
                Descartar Postulación
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onStatusChange(b.id, 'approved');
                  onOpenChange(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Aprobar e Incorporar al Padrón
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
