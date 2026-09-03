import { AlertTriangle, TrendingUp, ShieldAlert, MapPin, Activity } from 'lucide-react';

export default function GeoHeatmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Mapa de Calor e Incidencias Nutricionales
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Detección de clusters territoriales de vulnerabilidad, desnutrición crónica infantil y alertas epidemiológicas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex justify-between items-start mb-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">ALTA PRIORIDAD</span>
          </div>
          <p className="text-2xl font-bold text-white">4 Casos</p>
          <p className="text-xs text-white/50">Zona 8 - Guasmo Sur (Guayaquil)</p>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex justify-between items-start mb-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">MEDIA</span>
          </div>
          <p className="text-2xl font-bold text-white">6 Casos</p>
          <p className="text-xs text-white/50">Monte Sinaí - Anemia Leve</p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex justify-between items-start mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">RECUPERADOS</span>
          </div>
          <p className="text-2xl font-bold text-white">28 Niños</p>
          <p className="text-xs text-white/50">Recuperación Nutricional 2026</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
        <h2 className="text-base font-bold text-white mb-4">Registro de Incidencias Activas en Territorio</h2>
        <div className="space-y-2">
          {[
            { zone: 'Guasmo Sur', desc: 'DCI Moderada identificada en tamizaje de brigada', type: 'DCI Crítica', date: 'Hoy' },
            { zone: 'Monte Sinaí', desc: 'Alerta de hemoglobina baja en 6 beneficiarios', type: 'Anemia', date: 'Ayer' },
            { zone: 'Bastión Popular', desc: 'Falta de carnet de vacunación en 12 infantes', type: 'Vacunación', date: '26 Feb 2026' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/5 hover:bg-white/7 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.zone} · <span className="text-red-300 font-normal">{item.type}</span></p>
                  <p className="text-xs text-white/45">{item.desc}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-white/40">{item.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
