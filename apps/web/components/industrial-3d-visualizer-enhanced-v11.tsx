'use client'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Activity, Cpu, Database, ShieldCheck, Box, Download } from 'lucide-react'
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
 * TRULY-INDUSTRIAL V11-ENHANCED
 * Physics-Informed Volumetric Engine with Scenario-Adaptive Geometry
 * 
 * Chaque scénario industriel a sa propre forme géométrique physique :
 * - Pipeline H2 → Cylindre horizontal (forme tubulaire)
 * - Stockage LH2 → Sphère/Cylindre vertical (réservoir pressurisé)
 * - Bloc minier → Parallélépipède massif (roche)
 * - Heatsink FPGA → Plaque rectangulaire avec ailettes
 * - Compression → Cylindre vertical compact
 */

// ============================================================================
// SCENARIO GEOMETRY DEFINITIONS - Formes géométriques industrielles réelles
// ============================================================================
interface ScenarioGeometry {
  shape: 'cylinder_horizontal' | 'cylinder_vertical' | 'sphere' | 'box' | 'rectangular_plate';
  /** Dimensions physiques (rayon ou demi-axes) */
  radius?: number;
  height?: number;
  length?: number;
  width?: number;
  wallThickness?: number;
  /** Contrainte : point doit être à l'intérieur de la forme */
  isInsideShape: (x: number, y: number, z: number, geom: ScenarioGeometry) => boolean;
  /** Description industrielle */
  industrialDescription: string;
  /** Symbole visuel */
  icon: string;
}

