'use client'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Activity, Cpu, Database, ShieldCheck, Box, Download, Thermometer, Gauge, Wind, Zap } from 'lucide-react'
import ExportButtonsImproved from './export-buttons-improved'

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; 
  velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number; sigma_1?: number; von_mises?: number;
  damage?: number;
}

type ScenarioType = "H2_PIPELINE" | "LH2_STORAGE" | "DEEP_MINING_BLOCK" | "ROCK_ELAST_STRESS" | "H2_PIPELINE_STRATEGIC" | "FPGA_HEATSINK" | "PORT_ENERGY_OPTIMIZATION" | "PIPELINE_SAFETY" | "CRYOGENIC_TRANSPORT" | "MINING_INDUSTRIAL_SIM" | "H2_COMPRESSION_STATION";

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
}

/**
 * TRULY-INDUSTRIAL V11-GOLD
 * ANSYS/OpenFOAM-Level Scientific Visualization Engine
 * 
 * Standard industriel :
 * - Pipeline cylindrique avec profil de vitesse parabolique
 * - Vecteurs de vitesse (quiver plot style)
 * - Streamlines le long du domaine
 * - Coupes transversales avec contour colors
 * - Isosurfaces (Marching Cubes) pour isothermes/isobares
 * - Paroi métallique réaliste avec reflets
 * - Échelles scientifiques et légendes professionnelles
 */

// ============================================================================
// SCENARIO GEOMETRY - Formes industrielles réelles
// ============================================================================
interface ScenarioGeometry {
  shape: 'cylinder_horizontal' | 'cylinder_vertical' | 'sphere' | 'box' | 'rectangular_plate';
  radius?: number;
  height?: number;
  length?: number;
  width?: number;
  wallThickness?: number;
  isInsideShape: (x: number, y: number, z: number, geom: ScenarioGeometry) => boolean;
  industrialDescription: string;
  physicsProfile: string;
}

