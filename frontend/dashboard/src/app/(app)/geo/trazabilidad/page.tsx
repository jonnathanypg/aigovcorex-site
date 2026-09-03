import { Layers, Activity, CheckCircle2, Search } from 'lucide-react';

export default function GeoTrazabilidadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-emerald-400" />
          Trazabilidad Integral de Red
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Auditoría de asignación de recursos, transferencias interinstitucionales y flujo de ejecución por programa social
        </p>
      </div>

      <div className="space-y-3">
        {[
          { id: 'TRZ-2026-001', prog: 'Programa Nutrición Integral Costa', actor: 'BID → MIES', status: 'Desembolso Validado', amount: '$1,200,000' },
          { id: 'TRZ-2026-002', prog: 'Atención Primera Infancia Guasmo', actor: 'GAD Guayaquil → Fundación Vida', status: 'Operación Activa', amount: '$350,000' },
          { id: 'TRZ-2026-003', prog: 'KindiCore AI CDI Despliegue', actor: 'Gobierno → 12 Centros', status: 'En Ejecución', amount: '1,450 Niños' },
        ].map((item, i) => (
          <div key={i} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-emerald-400 font-bold">{item.id}</span>
                <span className="text-xs text-white/50">· {item.actor}</span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">{item.prog}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-white block">{item.amount}</span>
              <span className="text-xs text-emerald-400 font-medium">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
