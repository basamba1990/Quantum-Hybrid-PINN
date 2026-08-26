"use client";

export type CFDControlsProps = {
  fieldName?: string;
  availableFields: readonly string[];
  time: number;
  times: readonly number[];
  isoValue?: number;
  onFieldChange: (field: string) => void;
  onTimeChange: (time: number) => void;
  onIsoValueChange: (value: number | undefined) => void;
};

export default function CFDControls({ fieldName, availableFields, time, times, isoValue, onFieldChange, onTimeChange, onIsoValueChange }: CFDControlsProps) {
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  return (
    <div className="grid gap-4" data-cfd-controls="strict">
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Scalar field
        <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-400/60" value={fieldName ?? ""} onChange={(event) => onFieldChange(event.target.value)} disabled={!availableFields.length}>
          <option value="" disabled>{availableFields.length ? "Select a field" : "Field unavailable"}</option>
          {availableFields.map((field) => <option value={field} key={field}>{field}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Simulation time
        <input className="accent-cyan-400" type="range" min={minTime ?? 0} max={maxTime ?? 0} step="any" value={time} onChange={(event) => onTimeChange(Number(event.target.value))} disabled={times.length < 2} />
        <span className="font-mono text-[10px] normal-case tracking-normal text-slate-300">{time.toFixed(4)} s · {times.length} available states</span>
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Iso-surface threshold
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-400/60" type="number" value={isoValue ?? ""} onChange={(event) => onIsoValueChange(event.target.value === "" ? undefined : Number(event.target.value))} placeholder="Required by user or case contract" />
      </label>
    </div>
  );
}
