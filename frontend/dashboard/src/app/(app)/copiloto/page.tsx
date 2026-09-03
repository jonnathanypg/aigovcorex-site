import { Brain, Mic, BookOpen, Globe, Upload, Sparkles } from 'lucide-react';

export default function CopilotPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-pink-400" />
            Copiloto RAG
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Asistente agéntico multimodal con conocimiento institucional
          </p>
        </div>
      </div>

      {/* RAG Sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Documentos', desc: 'PDFs, Word, Excel indexados', icon: Upload, color: '#ec4899', count: '24 docs' },
          { title: 'Sitios Web', desc: 'Páginas institucionales y normativas', icon: Globe, color: '#0ea5e9', count: '8 fuentes' },
          { title: 'Audios', desc: 'Notas de voz transcritas', icon: Mic, color: '#10b981', count: '156 notas' },
        ].map((source) => (
          <div
            key={source.title}
            className="rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition-all duration-200"
            style={{ background: `${source.color}08`, border: `1px solid ${source.color}25` }}
          >
            <div className="flex items-center justify-between mb-3">
              <source.icon className="w-5 h-5" style={{ color: source.color }} />
              <span className="text-xs font-bold" style={{ color: source.color }}>
                {source.count}
              </span>
            </div>
            <p className="text-white font-semibold text-sm">{source.title}</p>
            <p className="text-white/40 text-xs mt-0.5">{source.desc}</p>
          </div>
        ))}
      </div>

      {/* Chat Interface */}
      <div
        className="rounded-2xl border flex flex-col"
        style={{
          background: 'rgba(236,72,153,0.04)',
          border: '1px solid rgba(236,72,153,0.2)',
          minHeight: '340px',
        }}
      >
        <div
          className="flex items-center gap-3 p-4 border-b"
          style={{ borderColor: 'rgba(236,72,153,0.15)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(236,72,153,0.2)' }}
          >
            <Brain className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">GovCore Copiloto</p>
            <p className="text-white/40 text-xs">Activo · Contexto cargado</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs text-pink-400 font-medium">RAG Activo</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Brain className="w-12 h-12 text-pink-500/20 mx-auto mb-3" />
            <p className="text-white/25 text-sm">Inicia una conversación con el copiloto</p>
            <p className="text-white/15 text-xs mt-1">Puedes usar texto o activar el micrófono</p>
          </div>
        </div>

        <div
          className="p-4 border-t"
          style={{ borderColor: 'rgba(236,72,153,0.15)' }}
        >
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Mic className="w-4 h-4 text-pink-400 shrink-0" />
            <span className="text-white/30 text-sm flex-1">
              Pregunta o dicta una instrucción...
            </span>
            <button
              className="px-3 py-1 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(236,72,153,0.25)', color: '#ec4899' }}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
