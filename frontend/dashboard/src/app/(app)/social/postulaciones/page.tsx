'use client';

import React from 'react';
import { UserCheck, Search, Filter, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PostulacionesPage() {
  const postulaciones = [
    { id: 'POST-2026-081', child: 'Liam Daniel Morales', rep: 'Elena Morales', prog: 'Programa Nutrición Costa', score: '94/100', status: 'Aprobada', color: 'emerald' },
    { id: 'POST-2026-082', child: 'Sofía Valentina Castro', rep: 'Manuel Castro', prog: 'Atención Primera Infancia CDI', score: '88/100', status: 'En Evaluación', color: 'amber' },
    { id: 'POST-2026-083', child: 'Thiago Javier Mendoza', rep: 'Karla Mendoza', prog: 'Bono Nutricional Infancia', score: '91/100', status: 'Aprobada', color: 'emerald' },
    { id: 'POST-2026-084', child: 'Valeria Nicole Poveda', rep: 'Rosa Poveda', prog: 'Programa Nutrición Costa', score: '45/100', status: 'No Elegible', color: 'red' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-sky-400" />
            Postulaciones y Elegibilidad
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Revisión algorítmica de vulnerabilidad, scoring social y aprobación automatizada de beneficiarios
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Bandeja de Postulaciones Recientes</span>
          <span className="text-xs text-white/50">{postulaciones.length} registros</span>
        </div>
        <div className="divide-y divide-white/5">
          {postulaciones.map((post) => (
            <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/3 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-sky-400 font-bold">{post.id}</span>
                  <span className="text-xs text-white/40">· Representante: {post.rep}</span>
                </div>
                <p className="text-sm font-semibold text-white mt-0.5">{post.child}</p>
                <p className="text-xs text-white/50">{post.prog}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-white/40 block">Scoring Social</span>
                  <span className="text-sm font-bold text-amber-400">{post.score}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${post.status === 'Aprobada' ? 'bg-emerald-500/20 text-emerald-300' : post.status === 'En Evaluación' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                  {post.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
