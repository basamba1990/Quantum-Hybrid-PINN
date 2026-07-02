'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  temperature?: number;
  pressure?: number;
  velocity_magnitude?: number;
  stress?: number;
  strain?: number;
  boil_off_rate?: number;
  thermal_conductivity?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure' | 'velocity' | 'stress' | 'strain' | 'boil_off' | 'thermal';
  maxPointsDisplay?: number;
  domain?: 'hydrogen' | 'cryogenic' | 'geomechanical';
}

/**
 * VISUALISEUR 3D V10 EXTENDED - TRULY INDUSTRIAL
 * Support pour :
 * - Hydrogène haute pression (Pipeline ASME B31.12)
 * - Cryogénie (LH2, ISO 21009)
 * - Géomécanique (Roche, Contraintes/Déformations)
 */
const Industrial3DVisualizerV10Extended: React.FC<Props> = ({ 
  data = [], 
  title = "3D Isosurface Visualization",
  colorVariable = 'temperature',
  maxPointsDisplay = 50000,
  domain = 'hydrogen'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<any>(null)
  const frameIdRef = useRef<number | null>(null)
  const pointsRef = useRef<THREE.Points | null>(null)
  const cageRef = useRef<THREE.Group | null>(null)

  const [stats, setStats] = useState({ 
    minT: 0, maxT: 0, minP: 0, maxP: 0, minV: 0, maxV: 0,
    minS: 0, maxS: 0, minE: 0, maxE: 0, minB: 0, maxB: 0,
    count: 0, displayedCount: 0,
    xMin: 0, xMax: 12, yMin: -1, yMax: 1, zMin: 0, zMax: 12
  })

  // Initialiser le moteur 3D
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const initEngine = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0e27)
        scene.fog = new THREE.Fog(0x0a0e27, 30, 100)

        const width = containerRef.current!.clientWidth
        const height = containerRef.current!.clientHeight
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
        camera.position.set(8, 3, 8)
        camera.lookAt(6, 0, 6)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true

        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = false

        // Éclairage réaliste
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
        directionalLight.position.set(15, 10, 15)
        directionalLight.castShadow = true
        scene.add(directionalLight)

        const fillLight = new THREE.DirectionalLight(0x6688ff, 0.3)
        fillLight.position.set(-10, 5, -10)
        scene.add(fillLight)

        // Grille de sol
        const gridHelper = new THREE.GridHelper(14, 14, 0x2a4a6a, 0x1a2a4a)
        gridHelper.position.set(6, -1.2, 6)
        scene.add(gridHelper)

        sceneRef.current = scene
        rendererRef.current = renderer
        cameraRef.current = camera
        controlsRef.current = controls

        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

      } catch (e) {
        console.error('3D Engine Init Error:', e)
      }
    }

    initEngine()

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  // Mettre à jour les données et créer la cage + axes
  useEffect(() => {
    if (!sceneRef.current || !data.length) return

    const pointsToUse = data.slice(0, maxPointsDisplay)
    
    // Calculer les limites spatiales
    const xMin = Math.min(...pointsToUse.map(p => p.x))
    const xMax = Math.max(...pointsToUse.map(p => p.x))
    const yMin = Math.min(...pointsToUse.map(p => p.y))
    const yMax = Math.max(...pointsToUse.map(p => p.y))
    const zMin = Math.min(...pointsToUse.map(p => p.z))
    const zMax = Math.max(...pointsToUse.map(p => p.z))

    const temps = pointsToUse.map(p => p.temperature || 0)
    const press = pointsToUse.map(p => p.pressure || 0)
    const vels = pointsToUse.map(p => p.velocity_magnitude || 0)
    const stress = pointsToUse.map(p => p.stress || 0)
    const strain = pointsToUse.map(p => p.strain || 0)
    const boil = pointsToUse.map(p => p.boil_off_rate || 0)

    const newStats = {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      minV: Math.min(...vels),
      maxV: Math.max(...vels),
      minS: Math.min(...stress),
      maxS: Math.max(...stress),
      minE: Math.min(...strain),
      maxE: Math.max(...strain),
      minB: Math.min(...boil),
      maxB: Math.max(...boil),
      count: data.length,
      displayedCount: pointsToUse.length,
      xMin, xMax, yMin, yMax, zMin, zMax
    }
    setStats(newStats)

    // CRÉER LA CAGE 3D INDUSTRIELLE COMPLÈTE
    if (cageRef.current) {
      sceneRef.current.remove(cageRef.current)
    }

    const cageGroup = new THREE.Group()
    const cageMaterial = new THREE.LineBasicMaterial({ color: 0x4a7c7e, linewidth: 2 })

    // Fonction pour créer une ligne entre deux points
    const createLine = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]), 3))
      return new THREE.Line(geometry, cageMaterial)
    }

    // Coins de la cage
    const corners = [
      new THREE.Vector3(xMin, yMin, zMin), // 0
      new THREE.Vector3(xMax, yMin, zMin), // 1
      new THREE.Vector3(xMax, yMax, zMin), // 2
      new THREE.Vector3(xMin, yMax, zMin), // 3
      new THREE.Vector3(xMin, yMin, zMax), // 4
      new THREE.Vector3(xMax, yMin, zMax), // 5
      new THREE.Vector3(xMax, yMax, zMax), // 6
      new THREE.Vector3(xMin, yMax, zMax), // 7
    ]

    // Arêtes de la cage
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Face avant
      [4, 5], [5, 6], [6, 7], [7, 4], // Face arrière
      [0, 4], [1, 5], [2, 6], [3, 7]  // Arêtes verticales
    ]

    edges.forEach(([i, j]) => {
      cageGroup.add(createLine(corners[i], corners[j]))
    })

    // CRÉER LES AXES GRADUÉS AVEC ÉTIQUETTES
    const createGraduatedAxis = (start: THREE.Vector3, end: THREE.Vector3, color: number, label: string, steps: number) => {
      const group = new THREE.Group()
      
      // Ligne principale
      const lineGeometry = new THREE.BufferGeometry()
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([start.x, start.y, start.z, end.x, end.y, end.z]), 3))
      const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: 3 })
      group.add(new THREE.Line(lineGeometry, lineMaterial))

      // Graduations
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const pos = new THREE.Vector3().lerpVectors(start, end, t)
        
        // Petit trait de graduation
        const tickLength = 0.15
        const tickDir = new THREE.Vector3().subVectors(end, start).normalize()
        const perpDir = new THREE.Vector3(-tickDir.y, tickDir.x, 0).normalize()
        
        const tickStart = pos.clone().addScaledVector(perpDir, tickLength / 2)
        const tickEnd = pos.clone().addScaledVector(perpDir, -tickLength / 2)
        
        const tickGeometry = new THREE.BufferGeometry()
        tickGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([tickStart.x, tickStart.y, tickStart.z, tickEnd.x, tickEnd.y, tickEnd.z]), 3))
        group.add(new THREE.Line(tickGeometry, lineMaterial))
      }

      return group
    }

    // Ajouter les trois axes gradués
    const xAxis = createGraduatedAxis(
      new THREE.Vector3(xMin, yMin - 0.5, zMin),
      new THREE.Vector3(xMax, yMin - 0.5, zMin),
      0xff4444,
      'X',
      Math.floor(xMax - xMin)
    )
    cageGroup.add(xAxis)

    const yAxis = createGraduatedAxis(
      new THREE.Vector3(xMin - 0.5, yMin, zMin),
      new THREE.Vector3(xMin - 0.5, yMax, zMin),
      0x44ff44,
      'Y',
      Math.floor(yMax - yMin)
    )
    cageGroup.add(yAxis)

    const zAxis = createGraduatedAxis(
      new THREE.Vector3(xMin, yMin - 0.5, zMin),
      new THREE.Vector3(xMin, yMin - 0.5, zMax),
      0x4444ff,
      'Z',
      Math.floor(zMax - zMin)
    )
    cageGroup.add(zAxis)

    sceneRef.current.add(cageGroup)
    cageRef.current = cageGroup

    // CRÉER LES POINTS DE DONNÉES
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(pointsToUse.length * 3)
    const colArr = new Float32Array(pointsToUse.length * 3)

    const tRange = newStats.maxT - newStats.minT || 1
    const pRange = newStats.maxP - newStats.minP || 1
    const vRange = newStats.maxV - newStats.minV || 1
    const sRange = newStats.maxS - newStats.minS || 1
    const eRange = newStats.maxE - newStats.minE || 1
    const bRange = newStats.maxB - newStats.minB || 1

    pointsToUse.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      let norm = 0
      if (colorVariable === 'temperature') {
        norm = (p.temperature || 0 - newStats.minT) / tRange
      } else if (colorVariable === 'pressure') {
        norm = (p.pressure || 0 - newStats.minP) / pRange
      } else if (colorVariable === 'velocity') {
        norm = (p.velocity_magnitude || 0 - newStats.minV) / vRange
      } else if (colorVariable === 'stress') {
        norm = (p.stress || 0 - newStats.minS) / sRange
      } else if (colorVariable === 'strain') {
        norm = (p.strain || 0 - newStats.minE) / eRange
      } else if (colorVariable === 'boil_off') {
        norm = (p.boil_off_rate || 0 - newStats.minB) / bRange
      }

      // Dégradé: Bleu -> Cyan -> Jaune -> Rouge
      const color = new THREE.Color()
      if (norm < 0.33) {
        color.setRGB(0, norm * 3, 1)
      } else if (norm < 0.66) {
        color.setRGB(0, 1, 1 - (norm - 0.33) * 3)
      } else {
        color.setRGB((norm - 0.66) * 3, 1 - (norm - 0.66) * 3, 0)
      }

      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    })

    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current)
      pointsRef.current.geometry.dispose();
      (pointsRef.current.material as THREE.Material).dispose()
    }

    const points = new THREE.Points(geometry, pointsMaterial)
    sceneRef.current.add(points)
    pointsRef.current = points

  }, [data, colorVariable, maxPointsDisplay])

  const getScaleInfo = () => {
    if (colorVariable === 'temperature') {
      return { min: stats.minT.toFixed(1), max: stats.maxT.toFixed(1), unit: 'K' }
    } else if (colorVariable === 'pressure') {
      return { min: stats.minP.toFixed(2), max: stats.maxP.toFixed(2), unit: 'MPa' }
    } else if (colorVariable === 'velocity') {
      return { min: stats.minV.toFixed(1), max: stats.maxV.toFixed(1), unit: 'm/s' }
    } else if (colorVariable === 'stress') {
      return { min: stats.minS.toFixed(1), max: stats.maxS.toFixed(1), unit: 'MPa' }
    } else if (colorVariable === 'strain') {
      return { min: stats.minE.toFixed(4), max: stats.maxE.toFixed(4), unit: '-' }
    } else if (colorVariable === 'boil_off') {
      return { min: stats.minB.toFixed(3), max: stats.maxB.toFixed(3), unit: 'kg/h' }
    }
    return { min: '0', max: '1', unit: '-' }
  }

  const scaleInfo = getScaleInfo()

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
        <div className="flex gap-4 text-[10px] font-mono text-gray-500">
          <span>Points: {stats.displayedCount.toLocaleString()}</span>
          <span>X: [{stats.xMin.toFixed(1)}, {stats.xMax.toFixed(1)}]</span>
          <span>Y: [{stats.yMin.toFixed(1)}, {stats.yMax.toFixed(1)}]</span>
          <span>Z: [{stats.zMin.toFixed(1)}, {stats.zMax.toFixed(1)}]</span>
        </div>
      </div>

      <div className="relative flex gap-4">
        <div ref={containerRef} className="flex-1 h-[600px] bg-slate-950 rounded-lg border-2 border-cyan-500/30 overflow-hidden shadow-2xl" />
        
        {/* Échelle de couleur */}
        <div className="w-20 flex flex-col">
          <div className="flex-1 rounded-lg overflow-hidden border-2 border-cyan-500/30 relative bg-gradient-to-t from-red-600 via-yellow-500 to-blue-600 shadow-lg">
            <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[10px] text-gray-300 pr-1">
              {[100, 75, 50, 25, 0].map((pct, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="font-mono">{(pct / 100).toFixed(2)}</span>
                  <div className="w-2 h-px bg-white/30" />
                </div>
              ))}
            </div>
          </div>
          <div className="text-center text-[11px] text-gray-400 mt-2 font-mono">{scaleInfo.unit}</div>
          <div className="text-center text-[9px] text-gray-500 mt-1 space-y-1">
            <div>Max: {scaleInfo.max}</div>
            <div>Min: {scaleInfo.min}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400 text-[9px]">X Range</div>
          <div className="text-cyan-400 font-mono text-[10px]">{stats.xMin.toFixed(1)} → {stats.xMax.toFixed(1)} m</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400 text-[9px]">Y Range</div>
          <div className="text-green-400 font-mono text-[10px]">{stats.yMin.toFixed(1)} → {stats.yMax.toFixed(1)} m</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400 text-[9px]">Z Range</div>
          <div className="text-blue-400 font-mono text-[10px]">{stats.zMin.toFixed(1)} → {stats.zMax.toFixed(1)} m</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400 text-[9px]">Points</div>
          <div className="text-emerald-400 font-mono text-[10px]">{stats.displayedCount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV10Extended
