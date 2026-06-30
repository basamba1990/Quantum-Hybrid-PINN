'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'

interface ScenarioMetadata {
  reynolds?: number
  mach?: number
  domainBounds?: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number }
  fluidProperties?: { density: number; viscosity: number; temperature_ref: number }
  boundaryConditions?: string
  description?: string
}

interface DataPoint {
  x: number
  y: number
  z: number
  temperature: number
  pressure: number
  velocity_magnitude?: number
  velocity_u?: number
  velocity_v?: number
  velocity_w?: number
  damage?: number
  tke?: number
  epsilon?: number
  stress?: number
  uncertainty?: number
  residual?: number
}

interface Props {
  data?: DataPoint[]
  scenario?: ScenarioMetadata
  title?: string
  showValidation?: boolean
}

interface ValidationResult {
  massConservation: boolean
  physicalLimits: boolean
  convergence: boolean
  warnings: string[]
  errors: string[]
}

const Industrial3DVisualizerIndustrialGrade: React.FC<Props> = ({ 
  data = [], 
  scenario,
  title = "Visualisation Scientifique 3D - Grade Industriel",
  showValidation = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const requestRef = useRef<number>()
  
  // 1. Calculs mémorisés pour éviter les re-renders et les boucles infinies
  const { stats, validation, domainBounds } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        stats: { pointCount: 0, avgTemp: 0, maxVelocity: 0, minPressure: 0, maxPressure: 0, minTemp: 0, maxTemp: 0 },
        validation: { massConservation: true, physicalLimits: true, convergence: true, warnings: [], errors: [] },
        domainBounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }
      }
    }

    const temps = data.map(p => p.temperature)
    const vels = data.map(p => p.velocity_magnitude || 0)
    const pressures = data.map(p => p.pressure)
    
    // Stats
    const statsObj = {
      pointCount: data.length,
      avgTemp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
      maxVelocity: Math.max(...vels),
      minPressure: Math.min(...pressures),
      maxPressure: Math.max(...pressures),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
    }

    // Bounds
    let xMin = data[0].x, xMax = data[0].x
    let yMin = data[0].y, yMax = data[0].y
    let zMin = data[0].z, zMax = data[0].z
    data.forEach(p => {
      xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x)
      yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y)
      zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z)
    })
    
    const xMargin = (xMax - xMin) * 0.1 || 0.5
    const yMargin = (yMax - yMin) * 0.1 || 0.5
    const zMargin = (zMax - zMin) * 0.1 || 0.5
    
    const bounds = {
      xMin: xMin - xMargin, xMax: xMax + xMargin,
      yMin: yMin - yMargin, yMax: yMax + yMargin,
      zMin: zMin - zMargin, zMax: zMax + zMargin,
    }

    // Validation
    const valResult: ValidationResult = { massConservation: true, physicalLimits: true, convergence: true, warnings: [], errors: [] }
    data.slice(0, 1000).forEach((p, idx) => { // Limiter la validation aux 1000 premiers points pour la performance
      if (p.temperature < 0) {
        valResult.physicalLimits = false
        if (valResult.errors.length < 3) valResult.errors.push(`Point ${idx}: Température < 0K (${p.temperature}K)`)
      }
    })

    return { stats: statsObj, validation: valResult, domainBounds: bounds }
  }, [data])

  // 2. Effet de rendu Three.js
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let controls: any

    const init = async () => {
      // Import dynamique sécurisé
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x020617)

        const width = containerRef.current!.clientWidth || 800
        const height = containerRef.current!.clientHeight || 500
        
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)

        const centerX = (domainBounds.xMin + domainBounds.xMax) / 2
        const centerY = (domainBounds.yMin + domainBounds.yMax) / 2
        const centerZ = (domainBounds.zMin + domainBounds.zMax) / 2
        const distance = Math.max(
          domainBounds.xMax - domainBounds.xMin,
          domainBounds.yMax - domainBounds.yMin,
          domainBounds.zMax - domainBounds.zMin
        ) * 1.5 || 10

        camera.position.set(centerX + distance, centerY + distance, centerZ + distance)
        camera.lookAt(centerX, centerY, centerZ)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        // Nettoyage impératif avant ajout
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
          containerRef.current.appendChild(renderer.domElement)
        }
        rendererRef.current = renderer

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.target.set(centerX, centerY, centerZ)

        // Objets de la scène
        scene.add(new THREE.AxesHelper(distance * 0.3))
        
        const gridSize = Math.max(domainBounds.xMax - domainBounds.xMin, domainBounds.zMax - domainBounds.zMin)
        const grid = new THREE.GridHelper(gridSize, 10, 0x334155, 0x1e293b)
        grid.position.set(centerX, domainBounds.yMin, centerZ)
        scene.add(grid)

        // Data Points (Points Cloud)
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(data.length * 3)
        const colors = new Float32Array(data.length * 3)
        const tempRange = stats.maxTemp - stats.minTemp || 1

        data.forEach((p, i) => {
          positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z
          const norm = (p.temperature - stats.minTemp) / tempRange
          const color = new THREE.Color().setHSL(0.6 * (1 - norm), 1, 0.5)
          colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
        })

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.15, vertexColors: true }))
        scene.add(points)

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.5))
        const light = new THREE.DirectionalLight(0xffffff, 1)
        light.position.set(1, 1, 1)
        scene.add(light)

        const animate = () => {
          if (!rendererRef.current) return
          requestRef.current = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()
      } catch (err) {
        console.error("Three.js init error:", err)
      }
    }

    init()

    // Nettoyage complet
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        rendererRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [domainBounds, stats.minTemp, stats.maxTemp]) // Dépendances stables

  return (
    <div className="w-full space-y-4">
      <div className="w-full relative group">
        {/* Overlay Légende */}
        <div className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl pointer-events-none">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Température (K)</p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-24 bg-gradient-to-t from-blue-600 via-emerald-500 to-red-500 rounded-full" />
            <div className="flex flex-col justify-between h-24 text-[9px] font-mono text-slate-300">
              <span>{stats.maxTemp} K</span>
              <span>{stats.minTemp} K</span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={containerRef} 
          className="w-full h-[500px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" 
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Points" value={stats.pointCount.toLocaleString()} color="text-blue-400" />
        <StatCard title="Temp Moy" value={`${stats.avgTemp} K`} color="text-emerald-400" />
        <StatCard title="Vitesse Max" value={`${stats.maxVelocity.toFixed(2)} m/s`} color="text-orange-400" />
        <StatCard title="Pression" value={`${(stats.maxPressure / 1e5).toFixed(2)} bar`} color="text-purple-400" />
      </div>

      {/* Validation Panel */}
      {showValidation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">⚠️ Alertes Physiques</p>
          {validation.errors.map((err, i) => <p key={i} className="text-[10px] text-red-300 font-mono">{err}</p>)}
        </div>
      )}
    </div>
  )
}

const StatCard = ({ title, value, color }: { title: string, value: string, color: string }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{title}</p>
    <p className={`text-xl font-black ${color} mt-1`}>{value}</p>
  </div>
)

export default Industrial3DVisualizerIndustrialGrade;
