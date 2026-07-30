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
  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ minV: 0, maxV: 1, avgV: 0, count: 0 })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [showAxes, setShowAxes] = useState(true)
  const [renderMode, setRenderMode] = useState<'volume' | 'particles'>('volume')
  const [isLoading, setIsLoading] = useState(data.length === 0)

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const domainBounds = useMemo(() => {
    if (!data.length) return { min: new THREE.Vector3(-1, -1, -1), max: new THREE.Vector3(1, 1, 1), center: new THREE.Vector3(0, 0, 0) }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data])

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

    data.forEach(p => {
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
  }, [data, activeVariable, quality, domainBounds, stats, getIndustrialColor])

  useEffect(() => {
    if (!isMounted || !visualizationRef.current || !data.length) return
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, visualizationRef.current.clientWidth / visualizationRef.current.clientHeight, 0.1, 1000)
    camera.position.set(domainBounds.max.x * 2.5, domainBounds.max.y * 2.5, domainBounds.max.z * 2.5)
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
  }, [isMounted, data, buildMassiveVolume, buildParticleCloud, createScientificAxes, domainBounds, renderMode])

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

  const buildParticleCloud = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current)
    }
    const group = new THREE.Group()
    meshGroupRef.current = group
    if (!data.length) return

    const positions = new Float32Array(data.length * 3)
    const colors = new Float32Array(data.length * 3)
    const vMin = stats.minV, vRange = stats.maxV - vMin || 1

    data.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      
      const val = (p as any)[activeVariable] ?? (p as any)[activeVariable.replace(/_/g, '')] ?? 0
      const norm = (val - vMin) / vRange
      const [r, g, b] = getIndustrialColor(norm)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    })

    const points = new THREE.Points(geometry, material)
    group.add(points)
    scene.add(group)
  }, [data, activeVariable, stats, getIndustrialColor])

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
          <p className="text-[8px] md:text-[9px] font-mono text-gray-500 uppercase tracking-widest">Physics-Informed Volumetric Engine</p>
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
