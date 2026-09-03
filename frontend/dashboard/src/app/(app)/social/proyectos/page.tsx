import { Layers, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProyectosActivosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            Proyectos de Intervención Activos
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Planes operativos anuales, convenios específicos de cooperación y proyectos de desarrollo
          </p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700 text-white text-xs">
          Nuevo Proyecto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Reducción DCI Guasmo 2026', org: 'BID + GAD Guayaquil', budget: '$450,000', progress: 65, status: 'En Ejecución' },
          { name: 'Equipamiento Tecnológico CDIs Litoral', org: 'MIES + Fundación Vida', budget: '$180,000', progress: 90, status: 'Fase Final' },
          { name: 'Seguimiento Nutricional Rural Daule', org: 'GAD Daule + MIES', budget: '$95,000', progress: 30, status: 'Inicio' },
        ].map((p, i) => (
          <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-white text-sm">{p.name}</h3>
                <p className="text-xs text-white/50">{p.org}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">{p.status}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="bg-sky-400 h-2 rounded-full" style={{ width: `${p.progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>Presupuesto: {p.budget}</span>
              <span>{p.progress}% Ejecutado</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
