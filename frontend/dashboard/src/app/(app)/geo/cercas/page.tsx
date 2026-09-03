import { Scan, ShieldCheck, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GeoCercasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-emerald-400" />
            Cercos Digitales y Perímetros
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Delimitación georeferenciada de zonas de cobertura institucional, polígonos de intervención y límites de atención
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nuevo Cerco
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Polígono MIES Guasmo Central', area: '14.2 km²', type: 'Cobertura Directa', color: '#10b981', status: 'Activo' },
          { name: 'Cerco Vulnerabilidad Monte Sinaí', area: '8.7 km²', type: 'Prioridad Social', color: '#0ea5e9', status: 'Activo' },
          { name: 'Perímetro Rural Salitre Sector 4', area: '22.0 km²', type: 'Brigada Móvil', color: '#f97316', status: 'Activo' },
        ].map((fence, i) => (
          <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: fence.color }} />
                <h3 className="font-bold text-white text-sm">{fence.name}</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{fence.status}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/50 border-t border-white/5 pt-2">
              <span>Área: {fence.area}</span>
              <span>Tipo: {fence.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