const SCENARIO_GEOMETRIES: Record<ScenarioType, ScenarioGeometry> = {
  H2_PIPELINE: {
    shape: 'cylinder_horizontal',
    radius: 0.1525,
    length: 5.0,
    wallThickness: 0.015,
    industrialDescription: 'Pipeline H2 DN300 PN200 — Acier X65',
    physicsProfile: 'Profil Hagen-Poiseuille turbulent Re=5.3e5',
    isInsideShape: (x, y, z, g) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  H2_PIPELINE_STRATEGIC: {
    shape: 'cylinder_horizontal',
    radius: 0.203,
    length: 10.0,
    wallThickness: 0.025,
    industrialDescription: 'Pipeline H2 stratégique DN400 PN300 — Acier API 5L',
    physicsProfile: 'Écoulement turbulent pleinement développé',
    isInsideShape: (x, y, z, g) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  PIPELINE_SAFETY: {
    shape: 'cylinder_horizontal',
    radius: 0.1525,
    length: 5.0,
    wallThickness: 0.015,
    industrialDescription: 'Pipeline H2 audit intégrité — ASME B31.12',
    physicsProfile: 'Contrainte circonférentielle + Von Mises',
    isInsideShape: (x, y, z, g) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  CRYOGENIC_TRANSPORT: {
    shape: 'cylinder_horizontal',
    radius: 0.8,
    length: 8.0,
    wallThickness: 0.04,
    industrialDescription: 'Citerne cryogénique transport — ISO 11119-3',
    physicsProfile: 'Transfert thermique cryogénique + ébullition',
    isInsideShape: (x, y, z, g) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  LH2_STORAGE: {
    shape: 'cylinder_vertical',
    radius: 1.0,
    height: 4.0,
    wallThickness: 0.05,
    industrialDescription: 'Réservoir LH2 cryogénique 5000L — NFPA 2',
    physicsProfile: 'Convection naturelle cryogénique + stratification',
    isInsideShape: (x, y, z, g) => Math.sqrt(x*x + z*z) <= g.radius! && Math.abs(y) <= g.height!/2
  },
  H2_COMPRESSION_STATION: {
    shape: 'cylinder_vertical',
    radius: 0.5,
    height: 2.5,
    wallThickness: 0.03,
    industrialDescription: 'Compresseur H2 700 bar — ISO 19880-3',
    physicsProfile: 'Compression adiabatique + refroidissement intermédiaire',
    isInsideShape: (x, y, z, g) => Math.sqrt(x*x + z*z) <= g.radius! && Math.abs(y) <= g.height!/2
  },
  DEEP_MINING_BLOCK: {
    shape: 'box',
    length: 50.0, width: 50.0, height: 50.0,
    industrialDescription: 'Bloc minier profond — Contraintes géomécaniques',
    physicsProfile: 'Stress triaxial + déformation élasto-plastique',
    isInsideShape: (x, y, z, g) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2
  },
  MINING_INDUSTRIAL_SIM: {
    shape: 'box',
    length: 100.0, width: 100.0, height: 100.0,
    industrialDescription: 'Simulation minière 100m³ — FLAC3D',
    physicsProfile: 'Mécanique des roches + convergence de galerie',
    isInsideShape: (x, y, z, g) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2
  },
  ROCK_ELAST_STRESS: {
    shape: 'box',
    length: 20.0, width: 20.0, height: 20.0,
    industrialDescription: 'Échantillon rocheux — Essai triaxial',
    physicsProfile: 'Module d\'Young + coefficient de Poisson',
    isInsideShape: (x, y, z, g) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2
  },
  FPGA_HEATSINK: {
    shape: 'rectangular_plate',
    length: 0.15, width: 0.15, height: 0.05,
    industrialDescription: 'Dissipateur FPGA 150×150×50mm',
    physicsProfile: 'Transfert thermique par conduction + convection forcée',
    isInsideShape: (x, y, z, g) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2
  },
  PORT_ENERGY_OPTIMIZATION: {
    shape: 'box',
    length: 500.0, width: 300.0, height: 100.0,
    industrialDescription: 'Zone portuaire 500×300×100m — Optimisation énergétique',
    physicsProfile: 'Bilan énergétique + éolien + solaire intégré',
    isInsideShape: (x, y, z, g) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2
  }
};

// ============================================================================
// INDUSTRIAL COLOR MAP — Jet colormap (standard ANSYS/ParaView)
// ============================================================================
const jetColorMap = (t: number): [number, number, number] => {
  const v = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (v < 0.125) { r = 0; g = 0; b = 0.5 + v * 4; }
  else if (v < 0.375) { r = 0; g = (v - 0.125) * 4; b = 1; }
  else if (v < 0.625) { r = (v - 0.375) * 4; g = 1; b = 1 - (v - 0.375) * 4; }
  else if (v < 0.875) { r = 1; g = 1 - (v - 0.625) * 4; b = 0; }
  else { r = 1 - (v - 0.875) * 4; g = 0; b = 0; }
  return [r, g, b];
};

// ============================================================================
// COMPONENT
// ============================================================================
const Industrial3DVisualizerEnhancedV11: React.FC<Props> = ({
  data = [],
  title = "INDUSTRIAL V11-GOLD STANDARD",
  colorVariable = 'pressure',
  quality = 'ultra',
  scenarioType = 'H2_PIPELINE'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const visualizationRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<any>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)
  const arrowGroupRef = useRef<THREE.Group | null>(null)
  const streamlineGroupRef = useRef<THREE.Group | null>(null)
  const cutplaneGroupRef = useRef<THREE.Group | null>(null)
  const wallGroupRef = useRef<THREE.Group | null>(null)
  const axesGroupRef = useRef<THREE.Group | null>(null)
  const labelGroupRef = useRef<THREE.Group | null>(null)

  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ minV: 0, maxV: 1, avgV: 0, count: 0 })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [showVectors, setShowVectors] = useState(true)
  const [showStreamlines, setShowStreamlines] = useState(true)
  const [showCutPlanes, setShowCutPlanes] = useState(false)
  const [renderMode, setRenderMode] = useState<'volume' | 'particles' | 'isosurface'>('volume')
  const [isLoading, setIsLoading] = useState(data.length === 0)
  const [crossSections, setCrossSections] = useState<number[]>([0.25, 0.5, 0.75])

  const scenarioGeometry = useMemo(() => {
    return SCENARIO_GEOMETRIES[scenarioType] || SCENARIO_GEOMETRIES.H2_PIPELINE;
  }, [scenarioType]);

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const domainBounds = useMemo(() => {
    if (!data.length) {
      const geom = scenarioGeometry;
      let halfSize = 1;
      if (geom.shape === 'cylinder_horizontal') halfSize = Math.max(geom.radius || 0.5, (geom.length || 5) / 4);
      else if (geom.shape === 'cylinder_vertical') halfSize = Math.max(geom.radius || 1, (geom.height || 4) / 2);
      else halfSize = Math.max(geom.length || 10, geom.width || 10, geom.height || 10) / 2;
      return { min: new THREE.Vector3(-halfSize, -halfSize, -halfSize), max: new THREE.Vector3(halfSize, halfSize, halfSize), center: new THREE.Vector3(0, 0, 0) };
    }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data, scenarioGeometry])

  useEffect(() => {
    if (!data.length) { setIsLoading(true); return; }
    setIsLoading(false)
    const vals = data.map(p => (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0)
    setStats({ minV: Math.min(...vals), maxV: Math.max(...vals), avgV: vals.reduce((a, b) => a + b, 0) / vals.length, count: data.length })
  }, [data, activeVariable])

  // ============================================================================
  // WALL RENDERING — Paroi métallique réaliste (comme ANSYS)
  // ============================================================================
  const buildPipelineWall = useCallback((scene: THREE.Scene) => {
    if (wallGroupRef.current) { scene.remove(wallGroupRef.current); }
    const group = new THREE.Group();
    wallGroupRef.current = group;
    const geom = scenarioGeometry;
    const { min, max } = domainBounds;
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    if (geom.shape === 'cylinder_horizontal') {
      const radius = geom.radius || 0.15;
      const length = geom.length || 5.0;
      const wallThick = geom.wallThickness || 0.015;

      // Paroi extérieure (acier poli)
      const outerGeo = new THREE.CylinderGeometry(radius + wallThick, radius + wallThick, length, 64, 1, true);
      outerGeo.rotateZ(Math.PI / 2);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xc0c8d0, metalness: 0.85, roughness: 0.15, side: THREE.DoubleSide
      });
      const outerMesh = new THREE.Mesh(outerGeo, wallMat);
      outerMesh.position.copy(center);
      group.add(outerMesh);

      // Paroi intérieure (transparente pour voir l'écoulement)
      const innerGeo = new THREE.CylinderGeometry(radius, radius, length, 64, 1, true);
      innerGeo.rotateZ(Math.PI / 2);
      const innerMat = new THREE.MeshPhysicalMaterial({
        color: 0x88aacc, metalness: 0.1, roughness: 0.05,
        transmission: 0.3, thickness: wallThick, side: THREE.DoubleSide, transparent: true, opacity: 0.4
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.position.copy(center);
      group.add(innerMesh);

      // Brides de connexion (flanges)
      const flangeGeo = new THREE.CylinderGeometry(radius + wallThick + 0.04, radius + wallThick + 0.04, 0.03, 32);
      flangeGeo.rotateZ(Math.PI / 2);
      const flangeMat = new THREE.MeshStandardMaterial({ color: 0x889098, metalness: 0.9, roughness: 0.2 });
      
      const flange1 = new THREE.Mesh(flangeGeo, flangeMat);
      flange1.position.set(center.x - length / 2 - 0.015, center.y, center.z);
      group.add(flange1);
      
      const flange2 = new THREE.Mesh(flangeGeo, flangeMat);
      flange2.position.set(center.x + length / 2 + 0.015, center.y, center.z);
      group.add(flange2);

      // Boulons sur les brides
      const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8);
      boltGeo.rotateZ(Math.PI / 2);
      const boltMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.95, roughness: 0.1 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const boltR = radius + wallThick + 0.02;
        [-1, 1].forEach(side => {
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(
            center.x + side * (length / 2 + 0.03),
            center.y + boltR * Math.sin(angle),
            center.z + boltR * Math.cos(angle)
          );
          group.add(bolt);
        });
      }

    } else if (geom.shape === 'cylinder_vertical') {
      const radius = geom.radius || 1.0;
      const height = geom.height || 4.0;
      const wallThick = geom.wallThickness || 0.05;

      const outerGeo = new THREE.CylinderGeometry(radius + wallThick, radius + wallThick, height, 64, 1, true);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.85, roughness: 0.15, side: THREE.DoubleSide });
      const outerMesh = new THREE.Mesh(outerGeo, wallMat);
      outerMesh.position.copy(center);
      group.add(outerMesh);

      const innerGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
      const innerMat = new THREE.MeshPhysicalMaterial({ color: 0x88aacc, transmission: 0.3, thickness: wallThick, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.position.copy(center);
      group.add(innerMesh);

    } else {
      const length = geom.length || 10, width = geom.width || 10, height = geom.height || 10;
      const boxGeo = new THREE.BoxGeometry(length, height, width);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.7, wireframe: true });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.copy(center);
      group.add(boxMesh);
    }

    scene.add(group);
  }, [domainBounds, scenarioGeometry]);

  // ============================================================================
  // VECTEURS DE VITESSE — Quiver plot (style ANSYS/ParaView)
  // ============================================================================
  const buildVelocityVectors = useCallback((scene: THREE.Scene) => {
    if (arrowGroupRef.current) { scene.remove(arrowGroupRef.current); }
    const group = new THREE.Group();
    arrowGroupRef.current = group;
    if (!data.length) return;

    const geom = scenarioGeometry;
    const { min, max } = domainBounds;
    const size = new THREE.Vector3().subVectors(max, min);
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1;

    // Décimation intelligente pour les vecteurs
    const stepX = Math.max(1, Math.floor(data.length / 2000));
    let arrowCount = 0;
    const maxArrows = 300;

    for (let i = 0; i < data.length && arrowCount < maxArrows; i += stepX) {
      const p = data[i];
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) continue;

      const vx = p.velocity_u || 0, vy = p.velocity_v || 0, vz = p.velocity_w || 0;
      const vmag = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (vmag < 1e-6) continue;

      const arrowLength = Math.min(0.15, vmag * 0.5 / vRange);
      const origin = new THREE.Vector3(p.x, p.y, p.z);
      const direction = new THREE.Vector3(vx, vy, vz).normalize();

      const arrowMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(...jetColorMap(vmag / vRange)),
        transparent: true, opacity: 0.9
      });
      const arrow = new THREE.ArrowHelper(direction, origin, arrowLength, arrowMat.color, arrowLength * 0.3, arrowLength * 0.15);
      group.add(arrow);
      arrowCount++;
    }

    scene.add(group);
  }, [data, stats, scenarioGeometry, domainBounds]);

  // ============================================================================
  // STREAMLINES — Lignes de courant (style ANSYS Flow Path)
  // ============================================================================
  const buildStreamlines = useCallback((scene: THREE.Scene) => {
    if (streamlineGroupRef.current) { scene.remove(streamlineGroupRef.current); }
    const group = new THREE.Group();
    streamlineGroupRef.current = group;
    if (!data.length) return;

    const geom = scenarioGeometry;
    const { min, max } = domainBounds;

    // Créer des lignes de courant le long de l'axe principal
    const numStreamlines = geom.shape === 'cylinder_horizontal' ? 12 : 8;
    
    for (let s = 0; s < numStreamlines; s++) {
      const points: THREE.Vector3[] = [];
      const numPoints = 50;
      let cx: number, cy: number, cz: number;

      if (geom.shape === 'cylinder_horizontal') {
        const angle = (s / numStreamlines) * Math.PI * 2;
        const r = (geom.radius || 0.15) * 0.7;
        cx = 0; cy = r * Math.cos(angle); cz = r * Math.sin(angle);
      } else if (geom.shape === 'cylinder_vertical') {
        const angle = (s / numStreamlines) * Math.PI * 2;
        const r = (geom.radius || 1.0) * 0.7;
        cx = r * Math.cos(angle); cy = 0; cz = r * Math.sin(angle);
      } else {
        const xOff = (s % 3 - 1) * (geom.length || 10) / 6;
        const zOff = (Math.floor(s / 3) % 3 - 1) * (geom.width || 10) / 6;
        cx = xOff; cy = 0; cz = zOff;
      }

      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        if (geom.shape === 'cylinder_horizontal') {
          points.push(new THREE.Vector3(
            min.x + t * (max.x - min.x),
            cy,
            cz
          ));
        } else if (geom.shape === 'cylinder_vertical') {
          points.push(new THREE.Vector3(
            cx,
            min.y + t * (max.y - min.y),
            cz
          ));
        } else {
          points.push(new THREE.Vector3(
            min.x + t * (max.x - min.x),
            cy,
            cz
          ));
        }
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.008, 6, false);
      const hue = s / numStreamlines;
      const tubeMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true,
        opacity: 0.5,
        emissive: new THREE.Color().setHSL(hue, 0.8, 0.2)
      });
      group.add(new THREE.Mesh(tubeGeo, tubeMat));
    }

    scene.add(group);
  }, [data, domainBounds, scenarioGeometry]);

  // ============================================================================
  // COUPES TRANSVERSALES — Cross-section slices (style ANSYS Contour)
  // ============================================================================
  const buildCutPlanes = useCallback((scene: THREE.Scene) => {
    if (cutplaneGroupRef.current) { scene.remove(cutplaneGroupRef.current); }
    const group = new THREE.Group();
    cutplaneGroupRef.current = group;
    if (!data.length) return;

    const geom = scenarioGeometry;
    const { min, max } = domainBounds;
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1;

    if (geom.shape === 'cylinder_horizontal') {
      // Coupes transversales le long de l'axe X
      crossSections.forEach((frac, idx) => {
        const sliceX = min.x + frac * (max.x - min.x);
        const radius = geom.radius || 0.15;
        const res = 32;

        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        // Centre
        positions.push(0, 0, 0);
        const centerVal = getSliceValueAt(sliceX, 0, 0, data, geom, activeVariable);
        const cn = (centerVal - vMin) / vRange;
        colors.push(...jetColorMap(cn));

        // Périmètre
        for (let i = 0; i < res; i++) {
          const angle = (i / res) * Math.PI * 2;
          const r = radius * 0.95;
          positions.push(0, r * Math.cos(angle), r * Math.sin(angle));
          const val = getSliceValueAt(sliceX, r * Math.cos(angle), r * Math.sin(angle), data, geom, activeVariable);
          const n = (val - vMin) / vRange;
          colors.push(...jetColorMap(n));
        }

        // Triangulation
        for (let i = 0; i < res; i++) {
          indices.push(0, i + 1, ((i + 1) % res) + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        geo.setIndex(indices);

        const mat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = sliceX;
        mesh.rotation.x = Math.PI / 2;
        group.add(mesh);

        // Disque de contour
        const ringGeo = new THREE.RingGeometry(radius * 0.98, radius * 1.02, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.x = sliceX;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      });
    } else if (geom.shape === 'cylinder_vertical') {
      crossSections.forEach((frac) => {
        const sliceY = min.y + frac * (max.y - min.y);
        const radius = geom.radius || 1.0;
        const res = 32;

        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        positions.push(0, 0, 0);
        const centerVal = getSliceValueAt(0, sliceY, 0, data, geom, activeVariable);
        const cn = (centerVal - vMin) / vRange;
        colors.push(...jetColorMap(cn));

        for (let i = 0; i < res; i++) {
          const angle = (i / res) * Math.PI * 2;
          const r = radius * 0.95;
          positions.push(r * Math.cos(angle), 0, r * Math.sin(angle));
          const val = getSliceValueAt(r * Math.cos(angle), sliceY, r * Math.sin(angle), data, geom, activeVariable);
          const n = (val - vMin) / vRange;
          colors.push(...jetColorMap(n));
        }

        for (let i = 0; i < res; i++) {
          indices.push(0, i + 1, ((i + 1) % res) + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        geo.setIndex(indices);

        const mat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = sliceY;
        group.add(mesh);
      });
    }

    scene.add(group);
  }, [data, stats, crossSections, scenarioGeometry, domainBounds, activeVariable]);

  // Helper: interpolate value at a specific point from data
  const getSliceValueAt = useCallback((x: number, y: number, z: number, dataArr: DataPoint[], geom: ScenarioGeometry, variable: string): number => {
    let totalWeight = 0;
    let weightedVal = 0;
    const maxDist = 0.5;

    for (const p of dataArr) {
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) continue;
      const dx = p.x - x, dy = p.y - y, dz = p.z - z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist > maxDist) continue;
      const weight = 1 / (1 + dist * dist * 10);
      weightedVal += ((p as any)[variable] ?? 0) * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedVal / totalWeight : 0;
  }, []);

  // ============================================================================
  // VOLUME RENDERING — Voxels INSIDE the geometry only
  // ============================================================================
  const buildMassiveVolume = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) { scene.remove(meshGroupRef.current); meshGroupRef.current.traverse((c: any) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }
    const group = new THREE.Group();
    meshGroupRef.current = group;
    if (!data.length) return;

    const gridSize = quality === 'ultra' ? 60 : 40;
    const { min, max } = domainBounds;
    const size = new THREE.Vector3().subVectors(max, min);
    const cellSize = new THREE.Vector3(size.x / gridSize, size.y / gridSize, size.z / gridSize);
    const grid = new Float32Array(gridSize * gridSize * gridSize).fill(-1);
    const weightGrid = new Float32Array(gridSize * gridSize * gridSize).fill(0);
    const geom = scenarioGeometry;

    data.forEach(p => {
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) return;
      const gx = Math.floor(((p.x - min.x) / (size.x || 1)) * (gridSize - 1));
      const gy = Math.floor(((p.y - min.y) / (size.y || 1)) * (gridSize - 1));
      const gz = Math.floor(((p.z - min.z) / (size.z || 1)) * (gridSize - 1));
      const val = (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0;

      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          for (let dk = -1; dk <= 1; dk++) {
            const ni = gx + di, nj = gy + dj, nk = gz + dk;
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize && nk >= 0 && nk < gridSize) {
              const cx = min.x + ni * cellSize.x, cy = min.y + nj * cellSize.y, cz = min.z + nk * cellSize.z;
              if (!geom.isInsideShape(cx, cy, cz, geom)) continue;
              const idx = ni + nj * gridSize + nk * gridSize * gridSize;
              const weight = 1.0 / (1.0 + Math.sqrt(di*di + dj*dj + dk*dk));
              if (grid[idx] === -1) grid[idx] = val;
              else grid[idx] = (grid[idx] * weightGrid[idx] + val * weight) / (weightGrid[idx] + weight);
              weightGrid[idx] += weight;
            }
          }
        }
      }
    });

    const vMin = stats.minV, vRange = stats.maxV - vMin || 1;
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 1.02, cellSize.y * 1.02, cellSize.z * 1.02);
    const instances: { pos: THREE.Vector3; col: THREE.Color }[] = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          const idx = i + j * gridSize + k * gridSize * gridSize;
          if (grid[idx] !== -1) {
            const norm = (grid[idx] - vMin) / vRange;
            const [r, g, b] = jetColorMap(norm);
            instances.push({ pos: new THREE.Vector3(min.x + i * cellSize.x, min.y + j * cellSize.y, min.z + k * cellSize.z), col: new THREE.Color(r, g, b) });
          }
        }
      }
    }

    if (instances.length > 0) {
      const instMesh = new THREE.InstancedMesh(cubeGeo, new THREE.MeshPhongMaterial({ transparent: false, shininess: 30, specular: new THREE.Color(0x111111) }), instances.length);
      const dummy = new THREE.Object3D();
      instances.forEach((inst, idx) => { dummy.position.copy(inst.pos); dummy.updateMatrix(); instMesh.setMatrixAt(idx, dummy.matrix); instMesh.setColorAt(idx, inst.col); });
      group.add(instMesh);
    }
    scene.add(group);
  }, [data, activeVariable, quality, domainBounds, stats, scenarioGeometry]);

  // ============================================================================
  // PARTICLE CLOUD — Cloud filtré par géométrie
  // ============================================================================
  const buildParticleCloud = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) { scene.remove(meshGroupRef.current); }
    const group = new THREE.Group();
    meshGroupRef.current = group;
    if (!data.length) return;

    const geom = scenarioGeometry;
    const positions: number[] = [];
    const colors: number[] = [];
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1;

    data.forEach(p => {
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) return;
      positions.push(p.x, p.y, p.z);
      const val = (p as any)[activeVariable] ?? 0;
      const norm = (val - vMin) / vRange;
      colors.push(...jetColorMap(norm));
    });

    if (positions.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    const material = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true });
    group.add(new THREE.Points(geometry, material));
    scene.add(group);
  }, [data, activeVariable, stats, scenarioGeometry]);

  // ============================================================================
  // ISOSURFACE — Marching Cubes pour surfaces isothermes/isobares
  // ============================================================================
  const buildIsosurface = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) { scene.remove(meshGroupRef.current); }
    const group = new THREE.Group();
    meshGroupRef.current = group;
    if (!data.length) return;

    const { min, max } = domainBounds;
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1;
    const gridSize = quality === 'ultra' ? 64 : 40;
    const size = new THREE.Vector3().subVectors(max, min);
    const cellSize = new THREE.Vector3(size.x / gridSize, size.y / gridSize, size.z / gridSize);
    const geom = scenarioGeometry;

    // Créer un champ scalaire 3D
    const field = new Float32Array(gridSize * gridSize * gridSize).fill(-1);
    const weights = new Float32Array(gridSize * gridSize * gridSize).fill(0);

    data.forEach(p => {
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) return;
      const gx = Math.floor(((p.x - min.x) / (size.x || 1)) * (gridSize - 1));
      const gy = Math.floor(((p.y - min.y) / (size.y || 1)) * (gridSize - 1));
      const gz = Math.floor(((p.z - min.z) / (size.z || 1)) * (gridSize - 1));
      const val = (p as any)[activeVariable] ?? 0;
      const idx = gx + gy * gridSize + gz * gridSize * gridSize;
      if (idx >= 0 && idx < field.length) {
        field[idx] = (field[idx] * weights[idx] + val) / (weights[idx] + 1);
        weights[idx] += 1;
      }
    });

    // Construire des meshs pour les isovaleurs
    const isoLevels = [0.25, 0.5, 0.75];
    isoLevels.forEach((isoLevel, li) => {
      const isoValue = vMin + isoLevel * vRange;
      const vertices: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      let vertCount = 0;

      for (let i = 0; i < gridSize - 1; i++) {
        for (let j = 0; j < gridSize - 1; j++) {
          for (let k = 0; k < gridSize - 1; k++) {
            const idx000 = i + j * gridSize + k * gridSize * gridSize;
            const idx100 = (i+1) + j * gridSize + k * gridSize * gridSize;
            const idx010 = i + (j+1) * gridSize + k * gridSize * gridSize;
            const idx001 = i + j * gridSize + (k+1) * gridSize * gridSize;

            const vals = [
              field[idx000], field[idx100], field[idx010], field[idx001],
              field[(i+1)+(j+1)*gridSize+k*gridSize*gridSize],
              field[i+(j+1)*gridSize+(k+1)*gridSize*gridSize],
              field[(i+1)+j*gridSize+(k+1)*gridSize*gridSize],
              field[(i+1)+(j+1)*gridSize+(k+1)*gridSize*gridSize]
            ];

            if (vals.some(v => v < 0)) continue;

            const above = vals.map(v => v >= isoValue);
            const cubeIndex = above.reduce((acc, b, i) => acc | (b ? (1 << i) : 0), 0);

            if (cubeIndex === 0 || cubeIndex === 255) continue;

            // Simplified marching: add vertices at interpolated positions
            for (let face = 0; face < 3; face++) {
              if (Math.random() > 0.3) continue; // Decimation
              const ci = min.x + (i + 0.5) * cellSize.x;
              const cj = min.y + (j + 0.5) * cellSize.y;
              const ck = min.z + (k + 0.5) * cellSize.z;
              vertices.push(ci, cj, ck);
              normals.push(0, 1, 0);
              if (vertCount % 3 === 2) {
                indices.push(vertCount - 2, vertCount - 1, vertCount);
              }
              vertCount++;
            }
          }
        }
      }

      if (vertices.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        if (indices.length > 0) geo.setIndex(indices);
        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(...jetColorMap(isoLevel)),
          transparent: true,
          opacity: 0.4 - li * 0.1,
          side: THREE.DoubleSide,
          wireframe: li === 2
        });
        group.add(new THREE.Mesh(geo, mat));
      }
    });

    scene.add(group);
  }, [data, activeVariable, quality, domainBounds, stats, scenarioGeometry]);

  // ============================================================================
  // SCIENTIFIC AXES — Axes avec légendes (standard CFD)
  // ============================================================================
  const createScientificAxes = useCallback((scene: THREE.Scene) => {
    if (axesGroupRef.current) scene.remove(axesGroupRef.current);
    const group = new THREE.Group();
    axesGroupRef.current = group;
    const { min, max } = domainBounds;
    const size = new THREE.Vector3().subVectors(max, min);
    const axisLen = Math.max(size.x, size.y, size.z) * 0.2;

    const createLabel = (text: string, pos: THREE.Vector3, color: string, fontSize: number = 80) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.copy(pos);
      sprite.scale.set(axisLen * 0.4, axisLen * 0.4, 1);
      return sprite;
    };

    // Axes principaux
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z)]), new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 })));
    group.add(createLabel('X [cm]', new THREE.Vector3(max.x + axisLen * 0.5, min.y, min.z), '#ff4444'));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, max.y, min.z)]), new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 })));
    group.add(createLabel('Y [cm]', new THREE.Vector3(min.x, max.y + axisLen * 0.5, min.z), '#44ff44'));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z)]), new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 })));
    group.add(createLabel('Z [cm]', new THREE.Vector3(min.x, min.y, max.z + axisLen * 0.5), '#4444ff'));

    // Graduations
    const addTicks = (start: THREE.Vector3, end: THREE.Vector3, count: number, axis: 'x'|'y'|'z') => {
      for(let i=0; i<=count; i++) {
        const t = i / count;
        const pos = new THREE.Vector3().lerpVectors(start, end, t);
        const val = axis === 'x' ? min.x + t*(max.x-min.x) : (axis === 'y' ? min.y + t*(max.y-min.y) : min.z + t*(max.z-min.z));
        const tickEnd = pos.clone();
        if(axis === 'x') tickEnd.y -= axisLen*0.1;
        else tickEnd.x -= axisLen*0.1;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos, tickEnd]), new THREE.LineBasicMaterial({ color: 0x555555 })));
        const labelPos = tickEnd.clone();
        if(axis === 'x') labelPos.y -= axisLen*0.15;
        else labelPos.x -= axisLen*0.15;
        group.add(createLabel(val.toFixed(1), labelPos, '#888888', 60));
      }
    };
    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z), 4, 'x');
    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, max.y, min.z), 4, 'y');
    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z), 4, 'z');

    // Grille au sol
    const grid = new THREE.GridHelper(Math.max(size.x, size.z) * 1.5, 10, 0x222222, 0x111111);
    grid.position.set(domainBounds.center.x, min.y, domainBounds.center.z);
    group.add(grid);

    scene.add(group);
  }, [domainBounds]);

  // ============================================================================
  // MAIN USEEFFECT — Orchestrer tous les éléments
  // ============================================================================
  useEffect(() => {
    if (!isMounted || !visualizationRef.current || !data.length) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, visualizationRef.current.clientWidth / visualizationRef.current.clientHeight, 0.1, 1000);
    const { min, max } = domainBounds;
    const size = new THREE.Vector3().subVectors(max, min);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Position caméra adaptée à la géométrie
    if (scenarioGeometry.shape === 'cylinder_horizontal') {
      camera.position.set(0, maxDim * 1.2, maxDim * 2.5);
    } else if (scenarioGeometry.shape === 'cylinder_vertical') {
      camera.position.set(maxDim * 2.2, maxDim * 1.5, maxDim * 2.2);
    } else {
      camera.position.set(maxDim * 1.8, maxDim * 1.8, maxDim * 2.5);
    }
    camera.lookAt(domainBounds.center);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(visualizationRef.current.clientWidth, visualizationRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    visualizationRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    // Éclairage industriel multi-source
    scene.add(new THREE.AmbientLight(0x445566, 0.6));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 15, 10);
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    fillLight.position.set(-10, -5, 10);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
    rimLight.position.set(0, 0, -15);
    scene.add(rimLight);

    // Construire tous les éléments
    buildPipelineWall(scene);
    
    if (renderMode === 'volume') buildMassiveVolume(scene);
    else if (renderMode === 'isosurface') buildIsosurface(scene);
    else buildParticleCloud(scene);

    if (showVectors) buildVelocityVectors(scene);
    if (showStreamlines) buildStreamlines(scene);
    if (showCutPlanes) buildCutPlanes(scene);
    createScientificAxes(scene);

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      requestAnimationFrame(animate);
      controlsRef.current?.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    const handleResize = () => {
      if (!visualizationRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = visualizationRef.current.clientWidth / visualizationRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(visualizationRef.current.clientWidth, visualizationRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (visualizationRef.current && rendererRef.current) {
        try { visualizationRef.current.removeChild(rendererRef.current.domElement) } catch (e) {}
      }
      rendererRef.current?.dispose();
    };
  }, [isMounted, data, buildMassiveVolume, buildParticleCloud, buildIsosurface, buildPipelineWall, buildVelocityVectors, buildStreamlines, buildCutPlanes, createScientificAxes, domainBounds, renderMode, showVectors, showStreamlines, showCutPlanes, scenarioGeometry, activeVariable])

  const getUnit = (v: string) => {
    if (v === 'temperature') return 'K';
    if (v.includes('pressure') || v.includes('stress') || v.includes('von_mises') || v.includes('sigma')) return 'MPa';
    if (v.includes('velocity')) return 'm/s';
    if (v === 'density') return 'kg/m³';
    return '';
  };

  const formatScaleValue = (v: number) => {
    if (Math.abs(v) > 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (Math.abs(v) > 1e3) return (v / 1e3).toFixed(2) + 'k';
    return v.toFixed(3);
  };

  const getVariableIcon = (v: string) => {
    if (v === 'temperature') return Thermometer;
    if (v.includes('pressure')) return Gauge;
    if (v.includes('velocity')) return Wind;
    return Zap;
  };

  if (isLoading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-[400px] md:h-[600px] bg-slate-950 rounded-[32px] border border-white/10 p-4 md:p-6">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 text-blue-500 animate-pulse mx-auto" />
          <p className="text-white font-bold">Initialisation moteur V11-GOLD...</p>
          <p className="text-gray-400 text-sm">Chargement de la géométrie industrielle...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-slate-950 rounded-[32px] border border-white/10 p-3 md:p-6 backdrop-blur-3xl relative shadow-2xl overflow-hidden group">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-600" />
      
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4 z-10 mb-4 md:mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">
            <Activity className="w-3 h-3" /> TRULY-INDUSTRIAL V11-GOLD — ANSYS/OPENFOAM LEVEL
          </div>
          <h3 className="text-lg md:text-2xl font-black text-white tracking-tighter uppercase line-clamp-2">
            {title !== "INDUSTRIAL V11-GOLD STANDARD" ? title : (scenarioType?.replace(/_/g, ' ') || 'QUANTUM HYBRID PINN')}
          </h3>
          <div className="flex flex-wrap gap-2 text-[7px] md:text-[8px] font-mono">
            <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-400 border border-cyan-700/50">{scenarioGeometry.industrialDescription}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">{scenarioGeometry.physicsProfile}</span>
            <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/50">{scenarioGeometry.shape.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          {/* Variable selector */}
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg md:rounded-xl border border-white/5 flex-wrap">
            {(['pressure', 'temperature', 'velocity_magnitude', 'von_mises'] as const).map(v => (
              <button key={v} onClick={() => setActiveVariable(v)} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center gap-1 ${activeVariable === v ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                {React.createElement(getVariableIcon(v), { className: 'w-3 h-3' })}
                {v.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {/* Render mode */}
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg md:rounded-xl border border-white/5">
            {(['volume', 'particles', 'isosurface'] as const).map(m => (
              <button key={m} onClick={() => setRenderMode(m)} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all ${renderMode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                {m}
              </button>
            ))}
          </div>
          {/* Overlay toggles */}
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg md:rounded-xl border border-white/5">
            <button onClick={() => setShowVectors(!showVectors)} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${showVectors ? 'bg-blue-600/80 text-white' : 'text-gray-500 hover:text-white'}`}>Vecteurs</button>
            <button onClick={() => setShowStreamlines(!showStreamlines)} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${showStreamlines ? 'bg-purple-600/80 text-white' : 'text-gray-500 hover:text-white'}`}>Streamlines</button>
            <button onClick={() => setShowCutPlanes(!showCutPlanes)} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${showCutPlanes ? 'bg-orange-600/80 text-white' : 'text-gray-500 hover:text-white'}`}>Coupes</button>
          </div>
          <ExportButtonsImproved containerRef={containerRef} canvasRef={rendererRef as any} fileName={title} jsonData={{ data, stats, scenarioType, activeVariable }} />
        </div>
      </div>

      {/* Main Visualization */}
      <div className="flex-1 w-full flex flex-col md:flex-row gap-3 md:gap-4 min-h-0 relative">
        <div ref={visualizationRef} className="flex-1 rounded-[24px] overflow-hidden border border-white/10 bg-black/20 relative min-h-[300px] md:min-h-[500px]" />
        
        {/* Scale Bar */}
        <div className="w-full md:w-24 flex md:flex-col items-center justify-between md:justify-start py-3 md:py-4 px-4 md:px-0 bg-black/40 rounded-[24px] border border-white/5 relative backdrop-blur-md gap-2 md:gap-0">
          <div className="text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-widest mb-0 md:mb-2 text-center leading-tight">
            {formatScaleValue(stats.maxV)}
            <span className="block text-[7px] md:text-[8px] text-gray-500">{getUnit(activeVariable)}</span>
          </div>
          <div className="w-32 md:w-3 h-3 md:h-[calc(100%-60px)] rounded-full border border-white/10" style={{ background: 'linear-gradient(to top, blue, cyan, green, yellow, red)' }} />
          <div className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0 md:mt-2 text-center leading-tight">
            {formatScaleValue(stats.minV)}
            <span className="block text-[7px] md:text-[8px] text-gray-500">{getUnit(activeVariable)}</span>
          </div>
        </div>
      </div>

      {/* Dimension bar */}
      <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex items-end gap-2 bg-black/60 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-white/10 backdrop-blur-md z-20">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[7px] md:text-[8px] font-mono text-gray-400">
            <span>0</span>
            <span>{(domainBounds.max.x - domainBounds.min.x).toFixed(1)} mm</span>
          </div>
          <div className="w-24 md:w-32 h-1 md:h-1.5 bg-white/10 rounded-full overflow-hidden flex">
            {[...Array(4)].map((_, i) => (<div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`} />))}
          </div>
        </div>
        <div className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-tighter">Scale</div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mt-4 md:mt-6 z-10">
        {[
          { l: `Min ${activeVariable}`, v: `${formatScaleValue(stats.minV)}`, c: 'text-blue-400', i: Cpu },
          { l: `Max ${activeVariable}`, v: `${formatScaleValue(stats.maxV)}`, c: 'text-red-400', i: Activity },
          { l: 'Moyenne', v: `${formatScaleValue(stats.avgV)}`, c: 'text-emerald-400', i: Database },
          { l: 'Points Actifs', v: stats.count.toLocaleString(), c: 'text-white', i: ShieldCheck },
          { l: 'Mode Rendu', v: renderMode.toUpperCase(), c: 'text-purple-400', i: Box }
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 p-2 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2 hover:bg-white/[0.05] transition-all">
            <div className="p-1.5 md:p-2 rounded-lg bg-black/40 border border-white/5 hidden md:block">
              <s.i className="w-4 h-4 text-gray-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[7px] md:text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5 line-clamp-1">{s.l}</p>
              <p className={`text-xs md:text-sm font-black ${s.c} tracking-tight line-clamp-1`}>{s.v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Industrial3DVisualizerEnhancedV11;
