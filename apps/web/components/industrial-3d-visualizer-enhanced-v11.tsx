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
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  Activity,
  Cpu,
  Database,
  ShieldCheck,
  Box,
  Download,
  Thermometer,
  Gauge,
  Wind,
  Zap,
  Scissors,
  Layers,
  FileSpreadsheet,
  Image as ImageIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  normalizeVisualizationPoints,
  type VisualizationMetadata,
  type VisualizationPoint,
} from "@/lib/visualization-data";

type DataPoint = VisualizationPoint;

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
  | "ROCK_ELAST_STRESS"
  | "H2_PIPELINE_STRATEGIC"
  | "FPGA_HEATSINK"
  | "PORT_ENERGY_OPTIMIZATION"
  | "PIPELINE_SAFETY"
  | "CRYOGENIC_TRANSPORT"
  | "MINING_INDUSTRIAL_SIM"
  | "H2_COMPRESSION_STATION"
  | "H2_DISTRIBUTION_HIGH_PRESSURE"
  | "LH2_INFRASTRUCTURE_INTEGRITY"
  | "LH2_LARGE_SCALE_STORAGE_1250M3"
  | "HEAVY_DUTY_HYDROGEN_REFUELING"
  | "SMART_RADIATOR";

interface Props {
  data?: unknown;
  experimentalData?: unknown;
  metadata?: VisualizationMetadata;
  title?: string;
  colorVariable?: string;
  quality?: "low" | "medium" | "high" | "ultra";
  scenarioType?: ScenarioType;
  /** Surface CAO tessellée depuis le STEP AP242, versionnée et traçable. */
  geometryAssetUrl?: string;
  metrics?: {
    credibilityScore?: number;
    residuals?: {
      continuity?: number;
      momentum?: number;
      energy?: number;
    };
  };
}

const SCENARIO_GEOMETRIES: Record<
  ScenarioType,
  {
    shape: "cylinder_vertical" | "cylinder_horizontal" | "box";
    radius: number;
    height: number;
    length: number;
    width: number;
    description: string;
    defaultTemp: number;
    defaultPressure: number;
    defaultVelocity: number;
  }
> = {
  LH2_STORAGE: {
    shape: "cylinder_vertical",
    radius: 3.0,
    height: 8.0,
    length: 6.0,
    width: 6.0,
    description: "LH2 CRYOGENIC STORAGE V2.1.7 — Quantum Hybrid PINN",
    defaultTemp: 20.28,
    defaultPressure: 1.2,
    defaultVelocity: 0.1,
  },
  LH2_LARGE_SCALE_STORAGE_1250M3: {
    shape: "box",
    radius: 6.73,
    height: 13.46,
    length: 13.46,
    width: 13.46,
    description: "Sphère B-Rep LH2 1 250 m³ — surface GLB issue d'Open CASCADE",
    defaultTemp: 0,
    defaultPressure: 0,
    defaultVelocity: 0,
  },
  HEAVY_DUTY_HYDROGEN_REFUELING: {
    shape: "box",
    radius: 0.055,
    height: 0.11,
    length: 2.55,
    width: 0.11,
    description: "Manifold DN50 B-Rep — surface GLB issue d'Open CASCADE",
    defaultTemp: 0,
    defaultPressure: 0,
    defaultVelocity: 0,
  },
  LH2_INFRASTRUCTURE_INTEGRITY: {
    shape: "cylinder_horizontal",
    radius: 0.025,
    height: 0.05,
    length: 2.0,
    width: 0.05,
    description: "LH2 DN50 — ligne de transfert cryogénique pleine",
    defaultTemp: 20.28,
    defaultPressure: 1.2,
    defaultVelocity: 1.0,
  },
  H2_PIPELINE: {
    shape: "cylinder_horizontal",
    radius: 0.5,
    height: 1.0,
    length: 12.0,
    width: 1.0,
    description: "Pipeline Hydrogène DN300 PN200",
    defaultTemp: 293.15,
    defaultPressure: 200.0,
    defaultVelocity: 12.0,
  },
  H2_DISTRIBUTION_HIGH_PRESSURE: {
    shape: "cylinder_horizontal",
    radius: 0.4,
    height: 0.8,
    length: 15.0,
    width: 0.8,
    description: "Distribution H2 70 MPa (NIST)",
    defaultTemp: 288.0,
    defaultPressure: 70.0,
    defaultVelocity: 15.0,
  },
  H2_PIPELINE_STRATEGIC: {
    shape: "cylinder_horizontal",
    radius: 0.8,
    height: 1.6,
    length: 50.0,
    width: 1.6,
    description: "Pipeline H2 Stratégique Inter-régional",
    defaultTemp: 290.0,
    defaultPressure: 100.0,
    defaultVelocity: 10.0,
  },
  PIPELINE_SAFETY: {
    shape: "cylinder_horizontal",
    radius: 0.5,
    height: 1.0,
    length: 20.0,
    width: 1.0,
    description: "Sécurité Transitoire Pipelines",
    defaultTemp: 285.0,
    defaultPressure: 80.0,
    defaultVelocity: 8.0,
  },
  CRYOGENIC_TRANSPORT: {
    shape: "cylinder_horizontal",
    radius: 1.5,
    height: 3.0,
    length: 18.0,
    width: 3.0,
    description: "Transport Cryogénique LH2",
    defaultTemp: 22.0,
    defaultPressure: 0.5,
    defaultVelocity: 0.3,
  },
  DEEP_MINING_BLOCK: {
    shape: "box",
    radius: 25.0,
    height: 50.0,
    length: 50.0,
    width: 50.0,
    description: "Bloc Minier Profond 2500m",
    defaultTemp: 325.0,
    defaultPressure: 65.0,
    defaultVelocity: 0.02,
  },
  ROCK_ELAST_STRESS: {
    shape: "box",
    radius: 5.0,
    height: 10.0,
    length: 10.0,
    width: 10.0,
    description: "Contrainte Élastique Rocheuse",
    defaultTemp: 295.0,
    defaultPressure: 35.0,
    defaultVelocity: 0.01,
  },
  FPGA_HEATSINK: {
    shape: "box",
    radius: 0.05,
    height: 0.04,
    length: 0.1,
    width: 0.1,
    description: "Dissipateur Thermique FPGA",
    defaultTemp: 345.0,
    defaultPressure: 0.1,
    defaultVelocity: 4.2,
  },
  SMART_RADIATOR: {
    shape: "box",
    radius: 0,
    height: 0,
    length: 0,
    width: 0,
    description: "SMART_RADIATOR — géométrie CAO persistée requise",
    defaultTemp: 0,
    defaultPressure: 0,
    defaultVelocity: 0,
  },
  PORT_ENERGY_OPTIMIZATION: {
    shape: "box",
    radius: 5.0,
    height: 12.0,
    length: 25.0,
    width: 20.0,
    description: "Optimisation Énergétique Portuaire",
    defaultTemp: 298.0,
    defaultPressure: 1.0,
    defaultVelocity: 2.5,
  },
  MINING_INDUSTRIAL_SIM: {
    shape: "box",
    radius: 10.0,
    height: 20.0,
    length: 40.0,
    width: 30.0,
    description: "Simulation Minière Souterraine",
    defaultTemp: 305.0,
    defaultPressure: 1.1,
    defaultVelocity: 3.1,
  },
  H2_COMPRESSION_STATION: {
    shape: "box",
    radius: 3.0,
    height: 6.0,
    length: 8.0,
    width: 6.0,
    description: "Station de Compression H2",
    defaultTemp: 330.0,
    defaultPressure: 45.0,
    defaultVelocity: 18.0,
  },
};

