'use client';

import React, { useState } from 'react';
import { ClipboardList, Plus, Building2, Calendar, Target, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/services/api';

export default function NuevoProgramaPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [budget, setBudget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Por favor complete el nombre y código del programa');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/api/social/programs', {
        name,
        code,
        description,
        target_population: targetPopulation,
        budget: parseFloat(budget) || 0
      });
      toast.success('Programa social creado exitosamente');
      setName('');
      setCode('');
      setDescription('');
      setTargetPopulation('');
      setBudget('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear programa social');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-sky-400" />
          Crear Nuevo Programa Social
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Configuración de programas públicos, multilaterales, municipales o de ONG con reglas de focalización y elegibilidad
        </p>
      </div>

      <Card className="bg-zinc-900/60 border-white/10 backdrop-blur-md text-white">
        <CardHeader>
          <CardTitle className="text-base">Ficha Técnica del Programa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">Nombre del Programa *</label>
                <Input
                  placeholder="Ej: Nutrición y Salud Infantil Integral"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-950/60 border-white/10 text-white text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">Código / Siglas *</label>
                <Input
                  placeholder="Ej: PROG-NUTRI-2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-zinc-950/60 border-white/10 text-white text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Descripción & Objetivos</label>
              <textarea
                rows={3}
                placeholder="Objetivo del programa, alcance territorial y metas de impacto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md bg-zinc-950/60 border border-white/10 p-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">Población Objetivo</label>
                <Input
                  placeholder="Ej: Infantes 0-36 meses en vulnerabilidad"
                  value={targetPopulation}
                  onChange={(e) => setTargetPopulation(e.target.value)}
                  className="bg-zinc-950/60 border-white/10 text-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">Presupuesto Referencial (USD)</label>
                <Input
                  type="number"
                  placeholder="Ej: 500000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="bg-zinc-950/60 border-white/10 text-white text-sm"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
              <Button type="submit" disabled={isSubmitting} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-5">
                {isSubmitting ? 'Guardando...' : 'Crear y Habilitar Programa'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
