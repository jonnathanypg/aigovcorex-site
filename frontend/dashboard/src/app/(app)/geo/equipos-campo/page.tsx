import { Users, Phone, MapPin, Radio, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GeoEquiposCampoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Equipos y Brigadas en Campo
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Monitoreo en vivo de técnicos de territorio, educadoras comunitarias, nutricionistas y trabajadores sociales
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
          Despachar Nueva Brigada
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Brigada Médica Nutricional 1', leader: 'Dra. María Elena Ramos', phone: '+593 90 000 0006', zone: 'Guasmo Sur Sector B', status: 'En Ruta', color: '#10b981' },
          { name: 'Equipo de Intervención Familiar', leader: 'Lic. Carlos Social', phone: '+593 90 000 0007', zone: 'Monte Sinaí Sector Las Cañas', status: 'En Visita Domiciliaria', color: '#0ea5e9' },
          { name: 'Brigada Censo y Registro', leader: 'Ana Educadora', phone: '+593 90 000 0005', zone: 'Bastión Popular Bloque 1', status: 'En Sede Comunal', color: '#f97316' },
        ].map((team, i) => (
          <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">{team.name}</h3>
                <p className="text-xs text-white/50">{team.leader}</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                {team.status}
              </span>
            </div>
            <div className="text-xs text-white/70 space-y-1 bg-white/3 p-2.5 rounded-xl">
              <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> {team.zone}</p>
              <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-sky-400" /> {team.phone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
