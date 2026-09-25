'use client';

import React from 'react';
import { BookOpen, Upload, FileText, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DocumentosRagPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            Documentos e Indexación RAG
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión de manuales de atención, reglamentos y normativas vectorizadas para el copiloto
          </p>
        </div>
        <Button className="bg-pink-600 hover:bg-pink-500 text-white font-medium">
          <Upload className="w-4 h-4 mr-2" />
          Subir Documento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Manual de Operaciones CDI 2026.pdf', size: '4.2 MB', vectors: '1,420 chunks', date: '12 Sep 2026' },
          { name: 'Normativa MIES Salud y Nutrición.docx', size: '1.8 MB', vectors: '680 chunks', date: '08 Sep 2026' },
          { name: 'Protocolo de Emergencias Infantiles.pdf', size: '2.5 MB', vectors: '920 chunks', date: '01 Sep 2026' },
        ].map((doc, i) => (
          <Card key={i} className="border border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <FileText className="w-5 h-5 text-pink-400" />
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  INDEXADO
                </span>
              </div>
              <CardTitle className="text-white text-sm mt-2">{doc.name}</CardTitle>
              <CardDescription className="text-xs text-white/40">{doc.size} • {doc.vectors}</CardDescription>
            </CardHeader>
            <CardContent className="text-[11px] text-white/40 pt-2 border-t border-white/5">
              Actualizado: {doc.date}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
