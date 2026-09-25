'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Bot,
  Smartphone,
  Check,
  X,
  Eye,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  BeneficiaryDetailsDialog,
  type BeneficiaryDetail,
} from '@/components/social/beneficiary-details-dialog';

interface PostulacionItem {
  id: string;
  child: string;
  rep: string;
  cedula?: string;
  phone?: string;
  address?: string;
  prog: string;
  score: string;
  channel: string;
  status: string;
  monthly_income?: number;
  household_members?: number;
  socioeconomic_level?: string;
  notes?: string;
  form_data?: Record<string, any>;
  created_at?: string;
}

export default function PostulacionesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [postulaciones, setPostulaciones] = useState<PostulacionItem[]>([
    {
      id: 'POST-2026-081',
      child: 'Liam Daniel Morales',
      rep: 'Elena Morales',
      cedula: '0958192031',
      phone: '+593987112233',
      address: 'Bastión Popular Bloque 5, Guayaquil',
      prog: 'Programa Nutrición Costa',
      score: '94/100',
      channel: 'whatsapp',
      status: 'Aprobada',
      monthly_income: 160,
      household_members: 4,
      socioeconomic_level: 'critical_poverty',
      notes: 'Alta vulnerabilidad detectada en triaje nutricional vía WhatsApp.',
      form_data: {
        peso_nacimiento: '2.4 kg',
        lactancia_actual: 'No',
        acceso_salud: 'Subcentro Bastión Popular',
        ingresos_fijos: false,
      },
      created_at: '2026-09-08T10:15:00Z',
    },
    {
      id: 'POST-2026-082',
      child: 'Sofía Valentina Castro',
      rep: 'Manuel Castro',
      cedula: '0948291048',
      phone: '+593992233445',
      address: 'Monte Sinaí, Sector Las Marías, Guayaquil',
      prog: 'Atención Primera Infancia CDI',
      score: '88/100',
      channel: 'agent',
      status: 'En Evaluación',
      monthly_income: 210,
      household_members: 3,
      socioeconomic_level: 'poverty',
      notes: 'Postulación ingresada mediante Agente Conversacional Web. Requiere cupo en CDI.',
      form_data: {
        madre_en_lactancia: false,
        padre_soltero: true,
        edad_meses: 14,
        observaciones_adicionales: 'El padre trabaja en jornada extendida de comercio informal.',
      },
      created_at: '2026-09-08T11:40:00Z',
    },
    {
      id: 'POST-2026-083',
      child: 'Thiago Javier Mendoza',
      rep: 'Karla Mendoza',
      cedula: '0961829304',
      phone: '+593976543210',
      address: 'Guasmo Central, Calle Las Esclusas, Guayaquil',
      prog: 'Bono Nutricional Infancia',
      score: '91/100',
      channel: 'whatsapp',
      status: 'Aprobada',
      monthly_income: 140,
      household_members: 5,
      socioeconomic_level: 'critical_poverty',
      notes: 'Prioridad asignada por scoring socioeconómico mayor a 90 puntos.',
      form_data: {
        banco_preferido: 'BanEcuador',
        tipo_ayuda: 'Bono mensual transferible',
        vivienda_propia: false,
      },
      created_at: '2026-09-09T08:20:00Z',
    },
    {
      id: 'POST-2026-084',
      child: 'Valeria Nicole Poveda',
      rep: 'Rosa Poveda',
      cedula: '0918273645',
      phone: '+593981239911',
      address: 'Suburbio Oeste, Calle 29 y la Ch, Guayaquil',
      prog: 'Programa Nutrición Costa',
      score: '45/100',
      channel: 'web',
      status: 'No Elegible',
      monthly_income: 480,
      household_members: 2,
      socioeconomic_level: 'vulnerable',
      notes: 'Ingreso per cápita sobrepasa la línea focalizada de pobreza extrema para este programa.',
      form_data: {
        empleo_formal: true,
        seguro_social: 'Afiliación voluntaria IESS',
      },
      created_at: '2026-09-09T14:10:00Z',
    },
  ]);

  // Modal State
  const [selectedPostulation, setSelectedPostulation] = useState<BeneficiaryDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleApprove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPostulaciones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'Aprobada' } : p))
    );
    toast.success(`Postulación ${id} aprobada con éxito`);
  };

  const handleReject = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPostulaciones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'No Elegible' } : p))
    );
    toast.error(`Postulación ${id} marcada como No Elegible`);
  };

  const handleOpenDetail = (post: PostulacionItem) => {
    const rawScore = parseInt(post.score.replace('/100', ''), 10) || 85;
    const detailObj: BeneficiaryDetail = {
      id: post.id,
      full_name: `${post.child} (Rep: ${post.rep})`,
      cedula: post.cedula,
      phone: post.phone,
      whatsapp_phone: post.phone,
      address: post.address,
      program_name: post.prog,
      intake_channel: post.channel,
      status: post.status,
      eligibility_score: rawScore,
      eligibility_notes: post.notes,
      socioeconomic_level: post.socioeconomic_level,
      household_members: post.household_members,
      monthly_income: post.monthly_income,
      form_data: post.form_data,
      created_at: post.created_at,
    };
    setSelectedPostulation(detailObj);
    setDetailsOpen(true);
  };

  const handleModalStatusChange = (id: string | number, newStatus: string) => {
    const statusLabel = newStatus === 'approved' ? 'Aprobada' : 'No Elegible';
    setPostulaciones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: statusLabel } : p))
    );
    toast.success(`Estado de ${id} actualizado a ${statusLabel}`);
  };

  const filtered = postulaciones.filter(
    (p) =>
      p.child.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.rep.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prog.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-sky-500" />
            Postulaciones y Elegibilidad
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revisión algorítmica de vulnerabilidad, scoring social y aprobación automatizada de beneficiarios
          </p>
        </div>
      </div>

      <Card className="p-4 bg-card border-border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por postulante, código o representante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs h-9 bg-background"
          />
        </div>
      </Card>

      <Card className="border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Bandeja de Postulaciones Recientes
            </span>
            <span className="text-[11px] text-sky-500 font-medium hidden sm:inline">
              (Haz clic en cualquier postulación para inspeccionar su ficha de evaluación)
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((post) => (
            <div
              key={post.id}
              onClick={() => handleOpenDetail(post)}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sky-500/5 cursor-pointer transition-colors group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-sky-500 font-bold group-hover:underline">
                    {post.id}
                  </span>
                  <span className="text-xs text-muted-foreground">· Representante: {post.rep}</span>
                  {post.channel === 'whatsapp' && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <Smartphone className="w-2.5 h-2.5" /> WhatsApp
                    </Badge>
                  )}
                  {post.channel === 'agent' && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20">
                      <Bot className="w-2.5 h-2.5" /> Agente IA
                    </Badge>
                  )}
                  {post.channel === 'web' && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                      Web Wizard
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5 group-hover:text-sky-500 transition-colors">
                  {post.child}
                </p>
                <p className="text-xs text-muted-foreground">{post.prog}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Scoring Social</span>
                  <span className="text-sm font-bold text-amber-500">{post.score}</span>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    post.status === 'Aprobada'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                      : post.status === 'En Evaluación'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25'
                  }`}
                >
                  {post.status}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDetail(post);
                  }}
                  className="h-8 px-2 text-xs text-sky-500 hover:text-sky-600 hover:bg-sky-500/10 gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Detalle</span>
                </Button>

                {post.status === 'En Evaluación' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleApprove(post.id, e)}
                      className="h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30"
                      title="Aprobar postulación"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleReject(post.id, e)}
                      className="h-8 px-2 text-xs text-red-600 hover:bg-red-500/10 border-red-500/30"
                      title="Rechazar postulación"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Descartar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Modal de Detalle de Postulación */}
      <BeneficiaryDetailsDialog
        beneficiary={selectedPostulation}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onStatusChange={handleModalStatusChange}
      />
    </div>
  );
}
