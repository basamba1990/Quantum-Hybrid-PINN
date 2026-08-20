'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  velocity_magnitude?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  zRange?: [number, number];
}

const Industrial3DVisualizerAdvancedV2: React.FC<Props> = ({ 
  data = [], 
  title = "3D Isosurface Visualization",
  xLabel = "X (m)",
  yLabel = "Y (m)",
  zLabel = "Z (m)",
  xRange = [-1, 1],
  yRange = [-1, 1],
  zRange = [-1, 1]
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const [stats, setStats] = useState({ minT: 0, maxT: 1, minP: 0, maxP: 1, count: 0 })
  const [renderError, setRenderError] = useState<string | null>(null)

  // Données effectives avec fallback de démonstration
  const effectiveData = useMemo(() => {
    if (data && data.length > 0) return data
    const demoPoints: DataPoint[] = []
    for (let i = 0; i < 200; i++) {
      const t = i / 20
      demoPoints.push({
        x: t * 5, y: Math.cos(t * 1.5) * 5, z: Math.sin(t * 1.5) * 5,
        temperature: 293 + Math.sin(t) * 10,
        pressure: 120 - (t * 0.5)
      })
    }
    return demoPoints
  }, [data])

  // Calcul des statistiques
  useEffect(() => {
    if (!effectiveData.length) return
    const temps = effectiveData.map(p => p.temperature)
    const press = effectiveData.map(p => p.pressure)
    setStats({
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      count: effectiveData.length
    })
  }, [effectiveData])

  // Rendu Three.js
  useEffect(() => {
    if (!containerRef.current) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: any

    const init = async () => {
      try {
        let OrbitControls: any = null
        try {
          const module = await import('three/examples/jsm/controls/OrbitControls.js')
          OrbitControls = module.OrbitControls
        } catch (e) {
          console.warn('OrbitControls load failed', e)
        }

        if (!containerRef.current) return

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)

        const width = containerRef.current.clientWidth || 800
        const height = containerRef.current.clientHeight || 600
        
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(8, 8, 8)
        camera.lookAt(0, 0, 0)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        if (OrbitControls) {
          controls = new OrbitControls(camera, renderer.domElement)
          controls.enableDamping = true
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 10)
        scene.add(directionalLight)

        scene.add(new THREE.GridHelper(10, 20, 0x444444, 0x222222))

        // Nuage de points
        const geometry = new THREE.BufferGeometry()
        const posArr = new Float32Array(effectiveData.length * 3)
        const colArr = new Float32Array(effectiveData.length * 3)
        const tRange = stats.maxT - stats.minT || 1

        effectiveData.forEach((p, i) => {
          posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z
          const norm = (p.temperature - stats.minT) / tRange
          const color = new THREE.Color().setHSL(0.6 * (1 - norm), 1, 0.5)
          colArr[i * 3] = color.r; colArr[i * 3 + 1] = color.g; colArr[i * 3 + 2] = color.b
        })

        geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

        const pointsMaterial = new THREE.PointsMaterial({
          size: 0.15, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true
        })
        scene.add(new THREE.Points(geometry, pointsMaterial))

        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          if (controls) controls.update()
          renderer.render(scene, camera)
        }
        animate()
        setRenderError(null)
      } catch (e) {
        console.error('3D Visualizer Error:', e)
        setRenderError(`Render Error: ${String(e).substring(0, 50)}`)
      }
    }

    init()

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      if (rendererRef.current) rendererRef.current.dispose()
    }
  }, [effectiveData, stats])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-500 rounded" /> {title}
        </h3>
        <div className="text-xs font-mono text-gray-500">
          {stats.count} Points | {Math.round(stats.minT)}K - {Math.round(stats.maxT)}K
        </div>
      </div>
      
      <div ref={containerRef} className="w-full h-[600px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
        {renderError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-400 text-xs p-4 text-center">
            {renderError}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Points</p>
          <p className="text-xl font-black text-blue-400">{stats.count}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Temp Min</p>
          <p className="text-xl font-black text-cyan-400">{Math.round(stats.minT)} K</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Temp Max</p>
          <p className="text-xl font-black text-red-400">{Math.round(stats.maxT)} K</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Pression Moy</p>
          <p className="text-xl font-black text-emerald-400">{Math.round((stats.minP + stats.maxP) / 2)} kPa</p>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerAdvancedV2
