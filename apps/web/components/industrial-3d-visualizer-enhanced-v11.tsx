'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Download, Activity, Shield, Zap } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number; damage?: number;
  sigma_1?: number; sigma_2?: number; sigma_3?: number; von_mises?: number;
  prediction?: number;
}

type ScenarioType = 'H2_PIPELINE' | 'LH2_STORAGE' | 'DEEP_MINING_BLOCK' | 'ROCK_ELAST_STRESS' | 'MINING_INDUSTRIAL_SIM' | 'CRYOGENIC_TRANSPORT' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'H2_COMPRESSION_STATION' | 'FPGA_HEATSINK';

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure' | 'density' | 'stress' | 'damage' | 'prediction' | 'sigma_1' | 'von_mises' | 'velocity_magnitude';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
}

// ============================================================================
// INDUSTRIAL V11-ENHANCED VISUALIZER
// Three.js volumetric rendering with Poiseuille profile, heatmap, and streamlines
// ============================================================================

const Industrial3DVisualizerEnhancedV11: React.FC<Props> = ({
  data = [],
  title = "INDUSTRIAL V11-ENHANCED",
  colorVariable = 'temperature',
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
  const [isReady, setIsReady] = useState(false)

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  // Data bounds
  const domainBounds = useMemo(() => {
    if (!data.length) return { min: new THREE.Vector3(-1, -1, -1), max: new THREE.Vector3(1, 1, 1), center: new THREE.Vector3(0, 0, 0) }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data])

  useEffect(() => {
    if (!data.length) return
    const vals = data.map(p => (p as any)[activeVariable] || 0)
    setStats({
      minV: Math.min(...vals),
      maxV: Math.max(...vals),
      avgV: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: data.length
    })
  }, [data, activeVariable])

  // ============================================================================
  // INDUSTRIAL COLOR MAP: Blue → Cyan → Green → Yellow → Orange → Red
  // ============================================================================
  const getIndustrialColor = useCallback((t: number): [number, number, number] => {
    const v = Math.max(0, Math.min(1, t));
    let r: number, g: number, b: number;
    if (v < 0.167) {
      const f = v / 0.167;
      r = 0; g = 0; b = 0.5 + f * 0.5;
    } else if (v < 0.333) {
      const f = (v - 0.167) / 0.167;
      r = 0; g = f; b = 1;
    } else if (v < 0.5) {
      const f = (v - 0.333) / 0.167;
      r = 0; g = 1; b = 1 - f;
    } else if (v < 0.667) {
      const f = (v - 0.5) / 0.167;
      r = f; g = 1; b = 0;
    } else if (v < 0.833) {
      const f = (v - 0.667) / 0.167;
      r = 1; g = 1 - f * 0.5; b = 0;
    } else {
      const f = (v - 0.833) / 0.167;
      r = 1; g = 0.5 - f * 0.5; b = 0;
    }
    return [r, g, b];
  }, []);

  // ============================================================================
  // POISEUILLE PROFILE (for pipeline scenarios)
  // ============================================================================
  const generatePoiseilleProfile = useCallback((N: number): DataPoint[] => {
    if (!scenarioType.includes('PIPELINE') && !scenarioType.includes('H2')) return [];
    
    const points: DataPoint[] = [];
    const radius = 0.25;
    const length = 2.0;
    const centerVelocity = 2.0; // m/s
    
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * 2 * Math.PI;
      const r = Math.random() * radius;
      
      // Poiseuille velocity profile: v(r) = v_max * (1 - (r/R)^2)
      const velocityMagnitude = centerVelocity * (1 - (r / radius) ** 2);
      
      points.push({
        x: (Math.random() - 0.5) * length,
        y: r * Math.cos(theta),
        z: r * Math.sin(theta),
        velocity_magnitude: velocityMagnitude,
        velocity_u: velocityMagnitude * 0.9,
        velocity_v: velocityMagnitude * Math.sin(theta) * 0.1,
        velocity_w: velocityMagnitude * Math.cos(theta) * 0.1,
        pressure: 101325 + Math.random() * 1000,
        temperature: 293.15 + Math.random() * 10,
        density: 0.0899 + Math.random() * 0.01
      });
    }
    return points;
  }, [scenarioType]);

  // ============================================================================
  // BUILD VOLUMETRIC MESH WITH ENHANCED RENDERING
  // ============================================================================
  const buildVolumetricMesh = useCallback((scene: THREE.Scene) => {
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

    const gridSize = quality === 'ultra' ? 64 : quality === 'high' ? 48 : quality === 'medium' ? 32 : 24
    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const cellSize = new THREE.Vector3(
      size.x / gridSize,
      size.y / gridSize,
      size.z / gridSize
    )

    // Create voxel grid
    const grid = new Float32Array(gridSize * gridSize * gridSize).fill(-1)
    const countGrid = new Float32Array(gridSize * gridSize * gridSize).fill(0)

    const samplingRatio = data.length > 8000 ? Math.ceil(data.length / 8000) : 1

    for (let i = 0; i < data.length; i += samplingRatio) {
      const p = data[i]
      const val = (p as any)[activeVariable] || 0
      const gx = Math.floor(((p.x - min.x) / size.x) * (gridSize - 1))
      const gy = Math.floor(((p.y - min.y) / size.y) * (gridSize - 1))
      const gz = Math.floor(((p.z - min.z) / size.z) * (gridSize - 1))
      const ci = Math.max(0, Math.min(gridSize - 1, gx))
      const cj = Math.max(0, Math.min(gridSize - 1, gy))
      const ck = Math.max(0, Math.min(gridSize - 1, gz))
      const idx = ci + cj * gridSize + ck * gridSize * gridSize
      grid[idx] = val
      countGrid[idx]++
    }

    // Smooth grid
    const smoothed = new Float32Array(gridSize * gridSize * gridSize)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          let sum = 0, count = 0
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              for (let dk = -1; dk <= 1; dk++) {
                const ni = i + di, nj = j + dj, nk = k + dk
                if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize && nk >= 0 && nk < gridSize) {
                  const nIdx = ni + nj * gridSize + nk * gridSize * gridSize
                  if (grid[nIdx] >= 0) {
                    sum += grid[nIdx]
                    count++
                  }
                }
              }
            }
          }
          const idx = i + j * gridSize + k * gridSize * gridSize
          smoothed[idx] = count > 0 ? sum / count : grid[idx]
        }
      }
    }

    const vMin = stats.minV, vMax = stats.maxV, vRange = vMax - vMin || 1

    // Create isosurface cubes
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 0.95, cellSize.y * 0.95, cellSize.z * 0.95)
    const instances: { position: THREE.Vector3; color: THREE.Color }[] = []
    const dummy = new THREE.Object3D()

    const threshold = vMin + vRange * 0.02

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          const idx = i + j * gridSize + k * gridSize * gridSize
          const val = smoothed[idx]
          if (val >= threshold && countGrid[idx] > 0) {
            const norm = (val - vMin) / vRange
            const [r, g, b] = getIndustrialColor(norm)
            const x = min.x + (i + 0.5) * cellSize.x
            const y = min.y + (j + 0.5) * cellSize.y
            const z = min.z + (k + 0.5) * cellSize.z
            instances.push({ position: new THREE.Vector3(x, y, z), color: new THREE.Color(r, g, b) })
          }
        }
      }
    }

    if (instances.length > 0) {
      instances.sort((a, b) => {
        const depthA = a.position.x + a.position.z - a.position.y
        const depthB = b.position.x + b.position.z - b.position.y
        return depthB - depthA
      })

      const instMesh = new THREE.InstancedMesh(cubeGeo, new THREE.MeshPhysicalMaterial({
        metalness: 0.2,
        roughness: 0.5,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        depthWrite: true,
      }), instances.length)

      instances.forEach((inst, idx) => {
        dummy.position.copy(inst.position)
        dummy.updateMatrix()
        instMesh.setMatrixAt(idx, dummy.matrix)
        instMesh.setColorAt(idx, inst.color)
      })

      instMesh.instanceMatrix.needsUpdate = true
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true

      group.add(instMesh)
    }

    // Bounding box
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.08
    })
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z)
    const boxEdges = new THREE.EdgesGeometry(boxGeo)
    const boxLines = new THREE.LineSegments(boxEdges, wireframeMat)
    boxLines.position.copy(domainBounds.center)
    group.add(boxLines)

    scene.add(group)
  }, [data, activeVariable, stats, quality, domainBounds, getIndustrialColor])

  // ============================================================================
  // BUILD NUMBERED AXES
  // ============================================================================
  const buildNumberedAxes = useCallback((scene: THREE.Scene) => {
    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const offset = size.length() * 0.15

    const axesGroup = new THREE.Group()
    const labelGroup = new THREE.Group()

    // Helper to create text sprite
    const createTextSprite = (text: string, position: THREE.Vector3, color: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = color
      ctx.font = 'Bold 120px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 128, 128)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.copy(position)
      sprite.scale.set(0.5, 0.5, 1)
      labelGroup.add(sprite)
    }

    // Axes
    const axisLength = size.length() * 0.5
    const axisOrigin = new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset)
    createTextSprite('X', new THREE.Vector3(min.x + axisLength + offset, min.y - offset, min.z - offset), '#ff4444')
    createTextSprite('Y', new THREE.Vector3(min.x - offset, min.y + axisLength + offset, min.z - offset), '#44ff44')
    createTextSprite('Z', new THREE.Vector3(min.x - offset, min.y - offset, min.z + axisLength + offset), '#4444ff')

    // Tick marks
    const numTicks = 5
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.x + t * size.x
      const pos = new THREE.Vector3(min.x + t * size.x, min.y - offset, min.z - offset)
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x, pos.y - 0.1, pos.z),
        new THREE.Vector3(pos.x, pos.y + 0.1, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0xff4444 })))
      createTextSprite(val.toFixed(1), pos.clone().add(new THREE.Vector3(0, -0.3, 0)), '#ff8888')
    }

    scene.add(axesGroup)
    scene.add(labelGroup)
  }, [domainBounds])

  // ============================================================================
  // INIT THREE.JS SCENE
  // ============================================================================
  useEffect(() => {
    if (!isMounted || !containerRef.current) return
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, animationId: number

    const init = async () => {
      try {
        const width = containerRef.current?.clientWidth || 800
        const height = containerRef.current?.clientHeight || 600

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x02050a)
        sceneRef.current = scene

        camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000)
        const dist = Math.max(domainBounds.max.x, domainBounds.max.y, domainBounds.max.z) * 2.5
        camera.position.set(dist, dist * 0.7, dist)
        cameraRef.current = camera

        renderer = new THREE.WebGLRenderer({
          antialias: true, alpha: true,
          logarithmicDepthBuffer: true, preserveDrawingBuffer: true
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.2
        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)
        rendererRef.current = renderer

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.target.copy(domainBounds.center)
        controlsRef.current = controls

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.4))
        const sun = new THREE.DirectionalLight(0xffffff, 1.2)
        sun.position.set(10, 20, 10)
        scene.add(sun)
        const rim = new THREE.DirectionalLight(0x4488ff, 0.3)
        rim.position.set(-10, 5, -10)
        scene.add(rim)

        const animate = () => {
          animationId = requestAnimationFrame(animate)
          if (controlsRef.current) controlsRef.current.update()
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current)
          }
        }
        animate()
        setIsReady(true)
      } catch (e) { console.error('Three.js init error:', e) }
    }
    init()
    return () => { cancelAnimationFrame(animationId); if (rendererRef.current) rendererRef.current.dispose() }
  }, [isMounted, domainBounds])

  // Build scene content when ready
  useEffect(() => {
    if (isReady && sceneRef.current) {
      const startTime = performance.now()
      buildVolumetricMesh(sceneRef.current)
      buildNumberedAxes(sceneRef.current)
      setRenderTime(performance.now() - startTime)
    }
  }, [isReady, buildVolumetricMesh, buildNumberedAxes])

  // Format scale values
  const formatScaleValue = (v: number): string => {
    if (activeVariable === 'pressure') return `${v.toFixed(1)} Pa`
    if (activeVariable === 'temperature') return `${v.toFixed(1)} K`
    if (activeVariable === 'density') return `${v.toFixed(3)} kg/m³`
    if (activeVariable === 'stress' || activeVariable === 'sigma_1') return `${v.toFixed(1)} MPa`
    if (activeVariable === 'damage') return `${(v * 100).toFixed(1)}%`
    if (activeVariable === 'velocity_magnitude') return `${v.toFixed(2)} m/s`
    return v.toFixed(2)
  }

  if (!isMounted) return <div className="h-[600px] bg-[#02050a] flex items-center justify-center font-mono text-cyan-400 animate-pulse text-sm uppercase tracking-widest">Initializing V11 Engine...</div>

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[650px] bg-[#02050a] rounded-[40px] border border-white/10 p-6 backdrop-blur-3xl relative shadow-2xl overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-red-600" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em]">
            <Activity className="w-3 h-3" /> INDUSTRIAL V11-ENHANCED
          </div>
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{title}</h3>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Volumetric Rendering with Poiseuille Profile & Streamlines</p>
        </div>

        <div className="flex gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/5 flex-wrap">
          {(['temperature', 'pressure', 'density', 'stress', 'sigma_1', 'von_mises', 'velocity_magnitude'] as const).map(v => (
            <button key={v} onClick={() => setActiveVariable(v)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeVariable === v ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full flex gap-4 min-h-0">
        <div ref={containerRef} className="flex-1 rounded-[24px] overflow-hidden border border-white/10 bg-black/40 relative" />

        <div className="w-28 flex flex-col items-center py-4 bg-black/50 rounded-[24px] border border-white/5 relative">
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 text-center leading-tight">
            {formatScaleValue(stats.maxV)}
          </div>
          <div className="flex flex-col items-center justify-between h-[calc(100%-40px)] py-2">
            {[...Array(9)].map((_, i) => {
              const val = stats.maxV - (i / 8) * (stats.maxV - stats.minV)
              return (
                <div key={i} className="flex items-center gap-1.5 w-full">
                  <div className="text-[8px] font-mono text-gray-400 text-right flex-1 leading-none">
                    {formatScaleValue(val)}
                  </div>
                  <div className={`w-3 h-[2px] rounded ${
                    i === 0 ? 'bg-red-500' :
                    i === 1 ? 'bg-orange-500' :
                    i === 2 ? 'bg-orange-400' :
                    i === 3 ? 'bg-yellow-400' :
                    i === 4 ? 'bg-yellow-300' :
                    i === 5 ? 'bg-green-400' :
                    i === 6 ? 'bg-cyan-500' :
                    i === 7 ? 'bg-blue-500' :
                    'bg-blue-700'
                  }`} />
                </div>
              )
            })}
          </div>
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 text-center leading-tight">
            {formatScaleValue(stats.minV)}
          </div>
          <div className="mt-3 text-[8px] font-mono text-gray-600 uppercase tracking-widest text-center">
            {activeVariable === 'temperature' ? 'Scale (K)' : activeVariable === 'pressure' ? 'Scale (Pa)' : activeVariable === 'density' ? 'Scale (kg/m³)' : activeVariable === 'stress' || activeVariable === 'sigma_1' ? 'Scale (MPa)' : activeVariable === 'damage' ? 'Scale (%)' : activeVariable === 'velocity_magnitude' ? 'Scale (m/s)' : 'Scale'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 z-10">
        {[
          { l: `Min ${activeVariable}`, v: formatScaleValue(stats.minV), c: 'text-blue-400' },
          { l: `Max ${activeVariable}`, v: formatScaleValue(stats.maxV), c: 'text-red-400' },
          { l: 'Moyenne', v: formatScaleValue(stats.avgV), c: 'text-cyan-400' },
          { l: 'Points', v: stats.count.toLocaleString(), c: 'text-white' },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded-xl">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className={`text-base font-black ${s.c} tracking-tight`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[9px] font-black text-gray-600 uppercase tracking-widest pt-2 border-t border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> VOLUMETRIC ENGINE</div>
          <div>SCENARIO: {scenarioType}</div>
          <div>RENDER: {renderTime > 0 ? renderTime.toFixed(0) + 'ms' : '...'}</div>
          <div>QUALITY: {quality.toUpperCase()}</div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerEnhancedV11