/** Générateur pur et sans artefact de 10 000+ points volumétriques continus (maillage structuré plein) */
export function generatePureVolumetricGrid(
  meta: (typeof SCENARIO_GEOMETRIES)[ScenarioType],
): DataPoint[] {
  const points: DataPoint[] = [];

  if (meta.shape === "cylinder_vertical") {
    const R = meta.radius; // e.g. 3.0
    const H = meta.height; // e.g. 8.0
    const radialLayers = 18; // Couches concentriques
    const angularSlices = 45; // Sangles angulaires
    const heightSteps = 14; // Hauteurs Y (axe vertical Three.js)

    for (let h = 0; h < heightSteps; h++) {
      const y = (h / (heightSteps - 1)) * H - H / 2; // axe vertical Three.js, de -H/2 à +H/2
      const normY = (y + H / 2) / H;

      // Nœud central explicite : un anneau seul laisserait un trou au cœur du volume.
      points.push({
        x: 0,
        y: Number(y.toFixed(3)),
        z: 0,
        temperature: Number((20.28 + normY * 220.0 + 35.0).toFixed(2)),
        pressure: Number((meta.defaultPressure + normY * 0.5).toFixed(3)),
        velocity_magnitude: Number(meta.defaultVelocity.toFixed(3)),
        stress: Number((15.0 + normY * 10.0).toFixed(2)),
      });

      for (let r = 1; r <= radialLayers; r++) {
        const rho = (r / radialLayers) * R;
        for (let a = 0; a < angularSlices; a++) {
          const theta = (a / angularSlices) * Math.PI * 2;
          const x = rho * Math.cos(theta);
          const z = rho * Math.sin(theta);

          // Température physique réaliste (froid cryogénique 20K en bas/cœur, chaud en haut)
          const normR = rho / R; // 0 à 1
          const temp = 20.28 + normY * 220.0 + (1.0 - normR) * 35.0;
          const pressure = meta.defaultPressure + normY * 0.5;
          const velocity = meta.defaultVelocity * (1.0 - normR * 0.5);
          const stress = 15.0 + normR * 25.0 + normY * 10.0;

          points.push({
            x: Number(x.toFixed(3)),
            y: Number(y.toFixed(3)),
            z: Number(z.toFixed(3)),
            temperature: Number(temp.toFixed(2)),
            pressure: Number(pressure.toFixed(3)),
            velocity_magnitude: Number(velocity.toFixed(3)),
            stress: Number(stress.toFixed(2)),
          });
        }
      }
    }
  } else if (meta.shape === "cylinder_horizontal") {
    const R = meta.radius;
    const L = meta.length;
    const axialSteps = 120;
    const radialLayers = 16;
    const angularSlices = 36;

    for (let i = 0; i < axialSteps; i++) {
      const x = (i / (axialSteps - 1)) * L - L / 2;
      const normX = i / (axialSteps - 1);

      // Nœud central explicite le long de l'axe longitudinal pour éviter l'effet tube vide
      points.push({
        x: Number(x.toFixed(3)),
        y: 0,
        z: 0,
        temperature: Number((meta.defaultTemp + 5.0 * (1.0 - normX)).toFixed(2)),
        pressure: Number((meta.defaultPressure * (1.0 - normX * 0.05)).toFixed(3)),
        velocity_magnitude: Number((meta.defaultVelocity * 1.2).toFixed(3)),
        stress: Number((25.0 + normX * 10.0).toFixed(2)),
      });

      for (let r = 1; r <= radialLayers; r++) {
        const rho = (r / radialLayers) * R;
        for (let a = 0; a < angularSlices; a++) {
          const theta = (a / angularSlices) * Math.PI * 2;
          const y = rho * Math.cos(theta);
          const z = rho * Math.sin(theta);

          const normRho = rho / R;
          const temp = meta.defaultTemp + (1.0 - normRho) * 15.0 + 5.0 * (1.0 - normX);
          const pressure =
            meta.defaultPressure * (1.0 - normX * 0.05);
          const velocity = meta.defaultVelocity * (1.0 - normRho * normRho);
          const stress = 25.0 + normRho * 20.0;

          points.push({
            x: Number(x.toFixed(3)),
            y: Number(y.toFixed(3)),
            z: Number(z.toFixed(3)),
            temperature: Number(temp.toFixed(2)),
            pressure: Number(pressure.toFixed(3)),
            velocity_magnitude: Number(velocity.toFixed(3)),
            stress: Number(stress.toFixed(2)),
          });
        }
      }
    }
  } else {
    // Box
    const X = meta.length;
    const Y = meta.height; // axe vertical Three.js
    const Z = meta.width; // axe transversal
    const steps = 22;

    for (let ix = 0; ix < steps; ix++) {
      const x = (ix / (steps - 1)) * X - X / 2;
      for (let iy = 0; iy < steps; iy++) {
        const z = (iy / (steps - 1)) * Z - Z / 2;
        for (let iz = 0; iz < steps; iz++) {
          const y = (iz / (steps - 1)) * Y - Y / 2;

          const dist =
            Math.sqrt(x * x + y * y + z * z) / (Math.max(X, Y, Z) / 2);
          const temp = meta.defaultTemp + dist * 35.0;
          const pressure = meta.defaultPressure + (y / Y) * 5.0;
          const velocity = meta.defaultVelocity * (1.0 - dist * 0.3);
          const stress = 30.0 + dist * 30.0;

          points.push({
            x: Number(x.toFixed(3)),
            y: Number(y.toFixed(3)),
            z: Number(z.toFixed(3)),
            temperature: Number(temp.toFixed(2)),
            pressure: Number(pressure.toFixed(3)),
            velocity_magnitude: Number(velocity.toFixed(3)),
            stress: Number(stress.toFixed(2)),
          });
        }
      }
    }
  }

  return points;
}

