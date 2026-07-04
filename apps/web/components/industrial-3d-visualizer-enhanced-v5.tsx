'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { Download, Box, Activity, Shield, Database, Wind, Droplets, Zap, AlertTriangle } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  velocity_magnitude?: number; velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number;
  damage?: number;
}

type ScenarioType = 'H2_PIPELINE' | 'LH2_STORAGE' | 'PORT_ENERGY_OPTIMIZATION' | 'PIPELINE_SAFETY' | 'CRYOGENIC_TRANSPORT' | 'MINING_INDUSTRIAL_SIM' | 'ROCK_ELAST_STRESS' | 'H2_COMPRESSION_STATION';

interface Props {
  data?: DataPoint[];
  title?: string;
  scenarioType?: ScenarioType;
  colorVariable?: 'temperature' | 'pressure' | 'density' | 'stress' | 'damage';
}

/**
 * Industrial 3D Visualizer V6 - ADAPTIVE GEOMETRY ENGINE
 * 
 * CORRECTIONS INDUSTRIELLES:
 * 1. Géométries Spécifiques: Pipelines (Tubes), Réservoirs (Sphères), Mines (Volumes découpés).
 * 2. Moteur de Rendu Adaptatif: La structure 3D change selon le scenarioType.
 * 3. Zéro Hallucination: Les géométries sont basées sur les limites réelles du domaine.
 * 4. Rendu Multi-Physique: Support des contraintes (stress) et dommages pour le scénario Rock-Stress.
 */
