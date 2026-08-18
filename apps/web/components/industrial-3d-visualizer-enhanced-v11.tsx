"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Download, Pause, Play, Video } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import {
  normalizeVisualizationPoints,
  type VisualizationMetadata,
  type VisualizationPoint,
  type VisualizationScenario,
} from "@/lib/visualization-data";

interface Props {
  data?: unknown;
  experimentalData?: unknown;
  metadata?: VisualizationMetadata;
  title?: string;
  colorVariable?: string;
  scenarioType?: VisualizationScenario;
  geometryAssetUrl?: string;
  metrics?: unknown;
  quality?: string;
}

const SCENARIO_GEOMETRIES: Record<string, { shape: string; radius: number; length: number; description: string }> = {
  LH2_STORAGE: { shape: "cylinder_vertical", radius: 3, length: 8, description: "LH2 CRYOGENIC STORAGE" },
  HEAVY_DUTY_HYDROGEN_REFUELING: { shape: "cylinder_horizontal", radius: 0.025, length: 2.55, description: "Manifold DN50 B-Rep" },
  LH2_INFRASTRUCTURE_INTEGRITY: { shape: "cylinder_horizontal", radius: 0.025, length: 2, description: "LH2 DN50 Pipeline" },
  LH2_LARGE_SCALE_STORAGE_1250M3: { shape: "sphere", radius: 6.73, length: 13.46, description: "Sphère LH2 1250 m³" },
};

const TRANSITION_FRAMES = 60;
const TRANSITION_FPS = 30;

const finiteValue = (value: unknown): number | undefined => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const csvCell = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const waitForNextFrame = (): Promise<void> =>
  new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

