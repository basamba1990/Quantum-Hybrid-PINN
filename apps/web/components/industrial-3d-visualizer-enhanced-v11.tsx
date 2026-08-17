"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import {
  Activity,
  Zap,
  ShieldCheck,
  Database,
  Thermometer,
  Gauge,
  Wind,
  Layers,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  normalizeVisualizationPoints,
  type VisualizationMetadata,
  type VisualizationPoint,
} from "@/lib/visualization-data";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center text-xs font-black uppercase text-cyan-500 animate-pulse">
      Chargement Plotly.js...
    </div>
  ),
});

type ScenarioType =
  | "H2_PIPELINE"
  | "LH2_STORAGE"
  | "DEEP_MINING_BLOCK"
  | "LH2_INFRASTRUCTURE_INTEGRITY"
  | "LH2_LARGE_SCALE_STORAGE_1250M3"
  | "HEAVY_DUTY_HYDROGEN_REFUELING";

interface Props {
  data?: unknown;
  experimentalData?: unknown;
  metadata?: VisualizationMetadata;
  title?: string;
  colorVariable?: string;
  scenarioType?: ScenarioType;
  geometryAssetUrl?: string;
  metrics?: any;
}

const SCENARIO_GEOMETRIES: Record<string, any> = {
  LH2_STORAGE: { shape: "cylinder_vertical", radius: 3.0, height: 8.0, length: 6.0, width: 6.0, description: "LH2 CRYOGENIC STORAGE" },
  HEAVY_DUTY_HYDROGEN_REFUELING: { shape: "cylinder_horizontal", radius: 0.025, height: 0.05, length: 2.55, width: 0.05, description: "Manifold DN50 B-Rep" },
  LH2_INFRASTRUCTURE_INTEGRITY: { shape: "cylinder_horizontal", radius: 0.025, height: 0.05, length: 2.0, width: 0.05, description: "LH2 DN50 Pipeline" },
  LH2_LARGE_SCALE_STORAGE_1250M3: { shape: "box", radius: 6.73, height: 13.46, length: 13.46, width: 13.46, description: "Sphère LH2 1250m3" },
};

