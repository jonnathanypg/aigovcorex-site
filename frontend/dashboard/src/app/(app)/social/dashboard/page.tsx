import { LayoutGrid, ClipboardList, Users, MapPin, Activity } from 'lucide-react';

export default function SocialDashboardPage() {
  const stats = [
    { label: 'Programas Activos', value: '12', change: '+3 este mes', icon: ClipboardList, color: '#0ea5e9' },
    { label: 'Beneficiarios Totales', value: '4,820', change: '+124 nuevos', icon: Users, color: '#10b981' },
    { label: 'Instituciones Vinculadas', value: '38', change: '8 multilaterales', icon: LayoutGrid, color: '#8b5cf6' },
    { label: 'Cobertura Geográfica', value: '18 Cantones', change: '3 provincias', icon: MapPin, color: '#f97316' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Programas Sociales</h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión integral de programas e intervenciones sociales
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: '#0ea5e920', border: '1px solid #0ea5e940', color: '#0ea5e9' }}
        >
          <ClipboardList className="w-4 h-4" />
          Nuevo Programa
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01]"
            style={{ background: `${stat.color}08`, border: `1px solid ${stat.color}25` }}
          >
            <div className="flex items-start justify-between mb-3">
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              <Activity className="w-4 h-4 text-white/20" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{stat.label}</p>
            <p className="text-xs mt-2 font-medium" style={{ color: stat.color }}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Programs List */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-sky-400" />
          Programas Activos
        </h2>
        <div className="space-y-3">
          {[
            'Alimentación Escolar Nacional',
            'Bono Desarrollo Humano — Ciclo 2026',
            'Brigadas de Salud Comunitaria Costa',
          ].map((prog, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-white/4 border border-white/6 hover:bg-white/6 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: '#0ea5e9' }} />
                <span className="text-white/80 text-sm font-medium">{prog}</span>
              </div>
              <span className="text-xs text-white/35 font-mono">Ver →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
