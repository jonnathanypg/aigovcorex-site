'use client';

import React, { useState, useEffect } from 'react';
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
  FileText,
  RefreshCw
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
import { socialService, type ProgramBeneficiary } from '@/services/social.service';

interface PostulacionItem {
  id: string | number;
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
  const [loading, setLoading] = useState(true);
  const [postulaciones, setPostulaciones] = useState<PostulacionItem[]>([]);

  // Modal State
  const [selectedPostulation, setSelectedPostulation] = useState<BeneficiaryDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchPostulaciones = async () => {
    try {
      setLoading(true);
      const res = await socialService.getAllBeneficiaries({ limit: 100 });
      const apiData = res.data || [];

      if (apiData.length > 0) {
        const mapped: PostulacionItem[] = apiData.map((b: any) => {
          let statusLabel = 'En Evaluación';
          if (b.status === 'approved' || b.status === 'active') statusLabel = 'Aprobada';
          else if (b.status === 'rejected' || b.status === 'no_elegible') statusLabel = 'No Elegible';

          const scoreVal = b.eligibility_score != null ? Math.round(b.eligibility_score) : 85;

          return {
            id: b.id,
            child: b.full_name || 'Postulante',
            rep: b.form_data?.representante_nombre || b.form_data?.nombres_representante || 'Titular',
            cedula: b.cedula,
            phone: b.phone || b.whatsapp_phone,
            address: b.address,
            prog: b.program_name || `Programa #${b.program_id}`,
            score: `${scoreVal}/100`,
            channel: b.intake_channel || 'web',
            status: statusLabel,
            monthly_income: b.monthly_income,
            household_members: b.household_members,
            socioeconomic_level: b.socioeconomic_level,
            notes: b.eligibility_notes,
            form_data: b.form_data,
            created_at: b.created_at,
          };
        });
        setPostulaciones(mapped);
      } else {
        // Fallback demostrativo si la base está vacía
        setPostulaciones([
          {
            id: 'POST-DEMO-01',
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
            id: 'POST-DEMO-02',
            child: 'Sofía Valentina Castro',
            rep: 'Manuel Castro',
            cedula: '0948291048',
            phone: '+593992233445',
            address: 'Monte Sinaí, Sector Las Marías, Guayaquil',
            prog: 'Atención Primera Infancia',
            score: '88/100',
            channel: 'agent',
            status: 'En Evaluación',
            monthly_income: 210,
            household_members: 3,
            socioeconomic_level: 'poverty',
            notes: 'Postulación ingresada mediante Agente Conversacional Web. Requiere cupo en el centro.',
            form_data: {
              madre_en_lactancia: false,
              padre_soltero: true,
              edad_meses: 14,
              observaciones_adicionales: 'El padre trabaja en jornada extendida de comercio informal.',
            },
            created_at: '2026-09-08T11:40:00Z',
          },
        ]);
      }
    } catch (err) {
      console.error('Error fetching postulaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostulaciones();
  }, []);

  const handleApprove = async (id: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (typeof id === 'number' || !isNaN(Number(id))) {
        await socialService.updateBeneficiaryStatus(id, 'approved');
      }
      setPostulaciones((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'Aprobada' } : p))
      );
      toast.success(`Postulación #${id} aprobada con éxito`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Error al aprobar postulación #${id}`);
    }
  };

  const handleReject = async (id: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (typeof id === 'number' || !isNaN(Number(id))) {
        await socialService.updateBeneficiaryStatus(id, 'rejected');
      }
      setPostulaciones((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'No Elegible' } : p))
      );
      toast.error(`Postulación #${id} marcada como No Elegible`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Error al descartar postulación #${id}`);
    }
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

  const handleModalStatusChange = async (id: string | number, newStatus: string) => {
    try {
      if (typeof id === 'number' || !isNaN(Number(id))) {
        await socialService.updateBeneficiaryStatus(id, newStatus);
      }
      const statusLabel = newStatus === 'approved' ? 'Aprobada' : 'No Elegible';
      setPostulaciones((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: statusLabel } : p))
      );
      toast.success(`Estado de #${id} actualizado a ${statusLabel}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Error al actualizar estado`);
    }
  };

  const filtered = postulaciones.filter(
    (p) =>
      p.child.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.rep.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPostulaciones}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Bandeja
        </Button>
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
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No se encontraron postulaciones registradas.
            </div>
          ) : (
            filtered.map((post) => (
              <div
                key={post.id}
                onClick={() => handleOpenDetail(post)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sky-500/5 cursor-pointer transition-colors group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-sky-500 font-bold group-hover:underline">
                      #{post.id}
                    </span>
                    <span className="text-xs text-muted-foreground">· Representante: {post.rep}</span>
                    {post.channel === 'whatsapp' && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        <Smartphone className="w-2.5 h-2.5" /> WhatsApp
                      </Badge>
                    )}
                    {(post.channel === 'agent' || post.channel === 'conversational') && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20">
                        <Bot className="w-2.5 h-2.5" /> Agente IA
                      </Badge>
                    )}
                    {(post.channel === 'web' || post.channel === 'web_form' || post.channel === 'manual') && (
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
            ))
          )}
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
