"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Download, FileJson, Image as ImageIcon, Pause, Play, Video } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import { getScenarioCadUnitScale } from "@/lib/cad-assets";
import {
  normalizeVisualizationPoints,
  type VisualizationMetadata,
  type TransientBubble,
  type TransientSeries,
  type VisualizationPoint,
  type VisualizationScenario,
} from "@/lib/visualization-data";

interface Props {
  data?: unknown;
  experimentalData?: unknown;
  transientSeries?: TransientSeries;
  metadata?: VisualizationMetadata;
  title?: string;
  colorVariable?: string;
  scenarioType?: VisualizationScenario;
  geometryAssetUrl?: string;
  metrics?: unknown;
  quality?: string;
}


const TRANSITION_FRAMES = 60;
const TRANSITION_FPS = 30;

const COLOR_STOPS = {
  thermal: ["#180f3d", "#721f81", "#bb3754", "#ed6925", "#fbb61a", "#f0f921"],
  viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
  coolwarm: ["#3b4cc0", "#77aadd", "#dddddd", "#ee8866", "#b40426"],
} as const;

const colorGradient = (scale: keyof typeof COLOR_STOPS): string =>
  `linear-gradient(to top, ${COLOR_STOPS[scale].join(", ")})`;

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

export function generatePureVolumetricGrid(geometry: {
  shape: string;
  radius: number;
  height?: number;
  length?: number;
  defaultTemp?: number;
  defaultPressure?: number;
  defaultVelocity?: number;
}): VisualizationPoint[] {
  const radius = Number(geometry.radius);
  const height = Number(geometry.height ?? geometry.length);
  if (!Number.isFinite(radius) || !Number.isFinite(height) || radius <= 0 || height <= 0) return [];
  const axialSamples = 65;
  const radialSamples = 17;
  const points: VisualizationPoint[] = [];
  for (let axial = 0; axial < axialSamples; axial += 1) {
    const y = -height / 2 + (height * axial) / (axialSamples - 1);
    const temperature = Number(geometry.defaultTemp ?? 0) + axial / (axialSamples - 1);
    const pressure = Number(geometry.defaultPressure ?? 0) + axial / (axialSamples - 1);
    for (let ix = 0; ix < radialSamples; ix += 1) {
      const x = -radius + (2 * radius * ix) / (radialSamples - 1);
      for (let iz = 0; iz < radialSamples; iz += 1) {
        const z = -radius + (2 * radius * iz) / (radialSamples - 1);
        if (x * x + z * z > radius * radius + 1e-12) continue;
        points.push({
          x,
          y,
          z,
          temperature,
          pressure,
          velocity_magnitude: Number(geometry.defaultVelocity ?? 0),
        });
      }
    }
  }
  return points;
}

