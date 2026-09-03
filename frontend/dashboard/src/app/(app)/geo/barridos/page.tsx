import { Radio, Users, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GeoBarridosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-400" />
            Barridos Territoriales
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Campañas de levantamiento puerta a puerta, censo focalizado y registro social georreferenciado
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
          Iniciar Nueva Campaña
        </Button>
      </div>

      <div className="space-y-3">
        {[
          { name: 'Barrido Censo Nutricional 2026 - Guasmo', progress: 78, completed: 312, total: 400, status: 'En Progreso', brigadas: 8 },
          { name: 'Identificación Familias Vulnerables - Monte Sinaí', progress: 100, completed: 250, total: 250, status: 'Completado', brigadas: 5 },
          { name: 'Levantamiento Primera Infancia Rural - Daule', progress: 42, completed: 126, total: 300, status: 'En Progreso', brigadas: 4 },
        ].map((barrido, i) => (
          <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">{barrido.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${barrido.status === 'Completado' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{barrido.status}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${barrido.progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{barrido.completed} de {barrido.total} hogares visitados ({barrido.progress}%)</span>
              <span>{barrido.brigadas} brigadas en campo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
