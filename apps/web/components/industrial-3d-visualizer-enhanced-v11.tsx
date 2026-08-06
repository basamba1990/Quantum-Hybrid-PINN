'use client'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Activity, Cpu, Database, ShieldCheck, Box, Download, Thermometer, Gauge, Wind, Zap } from 'lucide-react'
import ExportButtonsImproved from './export-buttons-improved'

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; 
  velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number; 
  sigma_1?: number; sigma_2?: number; sigma_3?: number;
  von_mises?: number;
  damage?: number;
}

type ScenarioType = "H2_PIPELINE" | "LH2_STORAGE" | "DEEP_MINING_BLOCK" | "ROCK_ELAST_STRESS" | "H2_PIPELINE_STRATEGIC" | "FPGA_HEATSINK" | "PORT_ENERGY_OPTIMIZATION" | "PIPELINE_SAFETY" | "CRYOGENIC_TRANSPORT" | "MINING_INDUSTRIAL_SIM" | "H2_COMPRESSION_STATION" | "H2_DISTRIBUTION_HIGH_PRESSURE";

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
}

const SCENARIO_GEOMETRIES: Record<ScenarioType, any> = {
  H2_PIPELINE: {
    shape: 'cylinder_horizontal',
    radius: 0.1525,
    length: 5.0,
    wallThickness: 0.025,
    industrialDescription: 'Pipeline H2 DN300 PN200 — Acier X65',
    physicsProfile: 'Profil Hagen-Poiseuille turbulent Re=5.3e5',
    isInsideShape: (x: number, y: number, z: number, g: any) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  H2_DISTRIBUTION_HIGH_PRESSURE: {
    shape: 'cylinder_horizontal',
    radius: 0.1,
    length: 10.0,
    wallThickness: 0.025,
    industrialDescription: 'Distribution H2 Haute Pression (70 MPa) — NIST Standard',
    physicsProfile: 'Écoulement turbulent compressible (Lemmon 2008)',
    isInsideShape: (x: number, y: number, z: number, g: any) => Math.sqrt(y*y + z*z) <= g.radius!
  },
  LH2_STORAGE: { shape: 'cylinder_vertical', radius: 1.0, height: 4.0, wallThickness: 0.05, industrialDescription: 'Réservoir LH2 cryogénique', physicsProfile: 'Convection naturelle', isInsideShape: (x:any, y:any, z:any, g:any) => Math.sqrt(x*x + z*z) <= g.radius! && Math.abs(y) <= g.height!/2 },
  DEEP_MINING_BLOCK: { shape: 'box', length: 50.0, width: 50.0, height: 50.0, industrialDescription: 'Bloc minier profond', physicsProfile: 'Stress triaxial', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 },
  ROCK_ELAST_STRESS: { shape: 'box', length: 1.0, width: 1.0, height: 1.0, industrialDescription: 'Contrainte élastique rocheuse', physicsProfile: 'Modèle de Mohr-Coulomb', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 },
  H2_PIPELINE_STRATEGIC: { shape: 'cylinder_horizontal', radius: 0.5, length: 100.0, wallThickness: 0.05, industrialDescription: 'Pipeline H2 Stratégique', physicsProfile: 'Transport longue distance', isInsideShape: (x: number, y: number, z: number, g: any) => Math.sqrt(y*y + z*z) <= g.radius! },
  FPGA_HEATSINK: { shape: 'box', length: 0.1, width: 0.1, height: 0.05, industrialDescription: 'Dissipateur thermique FPGA', physicsProfile: 'Transfert thermique par convection', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 },
  PORT_ENERGY_OPTIMIZATION: { shape: 'box', length: 10.0, width: 10.0, height: 5.0, industrialDescription: 'Optimisation énergétique portuaire', physicsProfile: 'Flux d\'énergie multi-modale', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 },
  PIPELINE_SAFETY: { shape: 'cylinder_horizontal', radius: 0.2, length: 20.0, wallThickness: 0.03, industrialDescription: 'Sécurité des pipelines', physicsProfile: 'Détection de fuites et intégrité', isInsideShape: (x: number, y: number, z: number, g: any) => Math.sqrt(y*y + z*z) <= g.radius! },
  CRYOGENIC_TRANSPORT: { shape: 'cylinder_horizontal', radius: 0.8, length: 15.0, wallThickness: 0.1, industrialDescription: 'Transport cryogénique', physicsProfile: 'Isolation thermique avancée', isInsideShape: (x: number, y: number, z: number, g: any) => Math.sqrt(y*y + z*z) <= g.radius! },
  MINING_INDUSTRIAL_SIM: { shape: 'box', length: 20.0, width: 20.0, height: 20.0, industrialDescription: 'Simulation minière industrielle', physicsProfile: 'Mécanique des roches et dynamique des fluides', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 },
  H2_COMPRESSION_STATION: { shape: 'box', length: 5.0, width: 5.0, height: 5.0, industrialDescription: 'Station de compression H2', physicsProfile: 'Compression multi-étages', isInsideShape: (x:any, y:any, z:any, g:any) => Math.abs(x)<=g.length!/2 && Math.abs(y)<=g.height!/2 && Math.abs(z)<=g.width!/2 }
};

const jetColorMap = (t: number): [number, number, number] => {
  const v = Math.max(0, Math.min(1, t));
  const r = v < 0.7 ? (v < 0.3 ? 0 : (v - 0.3) / 0.4) : 1;
  const g = v < 0.3 ? v / 0.3 : (v < 0.7 ? 1 : 1 - (v - 0.7) / 0.3);
  const b = v < 0.3 ? 1 : (v < 0.7 ? 1 - (v - 0.3) / 0.4 : 0);
  return [r, g, b];
};

const Industrial3DVisualizerEnhancedV11: React.FC<Props> = ({
  data = [],
  title = "INDUSTRIAL V11-GOLD STANDARD",
  colorVariable = 'pressure',
  quality = 'ultra',
  scenarioType = 'H2_PIPELINE'
}) => {
  const visualizationRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<any>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [renderMode, setRenderMode] = useState<'volume' | 'particles' | 'isosurface'>('volume')

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const scenarioGeometry = useMemo(() => SCENARIO_GEOMETRIES[scenarioType] || SCENARIO_GEOMETRIES.H2_PIPELINE, [scenarioType]);

  const domainBounds = useMemo(() => {
    if (!data.length) return { min: new THREE.Vector3(-1,-1,-1), max: new THREE.Vector3(1,1,1), center: new THREE.Vector3(0,0,0) };
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data])

  const stats = useMemo(() => {
    if (!data.length) return { minV: 0, maxV: 1, avgV: 0, count: 0 };
    const vals = data.map(p => (p as any)[activeVariable] ?? 0)
    return { minV: Math.min(...vals), maxV: Math.max(...vals), avgV: vals.reduce((a, b) => a + b, 0) / vals.length, count: data.length }
  }, [data, activeVariable])

  useEffect(() => {
    if (!isMounted || !visualizationRef.current || !data.length) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, visualizationRef.current.clientWidth / visualizationRef.current.clientHeight, 0.1, 1000);
    const maxDim = Math.max(domainBounds.max.x - domainBounds.min.x, domainBounds.max.y - domainBounds.min.y, domainBounds.max.z - domainBounds.min.z);
    
    // Zoom immersif industriel
    camera.position.set(domainBounds.center.x - maxDim * 0.45, domainBounds.center.y + maxDim * 0.35, domainBounds.center.z + maxDim * 0.6);
    camera.lookAt(domainBounds.center);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(visualizationRef.current.clientWidth, visualizationRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    visualizationRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    // Wall & Volume Rendering (Simplified for direct push)
    const geom = scenarioGeometry;
    const wallThick = 0.025;
    const outerGeo = new THREE.CylinderGeometry(geom.radius + wallThick, geom.radius + wallThick, geom.length || 5, 128, 1, true);
    outerGeo.rotateZ(Math.PI / 2);
    const wall = new THREE.Mesh(outerGeo, new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide, transparent: true, opacity: 0.3 }));
    wall.position.copy(domainBounds.center);
    scene.add(wall);

    // Points
    const positions: number[] = [];
    const colors: number[] = [];
    const vRange = stats.maxV - stats.minV || 1;
    data.forEach(p => {
      positions.push(p.x, p.y, p.z);
      const norm = ((p as any)[activeVariable] - stats.minV) / vRange;
      colors.push(...jetColorMap(norm));
    });
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    pointsGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    scene.add(new THREE.Points(pointsGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.8 })));

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      requestAnimationFrame(animate);
      controlsRef.current?.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    return () => {
      if (visualizationRef.current && rendererRef.current) {
        try { visualizationRef.current.removeChild(rendererRef.current.domElement) } catch (e) {}
      }
      rendererRef.current?.dispose();
    };
  }, [isMounted, data, stats, scenarioGeometry, domainBounds, activeVariable]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 rounded-[32px] border border-white/10 p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-600" />
      <div className="mb-4">
        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{title}</h3>
        <p className="text-[10px] text-cyan-500 font-black uppercase tracking-widest mt-1">Nexus Engine V11-GOLD // Industrial Zoom Active</p>
      </div>
      <div ref={visualizationRef} className="flex-1 rounded-[24px] border border-white/5 bg-black/40 relative min-h-[500px]" />
      <div className="mt-4 flex gap-2">
        {['pressure', 'temperature', 'velocity_magnitude'].map(v => (
          <button key={v} onClick={() => setActiveVariable(v)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeVariable === v ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>
            {v.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Industrial3DVisualizerEnhancedV11;
