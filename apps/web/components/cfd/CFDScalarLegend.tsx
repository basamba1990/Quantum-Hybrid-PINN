"use client";

import type { CfdBufferField } from "@/lib/cfd/cfd-contract";

export type CFDScalarLegendProps = { field?: CfdBufferField };

export default function CFDScalarLegend({ field }: CFDScalarLegendProps) {
  if (!field) return <div data-cfd-legend="unavailable">Champ scalaire indisponible</div>;
  const values = Array.from(field.values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <div data-cfd-legend={field.name}>
      <div>{field.quantity} ({field.unit})</div>
      <div aria-label={`Échelle ${field.name}`} style={{ background: "linear-gradient(to top, #2166ac, #f7f7f7, #b2182b)", width: 16, height: 140 }} />
      <div>{max}</div>
      <div>{min}</div>
    </div>
  );
}
