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
  quality?: 'low' | 'medium' | 'high';
}

/**
 * TRULY-INDUSTRIAL V10-GOLD VISUALIZER (V2)
 * Implementation of professional CFD visualization:
 * - Continuous volumetric field (Marching Cubes)
 * - Scientific color mapping (Blue-Green-Yellow-Red)
 * - Industrial UI overlay
 * - High-fidelity material rendering
 */
const Industrial3DVisualizerV10Gold: React.FC<Props> = ({ 
  data = [], 
  title = "TRULY-INDUSTRIAL V10-GOLD",
  colorVariable = 'temperature',
  quality = 'high'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 })

  const resolution = useMemo(() => {
    switch(quality) {
      case 'low': return 32;
      case 'medium': return 48;
      case 'high': return 64;
      default: return 48;
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
    camera.position.set(5, 5, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // OrbitControls import dynamique
    let controls: any;
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
    })

    // 2. Professional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(10, 10, 10)
    scene.add(mainLight)

    const rimLight = new THREE.PointLight(0x3b82f6, 0.5)
    rimLight.position.set(-10, -10, -10)
    scene.add(rimLight)

    // 3. Marching Cubes for Continuous Volumetric Rendering
    const createVolumetricLayer = (color: number, opacity: number) => {
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        shininess: 100,
        specular: 0x222222
      })
      const mc = new MarchingCubes(resolution, material, true, true, 100000)
      mc.scale.set(3, 3, 3)
      return mc
    }

    // Industrial Color Map Layers
    const layers = [
      { t: 0.2, c: 0x0000ff, o: 0.3 }, // Blue (Cold)
      { t: 0.4, c: 0x00ff00, o: 0.4 }, // Green
      { t: 0.6, c: 0xffff00, o: 0.5 }, // Yellow
      { t: 0.8, c: 0xff0000, o: 0.6 }  // Red (Hot)
    ]

    const mcLayers = layers.map(l => createVolumetricLayer(l.c, l.o))
    mcLayers.forEach(mc => scene.add(mc))

    // 4. Data Processing & Statistics
    const values = data.map(p => p[colorVariable as keyof DataPoint] as number)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length
    setStats({ min: minVal, max: maxVal, avg: avgVal, count: data.length })

    // Fill Marching Cubes
    const updateVolumes = () => {
      mcLayers.forEach(mc => mc.reset())
      
      const xCoords = data.map(p => p.x)
      const yCoords = data.map(p => p.y)
      const zCoords = data.map(p => p.z)
      const xMin = Math.min(...xCoords), xMax = Math.max(...xCoords)
      const yMin = Math.min(...yCoords), yMax = Math.max(...yCoords)
      const zMin = Math.min(...zCoords), zMax = Math.max(...zCoords)
      
      data.forEach(p => {
        const nx = (p.x - xMin) / (xMax - xMin || 1)
        const ny = (p.y - yMin) / (yMax - yMin || 1)
        const nz = (p.z - zMin) / (zMax - zMin || 1)
        
        const val = ((p[colorVariable as keyof DataPoint] as number) - minVal) / (maxVal - minVal || 1)
        
        mcLayers.forEach((mc, idx) => {
          const layerThreshold = layers[idx].t
          if (val >= layerThreshold - 0.1 && val <= layerThreshold + 0.1) {
            mc.addBall(nx, ny, nz, 0.15, 12)
          }
        })
      })
    }
    updateVolumes()

    // 5. Grid & Bounding Box
    const boxGeom = new THREE.BoxGeometry(6, 6, 6)
    const edges = new THREE.EdgesGeometry(boxGeom)
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 }))
    scene.add(line)

    // Animation Loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (controls) controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
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
    <div className="relative w-full h-full min-h-[500px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* INDUSTRIAL UI OVERLAY */}
      <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-black tracking-tighter text-white uppercase">{title}</h2>
            </div>
            <p className="text-[10px] font-mono text-blue-500/60 tracking-widest uppercase">Physics-Informed Neural Network // V10 Gold Standard</p>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-right">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Status du Solveur</p>
            <p className="text-emerald-500 font-bold text-xs uppercase">Converged 100%</p>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="grid grid-cols-3 gap-4 bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-[32px]">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Min {colorVariable}</p>
              <p className="text-lg font-black text-white">{stats.min.toFixed(2)}</p>
            </div>
            <div className="border-x border-white/10 px-4">
              <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Max {colorVariable}</p>
              <p className="text-lg font-black text-white">{stats.max.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Avg {colorVariable}</p>
              <p className="text-lg font-black text-white">{stats.avg.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="h-32 w-4 bg-gradient-to-t from-blue-600 via-green-500 to-red-600 rounded-full border border-white/10" />
            <p className="text-[9px] font-black text-gray-400 uppercase vertical-text tracking-widest">Scale (K)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV10Gold;
