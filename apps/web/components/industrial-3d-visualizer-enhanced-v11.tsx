"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Download, FileJson, Image as ImageIcon, Pause, Play, Video } from "lucide-react";
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
  const [rendererReady, setRendererReady] = useState(false);

  const volumetricData = useMemo(() => normalizeVisualizationPoints(data), [data]);
  const measuredData = useMemo(() => normalizeVisualizationPoints(experimentalData), [experimentalData]);

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

  const transformPoint = useCallback((point: VisualizationPoint, phase = 0): THREE.Vector3 => {
    const pulseCenter = domain.minX + phase * domain.spanX;
    const pulseWidth = Math.max(domain.spanX * 0.12, 1e-6);
    const pulse = Math.exp(-0.5 * Math.pow((point.x - pulseCenter) / pulseWidth, 2));
    const carrier = Math.sin(phase * Math.PI * 8 + ((point.x - domain.minX) / domain.spanX) * Math.PI * 4);
    const radialDisplacement = amplitudeRef.current * 0.16 * pulse * carrier;
    const axialDisplacement = amplitudeRef.current * domain.spanX * 0.025 * pulse * Math.cos(phase * Math.PI * 4);
    return new THREE.Vector3(
      (point.x - domain.midX + axialDisplacement) * displayTransform.scale,
      (point.y - domain.midY) * displayTransform.radialBoost * (1 + radialDisplacement) * displayTransform.scale,
      (point.z - domain.midZ) * displayTransform.radialBoost * (1 + radialDisplacement) * displayTransform.scale,
    );
  }, [displayTransform.radialBoost, displayTransform.scale, domain.minX, domain.midX, domain.midY, domain.midZ, domain.spanX]);

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
      const stops = COLOR_STOPS[scale as keyof typeof COLOR_STOPS] ?? COLOR_STOPS.thermal;
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
      Math.min(displayTransform.displaySpanX, displayTransform.displaySpanY, displayTransform.displaySpanZ) / 80,
      0.008,
    );
    const voxelGeometry = new THREE.BoxGeometry(particleSize, particleSize, particleSize);
    const voxelMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    const instancedMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, volumetricData.length);
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    const dummy = new THREE.Object3D();
    const cadColorApplierRef = { current: (_phase: number) => undefined };

    const applyPhase = (phase: number) => {
      for (let index = 0; index < volumetricData.length; index += 1) {
        const point = volumetricData[index];
        const renderedPoint = transformPoint(point, phase);
        dummy.position.copy(renderedPoint);
        dummy.scale.setScalar(0.55 + amplitudeRef.current * 0.18);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(index, dummy.matrix);

        const pulseCenter = domain.minX + phase * domain.spanX;
        const pulseWidth = Math.max(domain.spanX * 0.12, 1e-6);
        const pulse = Math.exp(-0.5 * Math.pow((point.x - pulseCenter) / pulseWidth, 2));
        const baseValue = finiteValue(point[activeVariable]) ?? stats.minV;
        const waveValue = baseValue + (stats.maxV - stats.minV) * amplitudeRef.current * 0.18 * pulse;
        const normalizedValue = Math.max(stats.minV, Math.min(stats.maxV, waveValue));
        instancedMesh.setColorAt(index, getColorFromScale(normalizedValue, stats.minV, stats.maxV, colorScale));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      cadColorApplierRef.current(phase);
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
          const center = box.getCenter(new THREE.Vector3());
          const scaleX = displayTransform.scale;
          const scaleY = displayTransform.scale * displayTransform.radialBoost;
          const scaleZ = displayTransform.scale * displayTransform.radialBoost;
          cadModel.scale.set(scaleX, scaleY, scaleZ);
          cadModel.position.set(-center.x * scaleX, -center.y * scaleY, -center.z * scaleZ);
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
              opacity: 0.88,
              roughness: 0.42,
              metalness: 0.08,
              side: THREE.DoubleSide,
              wireframe: false,
            });
            cadMeshes.push(child);
          });

          const matchTolerance = Math.max(domain.spanX, domain.spanY, domain.spanZ, 1e-6) * displayTransform.scale * 0.035;
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
                if (sample.index >= 0 && sample.distance <= matchTolerance) {
                  const value = finiteValue(volumetricData[sample.index][activeVariable]) ?? stats.minV;
                  fieldColor.copy(getColorFromScale(value, stats.minV, stats.maxV, colorScale));
                } else {
                  fieldColor.setRGB(0.16, 0.20, 0.28);
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
    let lastUiUpdate = 0;
    const animate = (timestamp: number) => {
      animationFrameId = window.requestAnimationFrame(animate);
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;
      if (isPlayingRef.current) {
        animationPhaseRef.current = (animationPhaseRef.current + deltaSeconds * speedRef.current) % 1;
        forceApplyRef.current = true;
        if (timestamp - lastUiUpdate > 100) {
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
      setRendererReady(false);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [activeVariable, colorScale, displayTransform.radialBoost, displayTransform.scale, geometryAssetUrl, getColorFromScale, isMounted, stats.maxV, stats.minV, transformPoint, volumetricData]);

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
            {metadata?.source_label || "Données persistées"} — {stats.count.toLocaleString()} points
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={() => setIsPlaying((value) => !value)}
            disabled={!volumetricData.length}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${isPlaying ? "bg-amber-600 text-white" : "bg-white/5 text-amber-400"}`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Animer SPH / PINN"}
          </button>
          <button
            type="button"
            onClick={exportTransition}
            disabled={!volumetricData.length || Boolean(exportStatus)}
            className="flex min-h-10 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-fuchsia-400/40 bg-fuchsia-900/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300 transition-colors active:scale-[0.98] hover:bg-fuchsia-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Video size={14} /> Export transition ZIP
          </button>
        </div>
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] font-black uppercase tracking-widest text-slate-300 md:grid-cols-3">
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="text-amber-400">Phase</span>
          <input className="min-w-0 accent-amber-500" type="range" min="0" max="1" step="0.001" value={animationPhase} onChange={(event) => updatePhase(Number(event.target.value))} />
          <span className="text-right font-mono text-white">{animationPhase.toFixed(2)}</span>
        </label>
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="text-amber-400">Vitesse</span>
          <input className="min-w-0 accent-amber-500" type="range" min="0.001" max="0.1" step="0.001" value={animSpeed} onChange={(event) => setAnimSpeed(Number(event.target.value))} />
          <span className="text-right font-mono text-white">{animSpeed.toFixed(3)}</span>
        </label>
        <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="text-amber-400">Amplitude</span>
          <input className="min-w-0 accent-amber-500" type="range" min="0" max="0.5" step="0.01" value={animAmplitude} onChange={(event) => setAnimAmplitude(Number(event.target.value))} />
          <span className="text-right font-mono text-white">{animAmplitude.toFixed(2)}</span>
        </label>
      </div>

      <p className="mb-3 min-h-4 break-words text-center text-[10px] font-black uppercase tracking-widest text-fuchsia-300">{exportStatus}</p>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:min-h-[520px] lg:min-h-[560px]">
        <div ref={containerRef} className="absolute inset-0 min-h-0 min-w-0" />
        <div className="absolute bottom-3 right-3 top-3 flex w-16 flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-900/90 p-2 shadow-lg sm:bottom-4 sm:right-4 sm:top-4">
          <div className="max-w-full break-words text-center text-[8px] font-bold uppercase leading-tight text-white">{activeVariable} ({stats.unit})</div>
          <div className="my-2 min-h-24 w-3 flex-1 rounded-full" style={{ backgroundImage: colorGradient(colorScale) }} />
          <div className="flex h-24 flex-col justify-between text-[8px] font-mono text-gray-300">
            <span>{stats.maxV.toFixed(3)}</span>
            <span>{stats.avgV.toFixed(3)}</span>
            <span>{stats.minV.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(220px,auto)_minmax(280px,1.2fr)]">
        <select value={activeVariable} onChange={(event) => setActiveVariable(event.target.value)} className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-2 text-[10px] font-black uppercase text-white">
          <option value="temperature">Température (K)</option>
          <option value="pressure">Pression (MPa)</option>
          <option value="velocity_magnitude">Vitesse (m/s)</option>
          <option value="stress">Contrainte (MPa)</option>
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
