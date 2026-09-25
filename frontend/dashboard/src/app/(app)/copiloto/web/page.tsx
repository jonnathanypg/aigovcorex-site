'use client';

import React from 'react';
import { Globe, Plus, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function WebScrapingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Globe className="w-6 h-6" />
            </div>
            Fuentes Web y Scraping Institucional
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Indexación de sitios web gubernamentales y portales de noticias para mantener actualizado al copiloto
          </p>
        </div>
        <Button className="bg-pink-600 hover:bg-pink-500 text-white font-medium">
          <Plus className="w-4 h-4 mr-2" />
          Añadir URL
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { url: 'https://www.inclusion.gob.ec/normativa', name: 'Portal Normativo Oficial MIES', status: 'Sincronizado', pages: 48 },
          { url: 'https://gob.ec/tramites/infancia', name: 'Catálogo de Trámites de Primera Infancia', status: 'Sincronizado', pages: 112 },
        ].map((site, i) => (
          <Card key={i} className="border border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm font-semibold">{site.name}</CardTitle>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {site.status}
                </span>
              </div>
              <CardDescription className="text-xs text-pink-400/80 flex items-center gap-1 font-mono">
                {site.url} <ExternalLink className="w-3 h-3 inline" />
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-white/50 border-t border-white/5 pt-2">
              {site.pages} páginas indexadas en la base vectorial.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
