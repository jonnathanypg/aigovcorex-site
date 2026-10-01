"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  preset: string;
}

const PRESETS = [
  { key: "month", label: "Mes actual" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "custom", label: "Personalizado" },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolvePreset(preset: string, customFrom?: string, customTo?: string): { from?: string; to?: string } {
  const today = new Date();
  if (preset === "7d") {
    const s = new Date(today); s.setDate(s.getDate() - 6);
    return { from: iso(s), to: iso(today) };
  }
  if (preset === "30d") {
    const s = new Date(today); s.setDate(s.getDate() - 29);
    return { from: iso(s), to: iso(today) };
  }
  if (preset === "90d") {
    const s = new Date(today); s.setDate(s.getDate() - 89);
    return { from: iso(s), to: iso(today) };
  }
  if (preset === "custom") {
    return { from: customFrom, to: customTo };
  }
  // month = undefined -> backend usa mes actual por defecto
  return {};
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  className?: string;
}) {
  const [customFrom, setCustomFrom] = useState(value.from ?? "");
  const [customTo, setCustomTo] = useState(value.to ?? "");

  const active = useMemo(() => value.preset, [value]);

  const pick = (preset: string) => {
    if (preset === "custom") {
      onChange({ preset, from: customFrom || undefined, to: customTo || undefined });
    } else {
      const r = resolvePreset(preset);
      onChange({ preset, ...r });
    }
  };

  const applyCustom = () => {
    onChange({ preset: "custom", from: customFrom || undefined, to: customTo || undefined });
  };

  const clear = () => {
    setCustomFrom(""); setCustomTo("");
    onChange({ preset: "month" });
  };

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border/20 bg-card/50 p-3", className)}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={active === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => pick(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {(value.from || value.to) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Limpiar
          </Button>
        )}
      </div>
      {active === "custom" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={applyCustom}>
            Aplicar periodo
          </Button>
        </div>
      )}
      {(value.from || value.to) && (
        <p className="text-xs text-muted-foreground">
          Periodo: {value.from ?? "…"} → {value.to ?? "…"}
        </p>
      )}
    </div>
  );
}