export default function Industrial3DVisualizerEnhancedV11({
  data = [],
  experimentalData = [],
  transientSeries,
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
  const speedRef = useRef(0.05);
  const forceApplyRef = useRef(true);

  const [isMounted, setIsMounted] = useState(false);
  const [activeVariable, setActiveVariable] = useState(colorVariable || "temperature");
  const [colorScale, setColorScale] = useState<"thermal" | "viridis" | "coolwarm">("thermal");
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(0.05);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [rendererReady, setRendererReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<"points" | "surface" | "danger">("points");
  const [dangerThreshold, setDangerThreshold] = useState<number | null>(null);
  const [showBubbles, setShowBubbles] = useState(true);
  const [showVelocityVectors, setShowVelocityVectors] = useState(false);
  const [cadAlignment, setCadAlignment] = useState<{ status: "not_loaded" | "aligned" | "mismatch" | "unavailable"; message: string }>({
    status: geometryAssetUrl ? "not_loaded" : "unavailable",
    message: geometryAssetUrl ? "Vérification des bornes CAO…" : "Aucun actif CAO associé",
  });
  const cadFieldMatchRef = useRef(false);

  const fieldOptions = useMemo(() => [
    { key: "temperature", label: "Température", unit: metadata?.fields?.temperature?.unit },
    { key: "pressure", label: "Pression", unit: metadata?.fields?.pressure?.unit },
    { key: "velocity_magnitude", label: "Vitesse", unit: metadata?.fields?.velocity_magnitude?.unit },
    { key: "stress", label: "Contrainte", unit: metadata?.fields?.stress?.unit },
    { key: "shear_stress", label: "Cisaillement", unit: metadata?.fields?.shear_stress?.unit },
  ] as const, [metadata?.fields]);

  const volumetricData = useMemo(() => normalizeVisualizationPoints(data), [data]);
  const availableFieldOptions = useMemo(
    () => fieldOptions.filter((field) => volumetricData.some((point) => finiteValue(point[field.key]) !== undefined)),
    [fieldOptions, volumetricData],
  );

  useEffect(() => {
    if (availableFieldOptions.length > 0 && !availableFieldOptions.some((field) => field.key === activeVariable)) {
      setActiveVariable(availableFieldOptions[0].key);
    }
  }, [activeVariable, availableFieldOptions]);
  const measuredData = useMemo(() => normalizeVisualizationPoints(experimentalData), [experimentalData]);
  const transientFrames = transientSeries?.time_series ?? [];
  const hasUsableTransientFrames = useMemo(() => {
    if (!transientSeries?.is_true_transient || transientFrames.length < 2 || !volumetricData.length) return false;
    const validFrames = transientFrames.every((frame) =>
      Array.isArray(frame.points)
      && frame.points.length === volumetricData.length
      && frame.points.every((point) => (
        finiteValue(point.x) !== undefined
        && finiteValue(point.y) !== undefined
        && finiteValue(point.z) !== undefined
      )),
    );
    if (!validFrames) return false;
    const firstFrame = transientFrames[0].points;
    return transientFrames.slice(1).some((frame) => frame.points.some((point, index) => {
      const firstPoint = firstFrame[index];
      return Math.abs(point.x - firstPoint.x) > 1e-12
        || Math.abs(point.y - firstPoint.y) > 1e-12
        || Math.abs(point.z - firstPoint.z) > 1e-12;
    }));
  }, [transientFrames, transientSeries?.is_true_transient, volumetricData.length]);
  const transientThreshold = useMemo(() => {
    const raw = (metadata?.transient?.layer_contract as Record<string, unknown> | undefined)?.danger_temperature_k
      ?? (transientSeries?.layer_contract as Record<string, unknown> | undefined)?.danger_temperature_k;
    const numeric = finiteValue(raw);
    return numeric;
  }, [metadata?.transient?.layer_contract, transientSeries?.layer_contract]);

  const domain = useMemo(() => {
    if (!volumetricData.length) {
      return { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1, midX: 0, midY: 0, midZ: 0, spanX: 2, spanY: 2, spanZ: 2 };
    }
    const initial = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };
    for (const point of volumetricData) {
      initial.minX = Math.min(initial.minX, point.x);
      initial.maxX = Math.max(initial.maxX, point.x);
      initial.minY = Math.min(initial.minY, point.y);
      initial.maxY = Math.max(initial.maxY, point.y);
      initial.minZ = Math.min(initial.minZ, point.z);
      initial.maxZ = Math.max(initial.maxZ, point.z);
    }
    const spanX = Math.max(initial.maxX - initial.minX, 1e-6);
    const spanY = Math.max(initial.maxY - initial.minY, 1e-6);
    const spanZ = Math.max(initial.maxZ - initial.minZ, 1e-6);
    return {
      ...initial,
      midX: (initial.minX + initial.maxX) / 2,
      midY: (initial.minY + initial.maxY) / 2,
      midZ: (initial.minZ + initial.maxZ) / 2,
      spanX,
      spanY,
      spanZ,
    };
  }, [volumetricData]);

  const displayTransform = useMemo(() => {
    // No artificial radial enlargement: the persisted field and CAD must share the physical frame.
    const radialBoost = 1;
    const displaySpanX = domain.spanX;
    const displaySpanY = domain.spanY * radialBoost;
    const displaySpanZ = domain.spanZ * radialBoost;
    const scale = 3 / Math.max(displaySpanX, displaySpanY, displaySpanZ, 1e-6);
    return { radialBoost, scale, displaySpanX, displaySpanY, displaySpanZ };
  }, [domain.spanX, domain.spanY, domain.spanZ, scenarioType]);

  const transformPoint = useCallback((point: VisualizationPoint, _phase = 0): THREE.Vector3 => {
    // Les coordonnées restent celles du champ physique. La transition PINN-T
    // porte sur les valeurs des snapshots, jamais sur une déformation visuelle.
    return new THREE.Vector3(
      (point.x - domain.midX) * displayTransform.scale,
      (point.y - domain.midY) * displayTransform.radialBoost * displayTransform.scale,
      (point.z - domain.midZ) * displayTransform.radialBoost * displayTransform.scale,
    );
  }, [displayTransform.radialBoost, displayTransform.scale, domain.midX, domain.midY, domain.midZ]);

  const stats = useMemo(() => {
    const values = [
      ...volumetricData.map((point) => point[activeVariable]),
      ...transientFrames.flatMap((frame) => frame.points.map((point) => point[activeVariable])),
    ]
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
      unit: metadata?.fields?.[activeVariable]?.unit,
    };
  }, [activeVariable, metadata, transientFrames, volumetricData]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    speedRef.current = animSpeed;
    forceApplyRef.current = true;
  }, [animSpeed, isPlaying]);

  useEffect(() => {
    if (!hasUsableTransientFrames && isPlaying) setIsPlaying(false);
  }, [hasUsableTransientFrames, isPlaying]);

  useEffect(() => {
    setCadAlignment({
      status: geometryAssetUrl ? "not_loaded" : "unavailable",
      message: geometryAssetUrl ? "Vérification des bornes CAO…" : "Aucun actif CAO associé",
    });
    cadFieldMatchRef.current = false;
  }, [geometryAssetUrl]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const getColorFromScale = useCallback(
    (value: number, min: number, max: number, scale: string): THREE.Color => {
      const range = Math.max(max - min, 1e-12);
      const normalized = Math.max(0, Math.min(1, (value - min) / range));
      const stops = COLOR_STOPS[scale as keyof typeof COLOR_STOPS] ?? COLOR_STOPS.thermal;
      const scaled = normalized * (stops.length - 1);
      const index = Math.min(stops.length - 2, Math.floor(scaled));
      return new THREE.Color(stops[index]).lerp(new THREE.Color(stops[index + 1]), scaled - index);
    },
    [],
  );

  const getFrameBlend = useCallback((phase: number) => {
    if (!hasUsableTransientFrames) return { frameIndex: 0, nextFrameIndex: 0, weight: 0 };
    const times = transientFrames.map((frame, index) => finiteValue(frame.time) ?? index);
    const start = times[0] ?? 0;
    const end = times[times.length - 1] ?? start;
    const target = start + Math.max(0, Math.min(1, phase)) * Math.max(end - start, 0);
    let frameIndex = 0;
    while (frameIndex < times.length - 2 && target > (times[frameIndex + 1] ?? target)) frameIndex += 1;
    const nextFrameIndex = Math.min(frameIndex + 1, times.length - 1);
    const interval = (times[nextFrameIndex] ?? target) - (times[frameIndex] ?? target);
    const weight = interval > 0 ? Math.max(0, Math.min(1, (target - times[frameIndex]) / interval)) : 0;
    return { frameIndex, nextFrameIndex, weight };
  }, [hasUsableTransientFrames, transientFrames]);

  const currentTransientTime = useMemo(() => {
    if (!hasUsableTransientFrames) return undefined;
    const { frameIndex, nextFrameIndex, weight } = getFrameBlend(animationPhase);
    const firstTime = finiteValue(transientFrames[frameIndex]?.time);
    const secondTime = finiteValue(transientFrames[nextFrameIndex]?.time) ?? firstTime;
    if (firstTime === undefined) return undefined;
    return firstTime + ((secondTime ?? firstTime) - firstTime) * weight;
  }, [animationPhase, getFrameBlend, hasUsableTransientFrames, transientFrames]);

  const getInterpolatedPoint = useCallback((pointIndex: number, phase: number): VisualizationPoint | undefined => {
    const base = volumetricData[pointIndex];
    if (!hasUsableTransientFrames) return base;
    const { frameIndex, nextFrameIndex, weight } = getFrameBlend(phase);
    const p1 = transientFrames[frameIndex]?.points?.[pointIndex] || base;
    const p2 = transientFrames[nextFrameIndex]?.points?.[pointIndex] || p1;
    return {
      ...p1,
      x: p1.x + (p2.x - p1.x) * weight,
      y: p1.y + (p2.y - p1.y) * weight,
      z: p1.z + (p2.z - p1.z) * weight,
    };
  }, [getFrameBlend, hasUsableTransientFrames, transientFrames, volumetricData]);

  const getInterpolatedValue = useCallback((pointIndex: number, phase: number): number | undefined => {
    const baseValue = finiteValue(volumetricData[pointIndex]?.[activeVariable]);
    if (!hasUsableTransientFrames) return baseValue;
    const { frameIndex, nextFrameIndex, weight } = getFrameBlend(phase);
    const frame1Value = finiteValue(transientFrames[frameIndex]?.points?.[pointIndex]?.[activeVariable]) ?? baseValue;
    const frame2Value = finiteValue(transientFrames[nextFrameIndex]?.points?.[pointIndex]?.[activeVariable]) ?? frame1Value;
    if (frame1Value === undefined) return undefined;
    return frame1Value + ((frame2Value ?? frame1Value) - frame1Value) * weight;
  }, [activeVariable, getFrameBlend, hasUsableTransientFrames, transientFrames, volumetricData]);

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

  const exportPNG = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || !sceneRef.current || !cameraRef.current) return;
    renderer.render(sceneRef.current, cameraRef.current);
    const png = renderer.domElement.toDataURL("image/png");
    if (png === "data:,") return;
    const anchor = document.createElement("a");
    anchor.href = png;
    anchor.download = `${scenarioType}_visualization_${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [scenarioType]);

  const exportJSON = useCallback(() => {
    const payload = {
      scenario_type: scenarioType,
      title,
      active_variable: activeVariable,
      field_unit: stats.unit,
      persisted_points: volumetricData.length,
      metadata,
      points: volumetricData,
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
      `${scenarioType}_visualization.json`,
    );
  }, [activeVariable, metadata, scenarioType, stats.unit, title, volumetricData]);

  const buildTransitionCsv = useCallback((): string => {
    if (!volumetricData.length) return "";
    const frames = hasUsableTransientFrames
      ? transientFrames
      : [{ frame: 0, time: 0, points: volumetricData }];
    const fieldKeys = Array.from(new Set(frames.flatMap((frame) => frame.points.flatMap((point) => Object.keys(point))))).filter(
      (key) => !["x", "y", "z"].includes(key) && frames.some((frame) => frame.points.some((point) => point[key] !== undefined)),
    );
    const headers = ["frame", "time_s", "phase", "x_rendered", "y_rendered", "z_rendered", ...fieldKeys, "rendered_value", "danger_mask"];
    const rows: string[] = [headers.join(",")];
    frames.forEach((frame, frameIndex) => {
      const phase = frames.length > 1 ? frameIndex / (frames.length - 1) : 0;
      frame.points.forEach((point, pointIndex) => {
        const rendered = transformPoint(point, phase);
        const value = finiteValue(point[activeVariable]);
        const dangerMask = frame.transient_layers?.danger_mask?.[pointIndex];
        const values = [
          frame.frame ?? frameIndex,
          frame.time,
          phase.toFixed(6),
          rendered.x,
          rendered.y,
          rendered.z,
          ...fieldKeys.map((key) => point[key]),
          value,
          dangerMask,
        ];
        rows.push(values.map(csvCell).join(","));
      });
    });
    return `${rows.join("\n")}\n`;
  }, [activeVariable, hasUsableTransientFrames, transformPoint, transientFrames, volumetricData]);

  const recordTransition = useCallback(async (): Promise<Blob | null> => {
    const renderer = rendererRef.current;
    if (!renderer || typeof renderer.domElement.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      return null;
    }
    if (!hasUsableTransientFrames) return null;
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
  }, [hasUsableTransientFrames]);

  const exportTransition = useCallback(async () => {
    if (!volumetricData.length || !hasUsableTransientFrames || exportStatus) return;
    setExportStatus("Préparation de la transition…");
    try {
      const [videoBlob, transitionCsv] = await Promise.all([recordTransition(), Promise.resolve(buildTransitionCsv())]);
      const metadataPayload = {
        scenario_type: scenarioType,
        title,
        frames: transientFrames.length,
        fps: TRANSITION_FPS,
        duration_s: transientFrames.length / TRANSITION_FPS,
        active_variable: activeVariable,
        field_unit: stats.unit,
        animation: {
          phase_definition: "normalized interpolation over persisted snapshot times",
          speed: animSpeed,
          model: hasUsableTransientFrames ? "PINN-T snapshots; linear interpolation of persisted positions and fields" : "static persisted field; playback unavailable",
        },
        persisted_points: volumetricData.length,
        measured_points: measuredData.length,
        source: metadata?.source_label ?? "source non fournie",
        geometry: metadata?.geometry ?? null,
        geometry_asset_url: geometryAssetUrl ?? null,
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
  }, [activeVariable, animSpeed, buildTransitionCsv, exportStatus, geometryAssetUrl, hasUsableTransientFrames, measuredData.length, metadata, recordTransition, scenarioType, stats.unit, title, volumetricData.length]);

  useEffect(() => {
    if (!isMounted || !containerRef.current || !volumetricData.length) return;
    const container = containerRef.current;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 420);
    setRenderError(null);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(3.4, 2.6, 3.4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        preserveDrawingBuffer: true,
        logarithmicDepthBuffer: true
      });
    } catch {
      setRendererReady(false);
      setRenderError("Contexte WebGL indisponible : le champ persisté reste exportable, mais le rendu 3D ne peut pas être initialisé dans cet environnement.");
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;
    setRendererReady(true);

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

    const particleSize = Math.max(
      Math.min(displayTransform.displaySpanX, displayTransform.displaySpanY, displayTransform.displaySpanZ) / 120,
      0.004,
    );
    // Un seul nuage de points est rendu pour le champ. Le rendu simultané
    // d'instances cubiques et de points superposait deux profondeurs et
    // produisait le scintillement visible dans la capture vidéo.

    const cloudPositions = new Float32Array(volumetricData.length * 3);
    const cloudColors = new Float32Array(volumetricData.length * 3);
    const cloudGeometry = new THREE.BufferGeometry();
    cloudGeometry.setAttribute("position", new THREE.BufferAttribute(cloudPositions, 3));
    cloudGeometry.setAttribute("color", new THREE.BufferAttribute(cloudColors, 3));
    const cloudMaterial = new THREE.PointsMaterial({
      size: Math.max(particleSize * 2.0, 0.008),
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      alphaTest: 0.05,
    });
    const continuousCloud = new THREE.Points(cloudGeometry, cloudMaterial);
    continuousCloud.frustumCulled = false;
    scene.add(continuousCloud);

    const meshCells = metadata?.mesh?.cells;
    const surfaceSourceIndices: number[] = [];
    let surfaceMesh: THREE.Mesh | null = null;
    if (Array.isArray(meshCells) && meshCells.length > 0) {
      const surfacePositions: number[] = [];
      for (const cell of meshCells) {
        if (!Array.isArray(cell) || cell.length < 3) continue;
        for (let index = 1; index < cell.length - 1; index += 1) {
          const triangle = [cell[0], cell[index], cell[index + 1]];
          for (const pointIndex of triangle) {
            const point = volumetricData[Number(pointIndex)];
            if (!point) continue;
            const renderedPoint = transformPoint(point, 0);
            surfacePositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
            surfaceSourceIndices.push(Number(pointIndex));
          }
        }
      }
      if (surfacePositions.length >= 9) {
        const surfaceGeometry = new THREE.BufferGeometry();
        surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(surfacePositions, 3));
        surfaceGeometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(surfacePositions.length), 3));
        surfaceGeometry.computeVertexNormals();
        const surfaceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05 });
        surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        surfaceMesh.frustumCulled = false;
        scene.add(surfaceMesh);
      }
    }

    const maxBubbles = transientFrames.reduce((max, frame) => Math.max(max, frame.transient_layers?.vapor_bubbles?.length ?? 0), 0);
    const bubbleGeometry = new THREE.SphereGeometry(1, 12, 8);
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bubbleMesh = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, Math.max(maxBubbles, 1));
    bubbleMesh.frustumCulled = false;
    bubbleMesh.visible = false;
    scene.add(bubbleMesh);

    // --- VELOCITY VECTORS (Arrows) ---
    const velocityArrows = new THREE.Group();
    velocityArrows.visible = false;
    scene.add(velocityArrows);

    const arrowCount = Math.min(volumetricData.length, 200); // Échantillon pour ne pas surcharger
    const arrows: THREE.ArrowHelper[] = [];
    for (let i = 0; i < arrowCount; i++) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.1, 0x00ffff);
      arrows.push(arrow);
      velocityArrows.add(arrow);
    }

    const dummy = new THREE.Object3D();
    const cadColorApplierRef = { current: (_phase: number) => undefined };

    const applyPhase = (phase: number) => {
      const clampedPhase = Math.max(0, Math.min(1, phase));
      const { frameIndex, nextFrameIndex, weight: frameWeight } = getFrameBlend(clampedPhase);
      const frame = hasUsableTransientFrames ? transientFrames[frameIndex] : undefined;
      const nextFrame = hasUsableTransientFrames ? transientFrames[nextFrameIndex] : undefined;
      const layerMask = Array.isArray(frame?.transient_layers?.danger_mask)
        ? frame.transient_layers.danger_mask
        : undefined;
      const activeDangerThreshold = dangerThreshold ?? transientThreshold;
      const isDangerMode = renderMode === "danger";
      const safeMin = stats.minV;
      const safeMax = stats.maxV > stats.minV ? stats.maxV : stats.minV + 1;

      for (let index = 0; index < volumetricData.length; index += 1) {
        const point = getInterpolatedPoint(index, clampedPhase) ?? volumetricData[index];
        const renderedPoint = transformPoint(point, clampedPhase);
        const finalValue = getInterpolatedValue(index, clampedPhase) ?? stats.minV;
        const dangerous = layerMask?.[index] === 1
          || (activeDangerThreshold !== null && activeDangerThreshold !== undefined && finalValue >= activeDangerThreshold);
        const color = getColorFromScale(finalValue, safeMin, safeMax, colorScale);

        // En mode danger, les points non critiques deviennent noirs plutôt que
        // d'être déplacés artificiellement ou supprimés par une seconde géométrie.
        if (isDangerMode && !dangerous) color.setRGB(0, 0, 0);
        if (isDangerMode && dangerous) color.setRGB(1, 0.16, 0.05);

        cloudPositions[index * 3] = renderedPoint.x;
        cloudPositions[index * 3 + 1] = renderedPoint.y;
        cloudPositions[index * 3 + 2] = renderedPoint.z;
        cloudColors[index * 3] = color.r;
        cloudColors[index * 3 + 1] = color.g;
        cloudColors[index * 3 + 2] = color.b;
      }
      (cloudGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (cloudGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      continuousCloud.visible = renderMode !== "surface" || surfaceMesh === null;
      if (surfaceMesh) {
        surfaceMesh.visible = renderMode === "surface";
        const surfacePositions = surfaceMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const surfaceColors = surfaceMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
        for (let index = 0; index < surfaceSourceIndices.length; index += 1) {
          const sourceIndex = surfaceSourceIndices[index];
          const point = getInterpolatedPoint(sourceIndex, clampedPhase) ?? volumetricData[sourceIndex];
          const renderedPoint = transformPoint(point, clampedPhase);
          surfacePositions.setXYZ(index, renderedPoint.x, renderedPoint.y, renderedPoint.z);
          const value = getInterpolatedValue(sourceIndex, clampedPhase) ?? stats.minV;
          const surfaceColor = getColorFromScale(value, safeMin, safeMax, colorScale);
          surfaceColors.setXYZ(index, surfaceColor.r, surfaceColor.g, surfaceColor.b);
        }
        surfacePositions.needsUpdate = true;
        surfaceColors.needsUpdate = true;
      }

      // Une bulle n'est rendue que si le contrat fournit un rayon en mètres.
      // Une fraction de vapeur ne doit jamais être interprétée comme un rayon.
      const contract = transientSeries?.layer_contract as Record<string, unknown> | undefined;
      const hasMetricBubbleRadius = String(contract?.bubble_radius_unit ?? "").toLowerCase() === "m";
      const bubbles1: TransientBubble[] = frame?.transient_layers?.vapor_bubbles ?? [];
      const bubbles2: TransientBubble[] = nextFrame?.transient_layers?.vapor_bubbles ?? bubbles1;
      const bubbleCount = hasMetricBubbleRadius ? Math.min(Math.max(maxBubbles, 1), bubbles1.length) : 0;
      bubbleMesh.visible = Boolean(showBubbles && hasUsableTransientFrames && !isDangerMode && bubbleCount > 0);
      for (let index = 0; index < Math.max(maxBubbles, 1); index += 1) {
        const bubble1 = bubbles1[index];
        const bubble2 = bubbles2[index] ?? bubble1;
        if (!hasMetricBubbleRadius || !bubble1 || !bubble2) {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          bubbleMesh.setMatrixAt(index, dummy.matrix);
          continue;
        }
        const bubblePoint = transformPoint({
          x: bubble1.x + (bubble2.x - bubble1.x) * frameWeight,
          y: bubble1.y + (bubble2.y - bubble1.y) * frameWeight,
          z: bubble1.z + (bubble2.z - bubble1.z) * frameWeight,
        }, clampedPhase);
        const radius = bubble1.radius + (bubble2.radius - bubble1.radius) * frameWeight;
        const intensity = bubble1.intensity + (bubble2.intensity - bubble1.intensity) * frameWeight;
        dummy.position.copy(bubblePoint);
        dummy.scale.setScalar(Math.max(0, radius * displayTransform.scale));
        dummy.updateMatrix();
        bubbleMesh.setMatrixAt(index, dummy.matrix);
        bubbleMesh.setColorAt(index, getColorFromScale(intensity, safeMin, safeMax, colorScale));
      }
      bubbleMesh.instanceMatrix.needsUpdate = true;
      if (bubbleMesh.instanceColor) bubbleMesh.instanceColor.needsUpdate = true;

      // Update Velocity Arrows
      velocityArrows.visible = showVelocityVectors;
      if (showVelocityVectors) {
        const step = Math.floor(volumetricData.length / arrowCount);
        arrows.forEach((arrow, i) => {
          const idx = i * step;
          const pt = getInterpolatedPoint(idx, clampedPhase) ?? volumetricData[idx];
          const renderedPt = transformPoint(pt, clampedPhase);
          const vel = finiteValue(pt.velocity_magnitude) ?? 0;
          
          arrow.position.copy(renderedPt);
          // Direction simplifiée (selon l'axe principal du scénario)
          const dir = scenarioType === "HEAVY_DUTY_HYDROGEN_REFUELING" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
          arrow.setDirection(dir);
          arrow.setLength(Math.max(0.01, (vel / 150) * 0.2));
          arrow.setColor(new THREE.Color().setHSL(0.6, 1, 0.5));
        });
      }

      cadColorApplierRef.current(clampedPhase);
      forceApplyRef.current = false;
    };
    applyPhaseRef.current = applyPhase;

    let cadModel: THREE.Object3D | null = null;
    if (geometryAssetUrl) {
      new GLTFLoader().load(
        geometryAssetUrl,
        (gltf) => {
          cadModel = gltf.scene;
          // L'unité est une propriété de l'actif canonique, pas une estimation de
          // l'interface. La géométrie du champ reste en mètres SI.
          const cadUnitScale = getScenarioCadUnitScale(scenarioType);
          if (cadUnitScale == null) {
            console.error('CAD asset rejected: no verified unit scale in the CFD contract.');
            return;
          }
          // Le GLB DN50 mesure son axe longitudinal sur Z alors que la série de
          // points persistée utilise Y. Cette rotation est une convention de
          // repère documentée, pas une déformation du modèle.
          if (scenarioType === "HEAVY_DUTY_HYDROGEN_REFUELING") {
            cadModel.rotation.x = -Math.PI / 2;
          }
          const cadDisplayScale = displayTransform.scale * cadUnitScale;
          cadModel.scale.setScalar(cadDisplayScale);
          cadModel.updateMatrixWorld(true);

          // --- ALIGNEMENT SPATIAL MESURÉ ---
          const cadBox = new THREE.Box3().setFromObject(cadModel);
          const cadCenter = cadBox.getCenter(new THREE.Vector3());
          cadModel.position.sub(cadCenter);
          cadModel.updateMatrixWorld(true);
          const centeredCadBox = new THREE.Box3().setFromObject(cadModel);
          const fieldBox = new THREE.Box3(
            new THREE.Vector3(-displayTransform.displaySpanX * displayTransform.scale / 2, -displayTransform.displaySpanY * displayTransform.scale / 2, -displayTransform.displaySpanZ * displayTransform.scale / 2),
            new THREE.Vector3(displayTransform.displaySpanX * displayTransform.scale / 2, displayTransform.displaySpanY * displayTransform.scale / 2, displayTransform.displaySpanZ * displayTransform.scale / 2),
          );
          const overlapBox = centeredCadBox.clone().intersect(fieldBox);
          const fieldSize = fieldBox.getSize(new THREE.Vector3());
          const overlapSize = overlapBox.getSize(new THREE.Vector3());
          const fieldVolume = Math.max(fieldSize.x * fieldSize.y * fieldSize.z, 1e-12);
          const overlapVolume = Math.max(overlapSize.x * overlapSize.y * overlapSize.z, 0);
          const overlapRatio = overlapVolume / fieldVolume;
          const cadSize = centeredCadBox.getSize(new THREE.Vector3());
          const axisMismatch = Math.max(
            Math.abs(cadSize.x - fieldSize.x) / Math.max(fieldSize.x, 1e-12),
            Math.abs(cadSize.y - fieldSize.y) / Math.max(fieldSize.y, 1e-12),
            Math.abs(cadSize.z - fieldSize.z) / Math.max(fieldSize.z, 1e-12),
          );
          const spatiallyAligned = overlapRatio >= 0.85 && axisMismatch <= 0.25;
          cadFieldMatchRef.current = spatiallyAligned;
          setCadAlignment({
            status: spatiallyAligned ? "aligned" : "mismatch",
            message: spatiallyAligned
              ? `CAO/champ recouvrants (${Math.round(overlapRatio * 100)} %)`
              : `CAO/champ non recouvrants (${Math.round(overlapRatio * 100)} % ; écart d'axes ${Math.round(axisMismatch * 100)} %)`,
          });
          const cadMeshes: THREE.Mesh[] = [];
          cadModel.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const sourceGeometry = child.geometry;
            const position = sourceGeometry.getAttribute("position");
            if (!position) return;
            const colorAttribute = new THREE.Float32BufferAttribute(new Float32Array(position.count * 3), 3);
            sourceGeometry.setAttribute("color", colorAttribute);
            child.material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              color: 0xffffff,
              transparent: true,
              opacity: 0.35,
              roughness: 0.42,
              metalness: 0.08,
              side: THREE.DoubleSide,
              wireframe: false,
              depthWrite: false,
              polygonOffset: false
            });
            cadMeshes.push(child);
          });

          const matchTolerance = Math.max(Math.min(fieldBox.getSize(new THREE.Vector3()).x, fieldBox.getSize(new THREE.Vector3()).y, fieldBox.getSize(new THREE.Vector3()).z) * 0.08, 1e-6);
          const sortedPointIndices = volumetricData.map((point, index) => ({ x: point.x, index })).sort((a, b) => a.x - b.x);
          const fieldColor = new THREE.Color();
          const vertex = new THREE.Vector3();
          const samplePoint = new THREE.Vector3();
          const nearestSample = (target: THREE.Vector3, phase: number): { index: number; distance: number } => {
            if (!sortedPointIndices.length) return { index: -1, distance: Infinity };
            let low = 0;
            let high = sortedPointIndices.length - 1;
            while (low < high) {
              const middle = Math.floor((low + high) / 2);
              if (sortedPointIndices[middle].x < (target.x / displayTransform.scale) + domain.midX) low = middle + 1;
              else high = middle;
            }
            const centerIndex = low;
            let bestIndex = -1;
            let bestDistance = Infinity;
            const windowStart = Math.max(0, centerIndex - 8);
            const windowEnd = Math.min(sortedPointIndices.length, centerIndex + 9);
            for (let cursor = windowStart; cursor < windowEnd; cursor += 1) {
              const candidateIndex = sortedPointIndices[cursor].index;
              samplePoint.copy(transformPoint(volumetricData[candidateIndex], phase));
              const distance = target.distanceTo(samplePoint);
              if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = candidateIndex;
              }
            }
            return { index: bestIndex, distance: bestDistance };
          };
          cadColorApplierRef.current = (phase: number) => {
            for (const mesh of cadMeshes) {
              const position = mesh.geometry.getAttribute("position");
              const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
              for (let index = 0; index < position.count; index += 1) {
                vertex.fromBufferAttribute(position, index);
                mesh.localToWorld(vertex);
                const sample = nearestSample(vertex, phase);
                if (cadFieldMatchRef.current && sample.index >= 0 && sample.distance <= matchTolerance) {
                  const value = getInterpolatedValue(sample.index, phase);
                  if (value !== undefined) fieldColor.copy(getColorFromScale(value, stats.minV, stats.maxV, colorScale));
                  else fieldColor.setRGB(0.4, 0.4, 0.4);
                } else {
                  // Une CAO non recouvrante reste neutre : aucune couleur de
                  // champ n'est attribuée lorsqu'elle ne correspond pas à une
                  // mesure spatiale démontrée.
                  fieldColor.setRGB(0.4, 0.4, 0.4);
                }
                colors.setXYZ(index, fieldColor.r, fieldColor.g, fieldColor.b);
              }
              colors.needsUpdate = true;
            }
          };
          scene.add(cadModel);
          cadModel.updateMatrixWorld(true);
          cadColorApplierRef.current(animationPhaseRef.current);
        },
        undefined,
        () => {
          cadFieldMatchRef.current = false;
          setCadAlignment({ status: "unavailable", message: "Actif CAO non chargeable" });
        },
      );
    }

    const renderOnce = () => {
      controls.update();
      renderer.render(scene, camera);
    };
    renderOnceRef.current = renderOnce;

    let animationFrameId = 0;
    let previousTimestamp = performance.now();
    let lastUiUpdate = 0;
    const animate = (timestamp: number) => {
      animationFrameId = window.requestAnimationFrame(animate);
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;
      if (isPlayingRef.current) {
        // La vitesse contrôle uniquement le parcours du temps normalisé.
        // Aucune oscillation, rotation ou déformation ne vient compléter les données.
        animationPhaseRef.current = (animationPhaseRef.current + deltaSeconds * speedRef.current) % 1.0;
        forceApplyRef.current = true;
        if (timestamp - lastUiUpdate > 33) {
          setAnimationPhase(animationPhaseRef.current);
          lastUiUpdate = timestamp;
        }
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
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      bubbleGeometry.dispose();
      bubbleMaterial.dispose();
      if (surfaceMesh) {
        surfaceMesh.geometry.dispose();
        if (Array.isArray(surfaceMesh.material)) surfaceMesh.material.forEach((item) => item.dispose());
        else surfaceMesh.material.dispose();
      }
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
      setRendererReady(false);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [activeVariable, colorScale, dangerThreshold, displayTransform.radialBoost, displayTransform.scale, geometryAssetUrl, getColorFromScale, getFrameBlend, getInterpolatedPoint, getInterpolatedValue, hasUsableTransientFrames, isMounted, metadata, renderMode, showBubbles, stats.maxV, stats.minV, stats.unit, transformPoint, transientFrames, transientThreshold, volumetricData]);

  const updatePhase = (phase: number) => {
    animationPhaseRef.current = phase;
    setAnimationPhase(phase);
    forceApplyRef.current = true;
  };

  return (
    <div className="relative flex h-full min-h-[720px] w-full min-w-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#020617] p-4 shadow-2xl sm:p-6 md:p-8">
      <div className="mb-5 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-black uppercase tracking-tight text-white">{title}</h3>
          <p className="break-words font-mono text-[10px] text-cyan-400">
            {metadata?.source_label || (volumetricData.length ? "Données de champ persistées" : "Aucun champ de prédiction persisté")} — {stats.count.toLocaleString()} points
            {currentTransientTime !== undefined ? ` — t = ${currentTransientTime.toFixed(4)} ${transientSeries?.time_unit ?? "s"}` : ""}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={() => setIsPlaying((value) => !value)}
            disabled={!hasUsableTransientFrames}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${isPlaying ? "bg-amber-600 text-white" : "bg-white/5 text-amber-400"}`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : hasUsableTransientFrames ? "Lire les snapshots PINN-T" : "Série transitoire indisponible"}
          </button>
          <button
            type="button"
            onClick={exportTransition}
            disabled={!hasUsableTransientFrames || Boolean(exportStatus)}
            className="flex min-h-10 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-fuchsia-400/40 bg-fuchsia-900/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300 transition-colors active:scale-[0.98] hover:bg-fuchsia-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Video size={14} /> Export transition ZIP
          </button>
        </div>
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] font-black uppercase tracking-widest text-slate-300 md:grid-cols-2">
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="text-amber-400">Phase</span>
          <input className="min-w-0 accent-amber-500" type="range" min="0" max="1" step="0.001" value={animationPhase} onChange={(event) => updatePhase(Number(event.target.value))} disabled={!hasUsableTransientFrames} />
          <span className="text-right font-mono text-white">{animationPhase.toFixed(2)}</span>
        </label>
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="text-amber-400">Vitesse lecture</span>
          <input className="min-w-0 accent-amber-500" type="range" min="0.001" max="0.5" step="0.001" value={animSpeed} onChange={(event) => setAnimSpeed(Number(event.target.value))} disabled={!hasUsableTransientFrames} />
          <span className="text-right font-mono text-white">{animSpeed.toFixed(3)}</span>
        </label>
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-3 text-[10px] font-black uppercase tracking-widest text-slate-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span className="text-cyan-300">Rendu</span>
          <select value={renderMode} onChange={(event) => setRenderMode(event.target.value as "points" | "surface" | "danger")} className="min-w-0 rounded-lg border border-white/10 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
            <option value="points">Points / champ</option>
            <option value="surface">Surface continue</option>
            <option value="danger">Iso-surface danger</option>
          </select>
        </label>
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_5rem] items-center gap-3">
          <span className="text-rose-300">Seuil {stats.unit ?? "N/D"}</span>
          <input
            className="min-w-0 accent-rose-500"
            type="range"
            min={stats.minV}
            max={stats.maxV}
            step="any"
            value={dangerThreshold ?? transientThreshold ?? stats.maxV}
            onChange={(event) => setDangerThreshold(Number(event.target.value))}
            disabled={!stats.fieldCount || (transientThreshold === undefined && !transientFrames.some((frame) => Array.isArray(frame.transient_layers?.danger_mask)))}
          />
          <span className="text-right font-mono text-white">{dangerThreshold !== null || transientThreshold !== undefined ? (dangerThreshold ?? transientThreshold)!.toFixed(2) : (stats.fieldCount ? stats.maxV.toFixed(2) : "N/D")}</span>
        </label>
        <div className="flex flex-wrap items-center justify-end gap-4">
          <label className="flex items-center gap-2 text-cyan-200">
            <input type="checkbox" checked={showBubbles} onChange={(event) => setShowBubbles(event.target.checked)} className="accent-cyan-400" />
            Bulles
          </label>

          <label className="flex items-center gap-2 text-emerald-200">
            <input type="checkbox" checked={showVelocityVectors} onChange={(event) => setShowVelocityVectors(event.target.checked)} className="accent-emerald-400" />
            Vecteurs V
          </label>
        </div>
      </div>

      <p className="mb-3 min-h-4 break-words text-center text-[10px] font-black uppercase tracking-widest text-fuchsia-300">{exportStatus || (renderMode === "danger" && transientThreshold === undefined && !transientFrames.some((frame) => Array.isArray(frame.transient_layers?.danger_mask)) ? "Iso-surface indisponible : seuil/phase non persistés" : !hasUsableTransientFrames ? "Champ statique : aucune animation n'est simulée sans snapshots PINN-T cohérents" : `Snapshots PINN-T persistés : ${transientFrames.length} frames × ${volumetricData.length.toLocaleString()} points`)} · <span className={cadAlignment.status === "aligned" ? "text-emerald-300" : cadAlignment.status === "mismatch" ? "text-amber-300" : "text-slate-400"}>CAO : {cadAlignment.message}</span></p>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:min-h-[520px] lg:min-h-[560px]">
        <div ref={containerRef} className="absolute inset-0 min-h-0 min-w-0" />
        {renderError && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/85 p-8 text-center text-xs font-bold uppercase tracking-widest text-amber-300">{renderError}</div>}
        <div className="absolute bottom-3 right-3 top-3 flex w-16 flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-900/90 p-2 shadow-lg sm:bottom-4 sm:right-4 sm:top-4">
          <div className="max-w-full break-words text-center text-[8px] font-bold uppercase leading-tight text-white">{activeVariable} ({stats.unit ?? "N/D"})</div>
          <div className="my-2 min-h-24 w-3 flex-1 rounded-full" style={{ backgroundImage: colorGradient(colorScale) }} />
          <div className="flex h-24 flex-col justify-between text-[8px] font-mono text-gray-300">
            <span>{stats.fieldCount ? stats.maxV.toFixed(3) : "N/D"}</span>
            <span>{stats.fieldCount ? stats.avgV.toFixed(3) : "N/D"}</span>
            <span>{stats.fieldCount ? stats.minV.toFixed(3) : "N/D"}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(220px,auto)_minmax(280px,1.2fr)]">
        <select value={activeVariable} onChange={(event) => setActiveVariable(event.target.value)} disabled={!availableFieldOptions.length} className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50">
          {availableFieldOptions.length > 0 ? availableFieldOptions.map((field) => (
            <option key={field.key} value={field.key}>{field.label} ({field.unit ?? "N/D"})</option>
          )) : <option value="temperature">Aucun champ physique persisté</option>}
        </select>
        <div className="grid min-w-0 grid-cols-3 gap-1">
          {(["thermal", "viridis", "coolwarm"] as const).map((scale) => (
            <button key={scale} type="button" onClick={() => setColorScale(scale)} className={`min-w-0 rounded-xl py-2 text-[9px] font-black uppercase ${colorScale === scale ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"}`}>
              {scale}
            </button>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <button type="button" onClick={exportPNG} disabled={!rendererReady} className="min-w-0 rounded-xl border border-cyan-500/30 bg-cyan-900/30 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-600 hover:text-white disabled:opacity-40">
            <ImageIcon className="mx-auto inline-block" size={13} /> Capture PNG
          </button>
          <button type="button" onClick={exportJSON} disabled={!volumetricData.length} className="min-w-0 rounded-xl border border-purple-500/30 bg-purple-900/30 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-purple-400 transition-colors hover:bg-purple-600 hover:text-white disabled:opacity-40">
            <FileJson className="mx-auto inline-block" size={13} /> JSON
          </button>
          <button type="button" onClick={exportCSV} disabled={!volumetricData.length} className="min-w-0 rounded-xl border border-emerald-500/30 bg-emerald-900/30 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white disabled:opacity-40">
            <Download className="mx-auto inline-block" size={13} /> CSV champ
          </button>
          <button type="button" onClick={exportSTL} disabled={!rendererReady} className="min-w-0 rounded-xl border border-blue-500/30 bg-blue-900/30 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-blue-400 transition-colors hover:bg-blue-600 hover:text-white disabled:opacity-40">
            STL géométrie
          </button>
        </div>
      </div>
    </div>
  );
}
