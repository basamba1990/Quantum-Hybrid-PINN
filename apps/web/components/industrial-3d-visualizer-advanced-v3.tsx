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
  colorVariable?: 'temperature' | 'pressure';
}

const Industrial3DVisualizerAdvancedV3: React.FC<Props> = ({ 
  data = [], 
  title = "3D Isosurface Visualization",
  xLabel = "X (m)",
  yLabel = "Y (m)",
  zLabel = "Z (m)",
  xRange = [-1, 1],
  yRange = [-1, 1],
  zRange = [-1, 1],
  colorVariable = 'temperature'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const [stats, setStats] = useState({ minT: 0, maxT: 1, minP: 0, maxP: 1, count: 0 })
  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure'>(colorVariable)

  // Calcul des statistiques et des plages réelles
  const realRanges = useMemo(() => {
    if (!data.length) return { x: [-1, 1], y: [-1, 1], z: [-1, 1] }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    return {
      x: [Math.min(...xs), Math.max(...xs)],
      y: [Math.min(...ys), Math.max(...ys)],
      z: [Math.min(...zs), Math.max(...zs)]
    }
  }, [data])

  useEffect(() => {
    if (!data.length) return
    const temps = data.map(p => p.temperature)
    const press = data.map(p => p.pressure)
    setStats({
      minT: Math.min(...temps), maxT: Math.max(...temps),
      minP: Math.min(...press), maxP: Math.max(...press),
      count: data.length
    })
  }, [data])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: any

    const init = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x020617) // Deep industrial dark
        sceneRef.current = scene

        const width = containerRef.current!.clientWidth
        const height = containerRef.current!.clientHeight
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(2.5, 2, 2.5)
        cameraRef.current = camera

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)
        rendererRef.current = renderer

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05

        // Éclairage
        scene.add(new THREE.AmbientLight(0xffffff, 0.4))
        const light = new THREE.PointLight(0xffffff, 1)
        light.position.set(5, 5, 5)
        scene.add(light)

        // Helper function for text
        const createText = (text: string, color: string, size: number = 0.1) => {
          const canvas = document.createElement('canvas')
          canvas.width = 256; canvas.height = 64
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = color
          ctx.font = 'bold 40px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(text, 128, 45)
          const tex = new THREE.CanvasTexture(canvas)
          const mat = new THREE.SpriteMaterial({ map: tex })
          const sprite = new THREE.Sprite(mat)
          sprite.scale.set(size * 4, size, 1)
          return sprite
        }

        // Bounding Box Industrielle
        const boxGeom = new THREE.BoxGeometry(2, 2, 2)
        const edges = new THREE.EdgesGeometry(boxGeom)
        const lineMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 })
        const box = new THREE.LineSegments(edges, lineMat)
        scene.add(box)

        // Axes Gradués -1 à 1
        const axisMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8 })
        const ticks = [-1, -0.5, 0, 0.5, 1]
        
        ticks.forEach(t => {
          // X-Axis Labels
          const tx = createText(t.toString(), '#ef4444', 0.15)
          tx.position.set(t, -1.2, -1)
          scene.add(tx)
          
          // Y-Axis Labels
          const ty = createText(t.toString(), '#22c55e', 0.15)
          ty.position.set(-1.2, t, -1)
          scene.add(ty)
          
          // Z-Axis Labels
          const tz = createText(t.toString(), '#3b82f6', 0.15)
          tz.position.set(-1.2, -1, t)
          scene.add(tz)
        })

        // Labels des axes
        const xl = createText('X (m)', '#ef4444', 0.2); xl.position.set(0, -1.5, -1); scene.add(xl)
        const yl = createText('Y (m)', '#22c55e', 0.2); yl.position.set(-1.5, 0, -1); scene.add(yl)
        const zl = createText('Z (m)', '#3b82f6', 0.2); zl.position.set(-1.5, -1.2, 0); scene.add(zl)

        // Nuage de points coloré (Rouge/Bleu)
        const geometry = new THREE.BufferGeometry()
        const posArr = new Float32Array(data.length * 3)
        const colArr = new Float32Array(data.length * 3)
        
        const vMin = activeVariable === 'temperature' ? stats.minT : stats.minP
        const vMax = activeVariable === 'temperature' ? stats.maxT : stats.maxP
        const vRange = vMax - vMin || 1

        data.forEach((p, i) => {
          posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z
          
          const val = activeVariable === 'temperature' ? p.temperature : p.pressure
          const norm = (val - vMin) / vRange
          // Gradient Rouge (chaud) -> Bleu (froid)
          const color = new THREE.Color()
          color.setRGB(norm, 0.2, 1 - norm) 
          colArr[i * 3] = color.r; colArr[i * 3 + 1] = color.g; colArr[i * 3 + 2] = color.b
        })

        geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

        const points = new THREE.Points(geometry, new THREE.PointsMaterial({
          size: 0.08, vertexColors: true, transparent: true, opacity: 0.8
        }))
        scene.add(points)

        // Volume Isosurface (Placeholder pour rendu volumique)
        const isoGeom = new THREE.SphereGeometry(0.8, 32, 32)
        const isoMat = new THREE.MeshPhongMaterial({
          color: activeVariable === 'temperature' ? 0xef4444 : 0x3b82f6,
          transparent: true, opacity: 0.15, wireframe: true
        })
        const iso = new THREE.Mesh(isoGeom, isoMat)
        scene.add(iso)

        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          controls.update(); renderer.render(scene, camera)
        }
        animate()
      } catch (e) { console.error(e) }
    }
    init()
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      if (rendererRef.current) rendererRef.current.dispose()
    }
  }, [data, stats, activeVariable])

  return (
    <div className="w-full space-y-6 bg-slate-950 p-6 rounded-[32px] border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <div className="w-2 h-6 bg-blue-600 rounded-full" /> {title}
        </h3>
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          <button onClick={() => setActiveVariable('temperature')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeVariable === 'temperature' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}>Température</button>
          <button onClick={() => setActiveVariable('pressure')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeVariable === 'pressure' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Pression</button>
        </div>
      </div>
      
      <div className="relative flex flex-col lg:flex-row gap-6">
        <div ref={containerRef} className="flex-1 h-[600px] bg-black/40 rounded-2xl border border-white/5 overflow-hidden" />
        
        <div className="lg:w-48 space-y-6">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest text-center">Échelle Industrielle</p>
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-bold text-red-500">{activeVariable === 'temperature' ? `${Math.round(stats.maxT)}K` : `${(stats.maxP/1000).toFixed(1)}MPa`}</div>
              <div className="w-full h-64 rounded-xl border border-white/10 shadow-inner" style={{ background: 'linear-gradient(to top, #3b82f6, #10b981, #ef4444)' }} />
              <div className="text-xs font-bold text-blue-500">{activeVariable === 'temperature' ? `${Math.round(stats.minT)}K` : `${(stats.minP/1000).toFixed(1)}MPa`}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5"><p className="text-[8px] text-gray-500 uppercase font-black">Points</p><p className="text-lg font-black text-white">{stats.count.toLocaleString()}</p></div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5"><p className="text-[8px] text-gray-500 uppercase font-black">Domaine</p><p className="text-xs font-bold text-white">[-1.0, 1.0]³</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerAdvancedV3
