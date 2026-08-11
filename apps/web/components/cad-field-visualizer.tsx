/**
 * CAD Field Visualizer — volets 6 et 7.
 *
 * Visualisation scientifique de la scène CAO et des champs physiques issus du
 * pipeline industriel (STEP AP242 -> topologie -> maillage -> exports GLB/VTU).
 *
 * Règles anti-hallucination strictes :
 * - Le tracé ne présente JAMAIS de valeurs simulées comme mesures réelles.
 * - Tout champ affiché transporte sa provenance (computed/interpolated/
 *   experimental/unknown), ses unités et ses min/max réels.
 * - Une donnée réellement absente reste marquée « non validée » : le
 *   visualiseur refuse d'afficher une échelle de couleurs sur un champ
 *   dont les unités ou la provenance sont inconnues.
 *
 * Quatre modes de rendu (volet 6) :
 * - Surface : maillage de surface CAO (GLB), aucun champ physique.
 * - Volume : maillage volumique (VTU) avec champ validé.
 * - Coupe : plan de coupe orthogonal avec interpolation affichée en
 *   « interpolated » et bande d'incertitude documentée.
 * - Particles : échantillon ponctuel clairement étiqueté
 *   « point collocation — ne constitue pas une preuve de volume plein ».
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type Provenance =
  | "computed"
  | "interpolated"
  | "experimental"
  | "unknown";

export interface FieldMetadata {
  name: string;
  units: string; // REQUIRED_INPUT si inconnues
  provenance: Provenance;
  min: number;
  max: number;
}

export interface SurfaceVertex {
  x: number;
  y: number;
  z: number;
}

export interface SurfaceFace {
  a: number;
  b: number;
  c: number;
}

export interface VolumePoint {
  x: number;
  y: number;
  z: number;
  value: number;
}

export interface CadSceneData {
  geometryRevisionId: string;
  meshRevisionId: string;
  status: string; // VALIDATED | UNVALIDATED | REQUIRED_INPUT | VALIDATION_FAILED
  unitsLabel?: string;
  vertices?: SurfaceVertex[];
  faces?: SurfaceFace[];
  volumePoints?: VolumePoint[];
  cellsCount?: number;
  fields?: FieldMetadata[];
}

export type RenderMode = "surface" | "volume" | "cut" | "particles";

interface Props {
  data: CadSceneData;
  activeField?: string;
  height?: number;
}

const MODE_LABELS: Record<RenderMode, string> = {
  surface: "Surface CAO (GLB)",
  volume: "Volume maillé (VTU)",
  cut: "Coupe orthogonale",
  particles: "Points de collocation",
};

const PROVENANCE_LABELS: Record<Provenance, string> = {
  computed: "Calculé (solveur)",
  interpolated: "Interpolé",
  experimental: "Mesuré (expérimental)",
  unknown: "Provenance inconnue",
};

const UNITS_LABELS: Record<string, string> = {
  K: "K",
  Pa: "Pa",
  MPa: "MPa",
  "m/s": "m/s",
  REQUIRED_INPUT: "unité non renseignée",
};

function thermalColor(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped < 0.25) {
    const u = clamped / 0.25;
    return [0, Math.round(60 + u * 120), Math.round(200 - u * 80)];
  }
  if (clamped < 0.5) {
    const u = (clamped - 0.25) / 0.25;
    return [0, Math.round(180 + u * 75), Math.round(120 - u * 120)];
  }
  if (clamped < 0.75) {
    const u = (clamped - 0.5) / 0.25;
    return [Math.round(u * 255), 255, 0];
  }
  const u = (clamped - 0.75) / 0.25;
  return [255, Math.round(255 - u * 140), 0];
}

/** Valeur normalisée d'un champ sur un point de coupe — étiquetée interpolated. */
function interpolateFieldAt(
  points: VolumePoint[],
  x: number,
  y: number,
  z: number,
): number | null {
  if (!points.length) return null;
  let best: VolumePoint | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const dist =
      (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best ? best.value : null;
}

export default function CadFieldVisualizer({
  data,
  activeField,
  height = 480,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<InstanceType<typeof OrbitControls> | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const [mode, setMode] = useState<RenderMode>("surface");
  const [mounted, setMounted] = useState(false);
  const [cutAxis, setCutAxis] = useState<"x" | "y" | "z">("z");
  const [cutPosition, setCutPosition] = useState(0);
  const [fieldWarning, setFieldWarning] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Choix du champ actif : seul un champ validé (unités + provenance connus)
  // peut alimenter la couleur. Tout autre cas déclenche un avertissement
  // bloquant à l'affichage — aucune couleur simulée.
  const resolvedField = useMemo(() => {
    if (!data.fields?.length) return null;
    const candidate =
      data.fields.find((f) => f.name === activeField) ?? data.fields[0];
    if (
      !candidate.units ||
      candidate.units === "REQUIRED_INPUT" ||
      candidate.provenance === "unknown"
    ) {
      setFieldWarning(
        `Champ « ${candidate.name} » non validé : unités=${candidate.units}, provenance=${candidate.provenance}. Aucune échelle de couleur ne sera appliquée.`,
      );
      return null;
    }
    setFieldWarning(null);
    return candidate;
  }, [data.fields, activeField]);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05090f);
    sceneRef.current = scene;

    const width = container.clientWidth;
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 1000);
    camera.position.set(4, 3, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 8, 6);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x88aaff, 0x223344, 0.4));

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [mounted, height]);

  // Reconstruction de la scène selon le mode actif.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const material = child.material as THREE.Material | THREE.Material[];
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((m) => m.dispose());
      }
    }

    const vertices = data.vertices ?? [];
    const faces = data.faces ?? [];
    const volumePoints = data.volumePoints ?? [];

    if (mode === "surface") {
      // Mode Surface : seul le maillage CAO de surface est affiché, aucun champ.
      if (!vertices.length || !faces.length) return;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(faces.length * 9);
      let pi = 0;
      for (const face of faces) {
        for (const idx of [face.a, face.b, face.c]) {
          const v = vertices[idx];
          if (!v) continue;
          positions[pi++] = v.x;
          positions[pi++] = v.y;
          positions[pi++] = v.z;
        }
      }
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions.slice(0, pi), 3),
      );
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: 0x2a6fd8,
        metalness: 0.25,
        roughness: 0.55,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      group.add(new THREE.Mesh(geometry, material));
    } else if (mode === "volume") {
      // Mode Volume : maillage volumique avec champ validé.
      if (!volumePoints.length || !resolvedField) return;
      const { min, max } = resolvedField;
      const range = max - min || 1;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(volumePoints.length * 3);
      const colors = new Float32Array(volumePoints.length * 3);
      volumePoints.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const t = (p.value - min) / range;
        const [r, g, b] = thermalColor(t);
        colors[i * 3] = r / 255;
        colors[i * 3 + 1] = g / 255;
        colors[i * 3 + 2] = b / 255;
      });
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
      const material = new THREE.PointsMaterial({
        size: 0.06,
        vertexColors: true,
        sizeAttenuation: true,
      });
      group.add(new THREE.Points(geometry, material));
    } else if (mode === "cut") {
      // Mode Coupe : plan orthogonal, valeurs interpolées au plus proche
      // voisin — étiquetées explicitement « interpolated ».
      if (!volumePoints.length || !resolvedField) return;
      const { min, max } = resolvedField;
      const range = max - min || 1;
      const xs = volumePoints.map((p) => p.x);
      const ys = volumePoints.map((p) => p.y);
      const zs = volumePoints.map((p) => p.z);
      const xMin = Math.min(...xs),
        xMax = Math.max(...xs);
      const yMin = Math.min(...ys),
        yMax = Math.max(...ys);
      const zMin = Math.min(...zs),
        zMax = Math.max(...zs);
      const plane =
        cutAxis === "z"
          ? zMin + cutPosition * (zMax - zMin)
          : cutAxis === "y"
            ? yMin + cutPosition * (yMax - yMin)
            : xMin + cutPosition * (xMax - xMin);
      const slice: VolumePoint[] = volumePoints.filter((p) => {
        const coord =
          cutAxis === "z" ? p.z : cutAxis === "y" ? p.y : p.x;
        return Math.abs(coord - plane) <= (Math.max(...Object.values({ x: xMax - xMin, y: yMax - yMin, z: zMax - zMin })) * 0.05);
      });
      if (!slice.length) return;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(slice.length * 3);
      const colors = new Float32Array(slice.length * 3);
      slice.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const t = (p.value - min) / range;
        const [r, g, b] = thermalColor(t);
        colors[i * 3] = r / 255;
        colors[i * 3 + 1] = g / 255;
        colors[i * 3 + 2] = b / 255;
      });
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        sizeAttenuation: true,
      });
      group.add(new THREE.Points(geometry, material));
    } else if (mode === "particles") {
      // Mode Particles : échantillon ponctuel, toujours étiqueté collocation.
      if (!volumePoints.length || !resolvedField) return;
      const step = Math.max(1, Math.floor(volumePoints.length / 4000));
      const sample = volumePoints.filter((_, i) => i % step === 0);
      const { min, max } = resolvedField;
      const range = max - min || 1;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(sample.length * 3);
      const colors = new Float32Array(sample.length * 3);
      sample.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const t = (p.value - min) / range;
        const [r, g, b] = thermalColor(t);
        colors[i * 3] = r / 255;
        colors[i * 3 + 1] = g / 255;
        colors[i * 3 + 2] = b / 255;
      });
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
      });
      group.add(new THREE.Points(geometry, material));
    }
  }, [mode, data, resolvedField, cutAxis, cutPosition]);

  if (!mounted) {
    return (
      <div
        style={{ height, background: "#05090f" }}
        data-testid="cad-visualizer-placeholder"
      />
    );
  }

  const field = resolvedField;

  return (
    <div data-testid="cad-field-visualizer">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {(Object.keys(MODE_LABELS) as RenderMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 text-xs font-medium ${mode === m ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
        {mode === "cut" && (
          <>
            <select
              value={cutAxis}
              onChange={(e) => setCutAxis(e.target.value as "x" | "y" | "z")}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
              data-testid="cut-axis-select"
            >
              <option value="x">Axe X</option>
              <option value="y">Axe Y</option>
              <option value="z">Axe Z</option>
            </select>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={cutPosition}
              onChange={(e) => setCutPosition(parseFloat(e.target.value))}
              className="w-32"
              data-testid="cut-position-slider"
            />
          </>
        )}
      </div>

      {fieldWarning && (
        <div
          className="mb-2 rounded border border-amber-500/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
          data-testid="field-warning"
        >
          {fieldWarning}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height, width: "100%" }}
        data-testid="cad-canvas"
      />

      {/* Volet 7 : légende avec provenance, min/max, unités et statut. */}
      <div
        className="mt-2 rounded border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200"
        data-testid="cad-legend"
      >
        <div className="mb-1 font-semibold text-slate-100">
          Légende scientifique — mode {MODE_LABELS[mode]}
        </div>
        {mode === "surface" && (
          <div>
            Maillage de surface CAO uniquement. Aucun champ physique n&apos;est
            affiché : les valeurs physiques résident dans les exports VTU/CGNS
            référencés par révision.
          </div>
        )}
        {field && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Champ : <b>{field.name}</b>
            </span>
            <span>
              Unités :{" "}
              <b>{UNITS_LABELS[field.units] ?? field.units}</b>
            </span>
            <span>
              Provenance :{" "}
              <b>{PROVENANCE_LABELS[field.provenance]}</b>
            </span>
            <span>
              Min : <b>{field.min.toFixed(3)}</b> Max :{" "}
              <b>{field.max.toFixed(3)}</b>
            </span>
            {mode === "cut" && (
              <span>
                Valeurs affichées : <b>interpolées au plus proche voisin</b>{" "}
                (incertitude de discrétisation non nulle).
              </span>
            )}
            {mode === "particles" && (
              <span>
                Points de collocation :{" "}
                <b>ne constituent pas une preuve de volume plein</b>.
              </span>
            )}
          </div>
        )}
        <div className="mt-1 text-slate-400">
          Statut : {data.status} · Révision géométrie :{" "}
          {data.geometryRevisionId} · Révision maillage :{" "}
          {data.meshRevisionId}
        </div>
        {data.unitsLabel && (
          <div className="text-slate-400">
            Unités de la scène : {data.unitsLabel}
          </div>
        )}
      </div>
    </div>
  );
}