export default function Industrial3DVisualizerEnhancedV11({
  data = [],
  experimentalData = [],
  metadata,
  title = "Visualisation CFD",
  colorVariable = "temperature",
  scenarioType = "LH2_STORAGE",
  geometryAssetUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const applyPhaseRef = useRef<(phase: number) => void>(() => undefined);
  const renderOnceRef = useRef<() => void>(() => undefined);
  const animationPhaseRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(0.02);
  const amplitudeRef = useRef(0.15);
  const forceApplyRef = useRef(true);

  const [isMounted, setIsMounted] = useState(false);
  const [activeVariable, setActiveVariable] = useState(colorVariable || "temperature");
  const [colorScale, setColorScale] = useState<"thermal" | "viridis" | "coolwarm">("thermal");
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(0.02);
  const [animAmplitude, setAnimAmplitude] = useState(0.15);
  const [exportStatus, setExportStatus] = useState<string>("");

  const volumetricData = useMemo(() => normalizeVisualizationPoints(data), [data]);
  const measuredData = useMemo(() => normalizeVisualizationPoints(experimentalData), [experimentalData]);

  const stats = useMemo(() => {
    const values = volumetricData
      .map((point) => point[activeVariable])
      .map(finiteValue)
      .filter((value): value is number => value !== undefined);
    const minV = values.length ? Math.min(...values) : 0;
    const maxV = values.length ? Math.max(...values) : 100;
    return {
      minV,
      maxV,
      avgV: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      count: volumetricData.length,
      fieldCount: values.length,
      unit: metadata?.fields?.[activeVariable]?.unit || "SI",
    };
  }, [activeVariable, metadata, volumetricData]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    speedRef.current = animSpeed;
    amplitudeRef.current = animAmplitude;
    forceApplyRef.current = true;
  }, [animAmplitude, animSpeed, isPlaying]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const getColorFromScale = useCallback(
    (value: number, min: number, max: number, scale: string): THREE.Color => {
      const range = Math.max(max - min, 1e-12);
      const normalized = Math.max(0, Math.min(1, (value - min) / range));
      const stops =
        scale === "thermal"
          ? ["#180f3d", "#721f81", "#bb3754", "#ed6925", "#fbb61a", "#f0f921"]
          : scale === "coolwarm"
            ? ["#3b4cc0", "#77aadd", "#dddddd", "#ee8866", "#b40426"]
            : ["#440154", "#31688e", "#35b779", "#fde725"];
      const scaled = normalized * (stops.length - 1);
      const index = Math.min(stops.length - 2, Math.floor(scaled));
      return new THREE.Color(stops[index]).lerp(new THREE.Color(stops[index + 1]), scaled - index);
    },
    [],
  );

  const buildStaticCsv = useCallback((): string => {
    if (!volumetricData.length) return "";
    const keys = Array.from(
      new Set(volumetricData.flatMap((point) => Object.keys(point))),
    ).filter((key) => volumetricData.some((point) => point[key] !== undefined));
    const rows = volumetricData.map((point) => keys.map((key) => csvCell(point[key])).join(","));
    return `${keys.join(",")}\n${rows.join("\n")}\n`;
  }, [volumetricData]);

  const exportCSV = useCallback(() => {
    const csv = buildStaticCsv();
    if (!csv) return;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${scenarioType}_field.csv`);
  }, [buildStaticCsv, scenarioType]);

  const exportSTL = useCallback(() => {
    if (!sceneRef.current) return;
    const result = new STLExporter().parse(sceneRef.current, { binary: true });
    downloadBlob(new Blob([result], { type: "application/octet-stream" }), `${scenarioType}_geometry.stl`);
  }, [scenarioType]);

  const buildTransitionCsv = useCallback((): string => {
    if (!volumetricData.length) return "";
    const fieldKeys = Array.from(new Set(volumetricData.flatMap((point) => Object.keys(point)))).filter(
      (key) => !["x", "y", "z"].includes(key) && volumetricData.some((point) => point[key] !== undefined),
    );
    const headers = ["frame", "phase", "x_rendered", "y_rendered", "z_rendered", ...fieldKeys, "rendered_value"];
    const rows: string[] = [headers.join(",")];
    for (let frame = 0; frame < TRANSITION_FRAMES; frame += 1) {
      const phase = frame / (TRANSITION_FRAMES - 1);
      for (const point of volumetricData) {
        const baseValue = finiteValue(point[activeVariable]) ?? 0;
        const wave = Math.sin(phase * Math.PI * 2 + point.x * 10) * amplitudeRef.current;
        const radialScale = 1 + wave;
        const values = [
          frame,
          phase.toFixed(6),
          point.x,
          point.y * radialScale,
          point.z * radialScale,
          ...fieldKeys.map((key) => point[key]),
          baseValue * (1 + wave * 0.2),
        ];
        rows.push(values.map(csvCell).join(","));
      }
    }
    return `${rows.join("\n")}\n`;
  }, [activeVariable, volumetricData]);

  const recordTransition = useCallback(async (): Promise<Blob | null> => {
    const renderer = rendererRef.current;
    if (!renderer || typeof renderer.domElement.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      return null;
    }
    const stream = renderer.domElement.captureStream(TRANSITION_FPS);
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("MediaRecorder a signalé une erreur."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    const previousPhase = animationPhaseRef.current;
    const previousPlaying = isPlayingRef.current;
    isPlayingRef.current = false;
    recorder.start();
    for (let frame = 0; frame < TRANSITION_FRAMES; frame += 1) {
      const phase = frame / (TRANSITION_FRAMES - 1);
      animationPhaseRef.current = phase;
      applyPhaseRef.current(phase);
      renderOnceRef.current();
      await waitForNextFrame();
    }
    recorder.stop();
    const blob = await stopped;
    stream.getTracks().forEach((track) => track.stop());
    animationPhaseRef.current = previousPhase;
    isPlayingRef.current = previousPlaying;
    forceApplyRef.current = true;
    setAnimationPhase(previousPhase);
    return blob;
  }, []);

  const exportTransition = useCallback(async () => {
    if (!volumetricData.length || exportStatus) return;
    setExportStatus("Préparation de la transition…");
    try {
      const [videoBlob, transitionCsv] = await Promise.all([recordTransition(), Promise.resolve(buildTransitionCsv())]);
      const metadataPayload = {
        scenario_type: scenarioType,
        title,
        frames: TRANSITION_FRAMES,
        fps: TRANSITION_FPS,
        duration_s: TRANSITION_FRAMES / TRANSITION_FPS,
        active_variable: activeVariable,
        field_unit: stats.unit,
        animation: {
          phase_definition: "phase in [0,1]",
          speed: animSpeed,
          amplitude: animAmplitude,
          model: "SPH-inspired visualization of the persisted field; not a new CFD solve",
        },
        persisted_points: volumetricData.length,
        measured_points: measuredData.length,
        source: metadata?.source_label ?? "source non fournie",
        geometry: SCENARIO_GEOMETRIES[scenarioType] ?? null,
      };
      const files: Record<string, Uint8Array> = {
        "transition.csv": strToU8(transitionCsv),
        "metadata.json": strToU8(JSON.stringify(metadataPayload, null, 2)),
      };
      if (videoBlob) files["transition.webm"] = new Uint8Array(await videoBlob.arrayBuffer());
      const archive = zipSync(files, { level: 6 });
      downloadBlob(
        new Blob([archive], { type: "application/zip" }),
        `${scenarioType}_transition_export.zip`,
      );
      setExportStatus(videoBlob ? "Transition ZIP téléchargée" : "ZIP CSV + métadonnées téléchargée (vidéo indisponible)");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Échec de l’export de transition.");
    } finally {
      window.setTimeout(() => setExportStatus(""), 5000);
    }
  }, [activeVariable, animAmplitude, animSpeed, buildTransitionCsv, exportStatus, measuredData.length, metadata, recordTransition, scenarioType, stats.unit, title, volumetricData.length]);

  useEffect(() => {
    if (!isMounted || !containerRef.current || !volumetricData.length) return;
    const container = containerRef.current;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 420);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(3.4, 2.6, 3.4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    scene.add(new THREE.GridHelper(10, 20, 0x1e293b, 0x0f172a));
    scene.add(new THREE.AxesHelper(1));

    const voxelGeometry = new THREE.BoxGeometry(0.018, 0.018, 0.018);
    const voxelMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    const instancedMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, volumetricData.length);
    const dummy = new THREE.Object3D();
    const basePositions = volumetricData.map((point) => new THREE.Vector3(point.x, point.y, point.z));

    const applyPhase = (phase: number) => {
      const amplitude = amplitudeRef.current;
      for (let index = 0; index < volumetricData.length; index += 1) {
        const point = volumetricData[index];
        const base = basePositions[index];
        const wave = Math.sin(phase * Math.PI * 2 + point.x * 10) * amplitude;
        const radialScale = 1 + wave;
        dummy.position.set(base.x, base.y * radialScale, base.z * radialScale);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(index, dummy.matrix);
        const baseValue = finiteValue(point[activeVariable]) ?? stats.minV;
        instancedMesh.setColorAt(index, getColorFromScale(baseValue * (1 + wave * 0.2), stats.minV, stats.maxV, colorScale));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      forceApplyRef.current = false;
    };
    applyPhaseRef.current = applyPhase;

    let cadModel: THREE.Object3D | null = null;
    if (geometryAssetUrl) {
      new GLTFLoader().load(
        geometryAssetUrl,
        (gltf) => {
          cadModel = gltf.scene;
          const box = new THREE.Box3().setFromObject(cadModel);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDimension = Math.max(size.x, size.y, size.z, 1e-9);
          const scale = 3 / maxDimension;
          cadModel.scale.setScalar(scale);
          cadModel.position.sub(center.multiplyScalar(scale));
          cadModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.3,
                wireframe: true,
              });
            }
          });
          scene.add(cadModel);
        },
        undefined,
        () => undefined,
      );
    }

    const renderOnce = () => {
      controls.update();
      renderer.render(scene, camera);
    };
    renderOnceRef.current = renderOnce;

    let animationFrameId = 0;
    let previousTimestamp = performance.now();
    const animate = (timestamp: number) => {
      animationFrameId = window.requestAnimationFrame(animate);
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;
      if (isPlayingRef.current) {
        animationPhaseRef.current = (animationPhaseRef.current + deltaSeconds * speedRef.current) % 1;
        forceApplyRef.current = true;
      }
      if (forceApplyRef.current || isPlayingRef.current) {
        applyPhaseRef.current(animationPhaseRef.current);
      }
      renderOnce();
    };
    animationFrameId = window.requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(container.clientWidth, 320);
      const nextHeight = Math.max(container.clientHeight, 420);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      renderOnce();
    });
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      voxelGeometry.dispose();
      voxelMaterial.dispose();
      if (cadModel) {
        cadModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const material = child.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material.dispose();
          }
        });
      }
      container.replaceChildren();
      applyPhaseRef.current = () => undefined;
      renderOnceRef.current = () => undefined;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [activeVariable, colorScale, geometryAssetUrl, getColorFromScale, isMounted, stats.maxV, stats.minV, volumetricData]);

  const updatePhase = (phase: number) => {
    animationPhaseRef.current = phase;
    setAnimationPhase(phase);
    forceApplyRef.current = true;
  };

  return (
    <div className="relative flex h-full min-h-[720px] w-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#020617] p-6 shadow-2xl md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white">{title}</h3>
          <p className="font-mono text-[10px] text-cyan-400">
            {metadata?.source_label || "Données persistées"} — {stats.count.toLocaleString()} points
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((value) => !value)}
            disabled={!volumetricData.length}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isPlaying ? "bg-amber-600 text-white" : "bg-white/5 text-amber-400"}`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Animer SPH / PINN"}
          </button>
          <button
            type="button"
            onClick={exportTransition}
            disabled={!volumetricData.length || Boolean(exportStatus)}
            className="flex items-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-900/30 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Video size={14} /> Export transition ZIP
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] font-black uppercase tracking-widest text-slate-300 md:grid-cols-3">
        <label className="flex items-center gap-3">
          <span className="w-16 text-amber-400">Phase</span>
          <input className="flex-1 accent-amber-500" type="range" min="0" max="1" step="0.001" value={animationPhase} onChange={(event) => updatePhase(Number(event.target.value))} />
          <span className="w-12 text-right font-mono text-white">{animationPhase.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-16 text-amber-400">Vitesse</span>
          <input className="flex-1 accent-amber-500" type="range" min="0.001" max="0.1" step="0.001" value={animSpeed} onChange={(event) => setAnimSpeed(Number(event.target.value))} />
          <span className="w-12 text-right font-mono text-white">{animSpeed.toFixed(3)}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-16 text-amber-400">Amplitude</span>
          <input className="flex-1 accent-amber-500" type="range" min="0" max="0.5" step="0.01" value={animAmplitude} onChange={(event) => setAnimAmplitude(Number(event.target.value))} />
          <span className="w-12 text-right font-mono text-white">{animAmplitude.toFixed(2)}</span>
        </label>
      </div>

      {exportStatus && <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-fuchsia-300">{exportStatus}</p>}

      <div className="relative min-h-[500px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-4 right-4 top-4 flex w-14 flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 p-2">
          <div className="text-center text-[8px] font-bold uppercase text-white">{activeVariable}</div>
          <div className="my-2 w-3 flex-1 rounded-full" style={{ backgroundImage: "linear-gradient(to top, #180f3d, #721f81, #bb3754, #ed6925, #fbb61a, #f0f921)" }} />
          <div className="flex h-24 flex-col justify-between text-[8px] font-mono text-gray-400">
            <span>{stats.maxV.toFixed(3)}</span>
            <span>{stats.minV.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <select value={activeVariable} onChange={(event) => setActiveVariable(event.target.value)} className="rounded-xl border border-white/10 bg-black px-4 py-2 text-[10px] font-black uppercase text-white">
          <option value="temperature">Température (K)</option>
          <option value="pressure">Pression (MPa)</option>
          <option value="velocity_magnitude">Vitesse (m/s)</option>
          <option value="stress">Contrainte (MPa)</option>
        </select>
        <div className="flex gap-1">
          {(["thermal", "viridis", "coolwarm"] as const).map((scale) => (
            <button key={scale} type="button" onClick={() => setColorScale(scale)} className={`flex-1 rounded-xl py-2 text-[9px] font-black uppercase ${colorScale === scale ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"}`}>
              {scale}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCSV} disabled={!volumetricData.length} className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-900/30 text-[9px] font-black uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white disabled:opacity-40">
            <Download className="mx-auto inline-block" size={13} /> CSV champ
          </button>
          <button type="button" onClick={exportSTL} disabled={!sceneRef.current} className="flex-1 rounded-xl border border-blue-500/30 bg-blue-900/30 text-[9px] font-black uppercase tracking-widest text-blue-400 transition-colors hover:bg-blue-600 hover:text-white disabled:opacity-40">
            STL géométrie
          </button>
        </div>
      </div>
    </div>
  );
}
