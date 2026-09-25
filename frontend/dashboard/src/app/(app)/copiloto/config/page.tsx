'use client';

import React from 'react';
import { Sliders, Save, Bot, Sparkles, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ConfigIaPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Sliders className="w-6 h-6" />
          </div>
          Configuración y Parámetros del Agente IA
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Ajuste de modelo LLM, temperatura, prompt del sistema y políticas de orquestación omnisciente
        </p>
      </div>

      <Card className="border border-white/10 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-white text-base">Personalidad y Directrices del Orquestador</CardTitle>
          <CardDescription className="text-white/50 text-xs">
            Define las instrucciones maestras que regulan el comportamiento del copiloto en todos los canales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/70">Modelo de Inferencia Principal</Label>
            <select className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white">
              <option className="bg-zinc-900" value="claude-3-5-sonnet">Claude 3.5 Sonnet (Recomendado para razonamiento)</option>
              <option className="bg-zinc-900" value="gpt-4o">GPT-4o (Multimodal Audio & Visión)</option>
              <option className="bg-zinc-900" value="gemini-1.5-pro">Gemini 1.5 Pro (Contexto Ultra Largo)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/70">System Prompt Maestro</Label>
            <Textarea
              rows={5}
              defaultValue="Eres el Agente Orquestador Omnisciente de AI GovCoreX. Tu misión es coordinar la atención ciudadana, validar postulaciones de programas sociales y supervisar el bienestar integral en los centros CDI con empatía, precisión y apego estricto a las normativas públicas."
              className="bg-white/5 border-white/10 text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Temperatura (0.0 - 1.0)</Label>
              <Input type="number" step="0.1" defaultValue="0.2" className="bg-white/5 border-white/10 text-white text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Límite de Tokens Contexto</Label>
              <Input type="number" defaultValue="8192" className="bg-white/5 border-white/10 text-white text-xs" />
            </div>
          </div>

          <div className="pt-3">
            <Button className="w-full bg-pink-600 hover:bg-pink-500 text-white font-medium">
              <Save className="w-4 h-4 mr-2" />
              Guardar Parámetros de IA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
