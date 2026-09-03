'use client';

import dynamic from 'next/dynamic';
import { Map, AlertTriangle, Users, Network, Scan, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dynamic import with SSR false for Leaflet DOM binding
const InteractiveGeoMap = dynamic(
  () => import('@/components/geo/interactive-geo-map').then((mod) => mod.InteractiveGeoMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] w-full rounded-2xl border border-emerald-500/20 bg-zinc-950/80 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <span className="text-xs text-white/50 font-medium">Cargando Mapa Geoespacial OpenStreetMap...</span>
      </div>
    ),
  }
);

export default function GeoMapaPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-emerald-400" />
            Geo Análisis Territorial
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Inteligencia Geoespacial, telemetría de campo y monitoreo de alertas en tiempo real
          </p>
        </div>
      </div>

      {/* Map Interactive Canvas */}
      <InteractiveGeoMap />
    </div>
  );
}
