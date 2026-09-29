"use client";
/** Selector niño/a con autocomplete: escribe nombre/letras -> filtra opciones ->
 * al seleccionar precarga datos previos (familia, padres, cédula, fecha). */
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { childrenService } from "@/services/children.service";
import { cn } from "@/lib/utils";

export interface ChildOption {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  cedula: string | null;
  birth_date: string | null;
  age_display?: string;
  gender?: string;
  family_id?: number;
  representative?: { full_name: string; relationship: string; phone?: string } | null;
}

export interface ChildFull {
  child: { id: number; first_name: string; last_name: string; cedula?: string | null; birth_date?: string | null; gender?: string };
  family: Record<string, unknown>;
  representatives: Array<{ first_name: string; last_name: string; full_name: string; relationship: string; phone?: string; cedula?: string }>;
  last_vulnerability?: {
    answers?: Record<string, unknown>; scores?: Record<string, number>; subtotals?: Record<string, number>;
    total?: number; code?: string; status?: string;
  } | null;
  last_socioeconomic?: {
    incomes?: Record<string, unknown>; expenses?: Record<string, unknown>;
    total?: number; classification?: string; per_capita?: number; code?: string;
  } | null;
}

interface Props {
  label?: string;
  placeholder?: string;
  onSelect: (opt: ChildOption | null, full: ChildFull | null) => void;
}

export function ChildSearchSelect({ label = "Vincular niño/a *", placeholder = "Escriba el nombre o letras…", onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ChildOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ChildOption | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query || query.trim().length < 1) {
      setOptions([]);
      setOpen(false);
      return;
    }
    if (selected && query === selected.full_name) return;
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await childrenService.search(query.trim(), 10);
        setOptions(res as ChildOption[]);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, selected]);

  const pick = async (opt: ChildOption) => {
    setSelected(opt);
    setQuery(opt.full_name);
    setOpen(false);
    try {
      const full = await childrenService.getById(opt.id) as unknown as ChildFull;
      onSelect(opt, full);
    } catch {
      onSelect(opt, null);
    }
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setOptions([]);
    setOpen(false);
    onSelect(null, null);
  };

  return (
    <div className="relative">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (selected) setSelected(null); }}
          onFocus={() => { if (options.length) setOpen(true); }}
          placeholder={placeholder}
          className={cn(selected && "border-green-500")}
        />
        {(selected || query) && (
          <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground px-2 shrink-0">
            Limpiar
          </button>
        )}
      </div>
      {loading && <p className="text-xs text-muted-foreground mt-1">Buscando…</p>}
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-popover shadow-lg">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/70 flex flex-col"
              >
                <span className="font-medium">{o.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {[o.cedula ? `CI ${o.cedula}` : null, o.birth_date ? `Nac. ${String(o.birth_date).slice(0, 10)}` : null, o.age_display ?? null].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && query.trim().length >= 1 && options.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">Sin coincidencias — puede registrar al niño/a manualmente abajo.</p>
      )}
      {selected && (
        <p className="text-xs text-green-600 mt-1">Vinculado: {selected.full_name} — se precargaron los datos previos guardados.</p>
      )}
    </div>
  );
}
