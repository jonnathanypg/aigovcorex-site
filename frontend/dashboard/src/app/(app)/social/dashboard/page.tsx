'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LayoutGrid, 
  ClipboardList, 
  Users, 
  MapPin, 
  Activity, 
  Plus, 
  ArrowRight,
  RefreshCw,
  Eye,
  FileCode2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { socialService, SocialProgram, ProgramFormDefinition } from '@/services/social.service';
import { ProgramDetailsDialog } from '@/components/social/program-details-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DynamicFormRenderer } from '@/components/social/dynamic-form-renderer';
import { toast } from 'sonner';

export default function SocialDashboardPage() {
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Program Detail Dialog
  const [selectedProgram, setSelectedProgram] = useState<SocialProgram | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Form Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'web_form' | 'conversational'>('web_form');
  const [activeFormDef, setActiveFormDef] = useState<ProgramFormDefinition | null>(null);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const data = await socialService.getPrograms();
      setPrograms(data);
    } catch (e) {
      console.error('Error fetching social programs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  const handleOpenProgram = (prog: SocialProgram) => {
    setSelectedProgram(prog);
    setDetailsOpen(true);
  };

  const handleOpenFormPreview = async (prog: SocialProgram, mode: 'web_form' | 'conversational') => {
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

  const totalBeneficiaries = programs.reduce((acc, p) => acc + (p.beneficiaries_count || p.current_beneficiaries || 0), 0);

  const stats = [
    { label: 'Programas Activos', value: programs.length.toString(), change: 'En ejecución', icon: ClipboardList, color: '#0ea5e9' },
    { label: 'Beneficiarios Totales', value: totalBeneficiaries.toString(), change: 'Postulados / Aprobados', icon: Users, color: '#10b981' },
    { label: 'Organizaciones Vinculadas', value: '38', change: 'Red interinstitucional', icon: LayoutGrid, color: '#8b5cf6' },
    { label: 'Cobertura Territorial', value: '18 Cantones', change: 'Ecuador', icon: MapPin, color: '#f97316' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-sky-400" />
            Social AI
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión integral de programas, formularios conversacionales y captación multicanal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/social/programas/nuevo">
            <Button className="bg-sky-600 hover:bg-sky-500 text-white font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Programa
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01]"
            style={{ background: `${stat.color}08`, border: `1px solid ${stat.color}25` }}
          >
            <div className="flex items-start justify-between mb-3">
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              <Activity className="w-4 h-4 text-white/20" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{stat.label}</p>
            <p className="text-xs mt-2 font-medium" style={{ color: stat.color }}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Programs List */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4 text-sky-400" />
              Programas Sociales Registrados
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Haz clic sobre cualquier programa para ver su ficha técnica, objetivos y configuración
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPrograms}
            className="text-xs text-white/50 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
        </div>

        {programs.length === 0 ? (
          <div className="text-center py-8 text-xs text-white/40">
            No se han creado programas sociales aún. Crea uno nuevo usando el botón superior.
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((prog) => (
              <div
                key={prog.id}
                onClick={() => handleOpenProgram(prog)}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-sky-500/5 hover:border-sky-500/30 cursor-pointer transition-all gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 group-hover:scale-125 transition-transform" />
                  <div>
                    <p className="text-white text-sm font-semibold group-hover:text-sky-300 transition-colors">
                      {prog.name}
                    </p>
                    <p className="text-xs text-white/40">
                      Código: <span className="font-mono text-sky-300">{prog.short_code}</span> • Beneficiarios: {prog.beneficiaries_count || prog.current_beneficiaries || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-300 bg-sky-500/10 uppercase">
                    {prog.status || 'Activo'}
                  </Badge>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProgram(prog);
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 h-8 gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ficha Técnica
                  </Button>

                  <Link
                    href={`/social/postulaciones?program_id=${prog.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="ghost" className="text-xs text-white/60 hover:text-white h-8">
                      Postulantes →
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Ficha Técnica de Programa */}
      <ProgramDetailsDialog
        program={selectedProgram}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onOpenFormPreview={handleOpenFormPreview}
      />

      {/* Modal Preview Formulario Dinámico */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-white/15 text-white p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-sky-400" />
              {selectedProgram?.name} — Ficha de Captación
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Visualización y prueba del esquema dinámico en tiempo real
            </DialogDescription>
          </DialogHeader>

          {activeFormDef && selectedProgram && (
            <div className="mt-4">
              <DynamicFormRenderer
                programId={selectedProgram.id}
                programName={selectedProgram.name}
                formDefinition={activeFormDef}
                initialMode={previewMode}
                onSubmitted={() => {
                  toast.success('¡Postulación de prueba procesada!');
                  setPreviewOpen(false);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
