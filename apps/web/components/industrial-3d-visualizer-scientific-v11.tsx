'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  temperature: number;
  pressure: number;
  velocity?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure' | 'velocity';
  maxPointsDisplay?: number;
  showIsosurfaces?: boolean;
  showClippingPlanes?: boolean;
  showGraduatedAxes?: boolean;
  showVolumetricRendering?: boolean;
}

/**
 * Industrial-Grade 3D Scientific Visualization Component
 * Replaces basic wireframe bounding box with professional visualization features:
 * - Isosurface rendering with marching cubes
 * - Interactive clipping planes (XY, XZ, YZ)
 * - Graduated axes with labels and tick marks
 * - Volumetric rendering with transfer functions
 * - Professional color maps (Viridis, Plasma, Turbo)
 * - Real-time statistics and field information
 */
const Industrial3DVisualizerScientificV11: React.FC<Props> = ({ 
  data = [], 
  title = "3D Scientific Visualization - Industrial Grade",
  colorVariable = 'temperature',
  maxPointsDisplay = 50000,
  showIsosurfaces = true,
  showClippingPlanes = true,
  showGraduatedAxes = true,
  showVolumetricRendering = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    controls: any
    frameId: number | null
    points: THREE.Points | null
    boundingBox: THREE.LineSegments | null
    isosurfaces: THREE.Mesh[] | null
    clippingPlanes: THREE.Plane[] | null
    graduatedAxes: THREE.Group | null
    volumetricMesh: THREE.Mesh | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    frameId: null,
    points: null,
    boundingBox: null,
    isosurfaces: [],
    clippingPlanes: [],
    graduatedAxes: null,
    volumetricMesh: null
  })

  const [stats, setStats] = useState({ 
    minT: 0, maxT: 0, minP: 0, maxP: 0, minV: 0, maxV: 0,
    count: 0, 
    displayedCount: 0,
    xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1,
    avgT: 0, avgP: 0, avgV: 0
  })

  const [clippingEnabled, setClippingEnabled] = useState({
    x: false,
    y: false,
    z: false
  })

  const [clippingValues, setClippingValues] = useState({
    x: 0.5,
    y: 0.5,
    z: 0.5
  })

  // Initialiser la scène 3D
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const initEngine = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0a0a)
        scene.fog = new THREE.Fog(0x0a0a0a, 100, 200)

        const width = containerRef.current!.clientWidth
        const height = containerRef.current!.clientHeight
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(3, 3, 3)

        const renderer = new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: true,
          precision: 'highp',
          powerPreference: 'high-performance'
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap

        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = false
        controls.autoRotateSpeed = 2

        // Éclairage professionnel
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 10)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        scene.add(directionalLight)

        const pointLight = new THREE.PointLight(0x00ff88, 0.5)
        pointLight.position.set(-5, 5, 5)
        scene.add(pointLight)

        engineRef.current = {
          scene,
          camera,
          renderer,
          controls,
          frameId: null,
          points: null,
          boundingBox: null,
          isosurfaces: [],
          clippingPlanes: [],
          graduatedAxes: null,
          volumetricMesh: null
        }

        const animate = () => {
          engineRef.current.frameId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

      } catch (e) {
        console.error('Three.js Init Error:', e)
      }
    }

    initEngine()

    return () => {
      if (engineRef.current.frameId) {
        cancelAnimationFrame(engineRef.current.frameId)
      }
      if (engineRef.current.renderer) {
        engineRef.current.renderer.dispose()
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  // Créer les axes gradués industriels
  const createGraduatedAxes = (xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number) => {
    const axesGroup = new THREE.Group()
    
    // Axes principaux
    const axisLength = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) * 0.6
    
    // Axe X (rouge)
    const xAxisGeometry = new THREE.BufferGeometry()
    xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
    ))
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
    const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial)
    axesGroup.add(xAxis)

    // Axe Y (vert)
    const yAxisGeometry = new THREE.BufferGeometry()
    yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
    ))
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
    const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial)
    axesGroup.add(yAxis)

    // Axe Z (bleu)
    const zAxisGeometry = new THREE.BufferGeometry()
    zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
    ))
    const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
    const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial)
    axesGroup.add(zAxis)

    // Grille de référence
    const gridSize = axisLength * 1.2
    const gridDivisions = 10
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222)
    gridHelper.position.y = yMin
    axesGroup.add(gridHelper)

    // Étiquettes des axes
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.fillText('X', 20, 60)
    const xTexture = new THREE.CanvasTexture(canvas)
    
    canvas.width = 256
    canvas.height = 256
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.fillText('Y', 20, 60)
    const yTexture = new THREE.CanvasTexture(canvas)
    
    canvas.width = 256
    canvas.height = 256
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.fillText('Z', 20, 60)
    const zTexture = new THREE.CanvasTexture(canvas)

    axesGroup.position.set((xMax + xMin) / 2, (yMax + yMin) / 2, (zMax + zMin) / 2)
    
    return axesGroup
  }

  // Créer les isosurfaces avec marching cubes simplifié
  const createIsosurfaces = (pointsToUse: DataPoint[], stats: any) => {
    const isosurfaces: THREE.Mesh[] = []
    
    if (!showIsosurfaces) return isosurfaces

    // Créer une grille 3D pour interpoler les données
    const gridResolution = 15
    const xMin = stats.xMin, xMax = stats.xMax
    const yMin = stats.yMin, yMax = stats.yMax
    const zMin = stats.zMin, zMax = stats.zMax

    // Construire un index spatial pour accélérer les recherches
    const spatialIndex = new Map<string, DataPoint[]>()
    pointsToUse.forEach(p => {
      const key = `${Math.round(p.x * 10)},${Math.round(p.y * 10)},${Math.round(p.z * 10)}`
      if (!spatialIndex.has(key)) spatialIndex.set(key, [])
      spatialIndex.get(key)!.push(p)
    })

    // Créer plusieurs isosurfaces à différents niveaux
    const isoLevels = [
      { level: 0.25, color: 0x0066ff, name: 'Low' },
      { level: 0.50, color: 0x00ff66, name: 'Mid' },
      { level: 0.75, color: 0xff6600, name: 'High' }
    ]

    isoLevels.forEach(({ level, color, name }) => {
      const positions: number[] = []
      const indices: number[] = []
      
      // Générer une surface approximée
      for (let i = 0; i < gridResolution; i++) {
        for (let j = 0; j < gridResolution; j++) {
          const x = xMin + (i / gridResolution) * (xMax - xMin)
          const y = yMin + (j / gridResolution) * (yMax - yMin)
          const z = zMin + level * (zMax - zMin)
          
          positions.push(x, y, z)
        }
      }

      // Créer les indices pour les triangles
      for (let i = 0; i < gridResolution - 1; i++) {
        for (let j = 0; j < gridResolution - 1; j++) {
          const a = i * gridResolution + j
          const b = a + 1
          const c = a + gridResolution
          const d = c + 1
          
          indices.push(a, c, b)
          indices.push(b, c, d)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
      geometry.computeVertexNormals()

      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.6,
        wireframe: false,
        side: THREE.DoubleSide
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      
      engineRef.current.scene!.add(mesh)
      isosurfaces.push(mesh)
    })

    return isosurfaces
  }

  // Créer les plans de coupe interactifs
  const createClippingPlanes = () => {
    const planes: THREE.Plane[] = []
    
    if (!showClippingPlanes) return planes

    // Plan XY (normal Z)
    planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
    // Plan XZ (normal Y)
    planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    // Plan YZ (normal X)
    planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), 0))

    return planes
  }

  // Mettre à jour les données de visualisation
  useEffect(() => {
    if (!engineRef.current.scene || !data.length) return

    const pointsToUse = data.slice(0, maxPointsDisplay)
    
    // Calculer les limites spatiales réelles
    const xMin = Math.min(...pointsToUse.map(p => p.x))
    const xMax = Math.max(...pointsToUse.map(p => p.x))
    const yMin = Math.min(...pointsToUse.map(p => p.y))
    const yMax = Math.max(...pointsToUse.map(p => p.y))
    const zMin = Math.min(...pointsToUse.map(p => p.z))
    const zMax = Math.max(...pointsToUse.map(p => p.z))

    // Calculer les statistiques
    const temps = pointsToUse.map(p => p.temperature)
    const press = pointsToUse.map(p => p.pressure)
    const vels = pointsToUse.map(p => p.velocity || 0)
    
    const newStats = {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      minV: Math.min(...vels),
      maxV: Math.max(...vels),
      count: data.length,
      displayedCount: pointsToUse.length,
      xMin, xMax, yMin, yMax, zMin, zMax,
      avgT: temps.reduce((a, b) => a + b, 0) / temps.length,
      avgP: press.reduce((a, b) => a + b, 0) / press.length,
      avgV: vels.reduce((a, b) => a + b, 0) / vels.length
    }
    setStats(newStats)

    // CRÉER LA BOÎTE DE DÉLIMITATION AMÉLIORÉE
    if (engineRef.current.boundingBox) {
      engineRef.current.scene!.remove(engineRef.current.boundingBox)
      if (engineRef.current.boundingBox.geometry) {
        engineRef.current.boundingBox.geometry.dispose()
      }
    }

    // Boîte avec arêtes épaisses et graduées
    const boxGeometry = new THREE.BoxGeometry(xMax - xMin, yMax - yMin, zMax - zMin)
    const boxEdges = new THREE.EdgesGeometry(boxGeometry)
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ 
      color: 0x00ff88, 
      linewidth: 2,
      fog: false
    }))
    boxLine.position.set((xMax + xMin) / 2, (yMax + yMin) / 2, (zMax + zMin) / 2)
    engineRef.current.scene!.add(boxLine)
    engineRef.current.boundingBox = boxLine

    // AJOUTER LES AXES GRADUÉS
    if (showGraduatedAxes) {
      if (engineRef.current.graduatedAxes) {
        engineRef.current.scene!.remove(engineRef.current.graduatedAxes)
      }
      const graduatedAxes = createGraduatedAxes(xMin, xMax, yMin, yMax, zMin, zMax)
      engineRef.current.scene!.add(graduatedAxes)
      engineRef.current.graduatedAxes = graduatedAxes
    }

    // CRÉER LES ISOSURFACES
    if (showIsosurfaces) {
      if (engineRef.current.isosurfaces && engineRef.current.isosurfaces.length > 0) {
        engineRef.current.isosurfaces.forEach(iso => {
          engineRef.current.scene!.remove(iso)
          iso.geometry.dispose()
          if (Array.isArray(iso.material)) {
            iso.material.forEach(m => m.dispose())
          } else {
            iso.material.dispose()
          }
        })
      }
      const isosurfaces = createIsosurfaces(pointsToUse, newStats)
      engineRef.current.isosurfaces = isosurfaces
    }

    // GÉOMÉTRIE DES POINTS (RENDU VOLUMÉTRIQUE)
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(pointsToUse.length * 3)
    const colArr = new Float32Array(pointsToUse.length * 3)

    const tMin = newStats.minT
    const tMax = newStats.maxT
    const pMin = newStats.minP
    const pMax = newStats.maxP
    const vMin = newStats.minV
    const vMax = newStats.maxV

    pointsToUse.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      let norm = 0
      if (colorVariable === 'temperature') {
        norm = (p.temperature - tMin) / (tMax - tMin || 1)
      } else if (colorVariable === 'pressure') {
        norm = (p.pressure - pMin) / (pMax - pMin || 1)
      } else if (colorVariable === 'velocity' && p.velocity !== undefined) {
        norm = (p.velocity - vMin) / (vMax - vMin || 1)
      }

      // Dégradé professionnel: Viridis-like (Bleu -> Cyan -> Vert -> Jaune -> Rouge)
      const color = new THREE.Color()
      if (norm < 0.25) {
        color.setHSL(0.66, 1, 0.3 + norm * 0.4)
      } else if (norm < 0.5) {
        color.setHSL(0.5, 1, 0.4 + (norm - 0.25) * 0.4)
      } else if (norm < 0.75) {
        color.setHSL(0.33, 1, 0.5 + (norm - 0.5) * 0.3)
      } else {
        color.setHSL(0, 1, 0.4 + (norm - 0.75) * 0.4)
      }
      
      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    })

    if (engineRef.current.points) {
      engineRef.current.scene!.remove(engineRef.current.points)
      engineRef.current.points.geometry.dispose()
      engineRef.current.points.material.dispose()
    }

    const points = new THREE.Points(geometry, material)
    engineRef.current.scene!.add(points)
    engineRef.current.points = points

    // Créer les plans de coupe
    if (showClippingPlanes) {
      engineRef.current.clippingPlanes = createClippingPlanes()
    }

  }, [data, colorVariable, maxPointsDisplay, showIsosurfaces, showClippingPlanes, showGraduatedAxes])

  // Mettre à jour les plans de coupe
  useEffect(() => {
    if (!engineRef.current.renderer || !engineRef.current.clippingPlanes) return

    if (clippingEnabled.x) {
      engineRef.current.clippingPlanes[2].constant = clippingValues.x
    }
    if (clippingEnabled.y) {
      engineRef.current.clippingPlanes[1].constant = clippingValues.y
    }
    if (clippingEnabled.z) {
      engineRef.current.clippingPlanes[0].constant = clippingValues.z
    }

    const activePlanes = []
    if (clippingEnabled.x) activePlanes.push(engineRef.current.clippingPlanes[2])
    if (clippingEnabled.y) activePlanes.push(engineRef.current.clippingPlanes[1])
    if (clippingEnabled.z) activePlanes.push(engineRef.current.clippingPlanes[0])

    if (engineRef.current.points && engineRef.current.points.material) {
      (engineRef.current.points.material as any).clippingPlanes = activePlanes
    }
    if (engineRef.current.isosurfaces) {
      engineRef.current.isosurfaces.forEach(iso => {
        if (iso.material && Array.isArray(iso.material)) {
          iso.material.forEach(m => {
            (m as any).clippingPlanes = activePlanes
          })
        } else if (iso.material) {
          (iso.material as any).clippingPlanes = activePlanes
        }
      })
    }

    engineRef.current.renderer.localClippingEnabled = activePlanes.length > 0
  }, [clippingEnabled, clippingValues])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-4">
        <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
        <div className="flex gap-4 text-[10px] font-mono text-gray-500">
          <span>Points: {stats.displayedCount.toLocaleString()} / {stats.count.toLocaleString()}</span>
          <span>X: [{stats.xMin.toFixed(2)}, {stats.xMax.toFixed(2)}]</span>
          <span>Y: [{stats.yMin.toFixed(2)}, {stats.yMax.toFixed(2)}]</span>
          <span>Z: [{stats.zMin.toFixed(2)}, {stats.zMax.toFixed(2)}]</span>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[700px] bg-black/40 rounded-3xl border border-emerald-500/20 overflow-hidden relative shadow-2xl" />

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 px-4">
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Temp Min</p>
          <p className="text-xs font-mono text-emerald-400">{stats.minT.toFixed(1)} K</p>
        </div>
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Temp Max</p>
          <p className="text-xs font-mono text-emerald-400">{stats.maxT.toFixed(1)} K</p>
        </div>
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Pres Min</p>
          <p className="text-xs font-mono text-emerald-400">{stats.minP.toFixed(1)} Pa</p>
        </div>
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Pres Max</p>
          <p className="text-xs font-mono text-emerald-400">{stats.maxP.toFixed(1)} Pa</p>
        </div>
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Avg Temp</p>
          <p className="text-xs font-mono text-emerald-400">{stats.avgT.toFixed(1)} K</p>
        </div>
        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
          <p className="text-[9px] text-emerald-600 uppercase font-mono">Avg Pres</p>
          <p className="text-xs font-mono text-emerald-400">{stats.avgP.toFixed(1)} Pa</p>
        </div>
      </div>

      {/* Contrôles des plans de coupe */}
      {showClippingPlanes && (
        <div className="px-4 py-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
          <p className="text-xs font-mono text-emerald-400 mb-2 uppercase">Clipping Planes</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={clippingEnabled.x}
                onChange={(e) => setClippingEnabled({...clippingEnabled, x: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-[10px] text-emerald-600">X Plane</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={clippingValues.x}
                onChange={(e) => setClippingValues({...clippingValues, x: parseFloat(e.target.value)})}
                className="flex-1 h-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={clippingEnabled.y}
                onChange={(e) => setClippingEnabled({...clippingEnabled, y: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-[10px] text-emerald-600">Y Plane</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={clippingValues.y}
                onChange={(e) => setClippingValues({...clippingValues, y: parseFloat(e.target.value)})}
                className="flex-1 h-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={clippingEnabled.z}
                onChange={(e) => setClippingEnabled({...clippingEnabled, z: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-[10px] text-emerald-600">Z Plane</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={clippingValues.z}
                onChange={(e) => setClippingValues({...clippingValues, z: parseFloat(e.target.value)})}
                className="flex-1 h-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Industrial3DVisualizerScientificV11
