import { FileText, Download, BarChart2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportesSocialesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-sky-400" />
            Reportes e Informes de Impacto Social
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Generación automatizada de informes para organismos multilaterales, rendición de cuentas y auditorías
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { title: 'Informe Trimestral de Ejecución IDII - BID Q1 2026', format: 'PDF / Excel', date: '28 Feb 2026', size: '2.4 MB' },
          { title: 'Matriz Consolidada de Cobertura y Focalización Territorial', format: 'Excel', date: '25 Feb 2026', size: '4.8 MB' },
          { title: 'Rendición de Cuentas Fondos de Inclusión GAD Guayaquil', format: 'PDF', date: '20 Feb 2026', size: '1.2 MB' },
        ].map((rep, i) => (
          <div key={i} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{rep.title}</p>
                <p className="text-xs text-white/50">{rep.format} · {rep.size} · Generado el {rep.date}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs border-white/10 gap-1.5">
              <Download className="w-3.5 h-3.5" /> Descargar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
