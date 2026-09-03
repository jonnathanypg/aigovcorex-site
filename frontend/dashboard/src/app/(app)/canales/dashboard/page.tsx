import { MessageSquare, PhoneCall, Network, CheckCircle, Clock } from 'lucide-react';

export default function CanalesDashboardPage() {
  const channels = [
    {
      name: 'WhatsApp Institucional',
      number: '+593 98 765 4321',
      status: 'connected',
      msgs: 284,
      icon: MessageSquare,
      color: '#10b981',
    },
    {
      name: 'Telegram MIES Nacional',
      handle: '@mies_ecuador_bot',
      status: 'connected',
      msgs: 147,
      icon: MessageSquare,
      color: '#0ea5e9',
    },
    {
      name: 'WhatsApp Programa BDH',
      number: '+593 99 123 4567',
      status: 'pending',
      msgs: 0,
      icon: MessageSquare,
      color: '#f97316',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Canales de Comunicación</h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión centralizada de WhatsApp y Telegram por institución y programa
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: '#8b5cf620', border: '1px solid #8b5cf640', color: '#8b5cf6' }}
        >
          <PhoneCall className="w-4 h-4" />
          Conectar Canal
        </button>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        {channels.map((ch, i) => (
          <div
            key={i}
            className="rounded-xl p-4 border flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${ch.color}20`, border: `1px solid ${ch.color}35` }}
            >
              <ch.icon className="w-5 h-5" style={{ color: ch.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{ch.name}</p>
              <p className="text-white/45 text-xs">{'number' in ch ? ch.number : ch.handle}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                {ch.status === 'connected' ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">Conectado</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">Pendiente</span>
                  </>
                )}
              </div>
              {ch.msgs > 0 && (
                <p className="text-[11px] text-white/30 mt-0.5">{ch.msgs} mensajes hoy</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Inheritance diagram placeholder */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Network className="w-4 h-4 text-violet-400" />
          Árbol de Herencias de Canal
        </h2>
        <p className="text-white/40 text-sm">
          Visualización de cómo los canales de la institución matriz se heredan a sus programas
          dependientes. Módulo en implementación.
        </p>
      </div>
    </div>
  );
}
