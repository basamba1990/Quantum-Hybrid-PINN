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
}

const Industrial3DVisualizerAdvanced: React.FC<Props> = ({ data = [], title = "3D Isosurface Visualization" }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const [stats, setStats] = useState({ minT: 0, maxT: 1, minP: 0, maxP: 1, count: 0 })

  // Calcul des statistiques
  useEffect(() => {
    if (!data.length) return
    const temps = data.map(p => p.temperature)
    const press = data.map(p => p.pressure)
    setStats({
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      count: data.length
    })
  }, [data])

  // Rendu Three.js
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: any

    const init = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)

        const width = containerRef.current!.clientWidth || 1000
        const height = containerRef.current!.clientHeight || 600
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(8, 8, 8)
        camera.lookAt(0, 0, 0)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)
        rendererRef.current = renderer

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = false

        // Éclairage
        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 10)
        scene.add(directionalLight)

        // Grille et axes
        const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222)
        scene.add(gridHelper)

        const axesHelper = new THREE.AxesHelper(3)
        scene.add(axesHelper)

        // Étiquettes d'axes (texte 3D)
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 64
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 48px Arial'
        ctx.fillText('X (m)', 10, 50)
        const xTexture = new THREE.CanvasTexture(canvas)
        const xSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: xTexture }))
        xSprite.position.set(6, 0, 0)
        xSprite.scale.set(2, 0.5, 1)
        scene.add(xSprite)

        // Boîte englobante
        const boxGeometry = new THREE.BoxGeometry(10, 10, 10)
        const boxMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.2 })
        const boxLines = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), boxMaterial)
        boxLines.position.set(5, 5, 5)
        scene.add(boxLines)

        // Nuage de points avec gradient de température
        const geometry = new THREE.BufferGeometry()
        const posArr = new Float32Array(data.length * 3)
        const colArr = new Float32Array(data.length * 3)
        const tRange = stats.maxT - stats.minT || 1

        data.forEach((p, i) => {
          posArr[i * 3] = p.x
          posArr[i * 3 + 1] = p.y
          posArr[i * 3 + 2] = p.z
          
          const norm = (p.temperature - stats.minT) / tRange
          const hue = 0.6 * (1 - norm) // Bleu (froid) à Rouge (chaud)
          const color = new THREE.Color().setHSL(hue, 1, 0.5)
          colArr[i * 3] = color.r
          colArr[i * 3 + 1] = color.g
          colArr[i * 3 + 2] = color.b
        })

        geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

        const pointsMaterial = new THREE.PointsMaterial({
          size: 0.15,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          sizeAttenuation: true
        })

        const points = new THREE.Points(geometry, pointsMaterial)
        scene.add(points)

        // Isosurface simple (sphère de température moyenne)
        const avgTemp = (stats.minT + stats.maxT) / 2
        const isoGeometry = new THREE.IcosahedronGeometry(1.5, 6)
        const isoColor = new THREE.Color().setHSL(0.3, 1, 0.5)
        const isoMaterial = new THREE.MeshPhongMaterial({
          color: isoColor,
          transparent: true,
          opacity: 0.15,
          wireframe: false,
          emissive: isoColor,
          emissiveIntensity: 0.3
        })
        const isoMesh = new THREE.Mesh(isoGeometry, isoMaterial)
        isoMesh.position.set(5, 5, 5)
        scene.add(isoMesh)

        // Boucle d'animation
        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()
      } catch (e) {
        console.error('3D Visualizer Error:', e)
      }
    }

    init()

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        rendererRef.current = null
      }
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [data, stats])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2 1m2-1l-2-1m2 1v2.5" />
          </svg>
          {title}
        </h3>
        <div className="text-xs font-mono text-gray-500">
          {stats.count} Points | {Math.round(stats.minT)}K - {Math.round(stats.maxT)}K
        </div>
      </div>
      
      <div ref={containerRef} className="w-full h-[600px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />
      
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

export default Industrial3DVisualizerAdvanced