const SCENARIO_GEOMETRIES: Record<ScenarioType, ScenarioGeometry> = {
  H2_PIPELINE: {
    shape: 'cylinder_horizontal',
    radius: 0.15,
    length: 5.0,
    wallThickness: 0.015,
    industrialDescription: 'Pipeline H2 haute pression (DN300, PN200)',
    icon: '🔵',
    isInsideShape: (x, y, z, geom) => {
      // Cylindre horizontal le long de l'axe X
      const distFromAxis = Math.sqrt(y * y + z * z);
      return distFromAxis <= geom.radius!;
    }
  },
  H2_PIPELINE_STRATEGIC: {
    shape: 'cylinder_horizontal',
    radius: 0.20,
    length: 10.0,
    wallThickness: 0.025,
    industrialDescription: 'Pipeline H2 stratégique (DN400, PN300)',
    icon: '🔵',
    isInsideShape: (x, y, z, geom) => {
      const distFromAxis = Math.sqrt(y * y + z * z);
      return distFromAxis <= geom.radius!;
    }
  },
  PIPELINE_SAFETY: {
    shape: 'cylinder_horizontal',
    radius: 0.15,
    length: 5.0,
    wallThickness: 0.015,
    industrialDescription: 'Pipeline H2 sécurité (audit intégrité)',
    icon: '🔵',
    isInsideShape: (x, y, z, geom) => {
      const distFromAxis = Math.sqrt(y * y + z * z);
      return distFromAxis <= geom.radius!;
    }
  },
  LH2_STORAGE: {
    shape: 'cylinder_vertical',
    radius: 1.0,
    height: 4.0,
    wallThickness: 0.05,
    industrialDescription: 'Réservoir LH2 cryogénique (5000L)',
    icon: '🔴',
    isInsideShape: (x, y, z, geom) => {
      // Cylindre vertical le long de l'axe Y
      const distFromAxis = Math.sqrt(x * x + z * z);
      return distFromAxis <= geom.radius! && Math.abs(y) <= geom.height! / 2;
    }
  },
  H2_COMPRESSION_STATION: {
    shape: 'cylinder_vertical',
    radius: 0.5,
    height: 2.5,
    wallThickness: 0.03,
    industrialDescription: 'Station de compression H2 (700 bar)',
    icon: '🟢',
    isInsideShape: (x, y, z, geom) => {
      const distFromAxis = Math.sqrt(x * x + z * z);
      return distFromAxis <= geom.radius! && Math.abs(y) <= geom.height! / 2;
    }
  },
  CRYOGENIC_TRANSPORT: {
    shape: 'cylinder_horizontal',
    radius: 0.8,
    length: 8.0,
    wallThickness: 0.04,
    industrialDescription: 'Citerne cryogénique de transport',
    icon: '🔵',
    isInsideShape: (x, y, z, geom) => {
      const distFromAxis = Math.sqrt(y * y + z * z);
      return distFromAxis <= geom.radius!;
    }
  },
  DEEP_MINING_BLOCK: {
    shape: 'box',
    length: 50.0,
    width: 50.0,
    height: 50.0,
    industrialDescription: 'Bloc minier profond (stress géomécanique)',
    icon: '⬛',
    isInsideShape: (x, y, z, geom) => {
      return Math.abs(x) <= geom.length! / 2 && 
             Math.abs(y) <= geom.height! / 2 && 
             Math.abs(z) <= geom.width! / 2;
    }
  },
  MINING_INDUSTRIAL_SIM: {
    shape: 'box',
    length: 100.0,
    width: 100.0,
    height: 100.0,
    industrialDescription: 'Simulation minière industrielle (100m³)',
    icon: '⬛',
    isInsideShape: (x, y, z, geom) => {
      return Math.abs(x) <= geom.length! / 2 && 
             Math.abs(y) <= geom.height! / 2 && 
             Math.abs(z) <= geom.width! / 2;
    }
  },
  ROCK_ELAST_STRESS: {
    shape: 'box',
    length: 20.0,
    width: 20.0,
    height: 20.0,
    industrialDescription: 'Échantillon rocheux (contrainte élastique)',
    icon: '⬛',
    isInsideShape: (x, y, z, geom) => {
      return Math.abs(x) <= geom.length! / 2 && 
             Math.abs(y) <= geom.height! / 2 && 
             Math.abs(z) <= geom.width! / 2;
    }
  },
  FPGA_HEATSINK: {
    shape: 'rectangular_plate',
    length: 0.15,
    width: 0.15,
    height: 0.05,
    industrialDescription: 'Dissipateur thermique FPGA (150×150×50mm)',
    icon: '🟫',
    isInsideShape: (x, y, z, geom) => {
      return Math.abs(x) <= geom.length! / 2 && 
             Math.abs(y) <= geom.height! / 2 && 
             Math.abs(z) <= geom.width! / 2;
    }
  },
  PORT_ENERGY_OPTIMIZATION: {
    shape: 'box',
    length: 500.0,
    width: 300.0,
    height: 100.0,
    industrialDescription: 'Zone portuaire (optimisation énergétique)',
    icon: '⬛',
    isInsideShape: (x, y, z, geom) => {
      return Math.abs(x) <= geom.length! / 2 && 
             Math.abs(y) <= geom.height! / 2 && 
             Math.abs(z) <= geom.width! / 2;
    }
  }
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
  const axesGroupRef = useRef<THREE.Group | null>(null)
  const geometryOutlineRef = useRef<THREE.Object3D | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ minV: 0, maxV: 1, avgV: 0, count: 0 })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [showAxes, setShowAxes] = useState(true)
  const [renderMode, setRenderMode] = useState<'volume' | 'particles'>('volume')
  const [isLoading, setIsLoading] = useState(data.length === 0)

  // Get current scenario geometry
  const scenarioGeometry = useMemo(() => {
    return SCENARIO_GEOMETRIES[scenarioType] || SCENARIO_GEOMETRIES.H2_PIPELINE;
  }, [scenarioType]);

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const domainBounds = useMemo(() => {
    if (!data.length) {
      // Default domain based on scenario geometry
      const geom = scenarioGeometry;
      let halfSize = 1;
      if (geom.shape === 'cylinder_horizontal') {
        halfSize = Math.max(geom.radius || 0.5, (geom.length || 5) / 4);
      } else if (geom.shape === 'cylinder_vertical') {
        halfSize = Math.max(geom.radius || 1, (geom.height || 4) / 2);
      } else {
        halfSize = Math.max(geom.length || 10, geom.width || 10, geom.height || 10) / 2;
      }
      return { 
        min: new THREE.Vector3(-halfSize, -halfSize, -halfSize), 
        max: new THREE.Vector3(halfSize, halfSize, halfSize), 
        center: new THREE.Vector3(0, 0, 0) 
      };
    }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data, scenarioGeometry])

  useEffect(() => {
    if (!data.length) {
      setIsLoading(true)
      return
    }
    setIsLoading(false)
    const vals = data.map(p => (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0)
    setStats({
      minV: Math.min(...vals),
      maxV: Math.max(...vals),
      avgV: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: data.length
    })
  }, [data, activeVariable])

  const getIndustrialColor = useCallback((t: number): [number, number, number] => {
    const v = Math.max(0, Math.min(1, t));
    if (v < 0.2) return [0, 0.2 + v * 2, 1];
    if (v < 0.4) return [0, 1, 1 - (v - 0.2) * 2];
    if (v < 0.6) return [(v - 0.4) * 5, 1, 0];
    if (v < 0.8) return [1, 1 - (v - 0.6) * 5, 0];
    return [1, 0, 0];
  }, []);

  // ============================================================================
  // SCENARIO-ADAPTIVE GEOMETRY: Build the physical shape outline
  // ============================================================================
  const buildScenarioOutline = useCallback((scene: THREE.Scene) => {
    // Remove old outline
    if (geometryOutlineRef.current) {
      scene.remove(geometryOutlineRef.current);
      geometryOutlineRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    const group = new THREE.Group();
    geometryOutlineRef.current = group;
    const geom = scenarioGeometry;
    const { min, max } = domainBounds;
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x2266cc,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });

    if (geom.shape === 'cylinder_horizontal') {
      // Cylindre horizontal le long de l'axe X (pipeline)
      const length = geom.length || 5.0;
      const radius = geom.radius || 0.15;
      const geo = new THREE.CylinderGeometry(radius, radius, length, 64, 1, true);
      geo.rotateZ(Math.PI / 2); // Orienter le long de X
      
      const mesh = new THREE.Mesh(geo, wallMaterial);
      mesh.position.copy(center);
      group.add(mesh);
      
      const wireframe = new THREE.Mesh(geo, wireframeMaterial);
      wireframe.position.copy(center);
      group.add(wireframe);

      // Bouchons aux extrémités
      const capGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshPhongMaterial({
        color: 0x3366aa,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      
      const cap1 = new THREE.Mesh(capGeo, capMat);
      cap1.rotation.z = -Math.PI / 2;
      cap1.position.set(center.x - length / 2, center.y, center.z);
      group.add(cap1);
      
      const cap2 = new THREE.Mesh(capGeo, capMat);
      cap2.rotation.z = Math.PI / 2;
      cap2.position.set(center.x + length / 2, center.y, center.z);
      group.add(cap2);

    } else if (geom.shape === 'cylinder_vertical') {
      // Cylindre vertical le long de l'axe Y (réservoir)
      const radius = geom.radius || 1.0;
      const height = geom.height || 4.0;
      const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
      
      const mesh = new THREE.Mesh(geo, wallMaterial);
      mesh.position.copy(center);
      group.add(mesh);
      
      const wireframe = new THREE.Mesh(geo, wireframeMaterial);
      wireframe.position.copy(center);
      group.add(wireframe);

      // Bouchons haut et bas
      const capGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshPhongMaterial({
        color: 0x3366aa,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      
      const capBottom = new THREE.Mesh(capGeo, capMat);
      capBottom.rotation.x = Math.PI;
      capBottom.position.set(center.x, center.y - height / 2, center.z);
      group.add(capBottom);
      
      const capTop = new THREE.Mesh(capGeo, capMat);
      capTop.position.set(center.x, center.y + height / 2, center.z);
      group.add(capTop);

    } else if (geom.shape === 'sphere') {
      // Sphère (réservoir sphérique)
      const radius = geom.radius || 1.0;
      const geo = new THREE.SphereGeometry(radius, 64, 32);
      
      const mesh = new THREE.Mesh(geo, wallMaterial);
      mesh.position.copy(center);
      group.add(mesh);
      
      const wireframe = new THREE.Mesh(geo, wireframeMaterial);
      wireframe.position.copy(center);
      group.add(wireframe);

    } else {
      // Boîte (bloc minier, heatsink, zone portuaire)
      const length = geom.length || 10;
      const width = geom.width || 10;
      const height = geom.height || 10;
      const geo = new THREE.BoxGeometry(length, height, width);
      
      const mesh = new THREE.Mesh(geo, wallMaterial);
      mesh.position.copy(center);
      group.add(mesh);
      
      const wireframe = new THREE.Mesh(geo, wireframeMaterial);
      wireframe.position.copy(center);
      group.add(wireframe);

      // Arêtes visibles
      const edges = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x4488ff, opacity: 0.5, transparent: true });
      const edgesLine = new THREE.LineSegments(edges, edgesMat);
      edgesLine.position.copy(center);
      group.add(edgesLine);
    }

    scene.add(group);
  }, [domainBounds, scenarioGeometry]);

  const createScientificAxes = useCallback((scene: THREE.Scene) => {
    if (axesGroupRef.current) {
      scene.remove(axesGroupRef.current)
    }
    const group = new THREE.Group()
    axesGroupRef.current = group

    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const axisLen = Math.max(size.x, size.y, size.z) * 0.2

    const createLabel = (text: string, pos: THREE.Vector3, color: string, fontSize: number = 80) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = color
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(text, 128, 128)
      const texture = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
      sprite.position.copy(pos)
      sprite.scale.set(axisLen * 0.4, axisLen * 0.4, 1)
      return sprite
    }

    // Main Axes
    const xGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z)])
    group.add(new THREE.Line(xGeo, new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 })))
    group.add(createLabel('X [cm]', new THREE.Vector3(max.x + axisLen * 0.5, min.y, min.z), '#ff4444'))

    const yGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, max.y, min.z)])
    group.add(new THREE.Line(yGeo, new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 })))
    group.add(createLabel('Y [cm]', new THREE.Vector3(min.x, max.y + axisLen * 0.5, min.z), '#44ff44'))

    const zGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z)])
    group.add(new THREE.Line(zGeo, new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 })))
    group.add(createLabel('Z [cm]', new THREE.Vector3(min.x, min.y, max.z + axisLen * 0.5), '#4444ff'))

    // Ticks and Numbers
    const addTicks = (start: THREE.Vector3, end: THREE.Vector3, count: number, axis: 'x'|'y'|'z') => {
      for(let i=0; i<=count; i++) {
        const t = i / count;
        const pos = new THREE.Vector3().lerpVectors(start, end, t);
        const val = axis === 'x' ? min.x + t*(max.x-min.x) : (axis === 'y' ? min.y + t*(max.y-min.y) : min.z + t*(max.z-min.z));
        
        // Tick line
        const tickEnd = pos.clone();
        if(axis === 'x') tickEnd.y -= axisLen*0.1;
        else if(axis === 'y') tickEnd.x -= axisLen*0.1;
        else tickEnd.x -= axisLen*0.1;
        
        const tickGeo = new THREE.BufferGeometry().setFromPoints([pos, tickEnd]);
        group.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x555555 })));
        
        // Number label
        const labelPos = tickEnd.clone();
        if(axis === 'x') labelPos.y -= axisLen*0.15;
        else if(axis === 'y') labelPos.x -= axisLen*0.15;
        else labelPos.x -= axisLen*0.15;
        group.add(createLabel(val.toFixed(1), labelPos, '#888888', 60));
      }
    }

    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z), 4, 'x');
    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, max.y, min.z), 4, 'y');
    addTicks(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z), 4, 'z');

    const box = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z)), 0x333333)
    box.position.copy(domainBounds.center)
    group.add(box)

    const grid = new THREE.GridHelper(Math.max(size.x, size.z) * 1.5, 10, 0x222222, 0x111111)
    grid.position.set(domainBounds.center.x, min.y, domainBounds.center.z)
    group.add(grid)

    scene.add(group)
  }, [domainBounds])

  // ============================================================================
  // SCENARIO-ADAPTIVE VOLUME BUILDING
  // Les voxels ne sont créés que SI le point est physiquement dans la forme
  // ============================================================================
  const buildMassiveVolume = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current)
      meshGroupRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }
    const group = new THREE.Group()
    meshGroupRef.current = group
    if (!data.length) return

    const gridSize = quality === 'ultra' ? 60 : 40
    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const cellSize = new THREE.Vector3(size.x / gridSize, size.y / gridSize, size.z / gridSize)

    const grid = new Float32Array(gridSize * gridSize * gridSize).fill(-1)
    const weightGrid = new Float32Array(gridSize * gridSize * gridSize).fill(0)

    // PHYSICAL CONSTRAINT: Only populate cells that are inside the scenario geometry
    const geom = scenarioGeometry;

    data.forEach(p => {
      // Vérifier que le point est physiquement dans la forme industrielle
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) return;

      const gx = Math.floor(((p.x - min.x) / (size.x || 1)) * (gridSize - 1))
      const gy = Math.floor(((p.y - min.y) / (size.y || 1)) * (gridSize - 1))
      const gz = Math.floor(((p.z - min.z) / (size.z || 1)) * (gridSize - 1))
      
      const val = (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0
      
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          for (let dk = -1; dk <= 1; dk++) {
            const ni = gx + di, nj = gy + dj, nk = gz + dk
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize && nk >= 0 && nk < gridSize) {
              const idx = ni + nj * gridSize + nk * gridSize * gridSize
              
              // Vérifier que la cellule interpolée est aussi dans la forme
              const cx = min.x + ni * cellSize.x
              const cy = min.y + nj * cellSize.y
              const cz = min.z + nk * cellSize.z
              if (!geom.isInsideShape(cx, cy, cz, geom)) continue;
              
              const weight = 1.0 / (1.0 + Math.sqrt(di*di + dj*dj + dk*dk))
              if (grid[idx] === -1) grid[idx] = val
              else grid[idx] = (grid[idx] * weightGrid[idx] + val * weight) / (weightGrid[idx] + weight)
              weightGrid[idx] += weight
            }
          }
        }
      }
    })

    const vMin = stats.minV, vRange = stats.maxV - vMin || 1
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 1.02, cellSize.y * 1.02, cellSize.z * 1.02)
    
    const instances: { pos: THREE.Vector3, col: THREE.Color }[] = []
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          const idx = i + j * gridSize + k * gridSize * gridSize
          if (grid[idx] !== -1) {
            const norm = (grid[idx] - vMin) / vRange
            const [r, g, b] = getIndustrialColor(norm)
            instances.push({
              pos: new THREE.Vector3(min.x + i * cellSize.x, min.y + j * cellSize.y, min.z + k * cellSize.z),
              col: new THREE.Color(r, g, b)
            })
          }
        }
      }
    }

    if (instances.length > 0) {
      const instMesh = new THREE.InstancedMesh(cubeGeo, new THREE.MeshPhongMaterial({
        transparent: false,
        shininess: 30,
        specular: new THREE.Color(0x111111)
      }), instances.length)
      
      const dummy = new THREE.Object3D()
      instances.forEach((inst, idx) => {
        dummy.position.copy(inst.pos)
        dummy.updateMatrix()
        instMesh.setMatrixAt(idx, dummy.matrix)
        instMesh.setColorAt(idx, inst.col)
      })
      group.add(instMesh)
    }
    scene.add(group)
  }, [data, activeVariable, quality, domainBounds, stats, getIndustrialColor, scenarioGeometry])

  const buildParticleCloud = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current)
    }
    const group = new THREE.Group()
    meshGroupRef.current = group
    if (!data.length) return

    const geom = scenarioGeometry;
    const positions = new Float32Array(data.length * 3)
    const colors = new Float32Array(data.length * 3)
    const sizes = new Float32Array(data.length)
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1

    let validCount = 0;
    data.forEach((p, i) => {
      // Filtrer les points hors de la forme géométrique
      if (!geom.isInsideShape(p.x, p.y, p.z, geom)) return;

      positions[validCount * 3] = p.x
      positions[validCount * 3 + 1] = p.y
      positions[validCount * 3 + 2] = p.z
      
      const val = (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0
      const norm = (val - vMin) / vRange
      const [r, g, b] = getIndustrialColor(norm)
      colors[validCount * 3] = r
      colors[validCount * 3 + 1] = g
      colors[validCount * 3 + 2] = b
      sizes[validCount] = 0.05 * (0.5 + norm * 0.5); // Taille proportionnelle à la valeur
      validCount++;
    })

    if (validCount === 0) return;

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, validCount * 3), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, validCount * 3), 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes.slice(0, validCount), 1))
    
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    })

    const points = new THREE.Points(geometry, material)
    group.add(points)
    scene.add(group)
  }, [data, activeVariable, stats, getIndustrialColor, scenarioGeometry])

  useEffect(() => {
    if (!isMounted || !visualizationRef.current || !data.length) return
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, visualizationRef.current.clientWidth / visualizationRef.current.clientHeight, 0.1, 1000)
    
    // Adapter la position caméra selon la forme géométrique
    const { min, max } = domainBounds;
    const size = new THREE.Vector3().subVectors(max, min);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (scenarioGeometry.shape === 'cylinder_horizontal') {
      // Vue latérale pour pipeline
      camera.position.set(0, maxDim * 0.8, maxDim * 2.0)
    } else if (scenarioGeometry.shape === 'cylinder_vertical') {
      // Vue 3/4 pour réservoir
      camera.position.set(maxDim * 2.0, maxDim * 0.8, maxDim * 2.0)
    } else {
      // Vue générale pour boîte/sphère
      camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 2.0)
    }
    camera.lookAt(domainBounds.center)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(visualizationRef.current.clientWidth, visualizationRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    visualizationRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0x666666))
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(10, 10, 10)
    scene.add(light)
    
    // Lumière supplémentaire pour mieux voir les formes
    const light2 = new THREE.DirectionalLight(0x4488ff, 0.5)
    light2.position.set(-10, -5, 10)
    scene.add(light2)

    // Build scenario outline (forme géométrique)
    buildScenarioOutline(scene)

    if (renderMode === 'volume') {
      buildMassiveVolume(scene)
    } else {
      buildParticleCloud(scene)
    }
    createScientificAxes(scene)

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
      requestAnimationFrame(animate)
      controlsRef.current?.update()
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
    animate()

    const handleResize = () => {
      if (!visualizationRef.current || !cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = visualizationRef.current.clientWidth / visualizationRef.current.clientHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(visualizationRef.current.clientWidth, visualizationRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (visualizationRef.current && rendererRef.current) {
        try { visualizationRef.current.removeChild(rendererRef.current.domElement) } catch (e) {}
      }
      rendererRef.current?.dispose()
    }
  }, [isMounted, data, buildMassiveVolume, buildParticleCloud, buildScenarioOutline, createScientificAxes, domainBounds, renderMode, scenarioGeometry])

  const getUnit = (v: string) => {
    if (v === 'temperature') return 'K'
    if (v.includes('pressure') || v.includes('stress') || v.includes('von_mises') || v.includes('sigma')) return 'MPa'
    if (v.includes('velocity')) return 'm/s'
    if (v === 'density') return 'kg/m³'
    return ''
  }

  const formatScaleValue = (v: number) => {
    if (Math.abs(v) > 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (Math.abs(v) > 1e3) return (v / 1e3).toFixed(2) + 'k'
    return v.toFixed(3)
  }

  if (isLoading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-[400px] md:h-[600px] bg-slate-950 rounded-[32px] border border-white/10 p-4 md:p-6">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 text-blue-500 animate-pulse mx-auto" />
          <p className="text-white font-bold">Chargement des données PINN...</p>
          <p className="text-gray-400 text-sm">Aucun point de données disponible</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-slate-950 rounded-[32px] border border-white/10 p-3 md:p-6 backdrop-blur-3xl relative shadow-2xl overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-600" />
      
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3 md:gap-4 z-10 mb-4 md:mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">
            <Activity className="w-3 h-3" /> TRULY-INDUSTRIAL V11
          </div>
          <h3 className="text-lg md:text-2xl font-black text-white tracking-tighter uppercase line-clamp-2">
            {title !== "INDUSTRIAL V11-GOLD STANDARD" ? title : (scenarioType?.replace(/_/g, ' ') || 'QUANTUM HYBRID PINN')}
          </h3>
          <p className="text-[8px] md:text-[9px] font-mono text-gray-500 uppercase tracking-widest">
            Physics-Informed Volumetric Engine — {scenarioGeometry.industrialDescription}
          </p>
          <p className="text-[7px] md:text-[8px] font-mono text-cyan-400/60 tracking-wider">
            Forme: {scenarioGeometry.shape.replace('_', ' ').toUpperCase()} | {scenarioGeometry.icon}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg md:rounded-xl border border-white/5 flex-wrap">
            {(['pressure', 'temperature', 'velocity_magnitude', 'von_mises'] as const).map(v => (
              <button key={v} onClick={() => setActiveVariable(v)} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all ${activeVariable === v ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>{v.replace(/_/g, ' ')}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRenderMode(renderMode === 'volume' ? 'particles' : 'volume')} className={`px-4 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all ${renderMode === 'particles' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
              {renderMode === 'volume' ? 'MODE VOLUME' : 'MODE PARTICULES'}
            </button>
            <button onClick={() => setShowAxes(!showAxes)} className={`p-2 rounded-lg border transition-all ${showAxes ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500'}`} title="Toggle Axes">
              <Box className="w-4 h-4" />
            </button>
            <ExportButtonsImproved containerRef={containerRef} canvasRef={rendererRef as any} fileName={title} jsonData={{ data, stats, scenarioType, activeVariable }} />
          </div>
        </div>
      </div>

      {/* Main Visualization Area - Mobile Responsive */}
      <div className="flex-1 w-full flex flex-col md:flex-row gap-3 md:gap-4 min-h-0 relative">
        <div ref={visualizationRef} className="flex-1 rounded-[24px] overflow-hidden border border-white/10 bg-black/20 relative min-h-[300px] md:min-h-[500px]" />
        
        {/* Scientific Scale Bar - Mobile Optimized */}
        <div className="w-full md:w-24 flex md:flex-col items-center justify-between md:justify-start py-3 md:py-4 px-4 md:px-0 bg-black/40 rounded-[24px] border border-white/5 relative backdrop-blur-md gap-2 md:gap-0">
          <div className="text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-widest mb-0 md:mb-2 text-center leading-tight">
            {formatScaleValue(stats.maxV)}
            <span className="block text-[7px] md:text-[8px] text-gray-500">{getUnit(activeVariable)}</span>
          </div>
          <div className="w-32 md:w-3 h-3 md:h-[calc(100%-60px)] bg-gradient-to-r md:bg-gradient-to-t from-blue-600 via-yellow-400 to-red-600 rounded-full border border-white/10" />
          <div className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0 md:mt-2 text-center leading-tight">
            {formatScaleValue(stats.minV)}
            <span className="block text-[7px] md:text-[8px] text-gray-500">{getUnit(activeVariable)}</span>
          </div>
        </div>
      </div>

      {/* Physical Dimension Bar - Mobile Optimized */}
      <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex items-end gap-2 bg-black/60 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-white/10 backdrop-blur-md z-20">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[7px] md:text-[8px] font-mono text-gray-400">
            <span>0</span>
            <span>{(domainBounds.max.x - domainBounds.min.x).toFixed(1)} mm</span>
          </div>
          <div className="w-24 md:w-32 h-1 md:h-1.5 bg-white/10 rounded-full overflow-hidden flex">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`} />
            ))}
          </div>
        </div>
        <div className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-tighter">Scale</div>
      </div>

      {/* Footer Metrics - Mobile Responsive Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-4 md:mt-6 z-10">
        {[
          { l: `Min ${activeVariable}`, v: `${formatScaleValue(stats.minV)}`, c: 'text-blue-400', i: Cpu },
          { l: `Max ${activeVariable}`, v: `${formatScaleValue(stats.maxV)}`, c: 'text-red-400', i: Activity },
          { l: 'Moyenne', v: `${formatScaleValue(stats.avgV)}`, c: 'text-emerald-400', i: Database },
          { l: 'Points Actifs', v: stats.count.toLocaleString(), c: 'text-white', i: ShieldCheck }
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
  )
}

export default Industrial3DVisualizerEnhancedV11
