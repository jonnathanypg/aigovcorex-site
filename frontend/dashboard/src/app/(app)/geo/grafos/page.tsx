import { Network, Building2, Globe, Users, ArrowRight } from 'lucide-react';

export default function GeoGrafosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Network className="w-6 h-6 text-emerald-400" />
          Grafo Institucional y Red Multiactor
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Topología de relaciones interinstitucionales entre Multilaterales (BID), Gobierno (MIES), GADs, ONGs y Centros Operativos
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">Vínculos Institucionales Activos en el Grafo</h2>
        <div className="space-y-3">
          {[
            { source: 'Banco Interamericano de Desarrollo (BID)', rel: 'Financia Programa IDII', target: 'MIES Ecuador (Nivel Nacional)', color: '#8b5cf6' },
            { source: 'MIES Ecuador (Nivel Nacional)', rel: 'Convenio de Cooperación', target: 'GAD Municipal de Guayaquil', color: '#0ea5e9' },
            { source: 'GAD Municipal de Guayaquil', rel: 'Opera y Supervisa', target: 'Fundación Vida y Esperanza (ONG)', color: '#10b981' },
            { source: 'Fundación Vida y Esperanza (ONG)', rel: 'Administra Centro', target: 'CDI Huellitas de Amor (Guasmo Sur)', color: '#f97316' }
          ].map((edge, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/3 border border-white/6 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-white text-xs">{edge.source}</span>
              <div className="flex items-center gap-2 text-[11px] font-mono px-2 py-1 rounded bg-white/5 border border-white/10" style={{ color: edge.color }}>
                <span>{edge.rel}</span>
                <ArrowRight className="w-3 h-3" />
              </div>
              <span className="font-semibold text-white/80 text-xs">{edge.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
