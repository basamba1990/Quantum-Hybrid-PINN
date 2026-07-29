'use client'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Activity, Cpu, Database } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; density?: number;
  stress?: number; sigma_1?: number; von_mises?: number;
}

type ScenarioType = "H2_PIPELINE" | "LH2_STORAGE" | "DEEP_MINING_BLOCK" | "ROCK_ELAST_STRESS" | "H2_PIPELINE_STRATEGIC" | "FPGA_HEATSINK" | "PORT_ENERGY_OPTIMIZATION" | "PIPELINE_SAFETY" | "CRYOGENIC_TRANSPORT" | "MINING_INDUSTRIAL_SIM" | "H2_COMPRESSION_STATION";

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
}

const Industrial3DVisualizerEnhancedV11: React.FC<Props> = ({
  data = [],
  title = "INDUSTRIAL V11-GOLD STANDARD",
  colorVariable = 'pressure',
  quality = 'ultra',
  scenarioType = 'H2_PIPELINE'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<any>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ minV: 0, maxV: 1, avgV: 0, count: 0 })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [renderTime, setRenderTime] = useState(0)

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const domainBounds = useMemo(() => {
    if (!data.length) return { min: new THREE.Vector3(-1, -1, -1), max: new THREE.Vector3(1, 1, 1), center: new THREE.Vector3(0, 0, 0) }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data])

  useEffect(() => {
    if (!data.length) return
    const vals = data.map(p => (p as any)[activeVariable] ?? 0)
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

    // TRULY-INDUSTRIAL VOXEL DENSITY
    // KELLY SENECAL V2.1.7: Truly-industrial resolution (min 1000 points)
    const gridSize = quality === 'ultra' ? 100 : 60
    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const cellSize = new THREE.Vector3(size.x / gridSize, size.y / gridSize, size.z / gridSize)

    const grid = new Float32Array(gridSize * gridSize * gridSize).fill(-1)
    const weightGrid = new Float32Array(gridSize * gridSize * gridSize).fill(0)

    // KELLY SENECAL V2.1.7: Data Normalizer for Backend/Frontend formats
    const normalizedData = data.map(p => ({
      x: p.x, y: p.y, z: p.z,
      pressure: Number(p.pressure ?? (p as any).p ?? 0),
      temperature: Number(p.temperature ?? (p as any).temp ?? 0),
      velocity_magnitude: Number(p.velocity_magnitude ?? (p as any).velocityMagnitude ?? 0),
      velocity_u: Number(p.velocity_u ?? (p as any).velocityU ?? 0),
      velocity_v: Number(p.velocity_v ?? (p as any).velocityV ?? 0),
      velocity_w: Number(p.velocity_w ?? (p as any).velocityW ?? 0),
      von_mises: Number(p.von_mises ?? (p as any).vonMises ?? 0),
      sigma_1: Number(p.sigma_1 ?? (p as any).sigma1 ?? 0),
      damage: Number(p.damage ?? 0)
    }));

    // Splot data into grid with Gaussian-like splatting for "Full Volume"
    normalizedData.forEach(p => {
      const gx = Math.floor(((p.x - min.x) / size.x) * (gridSize - 1))
      const gy = Math.floor(((p.y - min.y) / size.y) * (gridSize - 1))
      const gz = Math.floor(((p.z - min.z) / size.z) * (gridSize - 1))
      
      const val = (p as any)[activeVariable] ?? 0
      
      // Splat to neighbors to ensure no holes
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          for (let dk = -1; dk <= 1; dk++) {
            const ni = gx + di, nj = gy + dj, nk = gz + dk
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize && nk >= 0 && nk < gridSize) {
              const idx = ni + nj * gridSize + nk * gridSize * gridSize
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
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 1.05, cellSize.y * 1.05, cellSize.z * 1.05) // Overlap to prevent gaps
    
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
              color: new THREE.Color(r, g, b)
            })
          }
        }
      }
    }

    if (instances.length > 0) {
      const instMesh = new THREE.InstancedMesh(cubeGeo, new THREE.MeshPhongMaterial({
        transparent: false, // Truly massive, no transparency holes
        shininess: 50,
        specular: new THREE.Color(0x222222)
      }), instances.length)
      
      const dummy = new THREE.Object3D()
      instances.forEach((inst, idx) => {
        dummy.position.copy(inst.pos)
        dummy.updateMatrix()
        instMesh.setMatrixAt(idx, dummy.matrix)
        instMesh.setColorAt(idx, inst.color)
      })
      group.add(instMesh)
    }
    scene.add(group)
  }, [data, activeVariable, quality, domainBounds, stats, getIndustrialColor])

  useEffect(() => {
    if (!isMounted || !containerRef.current || !data.length) return
    const start = performance.now()
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050505)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000)
    camera.position.set(domainBounds.max.x * 2, domainBounds.max.y * 2, domainBounds.max.z * 2)
    camera.lookAt(domainBounds.center)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0x444444))
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(10, 10, 10)
    scene.add(light)

    buildMassiveVolume(scene)

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
      requestAnimationFrame(animate)
      controlsRef.current?.update()
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
    animate()

    setRenderTime(performance.now() - start)

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current && rendererRef.current) containerRef.current.removeChild(rendererRef.current.domElement)
      rendererRef.current?.dispose()
    }
  }, [isMounted, data, buildMassiveVolume, domainBounds])

  const formatScaleValue = (v: number) => {
    if (Math.abs(v) > 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (Math.abs(v) > 1e3) return (v / 1e3).toFixed(2) + 'k'
    return v.toFixed(2)
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/50 rounded-[40px] border border-white/10 p-6 backdrop-blur-3xl relative shadow-2xl overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-red-600" />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em]">
            <Activity className="w-3 h-3" /> TRULY-INDUSTRIAL V11-GOLD
          </div>
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{title !== "INDUSTRIAL V11-GOLD STANDARD" ? title : (scenarioType?.replace(/_/g, ' ') || 'QUANTUM HYBRID PINN')}</h3>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Truly-Massive Volumetric Voxel Engine</p>
        </div>
        <div className="flex gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/5 flex-wrap">
          {(['pressure', 'temperature', 'velocity_magnitude', 'stress', 'von_mises', 'density'] as const).map(v => (
            <button key={v} onClick={() => setActiveVariable(v)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeVariable === v ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 w-full flex gap-4 min-h-0">
        <div ref={containerRef} className="flex-1 rounded-[24px] overflow-hidden border border-white/10 bg-black/40 relative" />
        <div className="w-28 flex flex-col items-center py-4 bg-black/50 rounded-[24px] border border-white/5 relative">
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 text-center leading-tight">{formatScaleValue(stats.maxV)}</div>
          <div className="flex flex-col items-center justify-between h-[calc(100%-40px)] py-2">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 w-full">
                <div className="text-[8px] font-mono text-gray-400 text-right flex-1 leading-none">{formatScaleValue(stats.maxV - (i/8)*(stats.maxV-stats.minV))}</div>
                <div className={`w-3 h-[2px] rounded ${i === 0 ? 'bg-red-500' : i === 8 ? 'bg-blue-700' : 'bg-yellow-400'}`} />
              </div>
            ))}
          </div>
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 text-center leading-tight">{formatScaleValue(stats.minV)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 z-10">
        {[
          { l: `Min ${activeVariable} (${activeVariable === 'temperature' ? 'K' : activeVariable.includes('stress') || activeVariable.includes('von_mises') ? 'MPa' : 'Pa'})`, v: formatScaleValue(stats.minV), c: 'text-blue-400', i: Cpu },
          { l: `Max ${activeVariable} (${activeVariable === 'temperature' ? 'K' : activeVariable.includes('stress') || activeVariable.includes('von_mises') ? 'MPa' : 'Pa'})`, v: formatScaleValue(stats.maxV), c: 'text-red-400', i: Activity },
          { l: 'Moyenne Physique', v: formatScaleValue(stats.avgV), c: 'text-cyan-400', i: Database },
          { l: 'Points PINN Actifs', v: stats.count.toLocaleString(), c: 'text-white', i: ShieldCheck }
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded-xl flex items-center gap-3">
            <s.i className="w-4 h-4 text-gray-600" />
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{s.l}</p>
              <p className={`text-base font-black ${s.c} tracking-tight`}>{s.v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
  )
}

export default Industrial3DVisualizerEnhancedV11
