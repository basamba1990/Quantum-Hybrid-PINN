"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CfdBufferDataset } from "@/lib/cfd/cfd-contract";
import { validateCfdBufferDataset } from "@/lib/cfd/cfd-validation";
import { createCfdScene, type CfdSceneHandle } from "./CFDScene";
import CFDControls from "./CFDControls";
import CFDScalarLegend from "./CFDScalarLegend";
import ExportButtonsImproved from "@/components/export-buttons-improved";

export type CFDViewerProps = { dataset: CfdBufferDataset | null; artifactPresent?: boolean; className?: string };

function downloadText(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CFDViewer({ dataset, artifactPresent = false, className }: CFDViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
  const canAnimate = Boolean(report?.canRender && report.hasRealTransientStates && dataset && dataset.frames.length > 1);
  const exportAnimation = async () => {
    if (!dataset || !canAnimate || !canvasRef.current || typeof MediaRecorder === "undefined") return;
    const canvas = canvasRef.current;
    if (typeof canvas.captureStream !== "function") return;
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) return;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("WebM recording failed"));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    const first = times[0] ?? 0;
    const last = times[times.length - 1] ?? first;
    const durationMs = Math.max(2000, Math.min(30000, (last - first) * 1000));
    setPlaying(false);
    setTime(first);
    recorder.start();
    await new Promise<void>((resolve) => {
      const startedAt = performance.now();
      const advance = (now: number) => {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        setTime(first + (last - first) * progress);
        if (progress < 1) requestAnimationFrame(advance);
        else window.setTimeout(resolve, 120);
      };
      requestAnimationFrame(advance);
    });
    recorder.stop();
    const blob = await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cfd-${dataset.meshRevision.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.webm`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportMetadata = useMemo(() => dataset ? {
    contract: "cfd-volume.v1",
    meshRevision: dataset.meshRevision,
    pointCount: dataset.pointCount,
    cellCount: dataset.cellCount,
    frameCount: dataset.frames.length,
    times,
    fields,
    validation: {
      canRender: report?.canRender ?? false,
      canClaimValidated: report?.canClaimValidated ?? false,
      issues: report?.issues ?? [],
    },
  } : null, [dataset, fields, report, times]);

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
    if (!canvasRef.current || !frame || !report?.canRender) return;
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
  }, [frame, fieldName, isoValue, report?.canRender]);

  const exportFieldCsv = () => {
    if (!scalarField || !fieldName) return;
    const rows = ["index,value", ...Array.from(scalarField.values, (value, index) => `${index},${value}`)];
    downloadText(`${fieldName}-${frame?.time ?? 0}s.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  };

  if (!dataset) return (
    <div className={`${className ?? ""} flex min-h-[420px] items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-950/20 p-8 text-center`} data-cfd-state="missing">
      <div className="max-w-xl space-y-3">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">CFD visualization unavailable</div>
        <p className="text-sm text-slate-200">{artifactPresent ? "Artefact CFD persistant détecté; chargement volumétrique différé." : "Aucun artefact CFD réel n’est actuellement lié à cette analyse."}</p>
        <p className="text-xs leading-5 text-slate-400">{artifactPresent ? "Le contrat volumétrique est chargé depuis Storage dans le navigateur afin de préserver la mémoire du serveur." : "Importez des frames VTU et leur sidecar contractuel dans cette analyse pour activer la visualisation. Aucun maillage, champ ou résidu n’est généré par l’interface."}</p>
        <div className="font-mono text-[10px] uppercase tracking-widest text-amber-200">Status: {artifactPresent ? "CFD_DATASET_LOADING" : "NO_CFD_ARTIFACT"}</div>
      </div>
    </div>
  );
  if (!report?.canRender) return <div className={className} data-cfd-state="rejected">CFD dataset rejected: topology or fields are incompatible with rendering.</div>;

  return (
    <section ref={containerRef} className={`overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#050b14] text-slate-100 ${className ?? ""}`} data-cfd-viewer="versioned">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 px-5 py-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Volumetric CFD workspace</div>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">{dataset.meshRevision}</h3>
          <p className="mt-1 text-xs text-slate-400">Real cell connectivity · solver evidence shown separately</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">Render ready</span>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-300">{report.canClaimValidated ? "Validated" : "Unvalidated"}</span>
        </div>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3"><div className="text-lg font-black text-white">{dataset.pointCount}</div><div className="uppercase tracking-widest text-slate-500">Vertices</div></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3"><div className="text-lg font-black text-white">{dataset.cellCount}</div><div className="uppercase tracking-widest text-slate-500">Cells</div></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3"><div className="text-lg font-black text-white">{dataset.frames.length}</div><div className="uppercase tracking-widest text-slate-500">Frames</div></div>
          </div>
          <div className="relative min-h-[420px] rounded-xl border border-cyan-400/15 bg-[#08111f] p-2">
            <div className="pointer-events-none absolute left-4 top-3 z-10 text-[10px] font-black uppercase tracking-widest text-cyan-200/80">{fieldName ?? "Scalar field"} · t = {time.toFixed(3)} s</div>
            <canvas ref={canvasRef} className="block min-h-[420px] w-full" aria-label="Volumetric CFD mesh canvas" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="text-[10px] text-slate-500">Evidence status: {report.canClaimValidated ? "complete" : "incomplete; no certification claimed"}</div>
            <div className="flex flex-wrap gap-2">
              <ExportButtonsImproved containerRef={containerRef} canvasRef={canvasRef} fileName={`cfd-${dataset.meshRevision}`} jsonData={exportMetadata} showPDF showPNG showJSON showAnimation={canAnimate} onExportAnimation={exportAnimation} />
              <button type="button" onClick={exportFieldCsv} disabled={!scalarField} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">CSV field</button>
            </div>
          </div>
        </div>
        <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <CFDScalarLegend field={scalarField} />
          <CFDControls fieldName={fieldName} availableFields={fields} time={time} times={times} isoValue={isoValue} onFieldChange={setFieldName} onTimeChange={setTime} onIsoValueChange={setIsoValue} />
          <button type="button" onClick={() => setPlaying((value) => !value)} disabled={!canAnimate} className="w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{canAnimate ? (playing ? "Pause transient" : "Play transient") : "Transient playback unavailable"}</button>
          <div className="space-y-2 border-t border-white/10 pt-3 text-xs text-slate-400">
            <div className="flex justify-between"><span>Mesh revision</span><span className="max-w-[150px] truncate font-mono text-right text-slate-200">{dataset.meshRevision}</span></div>
            <div className="flex justify-between"><span>Current frame</span><span className="font-mono text-slate-200">{times.indexOf(frame?.time ?? 0) + 1}/{times.length}</span></div>
            <div className="flex justify-between"><span>Iso-surface</span><span className="text-right text-slate-200">{isoValue === undefined ? "Threshold required" : "Connectivity-derived"}</span></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
