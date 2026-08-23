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
    <div className="grid gap-3" data-cfd-controls="strict">
      <label>
        Champ
        <select value={fieldName ?? ""} onChange={(event) => onFieldChange(event.target.value)} disabled={!availableFields.length}>
          <option value="" disabled>{availableFields.length ? "Sélectionner un champ" : "Champ indisponible"}</option>
          {availableFields.map((field) => <option value={field} key={field}>{field}</option>)}
        </select>
      </label>
      <label>
        Temps
        <input type="range" min={minTime ?? 0} max={maxTime ?? 0} step="any" value={time} onChange={(event) => onTimeChange(Number(event.target.value))} disabled={times.length < 2} />
      </label>
      <label>
        Seuil d’iso-surface
        <input type="number" value={isoValue ?? ""} onChange={(event) => onIsoValueChange(event.target.value === "" ? undefined : Number(event.target.value))} placeholder="Requis par le contrat ou l’utilisateur" />
      </label>
    </div>
  );
}
