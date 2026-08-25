"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CfdBufferDataset } from "@/lib/cfd/cfd-contract";
import { validateCfdBufferDataset } from "@/lib/cfd/cfd-validation";
import { createCfdScene, type CfdSceneHandle } from "./CFDScene";
import CFDControls from "./CFDControls";
import CFDScalarLegend from "./CFDScalarLegend";

export type CFDViewerProps = { dataset: CfdBufferDataset | null; className?: string };

export default function CFDViewer({ dataset, className }: CFDViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<CfdSceneHandle | null>(null);
  const [time, setTime] = useState(0);
  const [fieldName, setFieldName] = useState<string | undefined>(undefined);
  const [isoValue, setIsoValue] = useState<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const report = useMemo(() => dataset ? validateCfdBufferDataset(dataset) : null, [dataset]);
  const frame = useMemo(() => {
    if (!dataset || !dataset.frames.length) return null;
    let selected = dataset.frames[0];
    for (const candidate of dataset.frames) if (candidate.time <= time) selected = candidate;
    return selected;
  }, [dataset, time]);
  const fields = useMemo(() => frame ? [...new Set([...frame.pointData.keys(), ...frame.cellData.keys()])] : [], [frame]);
  const scalarField = fieldName ? frame?.pointData.get(fieldName) ?? frame?.cellData.get(fieldName) : undefined;
  const times = useMemo(() => dataset?.frames.map((item) => item.time) ?? [], [dataset]);
  const canAnimate = Boolean(report?.valid && report.hasRealTransientStates && dataset && dataset.frames.length > 1);

  useEffect(() => {
    if (!fieldName && fields.length) setFieldName(fields[0]);
  }, [fieldName, fields]);

  useEffect(() => {
    if (!playing || !canAnimate || !dataset) return;
    let raf = 0;
    let previous = performance.now();
    const loop = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      const first = times[0];
      const last = times[times.length - 1];
      const next = time + delta * (last - first) / Math.max(last - first, Number.EPSILON);
      setTime(next > last ? first : next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canAnimate, dataset, playing, time, times]);

  useEffect(() => {
    if (!canvasRef.current || !frame || !report?.valid) return;
    sceneRef.current?.dispose();
    try {
      const handle = createCfdScene(canvasRef.current, frame, fieldName, isoValue);
      sceneRef.current = handle;
      let raf = 0;
      const render = () => { handle.renderer.render(handle.scene, handle.camera); raf = requestAnimationFrame(render); };
      render();
      return () => { cancelAnimationFrame(raf); handle.dispose(); sceneRef.current = null; };
    } catch {
      sceneRef.current = null;
      return undefined;
    }
  }, [frame, fieldName, isoValue, report?.valid]);

  if (!dataset) return <div className={className} data-cfd-state="missing">Maillage CFD indisponible : aucun artefact réel chargé.</div>;
  if (!report?.valid) return <div className={className} data-cfd-state="rejected">Dataset CFD rejeté : topologie, champs ou preuves incomplets.</div>;

  return (
    <section className={className} data-cfd-viewer="versioned">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1"><canvas ref={canvasRef} style={{ display: "block", width: "100%", minHeight: 420 }} /></div>
        <aside className="w-56"><CFDScalarLegend field={scalarField} /><CFDControls fieldName={fieldName} availableFields={fields} time={time} times={times} isoValue={isoValue} onFieldChange={setFieldName} onTimeChange={setTime} onIsoValueChange={setIsoValue} /><button type="button" onClick={() => setPlaying((value) => !value)} disabled={!canAnimate}>{canAnimate ? (playing ? "Pause" : "Animer") : "Animation indisponible"}</button><p>Révision : {dataset.meshRevision}</p><p>{dataset.cellCount} cellules · {dataset.pointCount} sommets</p><p>{isoValue === undefined ? "Iso-surface : seuil requis" : "Iso-surface : extraite depuis la connectivité réelle"}</p></aside>
      </div>
    </section>
  );
}
