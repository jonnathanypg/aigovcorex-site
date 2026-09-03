import { Network, Building2, Globe, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RedInterinstitucionalPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-sky-400" />
            Red Interinstitucional
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gobernanza multiactor: vinculación de convenios entre Organismos Multilaterales, Ministerios, GADs y Organizaciones de la Sociedad Civil
          </p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700 text-white text-xs">
          Vincular Nuevo Organismo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Banco Interamericano de Desarrollo (BID)', type: 'Organismo Multilateral', programs: 2, role: 'Financiador & Cooperante', color: '#8b5cf6' },
          { name: 'Ministerio de Inclusión Económica y Social (MIES)', type: 'Gobierno Central', programs: 5, role: 'Rector de Política Pública', color: '#0ea5e9' },
          { name: 'GAD Municipal de Guayaquil', type: 'Gobierno Autónomo Descentralizado', programs: 3, role: 'Ejecutor Territorial', color: '#10b981' },
          { name: 'Fundación Vida y Esperanza', type: 'Organización Sin Fines de Lucro', programs: 1, role: 'Operador de CDI', color: '#f97316' },
        ].map((org, i) => (
          <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">{org.name}</h3>
                <p className="text-xs text-white/50">{org.type}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${org.color}20`, color: org.color }}>{org.programs} Programas</span>
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-white/60 flex items-center justify-between">
              <span>Rol Institucional:</span>
              <span className="font-semibold text-white">{org.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
