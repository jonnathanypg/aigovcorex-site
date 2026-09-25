'use client';

import React from 'react';
import { Mic, Volume2, Sparkles, Radio, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function VozInteractivaPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Mic className="w-6 h-6" />
          </div>
          Voz Interactiva y Asistente de Audio
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Interacción vocal con el copiloto agéntico en tiempo real (TTS y STT multimodal)
        </p>
      </div>

      <Card className="border border-white/10 bg-white/[0.02] text-center p-12">
        <div className="w-24 h-24 rounded-full bg-pink-500/10 border-2 border-pink-500/30 mx-auto flex items-center justify-center text-pink-400 mb-6 shadow-xl shadow-pink-500/10 animate-pulse">
          <Mic className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-white">Canal de Voz Bidireccional</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto mt-2">
          Habla directamente con el copiloto para consultar expedientes, reportes de nutrición o emitir directrices operativas con transcripción instantánea.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button className="bg-pink-600 hover:bg-pink-500 text-white font-semibold px-6 py-2.5">
            <Radio className="w-4 h-4 mr-2 animate-ping" />
            Iniciar Sesión de Voz
          </Button>
        </div>
      </Card>
    </div>
  );
}
