'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Download, Maximize2, Database, Activity, Shield, Zap } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
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

// ============================================================================
// TRULY-INDUSTRIAL V10-ULTRA VISUALIZER
// Three.js volumetric rendering with continuous isosurfaces
// Standard industrial palette: Blue (cold) → Cyan → Green → Yellow → Orange → Red (hot)
// Numbered axes with real-world values
// Scale bar with values from bottom to top
// ============================================================================

const Industrial3DVisualizerV10Ultra: React.FC<Props> = ({
  data = [],
  title = "TRULY-INDUSTRIAL V10-ULTRA",
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
  const labelSpritesRef = useRef<THREE.Group | null>(null)

  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ minV: 0, maxV: 1, avgV: 0, count: 0 })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [renderTime, setRenderTime] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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
      // Blue to Dark Blue
      const f = v / 0.167;
      r = 0; g = 0; b = 0.5 + f * 0.5;
    } else if (v < 0.333) {
      // Dark Blue to Cyan
      const f = (v - 0.167) / 0.167;
      r = 0; g = f; b = 1;
    } else if (v < 0.5) {
      // Cyan to Green
      const f = (v - 0.333) / 0.167;
      r = 0; g = 1; b = 1 - f;
    } else if (v < 0.667) {
      // Green to Yellow
      const f = (v - 0.5) / 0.167;
      r = f; g = 1; b = 0;
    } else if (v < 0.833) {
      // Yellow to Orange
      const f = (v - 0.667) / 0.167;
      r = 1; g = 1 - f * 0.5; b = 0;
    } else {
      // Orange to Red
      const f = (v - 0.833) / 0.167;
      r = 1; g = 0.5 - f * 0.5; b = 0;
    }
    return [r, g, b];
  }, []);

  // ============================================================================
  // BUILD VOLUMETRIC MESH (Marching Cubes-like approach with isosurfaces)
  // ============================================================================
  const buildVolumetricMesh = useCallback((scene: THREE.Scene) => {
    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current)
      meshGroupRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }
    if (axesGroupRef.current) {
      scene.remove(axesGroupRef.current)
    }
    if (labelSpritesRef.current) {
      scene.remove(labelSpritesRef.current)
    }

    const group = new THREE.Group()
    meshGroupRef.current = group

    if (!data.length) return

    // Create a voxel grid from the data
    const gridSize = quality === 'ultra' ? 48 : quality === 'high' ? 32 : quality === 'medium' ? 24 : 16
    const { min, max } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)
    const cellSize = new THREE.Vector3(
      size.x / gridSize,
      size.y / gridSize,
      size.z / gridSize
    )

    // Sample data into grid
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

    // Smooth the grid (simple 3x3x3 box blur for contiguous surfaces)
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

    // Create isosurface cubes with industrial gradient coloring
    const cubeGeo = new THREE.BoxGeometry(cellSize.x * 0.95, cellSize.y * 0.95, cellSize.z * 0.95)
    const instancedMesh = new THREE.InstancedMesh(cubeGeo, new THREE.MeshPhysicalMaterial({
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    }), 0)

    const instances: { position: THREE.Vector3; color: THREE.Color }[] = []
    const dummy = new THREE.Object3D()

    // Determine threshold based on data density
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

    // Use additive blending for volumetric effect
    instancedMesh.count = instances.length
    const colorAttr = new Float32Array(instances.length * 3)
    const posAttr = new Float32Array(instances.length * 9)

    instances.forEach((inst, idx) => {
      const baseIdx = idx * 9
      const s = 0.95
      // Generate 6 faces (4 vertices each) - simplified to just set positions
      posAttr[baseIdx + 0] = inst.position.x - cellSize.x * s * 0.5
      posAttr[baseIdx + 1] = inst.position.y - cellSize.y * s * 0.5
      posAttr[baseIdx + 2] = inst.position.z - cellSize.z * s * 0.5
      posAttr[baseIdx + 3] = inst.position.x + cellSize.x * s * 0.5
      posAttr[baseIdx + 4] = inst.position.y - cellSize.y * s * 0.5
      posAttr[baseIdx + 5] = inst.position.z - cellSize.z * s * 0.5
      posAttr[baseIdx + 6] = inst.position.x + cellSize.x * s * 0.5
      posAttr[baseIdx + 7] = inst.position.y + cellSize.y * s * 0.5
      posAttr[baseIdx + 8] = inst.position.z + cellSize.z * s * 0.5
      colorAttr[idx * 3] = inst.color.r
      colorAttr[idx * 3 + 1] = inst.color.g
      colorAttr[idx * 3 + 2] = inst.color.b
    })

    // Use individual meshes grouped by color for proper rendering
    // Batch cubes into a single geometry for performance
    if (instances.length > 0) {
      // Sort by depth for transparency
      instances.sort((a, b) => {
        const depthA = a.position.x + a.position.z - a.position.y
        const depthB = b.position.x + b.position.z - b.position.y
        return depthB - depthA
      })

      // Create merged geometry from all cube instances
      const geometries: THREE.BoxGeometry[] = []
      const matrices: THREE.Matrix4[] = []
      const colors: THREE.Color[] = []

      instances.forEach(inst => {
        dummy.position.copy(inst.position)
        dummy.updateMatrix()
        matrices.push(dummy.matrix.clone())
        colors.push(inst.color)
      })

      // Use instanced mesh for performance
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

    // Add wireframe outline for structure
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.08
    })

    // Bounding box
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z)
    const boxEdges = new THREE.EdgesGeometry(boxGeo)
    const boxLines = new THREE.LineSegments(boxEdges, wireframeMat)
    boxLines.position.copy(domainBounds.center)
    group.add(boxLines)

    // Infrastructure: scenario-specific industrial geometry
    buildInfrastructure(scene, group)

    scene.add(group)
  }, [data, activeVariable, stats, quality, domainBounds, getIndustrialColor])

  // ============================================================================
  // INDUSTRIAL INFRASTRUCTURE
  // ============================================================================
  const buildInfrastructure = useCallback((scene: THREE.Scene, parentGroup: THREE.Group) => {
    const { min, max, center } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)

    const industrialMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2a3a,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      transmission: 0.5,
      thickness: 1.0
    })

    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.12
    })

    switch (scenarioType) {
      case 'H2_PIPELINE':
      case 'PIPELINE_SAFETY': {
        const curve = new THREE.LineCurve3(new THREE.Vector3(min.x, center.y, center.z), new THREE.Vector3(max.x, center.y, center.z))
        const tubeGeom = new THREE.TubeGeometry(curve, 128, size.y * 0.45, 64, false)
        parentGroup.add(new THREE.Mesh(tubeGeom, industrialMat))
        parentGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(tubeGeom), wireframeMat))
        break
      }
      case 'LH2_STORAGE':
      case 'CRYOGENIC_TRANSPORT': {
        const radius = Math.max(size.x, size.y, size.z) * 0.5
        const sphereGeom = new THREE.SphereGeometry(radius, 128, 128)
        const sphereMesh = new THREE.Mesh(sphereGeom, industrialMat)
        sphereMesh.position.copy(center)
        parentGroup.add(sphereMesh)
        parentGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(sphereGeom), wireframeMat))
        break
      }
      case 'MINING_INDUSTRIAL_SIM':
      case 'ROCK_ELAST_STRESS':
      case 'DEEP_MINING_BLOCK': {
        const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z)
        const boxMesh = new THREE.Mesh(boxGeom, industrialMat)
        boxMesh.position.copy(center)
        parentGroup.add(boxMesh)
        parentGroup.add(new THREE.BoxHelper(boxMesh, 0x00ffff))
        const galleryRadius = size.x * 0.15
        const galleryLength = size.z * 0.8
        const galleryCurve = new THREE.LineCurve3(
          new THREE.Vector3(center.x, center.y, center.z + galleryLength / 2),
          new THREE.Vector3(center.x, center.y, center.z - galleryLength / 2)
        )
        const galleryGeom = new THREE.TubeGeometry(galleryCurve, 64, galleryRadius, 32, false)
        const galleryMat = new THREE.MeshPhysicalMaterial({
          color: 0x332211, metalness: 0.3, roughness: 0.8,
          transparent: true, opacity: 0.25
        })
        parentGroup.add(new THREE.Mesh(galleryGeom, galleryMat))
        break
      }
      case 'H2_COMPRESSION_STATION': {
        const compressorCurve = new THREE.LineCurve3(
          new THREE.Vector3(min.x, center.y, center.z),
          new THREE.Vector3(center.x - 50, center.y, center.z)
        )
        const compressorGeom = new THREE.TubeGeometry(compressorCurve, 64, size.y * 0.3, 32, false)
        parentGroup.add(new THREE.Mesh(compressorGeom, industrialMat))
        const reservoirRadius = size.x * 0.3
        const sphereGeom = new THREE.SphereGeometry(reservoirRadius, 64, 64)
        const sphereMesh = new THREE.Mesh(sphereGeom, industrialMat)
        sphereMesh.position.set(center.x + 50, center.y, center.z)
        parentGroup.add(sphereMesh)
        break
      }
      case 'FPGA_HEATSINK': {
        const baseGeom = new THREE.BoxGeometry(size.x, size.y * 0.2, size.z)
        const baseMesh = new THREE.Mesh(baseGeom, industrialMat)
        baseMesh.position.set(center.x, min.y + size.y * 0.1, center.z)
        parentGroup.add(baseMesh)
        const numFins = 8
        const finThickness = size.x / (numFins * 2)
        const finHeight = size.y * 0.8
        for (let i = 0; i < numFins; i++) {
          const finGeom = new THREE.BoxGeometry(finThickness, finHeight, size.z)
          const finMesh = new THREE.Mesh(finGeom, industrialMat)
          const posX = min.x + (i * 2 + 1) * finThickness
          finMesh.position.set(posX, min.y + size.y * 0.6, center.z)
          parentGroup.add(finMesh)
        }
        break
      }
      default: {
        const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z)
        const boxMesh = new THREE.Mesh(boxGeom, industrialMat)
        boxMesh.position.copy(center)
        parentGroup.add(boxMesh)
        parentGroup.add(new THREE.BoxHelper(boxMesh, 0x00ffff))
      }
    }

    // Grid helper
    const grid = new THREE.GridHelper(Math.max(size.x, size.z) * 2, 40, 0x00ffff, 0x002222)
    grid.position.y = domainBounds.min.y - 0.02
    grid.material.opacity = 0.08
    grid.material.transparent = true
    parentGroup.add(grid)
  }, [domainBounds, scenarioType])

  // ============================================================================
  // NUMBERED AXES WITH REAL-WORLD VALUES
  // ============================================================================
  const buildNumberedAxes = useCallback((scene: THREE.Scene) => {
    if (axesGroupRef.current) {
      scene.remove(axesGroupRef.current)
    }
    if (labelSpritesRef.current) {
      scene.remove(labelSpritesRef.current)
    }

    const axesGroup = new THREE.Group()
    axesGroupRef.current = axesGroup

    const labelGroup = new THREE.Group()
    labelSpritesRef.current = labelGroup

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
    axesGroup.add(new THREE.Line(xAxisGeo, new THREE.LineBasicMaterial({ color: 0xff4444 })))

    // Y Axis (Green)
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset),
      new THREE.Vector3(min.x - offset, min.y + axisLength, min.z - offset)
    ])
    axesGroup.add(new THREE.Line(yAxisGeo, new THREE.LineBasicMaterial({ color: 0x44ff44 })))

    // Z Axis (Blue)
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset),
      new THREE.Vector3(min.x - offset, min.y - offset, min.z + axisLength)
    ])
    axesGroup.add(new THREE.Line(zAxisGeo, new THREE.LineBasicMaterial({ color: 0x4444ff })))

    // Create text sprites for axis labels
    const createTextSprite = (text: string, position: THREE.Vector3, color: string, fontSize: number = 36) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = `bold ${fontSize}px monospace`
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 128, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.position.copy(position)
      sprite.scale.set(0.8, 0.2, 1)
      labelGroup.add(sprite)
    }

    // Axis labels (X, Y, Z)
    const axisOrigin = new THREE.Vector3(min.x - offset, min.y - offset, min.z - offset)
    createTextSprite('X', new THREE.Vector3(min.x + axisLength + offset, min.y - offset, min.z - offset), '#ff4444')
    createTextSprite('Y', new THREE.Vector3(min.x - offset, min.y + axisLength + offset, min.z - offset), '#44ff44')
    createTextSprite('Z', new THREE.Vector3(min.x - offset, min.y - offset, min.z + axisLength + offset), '#4444ff')

    // Tick marks and values along X axis
    const numTicks = 5
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.x + t * size.x
      const pos = new THREE.Vector3(min.x + t * size.x, min.y - offset, min.z - offset)

      // Tick mark
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x, pos.y - 0.1, pos.z),
        new THREE.Vector3(pos.x, pos.y + 0.1, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0xff4444 })))

      // Value label
      createTextSprite(formatAxisValue(val), pos.clone().add(new THREE.Vector3(0, -0.3, 0)), '#ff8888', 28)
    }

    // Tick marks and values along Y axis
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.y + t * size.y
      const pos = new THREE.Vector3(min.x - offset, min.y + t * size.y, min.z - offset)

      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x - 0.1, pos.y, pos.z),
        new THREE.Vector3(pos.x + 0.1, pos.y, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x44ff44 })))

      createTextSprite(formatAxisValue(val), pos.clone().add(new THREE.Vector3(-0.4, 0, 0)), '#88ff88', 28)
    }

    // Tick marks and values along Z axis
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks
      const val = min.z + t * size.z
      const pos = new THREE.Vector3(min.x - offset, min.y - offset, min.z + t * size.z)

      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x, pos.y - 0.1, pos.z),
        new THREE.Vector3(pos.x, pos.y + 0.1, pos.z)
      ])
      axesGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x4444ff })))

      createTextSprite(formatAxisValue(val), pos.clone().add(new THREE.Vector3(0, -0.3, 0)), '#8888ff', 28)
    }

    scene.add(axesGroup)
    scene.add(labelGroup)
  }, [domainBounds])

  // Format axis values nicely
  const formatAxisValue = (val: number): string => {
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k'
    if (Math.abs(val) < 0.01) return val.toFixed(4)
    if (Math.abs(val) < 1) return val.toFixed(2)
    if (Math.abs(val) < 100) return val.toFixed(1)
    return Math.round(val).toString()
  }

  // ============================================================================
  // EXPORT FUNCTIONS
  // ============================================================================
  const exportToPNG = useCallback(async () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    setIsExporting(true)
    try {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      const canvas = rendererRef.current.domElement
      const dataURL = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `QuantumHybrid_V10_${scenarioType}_${new Date().toISOString().slice(0,10)}.png`
      link.href = dataURL
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) { console.error('Export PNG failed:', err) }
    finally { setIsExporting(false) }
  }, [scenarioType])

  const exportToJSON = useCallback(() => {
    try {
      const jsonData = {
        title, timestamp: new Date().toISOString(), scenario: scenarioType,
        colorVariable: activeVariable, pointCount: data.length,
        statistics: { minValue: stats.minV, maxValue: stats.maxV, avgValue: stats.avgV },
        data
      }
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }))
      link.download = `3d-data-v10-${scenarioType}-${Date.now()}.json`
      link.click()
    } catch (err) { console.error('Export JSON failed:', err) }
  }, [title, scenarioType, activeVariable, data, stats])

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

  // ============================================================================
  // SCALE BAR FORMAT
  // ============================================================================
  const formatScaleValue = (v: number): string => {
    if (activeVariable === 'pressure') return `${v.toFixed(1)} MPa`
    if (activeVariable === 'temperature') return `${v.toFixed(1)} K`
    if (activeVariable === 'density') return `${v.toFixed(2)} kg/m³`
    if (activeVariable === 'stress') return `${v.toFixed(1)} MPa`
    if (activeVariable === 'damage') return `${(v * 100).toFixed(1)}%`
    if (activeVariable === 'prediction') return `${v.toFixed(3)}`
    if (activeVariable === 'sigma_1') return `${v.toFixed(1)} MPa`
    if (activeVariable === 'von_mises') return `${v.toFixed(1)} MPa`
    return v.toFixed(2)
  }

  if (!isMounted) return <div className="h-[600px] bg-[#02050a] flex items-center justify-center font-mono text-cyan-400 animate-pulse text-sm uppercase tracking-widest">Initializing V10 Ultra Engine...</div>

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[650px] bg-[#02050a] rounded-[40px] border border-white/10 p-6 backdrop-blur-3xl relative shadow-2xl overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-red-600" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em]">
            <Activity className="w-3 h-3" /> TRULY-INDUSTRIAL V10-ULTRA
          </div>
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{title}</h3>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Physics-Informed Neural Network // Volumetric Isosurface Rendering</p>
        </div>

        <div className="flex gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/5 flex-wrap">
          {(['temperature', 'pressure', 'density', 'stress', 'damage', 'prediction', 'sigma_1', 'von_mises'] as const).map(v => (
            <button key={v} onClick={() => setActiveVariable(v)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeVariable === v ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Main visualization area with scale bar */}
      <div className="flex-1 w-full flex gap-4 min-h-0">
        <div ref={containerRef} className="flex-1 rounded-[24px] overflow-hidden border border-white/10 bg-black/40 relative" />

        {/* Scale Bar - Values from bottom to top */}
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
            {activeVariable === 'temperature' ? 'Scale (K)' : activeVariable === 'pressure' || activeVariable === 'stress' || activeVariable === 'sigma_1' || activeVariable === 'von_mises' ? 'Scale (MPa)' : activeVariable === 'density' ? 'Scale (kg/m³)' : activeVariable === 'damage' ? 'Scale (%)' : 'Scale'}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
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

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] font-black text-gray-600 uppercase tracking-widest pt-2 border-t border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> VOLUMETRIC ENGINE</div>
          <div>SCENARIO: {scenarioType}</div>
          <div>RENDER: {renderTime > 0 ? renderTime.toFixed(0) + 'ms' : '...'}</div>
          <div>QUALITY: {quality.toUpperCase()}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToPNG} disabled={isExporting} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/10 disabled:opacity-50">
            <Download className="w-3 h-3" /> PNG
          </button>
          <button onClick={exportToJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/10">
            <Database className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV10Ultra