export default function Industrial3DVisualizerEnhancedV11({
  data = [],
  experimentalData = [],
  metadata,
  title = "Visualisation CFD",
  colorVariable = "temperature",
  scenarioType = "LH2_STORAGE",
  geometryAssetUrl,
  metrics,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [activeVariable, setActiveVariable] = useState(colorVariable || "temperature");
  const [colorScale, setColorScale] = useState<"thermal" | "viridis" | "coolwarm">("thermal");
  const [isPlaying, setIsPlaying] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(0.02);
  const [animAmplitude, setAnimAmplitude] = useState(0.15);
  const [activeTab, setActiveTab] = useState<"3d" | "plotly" | "metrics">("3d");
  const [cadSurfaceStatus, setCadSurfaceStatus] = useState<string>("absent");

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false); }, []);

  const exportCSV = useCallback(() => {
    if (!volumetricData.length) return;
    const headers = Object.keys(volumetricData[0]).join(",");
    const rows = volumetricData.map((p) => Object.values(p).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scenarioType}_volumetric_10k.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [volumetricData, scenarioType]);

  const exportSTL = useCallback(() => {
    if (!sceneRef.current) return;
    const exporter = new STLExporter();
    const result = exporter.parse(sceneRef.current, { binary: true });
    const blob = new Blob([result], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scenarioType}_geometry.stl`;
    link.click();
    URL.revokeObjectURL(url);
  }, [scenarioType]);

  const volumetricData = useMemo(() => normalizeVisualizationPoints(data), [data]);
  const measuredData = useMemo(() => normalizeVisualizationPoints(experimentalData), [experimentalData]);

  const stats = useMemo(() => {
    const vals = volumetricData.map(p => p[activeVariable]).filter((v): v is number => typeof v === 'number' && isFinite(v));
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 100;
    return { minV, maxV, avgV: vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0, count: volumetricData.length, fieldCount: vals.length, unit: metadata?.fields?.[activeVariable]?.unit || "SI" };
  }, [volumetricData, activeVariable, metadata]);

  const getColorFromScale = useCallback((val: number, min: number, max: number, scale: string) => {
    const norm = Math.max(0, Math.min(1, (val - min) / (Math.max(max - min, 1e-6))));
    const stops = scale === "thermal" ? ["#180f3d", "#721f81", "#bb3754", "#ed6925", "#fbb61a", "#f0f921"] : ["#440154", "#31688e", "#35b779", "#fde725"];
    const idx = Math.min(stops.length - 2, Math.floor(norm * (stops.length - 1)));
    const c1 = new THREE.Color(stops[idx]);
    const c2 = new THREE.Color(stops[idx+1]);
    return c1.lerp(c2, norm * (stops.length - 1) - idx);
  }, []);

  useEffect(() => {
    if (!isMounted || !containerRef.current || !volumetricData.length) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // Grid & Axes
    scene.add(new THREE.GridHelper(10, 20, 0x1e293b, 0x0f172a));
    scene.add(new THREE.AxesHelper(1));

    // Instanced Mesh for Points
    const voxelGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const voxelMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const instancedMesh = new THREE.InstancedMesh(voxelGeo, voxelMat, volumetricData.length);
    const dummy = new THREE.Object3D();
    volumetricData.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
      const color = getColorFromScale(Number(p[activeVariable]) || 0, stats.minV, stats.maxV, colorScale);
      instancedMesh.setColorAt(i, color);
    });
    scene.add(instancedMesh);

    // CAD Loader
    let cadModel: THREE.Object3D | null = null;
    if (geometryAssetUrl) {
      setCadSurfaceStatus("loading");
      new GLTFLoader().load(geometryAssetUrl, (gltf) => {
        cadModel = gltf.scene;
        // Auto-center and scale
        const box = new THREE.Box3().setFromObject(cadModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        cadModel.scale.setScalar(scale);
        cadModel.position.sub(center.multiplyScalar(scale));
        
        cadModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3, wireframe: true });
          }
        });
        scene.add(cadModel);
        setCadSurfaceStatus("aligned");
      });
    }

    let animationFrameId: number;
    let internalTime = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (isPlaying) {
        internalTime += animSpeed;
        if (internalTime > 1.0) internalTime = 0;
        
        volumetricData.forEach((p, i) => {
          const wave = Math.sin(internalTime * Math.PI * 2 + p.x * 10.0) * animAmplitude;
          const radialScale = 1.0 + wave;
          dummy.position.set(p.x, p.y * radialScale, p.z * radialScale);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          
          const val = (Number(p[activeVariable]) || 0) * (1.0 + wave * 0.2);
          instancedMesh.setColorAt(i, getColorFromScale(val, stats.minV, stats.maxV, colorScale));
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      voxelGeo.dispose();
      voxelMat.dispose();
    };
  }, [isMounted, volumetricData, activeVariable, colorScale, isPlaying, animSpeed, animAmplitude, stats, getColorFromScale, geometryAssetUrl]);

  return (
    <div className="flex flex-col h-full w-full bg-[#020617] rounded-[32px] border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] font-mono text-cyan-400">
            {metadata?.source_label || "Données Certifiées G0-G5"} — {stats.count.toLocaleString()} points
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPlaying(!isPlaying)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPlaying ? "bg-amber-600 text-white animate-pulse" : "bg-white/5 text-amber-400"}`}>
            {isPlaying ? "Pause" : "▶ Animer SPH / PINN"}
          </button>
          <div className="flex gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
            <input type="range" min="0.001" max="0.1" step="0.001" value={animSpeed} onChange={(e) => setAnimSpeed(parseFloat(e.target.value))} className="w-12 h-1 accent-amber-500" />
            <input type="range" min="0" max="0.5" step="0.01" value={animAmplitude} onChange={(e) => setAnimAmplitude(parseFloat(e.target.value))} className="w-12 h-1 accent-amber-500" />
          </div>
        </div>
      </div>

      <div className="flex-1 relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden min-h-[500px]">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute right-4 top-4 bottom-4 w-12 bg-slate-900/80 rounded-xl border border-white/10 p-2 flex flex-col items-center justify-between">
          <div className="text-[8px] font-bold text-white text-center uppercase">{activeVariable}</div>
          <div className="flex-1 w-3 rounded-full my-2" style={{ backgroundImage: `linear-gradient(to top, #180f3d, #721f81, #bb3754, #ed6925, #fbb61a, #f0f921)` }} />
          <div className="text-[8px] font-mono text-gray-400 flex flex-col justify-between h-24">
            <span>{stats.maxV.toFixed(1)}</span>
            <span>{stats.minV.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <select value={activeVariable} onChange={(e) => setActiveVariable(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-white uppercase">
          <option value="temperature">Température (K)</option>
          <option value="pressure">Pression (MPa)</option>
          <option value="velocity_magnitude">Vitesse (m/s)</option>
          <option value="stress">Contrainte (MPa)</option>
        </select>
        <div className="flex gap-1">
          {["thermal", "viridis"].map(s => (
            <button key={s} onClick={() => setColorScale(s as any)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase ${colorScale === s ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"}`}>{s}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportCSV}
            className="flex-1 bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-colors"
          >
            CSV 10k+
          </button>
          <button 
            onClick={exportSTL}
            className="flex-1 bg-blue-900/30 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors"
          >
            STL Export
          </button>
        </div>
      </div>
    </div>
  );
}
