import { Users, Search, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BeneficiariosSocialPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            Padrón Único de Beneficiarios
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Registro consolidado de infantes, familias y titulares de derecho adscritos a programas sociales
          </p>
        </div>
        <Button variant="outline" className="text-xs border-white/10 gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar Padrón
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
          <span className="text-xs text-sky-300 font-medium">Beneficiarios Activos</span>
          <p className="text-2xl font-bold text-white mt-1">4,820</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-xs text-emerald-300 font-medium">Familias en Acompañamiento</span>
          <p className="text-2xl font-bold text-white mt-1">3,450</p>
        </div>
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <span className="text-xs text-violet-300 font-medium">Cantones con Cobertura</span>
          <p className="text-2xl font-bold text-white mt-1">18</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-bold text-white mb-3">Muestra Representativa de Beneficiarios</h2>
        <div className="space-y-2">
          {[
            { name: 'Mateo Alejandro Vera', age: '18 meses', prog: 'Programa Nutrición Costa', status: 'Activo', center: 'CDI Huellitas de Amor' },
            { name: 'Luciana Belén Morales', age: '24 meses', prog: 'Atención Primera Infancia CDI', status: 'Activo', center: 'CDI Semillitas del Futuro' },
            { name: 'Emiliano José Alarcón', age: '11 meses', prog: 'Bono Nutricional Infancia', status: 'Activo', center: 'CDI Los Pequeñitos' },
          ].map((b, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{b.name} <span className="text-xs text-white/45">({b.age})</span></p>
                <p className="text-xs text-white/50">{b.prog} · {b.center}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
