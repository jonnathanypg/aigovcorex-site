import { Shield, Users, UserCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EquiposSocialesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-sky-400" />
            Equipos y Asignación de Roles
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión de permisos, delegaciones y equipos multidisciplinarios adscritos a proyectos sociales
          </p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700 text-white text-xs">
          Asignar Miembro a Programa
        </Button>
      </div>

      <div className="space-y-3">
        {[
          { name: 'Dr. Alejandro Multilateral', email: 'demo.multilateral@govcorex.org', role: 'Director de Cooperación', prog: 'Programa Nutrición Costa', org: 'BID' },
          { name: 'Lcda. Patricia Gobierno', email: 'demo.gobierno@govcorex.org', role: 'Supervisora Nacional', prog: 'Atención Primera Infancia CDI', org: 'MIES' },
          { name: 'Ing. Roberto Municipal', email: 'demo.gad@govcorex.org', role: 'Coordinador Cantonal', prog: 'Programa Nutrición Costa', org: 'GAD Guayaquil' },
          { name: 'Dra. María Elena Ramos', email: 'demo.medico@govcorex.org', role: 'Médico Evaluador', prog: 'Programa Nutrición Costa', org: 'Fundación Vida' },
        ].map((u, i) => (
          <div key={i} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{u.name} <span className="text-xs text-sky-400 font-normal">({u.org})</span></p>
              <p className="text-xs text-white/50">{u.email} · {u.role}</p>
            </div>
            <span className="text-xs font-semibold text-white/70 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">{u.prog}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
