'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Download, Maximize2, Database, Activity, Shield, Zap } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number;
  damage?: number;
  prediction?: number;
  sigma_1?: number;
  sigma_2?: number;
  sigma_3?: number;
  von_mises?: number;
}

type ScenarioType = 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION' | 'FPGA_HEATSINK' | 'DEEP_MINING_BLOCK';

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure' | 'density' | 'stress' | 'damage' | 'prediction' | 'sigma_1' | 'von_mises';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
}

// Unit mapping for different physical variables
const UNIT_MAP: Record<string, { unit: string; min: number; max: number }> = {
  temperature: { unit: 'K', min: 273.15, max: 500 },
  pressure: { unit: 'MPa', min: 0, max: 300 },
  density: { unit: 'kg/m³', min: 0, max: 3000 },
  stress: { unit: 'MPa', min: 0, max: 200 },
  damage: { unit: 'ratio', min: 0, max: 1 },
  prediction: { unit: 'score', min: 0, max: 1 },
  sigma_1: { unit: 'MPa', min: 0, max: 300 },
  von_mises: { unit: 'MPa', min: 0, max: 250 }
}

const IndustrialTrulyOperational: React.FC<Props> = ({
  data = [],
  title = "TRULY-OPERATIONAL V11-GOLD",
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
  const axesGroupRef = useRef<THREE.Group | null>(null)
  const colorbarRef = useRef<HTMLCanvasElement | null>(null)

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

  // Industrial color map
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

  // Build volumetric mesh
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

    const gridSize = quality === 'ultra' ? 48 : quality === 'high' ? 32 : quality === 'medium' ? 24 : 16
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

    // Create instanced mesh
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 0.95, cellSize.y * 0.95, cellSize.z * 0.95)
    const instances: { position: THREE.Vector3; color: THREE.Color }[] = []
    const dummy = new THREE.Object3D()

    const threshold = vMin + vRange * 0.05

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

  // Build numbered axes
  const buildNumberedAxes = useCallback((scene: THREE.Scene) => {
    if (axesGroupRef.current) {
      scene.remove(axesGroupRef.current)
    }

    const axesGroup = new THREE.Group()
    axesGroupRef.current = axesGroup

    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const maxDim = Math.max(size.x, size.y, size.z)
    const axisLength = maxDim * 1.3
    const offset = maxDim * 0.05

    // X Axis (Red)
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset),
      new THREE.Vector3(min.x + axisLength, min.y - offset, min.z - offset)
    ])
    axesGroup.add(new THREE.Line(xAxisGeo, new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 })))

    // Y Axis (Green)
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset),
      new THREE.Vector3(min.x - offset, min.y + axisLength, min.z - offset)
    ])
    axesGroup.add(new THREE.Line(yAxisGeo, new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 })))

    // Z Axis (Blue)
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset),
      new THREE.Vector3(min.x - offset, min.y - offset, min.z + axisLength)
    ])
    axesGroup.add(new THREE.Line(zAxisGeo, new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 })))

    // Tick marks and labels
    const numTicks = 5
    const createTextSprite = (text: string, position: THREE.Vector3, color: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = 'bold 36px monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 128, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.position.copy(position)
      sprite.scale.set(0.8, 0.2, 1)
      axesGroup.add(sprite)
    }

    // X axis ticks
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

    // Y axis ticks
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.y + t * size.y
      const pos = new THREE.Vector3(min.x - offset, min.y + t * size.y, min.z - offset)
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x - 0.1, pos.y, pos.z),
        new THREE.Vector3(pos.x + 0.1, pos.y, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x44ff44 })))
      createTextSprite(val.toFixed(1), pos.clone().add(new THREE.Vector3(-0.4, 0, 0)), '#88ff88')
    }

    // Z axis ticks
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.z + t * size.z
      const pos = new THREE.Vector3(min.x - offset, min.y - offset, min.z + t * size.z)
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x, pos.y - 0.1, pos.z),
        new THREE.Vector3(pos.x, pos.y + 0.1, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x4444ff })))
      createTextSprite(val.toFixed(1), pos.clone().add(new THREE.Vector3(0, -0.3, 0)), '#8888ff')
    }

    scene.add(axesGroup)
  }, [domainBounds])

  // Initialize Three.js scene
  useEffect(() => {
    if (!isMounted || !containerRef.current || !data.length) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0a)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000)
    const { center } = domainBounds
    camera.position.set(center.x + 50, center.y + 50, center.z + 50)
    camera.lookAt(center)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = false
    controlsRef.current = controls

    // Build mesh and axes
    buildVolumetricMesh(scene)
    buildNumberedAxes(scene)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    setIsReady(true)

    return () => {
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [isMounted, data, domainBounds, buildVolumetricMesh, buildNumberedAxes])

  if (!data.length) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950 rounded-[32px] border border-white/10 text-center p-8 space-y-6">
        <div className="text-emerald-600">
          <p className="text-xl font-bold">Aucune donnée de simulation disponible</p>
          <p className="text-sm text-gray-500 mt-2">Lancez une analyse PINN pour générer les visualisations avancées.</p>
        </div>
      </div>
    )
  }

  const unitInfo = UNIT_MAP[activeVariable] || { unit: 'N/A', min: 0, max: 1 }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Variable Active</p>
            <p className="text-lg font-bold text-white">{activeVariable} ({unitInfo.unit})</p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Min / Max</p>
            <p className="text-lg font-bold text-emerald-400">{stats.minV.toFixed(2)} / {stats.maxV.toFixed(2)} {unitInfo.unit}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Moyenne</p>
            <p className="text-lg font-bold text-blue-400">{stats.avgV.toFixed(2)} {unitInfo.unit}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Points</p>
            <p className="text-lg font-bold text-purple-400">{stats.count.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[600px] rounded-[24px] border border-white/10 bg-black/40 overflow-hidden" />

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Scénario</p>
          <p className="text-sm font-bold text-white">{scenarioType}</p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Qualité de Rendu</p>
          <p className="text-sm font-bold text-white">{quality.toUpperCase()}</p>
        </div>
      </div>
    </div>
  )
}

export default IndustrialTrulyOperational
