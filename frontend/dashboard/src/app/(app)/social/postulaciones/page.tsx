'use client';

import React, { useState } from 'react';
import { UserCheck, Search, Filter, CheckCircle2, Clock, XCircle, Bot, Smartphone, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function PostulacionesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [postulaciones, setPostulaciones] = useState([
    { id: 'POST-2026-081', child: 'Liam Daniel Morales', rep: 'Elena Morales', prog: 'Programa Nutrición Costa', score: '94/100', channel: 'whatsapp', status: 'Aprobada' },
    { id: 'POST-2026-082', child: 'Sofía Valentina Castro', rep: 'Manuel Castro', prog: 'Atención Primera Infancia CDI', score: '88/100', channel: 'agent', status: 'En Evaluación' },
    { id: 'POST-2026-083', child: 'Thiago Javier Mendoza', rep: 'Karla Mendoza', prog: 'Bono Nutricional Infancia', score: '91/100', channel: 'whatsapp', status: 'Aprobada' },
    { id: 'POST-2026-084', child: 'Valeria Nicole Poveda', rep: 'Rosa Poveda', prog: 'Programa Nutrición Costa', score: '45/100', channel: 'web', status: 'No Elegible' },
  ]);

  const handleApprove = (id: string) => {
    setPostulaciones(prev => prev.map(p => p.id === id ? { ...p, status: 'Aprobada' } : p));
  };

  const handleReject = (id: string) => {
    setPostulaciones(prev => prev.map(p => p.id === id ? { ...p, status: 'No Elegible' } : p));
  };

  const filtered = postulaciones.filter(p =>
    p.child.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.rep.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
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
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Bandeja de Postulaciones Recientes
          </span>
          <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-sky-500 font-bold">{post.id}</span>
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
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5">{post.child}</p>
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

                {post.status === 'En Evaluación' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(post.id)}
                      className="h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30"
                      title="Aprobar postulación"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(post.id)}
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
    </div>
  );
}
