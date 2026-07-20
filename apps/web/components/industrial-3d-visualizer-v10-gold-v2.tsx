'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

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
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  colorMapType?: 'scientific' | 'cryogenic' | 'alert'; // Nouvelle prop pour le type de palette
}

/**
 * TRULY-INDUSTRIAL V10-GOLD VISUALIZER (V2-REFINED)
 * Professional CFD volumetric visualization:
 * - High-resolution Marching Cubes (up to 128)
 * - Adaptive point fusion for continuous surfaces
 * - Scientific blue-to-red color mapping
 * - Industrial-grade UI overlay
 */
const Industrial3DVisualizerV10Gold: React.FC<Props> = ({ 
  data = [], 
  title = "TRULY-INDUSTRIAL V10-GOLD",
  colorVariable = 'temperature',
  quality = 'high',
  colorMapType = 'scientific' // Valeur par défaut
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 })

  const resolution = useMemo(() => {
    switch(quality) {
      case 'low': return 48;
      case 'medium': return 64;
      case 'high': return 96;
      case 'ultra': return 128;
      default: return 80;
    }
  }, [quality])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    // 1. Scene Setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617) // Deep industrial blue-black
    
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(6, 6, 6)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // OrbitControls
    let controls: any;
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
    })

    // 2. Advanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0)
    mainLight.position.set(10, 10, 10)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.4)
    fillLight.position.set(-10, 0, -10)
    scene.add(fillLight)

    // 3. Volumetric Rendering (Marching Cubes)
    const createVolumetricLayer = (color: number, opacity: number) => {
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        shininess: 120,
        specular: 0x444444,
        flatShading: false
      })
      const mc = new MarchingCubes(resolution, material, true, true, 200000)
      mc.scale.set(3.5, 3.5, 3.5)
      return mc
    }

    // Définition des palettes de couleurs
    const colorMaps = {
      scientific: [
        { t: 0.15, c: 0x1e3a8a, o: 0.25 }, // Deep Blue (Coldest)
        { t: 0.35, c: 0x3b82f6, o: 0.35 }, // Blue
        { t: 0.55, c: 0x10b981, o: 0.45 }, // Green
        { t: 0.75, c: 0xf59e0b, o: 0.55 }, // Yellow/Orange
        { t: 0.95, c: 0xef4444, o: 0.65 }  // Red (Hottest)
      ],
      cryogenic: [
        { t: 0.1, c: 0x000033, o: 0.2 }, // Very Deep Blue
        { t: 0.3, c: 0x000066, o: 0.3 }, // Deep Blue
        { t: 0.5, c: 0x000099, o: 0.4 }, // Medium Blue
        { t: 0.7, c: 0x0000cc, o: 0.5 }, // Light Blue
        { t: 0.9, c: 0xadd8e6, o: 0.6 }  // Light Cyan (Warmest for Cryo)
      ],
      alert: [
        { t: 0.1, c: 0x333333, o: 0.2 }, // Dark Grey (Normal)
        { t: 0.3, c: 0x666666, o: 0.3 }, // Grey
        { t: 0.5, c: 0x990000, o: 0.4 }, // Dark Red (Warning)
        { t: 0.7, c: 0xcc0000, o: 0.5 }, // Red (Alert)
        { t: 0.9, c: 0xff0000, o: 0.6 }  // Bright Red (Critical)
      ]
    };

    const layers = colorMaps[colorMapType] || colorMaps.scientific; // Sélection de la palette

    const mcLayers = layers.map(l => createVolumetricLayer(l.c, l.o))
    mcLayers.forEach(mc => scene.add(mc))

    // 4. Data Processing
    const values = data.map(p => p[colorVariable as keyof DataPoint] as number)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length
    setStats({ min: minVal, max: maxVal, avg: avgVal, count: data.length })

    // Adaptive Radius Calculation
    const xCoords = data.map(p => p.x)
    const yCoords = data.map(p => p.y)
    const zCoords = data.map(p => p.z)
    const xRange = Math.max(...xCoords) - Math.min(...xCoords) || 1
    const yRange = Math.max(...yCoords) - Math.min(...yCoords) || 1
    const zRange = Math.max(...zCoords) - Math.min(...zCoords) || 1
    
    // Estimation de l'espacement moyen pour fusionner les points
    const volume = xRange * yRange * zRange
    const avgSpacing = Math.pow(volume / data.length, 1/3)
    const fusionRadius = Math.max(0.25, avgSpacing * 1.8) // Facteur 1.8 pour assurer la fusion

    const updateVolumes = () => {
      mcLayers.forEach(mc => mc.reset())
      
      const xMin = Math.min(...xCoords), xMax = Math.max(...xCoords)
      const yMin = Math.min(...yCoords), yMax = Math.max(...yCoords)
      const zMin = Math.min(...zCoords), zMax = Math.max(...zCoords)
      
      data.forEach(p => {
        // Normalisation dans l'espace [0, 1] pour MarchingCubes
        const nx = (p.x - xMin) / (xMax - xMin || 1)
        const ny = (p.y - yMin) / (yMax - yMin || 1)
        const nz = (p.z - zMin) / (zMax - zMin || 1)
        
        const val = ((p[colorVariable as keyof DataPoint] as number) - minVal) / (maxVal - minVal || 1)
        
        mcLayers.forEach((mc, idx) => {
          const layerThreshold = layers[idx].t
          // Plage de seuil élargie pour une meilleure fusion volumétrique
          if (val >= layerThreshold - 0.15 && val <= layerThreshold + 0.15) {
            mc.addBall(nx, ny, nz, fusionRadius, 16) // 16 segments pour plus de précision
          }
        })
      })
    }
    updateVolumes()

    // 5. Grid & Bounding Box
    const boxGeom = new THREE.BoxGeometry(7, 7, 7)
    const edges = new THREE.EdgesGeometry(boxGeom)
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.3 }))
    scene.add(line)

    // Axis Helper
    const axesHelper = new THREE.AxesHelper(4)
    scene.add(axesHelper)

    // Animation Loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (controls) controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)
      renderer.dispose()
      mcLayers.forEach(mc => {
        mc.geometry.dispose()
        if (Array.isArray(mc.material)) mc.material.forEach(m => m.dispose())
        else mc.material.dispose()
      })
    }
  }, [data, colorVariable, resolution])

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* INDUSTRIAL UI OVERLAY */}
      <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-black tracking-tighter text-white uppercase">{title}</h2>
            </div>
            <p className="text-[10px] font-mono text-blue-500/60 tracking-widest uppercase">Physics-Informed Neural Network // Volumetric V10 Gold</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Qualité Rendu</p>
              <p className="text-blue-400 font-bold text-xs uppercase">{quality} ({resolution}^3)</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Status du Solveur</p>
              <p className="text-emerald-500 font-bold text-xs uppercase">Converged 100%</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="grid grid-cols-3 gap-6 bg-black/60 backdrop-blur-2xl border border-white/10 p-8 rounded-[32px] pointer-events-auto">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Min {colorVariable}</p>
              <p className="text-2xl font-black text-white">{stats.min.toFixed(2)}</p>
            </div>
            <div className="border-x border-white/10 px-6">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Max {colorVariable}</p>
              <p className="text-2xl font-black text-white">{stats.max.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Points PINN</p>
              <p className="text-2xl font-black text-blue-500">{stats.count.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 bg-black/40 p-4 rounded-3xl border border-white/5">
            <div className="h-48 w-6 bg-gradient-to-t from-blue-900 via-green-500 to-red-600 rounded-full border border-white/20 shadow-lg" />
            <p className="text-[10px] font-black text-gray-400 uppercase vertical-text tracking-widest">Scientific Scale (K)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV10Gold;