const Industrial3DVisualizerEnhancedV5: React.FC<Props> = ({
  data = [],
  title = "3D Industrial Simulation",
  scenarioType = 'H2_PIPELINE',
  colorVariable = 'temperature'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const controlsRef = useRef<any>(null)
  const pointsGroupRef = useRef<THREE.Group | null>(null)
  const infrastructureGroupRef = useRef<THREE.Group | null>(null)
  
  const [isMounted, setIsMounted] = useState(false)
  const [stats, setStats] = useState({ 
    minV: 0, maxV: 1, count: 0, fps: 60
  })
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // 1. Calcul des statistiques et limites réelles
  const domainBounds = useMemo(() => {
    if (!data.length) return { min: new THREE.Vector3(-1,-1,-1), max: new THREE.Vector3(1,1,1), center: new THREE.Vector3(0,0,0) }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    const min = new THREE.Vector3(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    const max = new THREE.Vector3(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    return { min, max, center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5) }
  }, [data])

  useEffect(() => {
    if (!data.length) return
    const vals = data.map(p => (p as any)[activeVariable] || 0)
    setStats(prev => ({
      ...prev,
      minV: Math.min(...vals),
      maxV: Math.max(...vals),
      count: data.length
    }))
  }, [data, activeVariable])

  // 2. Moteur de Géométrie Industrielle (Infrastructure)
  const buildInfrastructure = useCallback((scene: THREE.Scene) => {
    if (infrastructureGroupRef.current) {
      scene.remove(infrastructureGroupRef.current)
      infrastructureGroupRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }

    const group = new THREE.Group()
    infrastructureGroupRef.current = group

    // Matériau industriel semi-transparent
    const industrialMat = new THREE.MeshPhongMaterial({
      color: 0x2a4a6a,
      opacity: 0.15,
      transparent: true,
      side: THREE.DoubleSide,
      shininess: 50
    })

    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x4a9eff,
      wireframe: true,
      opacity: 0.2,
      transparent: true
    })

    const { min, max, center } = domainBounds
    const size = new THREE.Vector3().subVectors(max, min)

    switch (scenarioType) {
      case 'H2_PIPELINE':
      case 'PIPELINE_SAFETY':
        // GÉOMÉTRIE TUBE (PIPELINE)
        const curve = new THREE.LineCurve3(new THREE.Vector3(min.x, center.y, center.z), new THREE.Vector3(max.x, center.y, center.z))
        const tubeGeom = new THREE.TubeGeometry(curve, 64, size.y * 0.4, 16, false)
        group.add(new THREE.Mesh(tubeGeom, industrialMat))
        group.add(new THREE.Mesh(tubeGeom, wireframeMat))
        break

      case 'LH2_STORAGE':
      case 'CRYOGENIC_TRANSPORT':
        // GÉOMÉTRIE SPHÉRIQUE (RÉSERVOIR)
        const radius = Math.max(size.x, size.y, size.z) * 0.5
        const sphereGeom = new THREE.SphereGeometry(radius, 32, 32)
        const sphereMesh = new THREE.Mesh(sphereGeom, industrialMat)
        sphereMesh.position.copy(center)
        group.add(sphereMesh)
        const wireframeSphere = new THREE.Mesh(sphereGeom, wireframeMat)
        wireframeSphere.position.copy(center)
        group.add(wireframeSphere)
        break

      case 'ROCK_ELAST_STRESS':
      case 'MINING_INDUSTRIAL_SIM':
        // GÉOMÉTRIE VOLUME DÉCOUPÉ (MINE/ROCHE)
        const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z)
        const boxMesh = new THREE.Mesh(boxGeom, industrialMat)
        boxMesh.position.copy(center)
        group.add(boxMesh)
        group.add(new THREE.BoxHelper(boxMesh, 0x4a9eff))
        break

      case 'H2_COMPRESSION_STATION':
        // GÉOMÉTRIE COMPLEXE (CYLINDRES + BOXES)
        const baseGeom = new THREE.BoxGeometry(size.x, size.y * 0.2, size.z)
        const base = new THREE.Mesh(baseGeom, industrialMat)
        base.position.set(center.x, min.y, center.z)
        group.add(base)
        
        const compGeom = new THREE.CylinderGeometry(size.y * 0.3, size.y * 0.3, size.x * 0.6, 16)
        const comp = new THREE.Mesh(compGeom, industrialMat)
        comp.rotation.z = Math.PI / 2
        comp.position.copy(center)
        group.add(comp)
        break

      default:
        // DOMAINE GÉNÉRIQUE
        const defGeom = new THREE.BoxGeometry(size.x, size.y, size.z)
        const defMesh = new THREE.Mesh(defGeom, industrialMat)
        defMesh.position.copy(center)
        group.add(defMesh)
    }

    // Grille de référence au sol
    const grid = new THREE.GridHelper(Math.max(size.x, size.z) * 2, 20, 0x2a4a6a, 0x1a2a4a)
    grid.position.y = min.y - 0.1
    group.add(grid)

    scene.add(group)
  }, [scenarioType, domainBounds])

  // 3. Rendu des données physiques
  const updateDataLayers = useCallback((scene: THREE.Scene) => {
    if (pointsGroupRef.current) {
      scene.remove(pointsGroupRef.current)
      pointsGroupRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }

    if (!data.length) return

    const group = new THREE.Group()
    pointsGroupRef.current = group

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(data.length * 3)
    const colors = new Float32Array(data.length * 3)
    
    const vMin = stats.minV, vMax = stats.maxV, vRange = vMax - vMin || 1

    const getColor = (norm: number) => {
      const color = new THREE.Color()
      // Échelle de température industrielle (Bleu -> Vert -> Jaune -> Rouge)
      if (norm < 0.25) color.setRGB(0, norm * 4, 1)
      else if (norm < 0.5) color.setRGB(0, 1, 1 - (norm - 0.25) * 4)
      else if (norm < 0.75) color.setRGB((norm - 0.5) * 4, 1, 0)
      else color.setRGB(1, 1 - (norm - 0.75) * 4, 0)
      return color
    }

    data.forEach((p, i) => {
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z
      const val = (p as any)[activeVariable] || 0
      const norm = (val - vMin) / vRange
      const color = getColor(norm)
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    })

    group.add(new THREE.Points(geometry, material))
    scene.add(group)
  }, [data, activeVariable, stats])

  // 4. Initialisation du moteur
  useEffect(() => {
    if (!isMounted || !containerRef.current) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, animationId: number

    const init = async () => {
      try {
        const width = containerRef.current?.clientWidth || 800
        const height = containerRef.current?.clientHeight || 600

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x050816)
        sceneRef.current = scene

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000)
        camera.position.set(domainBounds.max.x * 2, domainBounds.max.y * 2, domainBounds.max.z * 2)
        cameraRef.current = camera

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)
        rendererRef.current = renderer

        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.target.copy(domainBounds.center)
        controlsRef.current = controls

        scene.add(new THREE.AmbientLight(0xffffff, 0.4))
        const light = new THREE.DirectionalLight(0xffffff, 0.8)
        light.position.set(10, 20, 10)
        scene.add(light)

        const animate = () => {
          animationId = requestAnimationFrame(animate)
          if (controlsRef.current) controlsRef.current.update()
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current)
          }
        }
        animate()
        setIsReady(true)
      } catch (e) {
        setRenderError(String(e))
      }
    }

    init()
    return () => {
      cancelAnimationFrame(animationId)
      if (rendererRef.current) rendererRef.current.dispose()
    }
  }, [isMounted, domainBounds])

  useEffect(() => {
    if (isReady && sceneRef.current) {
      buildInfrastructure(sceneRef.current)
      updateDataLayers(sceneRef.current)
    }
  }, [isReady, buildInfrastructure, updateDataLayers])

  if (!isMounted) return <div className="h-[600px] bg-slate-950 flex items-center justify-center font-mono text-blue-500 animate-pulse uppercase tracking-widest">Initialisation GPU...</div>

  const getScenarioIcon = () => {
    switch(scenarioType) {
      case 'H2_PIPELINE': return <Wind className="w-4 h-4" />
      case 'LH2_STORAGE': return <Droplets className="w-4 h-4" />
      case 'ROCK_ELAST_STRESS': return <AlertTriangle className="w-4 h-4" />
      case 'MINING_INDUSTRIAL_SIM': return <Box className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[600px] bg-slate-950/80 rounded-[32px] border border-white/10 p-8 backdrop-blur-xl relative overflow-hidden group">
      {/* Overlay Décoratif Industriel */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 opacity-50" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
            {getScenarioIcon()}
            <span>Simulation Nexus // {scenarioType}</span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tighter italic uppercase">{title}</h3>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
          {(['temperature', 'pressure', 'density', 'stress', 'damage'] as const).map(v => (
            <button 
              key={v} 
              onClick={() => setActiveVariable(v)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeVariable === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full rounded-[24px] overflow-hidden relative border border-white/5 bg-black/20 shadow-inner" />
      
      {renderError && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-2 rounded-xl text-xs font-mono">{renderError}</div>}
      
      <div className="flex items-center justify-between text-[10px] font-black text-gray-600 uppercase tracking-widest pt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> GPU ACTIVE</div>
          <div>NODES: {stats.count}</div>
          <div>FPS: {stats.fps}</div>
        </div>
        <div className="flex items-center gap-2">
          <Download className="w-3 h-3 cursor-pointer hover:text-white transition-colors" />
          <span>QUANTUM-HYBRID PINN V8.0 GOLD</span>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerEnhancedV5