export default function Industrial3DVisualizerEnhancedV11({
  data = [],
  experimentalData = [],
  metadata,
  title = "Visualisation CFD — données persistées requises",
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
  const [activeVariable, setActiveVariable] = useState(
    colorVariable || "temperature",
  );
  const [renderMode, setRenderMode] = useState<
    "particles" | "volume" | "isosurface"
  >("volume");
  const [colorScale, setColorScale] = useState<"thermal" | "viridis" | "coolwarm">(
    "thermal",
  );
  const [cutPosition, setCutPosition] = useState<number>(1.0);
  const [activeTab, setActiveTab] = useState<"3d" | "plotly" | "metrics">("3d");
  const [cadSurfaceStatus, setCadSurfaceStatus] = useState<"absent" | "loading" | "aligned" | "unaligned" | "error">("absent");

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const geometryMeta = useMemo(
    () => SCENARIO_GEOMETRIES[scenarioType] || SCENARIO_GEOMETRIES.LH2_STORAGE,
    [scenarioType],
  );

  // Le rendu 3D est strictement piloté par les champs persistés. Aucune grille
  // paramétrique ne remplace une prédiction PINN ou une mesure expérimentale absente.
  const fieldData = useMemo(() => normalizeVisualizationPoints(data), [data]);
  const measuredData = useMemo(() => normalizeVisualizationPoints(experimentalData), [experimentalData]);
  const volumetricData = useMemo(() => {
    const merged = [...fieldData, ...measuredData];
    const seen = new Set<string>();
    return merged.filter((point) => {
      const key = `${point.x}|${point.y}|${point.z}|${point.time ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fieldData, measuredData]);

  const stats = useMemo(() => {
    const vals = volumetricData
      .map((point) => point[activeVariable])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const unit = metadata?.fields?.[activeVariable]?.unit
      ?? (activeVariable === "temperature" ? "K" : activeVariable.includes("velocity") ? "m/s" : "unit_required");
    const minV = vals.length ? Math.min(...vals) : null;
    const maxV = vals.length ? Math.max(...vals) : null;
    const spanV = minV !== null && maxV !== null ? Math.abs(maxV - minV) : null;
    return {
      minV,
      maxV,
      avgV: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      spanV,
      isConstant: spanV !== null && spanV <= Number.EPSILON,
      count: volumetricData.length,
      fieldCount: vals.length,
      unit,
    };
  }, [volumetricData, activeVariable, metadata?.fields]);

  const dataBounds = useMemo(() => {
    if (!volumetricData.length) return null;
    const xs = volumetricData.map((point) => point.x);
    const ys = volumetricData.map((point) => point.y);
    const zs = volumetricData.map((point) => point.z);
    const min = { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) };
    const max = { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) };
    return {
      min,
      max,
      center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
      span: Math.max(max.x - min.x, max.y - min.y, max.z - min.z, Number.EPSILON),
    };
  }, [volumetricData]);

  const displayGeometry = useMemo(() => {
    const geometry = metadata?.geometry ?? {};
    const dimensions = geometry.dimensions_m && typeof geometry.dimensions_m === "object"
      ? (geometry.dimensions_m as Record<string, unknown>)
      : geometry;
    const finiteDimension = (key: string) => {
      const value = Number(dimensions[key]);
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    return {
      ...geometryMeta,
      radius: finiteDimension("inner_radius") ?? finiteDimension("radius") ?? geometryMeta.radius,
      length: finiteDimension("length") ?? geometryMeta.length,
      width: finiteDimension("width") ?? geometryMeta.width,
      height: finiteDimension("height") ?? geometryMeta.height,
    };
  }, [geometryMeta, metadata?.geometry]);

  const radialVisualMultiplier = scenarioType === "LH2_INFRASTRUCTURE_INTEGRITY" ? 6 : 1;

  // Palettes séquentielles perceptuellement uniformes : viridis est le défaut
  // scientifique pour un champ scalaire continu ; inferno convient aux champs
  // thermiques ; coolwarm est réservé aux champs signés (contraintes/résidus).
  const colorScaleGradient =
    colorScale === "thermal"
      ? "linear-gradient(to top, #180f3d, #721f81, #bb3754, #ed6925, #fbb61a, #f0f921)"
      : colorScale === "viridis"
        ? "linear-gradient(to top, #440154, #31688e, #35b779, #fde725)"
        : "linear-gradient(to top, #3b4cc0, #8db0fe, #f7f7f7, #f4987a, #b40426)";

  const getColorFromScale = useCallback(
    (val: number, min: number | null, max: number | null, scale: string) => {
      if (min === null || max === null) return new THREE.Color("#64748b");
      // Un champ constant doit être rendu au milieu de la palette, et non au
      // premier arrêt sombre. La colorbar et la géométrie représentent ainsi
      // la même valeur, sans créer l'illusion d'un volume noir.
      const span = max - min;
      const norm = Math.abs(span) <= Number.EPSILON
        ? 0.5
        : Math.max(0, Math.min(1, (val - min) / span));
      const stops = scale === "thermal"
        ? ["#180f3d", "#721f81", "#bb3754", "#ed6925", "#fbb61a", "#f0f921"]
        : scale === "viridis"
          ? ["#440154", "#31688e", "#35b779", "#fde725"]
          : ["#3b4cc0", "#8db0fe", "#f7f7f7", "#f4987a", "#b40426"];
      const scaled = norm * (stops.length - 1);
      const index = Math.min(stops.length - 2, Math.floor(scaled));
      const color = new THREE.Color(stops[index]);
      return color.lerp(new THREE.Color(stops[index + 1]), scaled - index);
    },
    [],
  );

  // Rendu Three.js avec cylindre plein de points dense
  useEffect(() => {
    if (!isMounted || !containerRef.current) return;
    const container = containerRef.current;
    container.replaceChildren();
    if (!geometryAssetUrl && (!volumetricData.length || !dataBounds)) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;
    const meta = displayGeometry;
    const fallbackSpanX = Math.max(meta.length, 1);
    const fallbackSpanY = Math.max(meta.height, 1);
    const fallbackSpanZ = Math.max(meta.width, 1);
    const renderBounds = dataBounds ?? {
      min: { x: -fallbackSpanX / 2, y: -fallbackSpanY / 2, z: -fallbackSpanZ / 2 },
      max: { x: fallbackSpanX / 2, y: fallbackSpanY / 2, z: fallbackSpanZ / 2 },
      center: { x: 0, y: 0, z: 0 },
      span: Math.max(fallbackSpanX, fallbackSpanY, fallbackSpanZ),
    };
    const center = renderBounds.center;
    const spanX = Math.max(renderBounds.max.x - renderBounds.min.x, meta.length, 0.001);
    const spanY = Math.max(renderBounds.max.y - renderBounds.min.y, meta.height, 0.001);
    const spanZ = Math.max(renderBounds.max.z - renderBounds.min.z, meta.width, 0.001);
    const maxDimension = Math.max(spanX, spanY, spanZ, renderBounds.span);
    const cameraDistance = Math.max(maxDimension * 2.4, 0.25);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      40,
      width / height,
      Math.max(maxDimension / 1000, 0.0001),
      Math.max(maxDimension * 20, 10),
    );
    camera.position.set(center.x + cameraDistance, center.y + cameraDistance * 0.65, center.z + cameraDistance);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      // Le mode sans WebGL conserve l’état textuel et la colorbar ; aucune donnée n’est inventée.
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(center.x, center.y, center.z);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(center.x + maxDimension, center.y + maxDimension * 2, center.z + maxDimension);
    scene.add(dirLight);

    const gridSize = Math.max(maxDimension * 1.35, 0.1);
    const grid = new THREE.GridHelper(gridSize, 16, 0x3b82f6, 0x1e293b);
    grid.position.set(center.x, renderBounds.min.y, center.z);
    scene.add(grid);
    const axes = new THREE.AxesHelper(Math.max(maxDimension * 0.35, 0.05));
    axes.position.set(center.x, center.y, center.z);
    scene.add(axes);

    // Fallback uniquement : il ne doit jamais être présenté comme une CAO validée.
    const physicalRadius = Math.max(spanY, spanZ) / 2;
    const displayRadius = physicalRadius * radialVisualMultiplier;
    let outerGeo: THREE.BufferGeometry | null = null;
    let outerMat: THREE.Material | null = null;
    if (!geometryAssetUrl) {
      if (meta.shape === "cylinder_vertical") {
        outerGeo = new THREE.CylinderGeometry(Math.max(spanX, spanZ) / 2, Math.max(spanX, spanZ) / 2, spanY, 36, 1, true);
      } else if (meta.shape === "cylinder_horizontal") {
        outerGeo = new THREE.CylinderGeometry(displayRadius, displayRadius, spanX, 48, 1, true);
        outerGeo.rotateZ(Math.PI / 2);
      } else {
        outerGeo = new THREE.BoxGeometry(spanX, spanY, spanZ);
      }
      outerMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.08, side: THREE.DoubleSide, wireframe: true });
      const vesselMesh = new THREE.Mesh(outerGeo, outerMat);
      vesselMesh.position.set(center.x, center.y, center.z);
      scene.add(vesselMesh);
    }

    // Surface B-Rep tessellée par Open CASCADE et publiée au format GLB.
    // La colorisation est appliquée uniquement si les points du champ recouvrent
    // spatialement la surface ; sinon la surface reste neutre et la colorbar est
    // explicitement signalée comme non alignée.
    let cadRoot: THREE.Object3D | null = null;
    let cadFieldAligned = false;
    let disposed = false;
    if (geometryAssetUrl) {
      setCadSurfaceStatus("loading");
      const loader = new GLTFLoader();
      loader.load(
        geometryAssetUrl,
        (gltf) => {
          if (disposed) return;
          cadRoot = gltf.scene;
          // Le STEP du manifold est exporté avec son axe principal sur Z ;
          // le contrat de champ du cas Heavy-Duty utilise X comme axe de débit.
          // La rotation est géométrique uniquement et ne modifie aucune valeur physique.
          if (scenarioType === "HEAVY_DUTY_HYDROGEN_REFUELING") {
            cadRoot.rotation.y = Math.PI / 2;
          }
          const box = new THREE.Box3().setFromObject(cadRoot);
          const cadCenter = box.getCenter(new THREE.Vector3());
          const cadSize = box.getSize(new THREE.Vector3());
          const targetSize = new THREE.Vector3(spanX, spanY, spanZ);
          const scale = Math.min(
            targetSize.x / Math.max(cadSize.x, Number.EPSILON),
            targetSize.y / Math.max(cadSize.y, Number.EPSILON),
            targetSize.z / Math.max(cadSize.z, Number.EPSILON),
          );
          cadRoot.position.sub(cadCenter).multiplyScalar(scale);
          cadRoot.position.add(new THREE.Vector3(center.x, center.y, center.z));
          cadRoot.scale.setScalar(scale);
          const fieldSamples = volumetricData.filter((point) => {
            const value = point[activeVariable];
            return typeof value === "number" && Number.isFinite(value);
          }).slice(0, 4096);
          const fieldBox = fieldSamples.length ? new THREE.Box3().setFromPoints(fieldSamples.map((point) => new THREE.Vector3(point.x, point.y, point.z))) : null;
          const overlap = fieldBox && fieldBox.intersectsBox(new THREE.Box3().setFromObject(cadRoot));
          cadFieldAligned = Boolean(overlap && fieldSamples.length && stats.minV !== null && stats.maxV !== null);
          cadRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
            if (cadFieldAligned) {
              const position = mesh.geometry.getAttribute("position");
              const colors = new Float32Array(position.count * 3);
              const local = new THREE.Vector3();
              const world = new THREE.Vector3();
              for (let i = 0; i < position.count; i += 1) {
                local.fromBufferAttribute(position, i);
                world.copy(local);
                mesh.localToWorld(world);
                let nearest = fieldSamples[0];
                let nearestDistance = Infinity;
                for (const sample of fieldSamples) {
                  const distance = (sample.x - world.x) ** 2 + (sample.y - world.y) ** 2 + (sample.z - world.z) ** 2;
                  if (distance < nearestDistance) { nearestDistance = distance; nearest = sample; }
                }
                const value = nearest[activeVariable];
                const mapped = typeof value === "number" && Number.isFinite(value)
                  ? getColorFromScale(value, stats.minV, stats.maxV, colorScale)
                  : new THREE.Color("#64748b");
                colors[i * 3] = mapped.r;
                colors[i * 3 + 1] = mapped.g;
                colors[i * 3 + 2] = mapped.b;
              }
              mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
              mesh.geometry.attributes.color.needsUpdate = true;
              mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.18, side: THREE.DoubleSide });
            } else {
              mesh.material = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.52, metalness: 0.22, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
            }
          });
          scene.add(cadRoot);
          setCadSurfaceStatus(cadFieldAligned ? "aligned" : "unaligned");
        },
        undefined,
        () => setCadSurfaceStatus("error"),
      );
    } else {
      setCadSurfaceStatus("absent");
    }

    // Les points persistés peuvent être uniquement axiaux (cas de la capture).
    // On construit alors une enveloppe cylindrique pleine, mais chaque sommet
    // reçoit uniquement une valeur issue du champ persisté le long de x : ce
    // rendu est explicitement une interpolation axiale, jamais une mesure inventée.
    let solidFieldMesh: THREE.Mesh | null = null;
    if (!geometryAssetUrl && meta.shape === "cylinder_horizontal" && stats.fieldCount > 0) {
      const solidRadius = Math.max(displayGeometry.radius * radialVisualMultiplier, displayRadius, Number.EPSILON);
      const solidLength = Math.max(spanX, displayGeometry.length, Number.EPSILON);
      const axialSamples = [...volumetricData]
        .filter((point) => typeof point[activeVariable] === "number" && Number.isFinite(point[activeVariable]))
        .sort((a, b) => a.x - b.x);
      const valueAtX = (x: number) => {
        if (!axialSamples.length) return null;
        let nearest = axialSamples[0];
        let distance = Math.abs(axialSamples[0].x - x);
        for (const sample of axialSamples) {
          const nextDistance = Math.abs(sample.x - x);
          if (nextDistance < distance) { nearest = sample; distance = nextDistance; }
        }
        const value = nearest[activeVariable];
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      };
      const solidGeo = new THREE.CylinderGeometry(solidRadius, solidRadius, solidLength, 48, Math.min(96, Math.max(8, axialSamples.length)), false);
      solidGeo.rotateZ(Math.PI / 2);
      const positionAttribute = solidGeo.getAttribute("position");
      const colors = new Float32Array(positionAttribute.count * 3);
      const color = new THREE.Color();
      for (let vertexIndex = 0; vertexIndex < positionAttribute.count; vertexIndex += 1) {
        const localX = positionAttribute.getX(vertexIndex);
        const physicalX = center.x + localX;
        const value = valueAtX(physicalX);
        color.copy(value === null ? new THREE.Color("#64748b") : getColorFromScale(value, stats.minV, stats.maxV, colorScale));
        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;
      }
      solidGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const solidMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: false, opacity: 0.94, side: THREE.DoubleSide, depthWrite: true });
      solidFieldMesh = new THREE.Mesh(solidGeo, solidMat);
      solidFieldMesh.position.set(center.x, center.y, center.z);
      scene.add(solidFieldMesh);
    }

    const pointBounds = dataBounds ?? renderBounds;
    const voxelSize = Math.max(pointBounds.span / 120, Math.min(spanX, spanY, spanZ) / 32, Number.EPSILON);
    const voxelGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const voxelMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: false, opacity: 0.92 });
    const cutLimit = pointBounds.min.x + cutPosition * (pointBounds.max.x - pointBounds.min.x);
    const visiblePoints = geometryAssetUrl ? [] : volumetricData.filter((point) => point.x <= cutLimit);
    const instancedMesh = new THREE.InstancedMesh(voxelGeo, voxelMat, visiblePoints.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    visiblePoints.forEach((point, index) => {
      dummy.position.set(point.x, point.y, point.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);
      const value = point[activeVariable];
      const mapped = typeof value === "number" && Number.isFinite(value)
        ? getColorFromScale(value, stats.minV, stats.maxV, colorScale)
        : new THREE.Color("#64748b");
      if (mapped) instancedMesh.setColorAt(index, mapped);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    if (visiblePoints.length) scene.add(instancedMesh);

    // Les mesures expérimentales sont superposées avec un marqueur distinct.
    let measuredPoints: THREE.Points | null = null;
    if (measuredData.length) {
      const measuredGeometry = new THREE.BufferGeometry();
      measuredGeometry.setAttribute("position", new THREE.Float32BufferAttribute(measuredData.flatMap((point) => [point.x, point.y, point.z]), 3));
      measuredPoints = new THREE.Points(measuredGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: voxelSize * 1.8, sizeAttenuation: true }));
      scene.add(measuredPoints);
    }

    // Le maillage tétraédrique n’est dessiné que s’il est réellement fourni par le pipeline CAO.
    const meshMetadata = metadata?.mesh;
    let meshLines: THREE.LineSegments | null = null;
    if (meshMetadata?.points?.length && meshMetadata.cells?.length) {
      const edgeKeys = new Set<string>();
      const positions: number[] = [];
      const points = meshMetadata.points;
      const addEdge = (a: number, b: number) => {
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        const key = `${low}:${high}`;
        if (edgeKeys.has(key) || !points[low] || !points[high]) return;
        edgeKeys.add(key);
        positions.push(...points[low], ...points[high]);
      };
      meshMetadata.cells.slice(0, 12000).forEach((cell) => {
        if (!Array.isArray(cell)) return;
        for (let i = 0; i < cell.length; i += 1) {
          for (let j = i + 1; j < cell.length; j += 1) addEdge(cell[i], cell[j]);
        }
      });
      const meshGeometry = new THREE.BufferGeometry();
      meshGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      meshLines = new THREE.LineSegments(meshGeometry, new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 }));
      scene.add(meshLines);
    }

    // Marqueur de fuite : position et diamètre sont affichés uniquement quand ils sont fournis.
    const discontinuity = metadata?.discontinuity ?? {};
    const position = (discontinuity.position_m ?? discontinuity.position) as Record<string, unknown> | undefined;
    const leakX = Number(position?.x);
    const leakY = Number(position?.y);
    const leakZ = Number(position?.z);
    const leakDiameter = Number(discontinuity.diameter_m ?? discontinuity.diameter);
    let leakMesh: THREE.Mesh | null = null;
    if ([leakX, leakY, leakZ, leakDiameter].every(Number.isFinite) && leakDiameter > 0) {
      const leakGeometry = new THREE.SphereGeometry(leakDiameter / 2, 20, 12);
      leakMesh = new THREE.Mesh(leakGeometry, new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true }));
      leakMesh.position.set(leakX, leakY, leakZ);
      scene.add(leakMesh);
    }

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      voxelGeo.dispose();
      voxelMat.dispose();
      outerGeo?.dispose();
      outerMat?.dispose();
      solidFieldMesh?.geometry.dispose();
      (solidFieldMesh?.material as THREE.Material | undefined)?.dispose();
      measuredPoints?.geometry.dispose();
      (measuredPoints?.material as THREE.Material | undefined)?.dispose();
      meshLines?.geometry.dispose();
      (meshLines?.material as THREE.Material | undefined)?.dispose();
      leakMesh?.geometry.dispose();
      (leakMesh?.material as THREE.Material | undefined)?.dispose();
      cadRoot?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });
    };
  }, [
    isMounted,
    volumetricData,
    measuredData,
    dataBounds,
    activeVariable,
    renderMode,
    colorScale,
    cutPosition,
    stats,
    displayGeometry,
    metadata,
    geometryAssetUrl,
    getColorFromScale,
  ]);

  const exportCSV = () => {
    if (!volumetricData.length) return;
    const headers = Object.keys(volumetricData[0]).join(",");
    const rows = volumetricData
      .map((p) => Object.values(p).join(","))
      .join("\n");
    const blob = new Blob([headers + "\n" + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scenarioType}_volumetric_10k.csv`;
    link.click();
  };

  const exportPNG = () => {
    if (!rendererRef.current) return;
    const url = rendererRef.current.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scenarioType}_3d_render.png`;
    link.click();
  };

  const exportSTL = () => {
    if (!sceneRef.current) return;
    const exporter = new STLExporter();
    const result = exporter.parse(sceneRef.current, { binary: true });
    const blob = new Blob([result], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scenarioType}_geometry.stl`;
    link.click();
  };

  const plotlyData = useMemo(() => {
    if (!volumetricData.length) return [];
    const sample = volumetricData.length > 0 ? volumetricData.filter(
      (_, i) => i % Math.max(1, Math.floor(volumetricData.length / 500)) === 0,
    ) : [];
    const scalarValues = sample.map((point) => point[activeVariable]);
    const validIndices = scalarValues
      .map((value, index) => (typeof value === "number" && Number.isFinite(value) ? index : -1))
      .filter((index) => index >= 0);
    return [{
      x: validIndices.map((index) => sample[index].x),
      y: validIndices.map((index) => scalarValues[index] as number),
      type: "scatter",
      mode: "lines+markers",
      marker: {
        color: validIndices.map((index) => scalarValues[index] as number),
        colorscale: colorScale === "thermal"
          ? [[0, "#180f3d"], [0.2, "#721f81"], [0.4, "#bb3754"], [0.6, "#ed6925"], [0.8, "#fbb61a"], [1, "#f0f921"]]
          : colorScale === "viridis"
            ? [[0, "#440154"], [0.33, "#31688e"], [0.66, "#35b779"], [1, "#fde725"]]
            : [[0, "#3b4cc0"], [0.25, "#8db0fe"], [0.5, "#f7f7f7"], [0.75, "#f4987a"], [1, "#b40426"]],
        cmin: stats.minV ?? undefined,
        cmax: stats.maxV ?? undefined,
        size: 5,
        showscale: true,
        colorbar: { title: `${activeVariable} (${stats.unit})` },
      },
      line: { color: "#94a3b8", width: 1.5 },
    }];
  }, [volumetricData, activeVariable, colorScale, stats]);

  const formatScalar = (value: number | null) => value === null ? "REQUIRED_INPUT" : value.toPrecision(5);
  const formatMetric = (value: number | undefined | null) =>
    typeof value === "number" && Number.isFinite(value) ? value.toExponential(3) : "N/D";
  const meshReady = Boolean(metadata?.mesh?.points?.length && metadata?.mesh?.cells?.length);
  const refinementReady = Boolean(metadata?.mesh?.refinement_applied && metadata?.mesh?.refinement_zones?.length);
  const crossSectionSamples = new Set(volumetricData.map((point) => `${point.y.toFixed(6)}|${point.z.toFixed(6)}`)).size;
  const fieldRenderingLabel = !volumetricData.length
    ? "Champ absent"
    : meshReady
      ? "Volume plein + maillage CAO"
      : crossSectionSamples <= 4
        ? "Volume plein — interpolation axiale du champ persisté"
        : "Volume plein — champ persisté";

  return (
    <div className="flex flex-col h-full w-full bg-[#020617] rounded-[32px] border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-600" />

      {/* Header identique à votre image de référence */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
            {title}
          </h3>
          <p className="text-[11px] font-mono text-cyan-400 mt-1">
            {metadata?.source_label ?? "Données de champ persistées"} — {stats.count.toLocaleString()} points
            {stats.fieldCount ? ` / ${stats.fieldCount.toLocaleString()} valeurs ${activeVariable}` : " / champ actif absent"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
          <button
            onClick={() => setActiveTab("3d")}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "3d" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
          >
            Vue 3D
          </button>
          <button
            onClick={() => setActiveTab("plotly")}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "plotly" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
          >
            Plotly 2D
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "metrics" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
          >
            Métriques
          </button>
          <span className="hidden md:block h-6 w-px bg-white/10 mx-1" />
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-700"
          >
            CSV
          </button>
          <button
            onClick={exportPNG}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-700"
          >
            PNG
          </button>
          <button
            onClick={exportSTL}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-950/60 border border-blue-500/30 text-blue-300 hover:bg-blue-700"
          >
            STL
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 rounded-[24px] border border-white/10 bg-black/50 overflow-hidden">
        {activeTab === "3d" && (
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_120px] gap-4 items-stretch">
              <div className="relative w-full h-[520px] md:h-[640px] rounded-2xl border border-white/10 bg-[#020617] overflow-hidden shadow-2xl">
                <div ref={containerRef} className="absolute inset-0" />
                {!volumetricData.length && (
                  <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                    <div className="max-w-sm rounded-2xl border border-amber-400/30 bg-slate-950/90 p-5 font-mono text-xs text-amber-200">
                      <div className="font-black tracking-widest">REQUIRED_INPUT</div>
                      <p className="mt-2 text-[10px] text-slate-400">Aucun champ de prédiction ou de mesure expérimental n’est persisté pour cette analyse. Le rendu paramétrique est désactivé.</p>
                    </div>
                  </div>
                )}
                {volumetricData.length > 0 && !stats.fieldCount && (
                  <div className="absolute left-3 top-3 rounded-lg border border-amber-400/30 bg-slate-950/90 px-3 py-2 text-[9px] font-mono text-amber-200">Champ {activeVariable}: REQUIRED_INPUT</div>
                )}
                <div className="pointer-events-none absolute left-3 bottom-3 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-[9px] font-mono text-gray-300">
                  <div className="text-cyan-400 font-bold mb-1">{typeof metadata?.geometry?.component_type === "string" ? metadata.geometry.component_type : geometryMeta.description}</div>
                  <div className="text-emerald-300 text-[8px] uppercase tracking-wide mb-1">{geometryAssetUrl ? `Surface B-Rep CAO GLB — ${cadSurfaceStatus === "aligned" ? "champ aligné" : cadSurfaceStatus === "unaligned" ? "surface neutre : champ non recouvrant" : cadSurfaceStatus === "error" ? "erreur de chargement" : "chargement"}` : fieldRenderingLabel}{scenarioType === "LH2_INFRASTRUCTURE_INTEGRITY" ? ` — échelle radiale visuelle ×${radialVisualMultiplier}` : ""}</div>
                  <div className="text-amber-300 text-[8px] uppercase tracking-wide mb-1">{meshReady ? `Maillage CAO fourni${refinementReady ? " — raffinement fuite fourni" : " — raffinement non fourni"}` : "Maillage CAO: REQUIRED_INPUT"}</div>
                  <div className="grid grid-cols-3 gap-x-3 text-[8px] text-gray-400">
                    <span>X: {dataBounds ? `${dataBounds.min.x.toPrecision(4)}…${dataBounds.max.x.toPrecision(4)} m` : "—"}</span>
                    <span>Y: {dataBounds ? `${dataBounds.min.y.toPrecision(4)}…${dataBounds.max.y.toPrecision(4)} m` : "—"}</span>
                    <span>Z: {dataBounds ? `${dataBounds.min.z.toPrecision(4)}…${dataBounds.max.z.toPrecision(4)} m` : "—"}</span>
                  </div>
                  {measuredData.length > 0 && <div className="mt-1 text-white">Mesures expérimentales: {measuredData.length}</div>}
                </div>
              </div>
              {/* Colorbar alignée sur la variable rendue par les voxels */}
              <aside className="rounded-2xl border border-white/10 bg-slate-900/95 p-3 flex flex-col items-center justify-between">
                <div className="text-[10px] font-mono font-bold text-gray-300 text-center">
                  {activeVariable === "temperature" ? "Température" : activeVariable === "pressure" ? "Pression" : activeVariable === "velocity_magnitude" ? "Vitesse" : "Contrainte"} ({stats.unit})
                  <span className="block text-[8px] text-slate-500">{metadata?.source_label ?? "source non fournie"}</span>
                </div>
                <div
                  className="h-[420px] w-6 rounded-lg border border-white/20 shadow-inner my-2"
                  style={{ backgroundImage: colorScaleGradient }}
                  aria-label="Échelle thermique"
                />
                {stats.isConstant && stats.minV !== null && (
                  <div className="w-full rounded-lg border border-amber-400/30 bg-amber-950/30 px-2 py-1 text-center text-[8px] font-mono text-amber-200">
                    Champ constant : valeur rendue au milieu de la palette
                  </div>
                )}
                {geometryAssetUrl && cadSurfaceStatus === "unaligned" && (
                  <div className="w-full rounded-lg border border-amber-400/30 bg-amber-950/30 px-2 py-1 text-center text-[8px] font-mono text-amber-200">
                    Colorbar du champ persisté ; coloration B-Rep bloquée faute de recouvrement spatial
                  </div>
                )}
                <div className="flex flex-col justify-between h-20 text-[9px] font-mono text-gray-400 text-right w-full pr-1">
                  <span>{formatScalar(stats.maxV)}</span>
                  <span>{stats.minV !== null && stats.maxV !== null ? formatScalar((stats.maxV + stats.minV) / 2) : "REQUIRED_INPUT"}</span>
                  <span>{formatScalar(stats.minV)}</span>
                </div>
              </aside>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <label className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                Variable Physique
                <select
                  value={activeVariable}
                  onChange={(e) => setActiveVariable(e.target.value)}
                  className="w-full mt-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white uppercase focus:outline-none focus:border-blue-500"
                >
                  <option value="temperature">Température (K)</option>
                  <option value="pressure">Pression (MPa)</option>
                  <option value="velocity_magnitude">Vitesse (m/s)</option>
                  <option value="stress">Contrainte (MPa)</option>
                </select>
              </label>
              <label className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                Plan de Coupe 3D: {Math.round(cutPosition * 100)}%
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={cutPosition}
                  onChange={(e) => setCutPosition(parseFloat(e.target.value))}
                  className="w-full mt-3 accent-blue-500 cursor-pointer"
                />
              </label>
              <div className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                Palette Thermique
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {(["thermal", "viridis", "coolwarm"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setColorScale(s)}
                      className={`py-2 rounded-lg text-[9px] font-black uppercase ${colorScale === s ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "plotly" && (
          <div className="w-full h-full p-6 flex flex-col justify-center items-center">
            <div className="w-full h-[500px]">
              <Plot
                data={plotlyData as any}
                layout={{
                  title: {
                    text: `Profil 2D — ${activeVariable.toUpperCase()}`,
                    font: { color: "#ffffff", size: 14 },
                  },
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  font: { color: "#94a3b8" },
                  xaxis: { title: "Position (m)", gridcolor: "#1e293b" },
                  yaxis: {
                    title: `${activeVariable} (${stats.unit})`,
                    gridcolor: "#1e293b",
                  },
                  margin: { t: 40, r: 20, l: 50, b: 40 },
                }}
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="w-full h-full p-8 flex flex-col gap-6 justify-center max-w-2xl mx-auto">
            <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">
              Validation Numérique & Résidus PINN
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Score de Crédibilité
                </p>
                <p className="text-3xl font-black text-emerald-400 mt-1">
                  {typeof metrics?.credibilityScore === "number" && Number.isFinite(metrics.credibilityScore)
                    ? `${metrics.credibilityScore.toFixed(2)}%`
                    : "N/D"}
                </p>
                <p className="text-[9px] text-gray-500 mt-1">
                  Score issu des résultats persistés
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Points Volumétriques
                </p>
                <p className="text-3xl font-black text-blue-400 mt-1">
                  {stats.count.toLocaleString()}
                </p>
                <p className="text-[9px] text-gray-500 mt-1">
                  Maillage Plein Continu
                </p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                Résidus des Équations de Conservation
              </p>
              <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                <span className="text-gray-400">Continuité (Masse)</span>
                <span className="text-emerald-400 font-mono">{formatMetric(metrics?.residuals?.continuity)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                <span className="text-gray-400">Navier-Stokes (Momentum)</span>
                <span className="text-emerald-400 font-mono">{formatMetric(metrics?.residuals?.momentum)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-400">Conservation de l'Énergie</span>
                <span className="text-emerald-400 font-mono">{formatMetric(metrics?.residuals?.energy)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
            Quantum-Hybrid PINN • Maillage Industriel Continu
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            CSV 10k+
          </button>
          <button
            onClick={exportPNG}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Capture PNG
          </button>
          <button
            onClick={exportSTL}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
          >
            Export STL
          </button>
        </div>
      </div>
    </div>
  );
}
