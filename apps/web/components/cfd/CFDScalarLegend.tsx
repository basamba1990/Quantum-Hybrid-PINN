"use client";

import type { CfdBufferField } from "@/lib/cfd/cfd-contract";

export type CFDScalarLegendProps = { field?: CfdBufferField };

function formatValue(value: number) {
  if (!Number.isFinite(value)) return "N/D";
  return Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)
    ? value.toExponential(3)
    : value.toFixed(3);
}

export default function CFDScalarLegend({ field }: CFDScalarLegendProps) {
  if (!field) return <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200" data-cfd-legend="unavailable">Scalar field unavailable</div>;
  const values = Array.from(field.values).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : Number.NaN;
  const max = values.length ? Math.max(...values) : Number.NaN;
  return (
    <div className="grid grid-cols-[18px_1fr] gap-3" data-cfd-legend={field.name}>
      <div aria-label={`Scalar scale for ${field.name}`} className="h-40 w-[18px] rounded-sm" style={{ background: "linear-gradient(to top, #2166ac 0%, #67a9cf 25%, #f7f7f7 50%, #ef8a62 75%, #b2182b 100%)" }} />
      <div className="flex h-40 flex-col justify-between text-[10px] font-mono text-slate-300">
        <div><div className="font-sans text-xs font-black uppercase tracking-widest text-white">{field.quantity}</div><div className="mt-1 text-cyan-300">{field.unit}</div></div>
        <div>{formatValue(max)}</div>
        <div>{formatValue((min + max) / 2)}</div>
        <div>{formatValue(min)}</div>
      </div>
    </div>
  );
}
