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

  // Calcul des statistiques et des plages de coordonnées
  const coordRanges = useMemo(() => {
    if (!data.length) return { xRange: [0, 1], yRange: [0, 1], zRange: [0, 1] }
    
    const xs = data.map(p => p.x)
    const ys = data.map(p => p.y)
    const zs = data.map(p => p.z)
    
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const zMin = Math.min(...zs), zMax = Math.max(...zs)
    
    return {
      xRange: [xMin, xMax === xMin ? xMin + 1 : xMax],
      yRange: [yMin, yMax === yMin ? yMin + 1 : yMax],
      zRange: [zMin, zMax === zMin ? zMin + 1 : zMax]
    }
  }, [data])

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

  // Rendu Three.js - VERSION OPTIMISÉE
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: any

    const init = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)
        sceneRef.current = scene

        const width = containerRef.current!.clientWidth || 1000
        const height = containerRef.current!.clientHeight || 600
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(1.5, 1.5, 1.5)
        camera.lookAt(0.5, 0.5, 0.5)
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
        controls.autoRotate = false

        // Éclairage
        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 10)
        scene.add(directionalLight)

        // Grille
        const gridHelper = new THREE.GridHelper(1.2, 12, 0x444444, 0x222222)
        gridHelper.position.set(0.6, 0, 0.6)
        scene.add(gridHelper)

        // Axes
        const axisLength = 1.2
        
        // Axe X (rouge)
        const xAxisGeometry = new THREE.BufferGeometry()
        xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
        ))
        const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
        const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial)
        scene.add(xAxis)

        // Axe Y (vert)
        const yAxisGeometry = new THREE.BufferGeometry()
        yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
        ))
        const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
        const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial)
        scene.add(yAxis)

        // Axe Z (bleu)
        const zAxisGeometry = new THREE.BufferGeometry()
        zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
        ))
        const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
        const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial)
        scene.add(zAxis)

        // Boîte englobante
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
        const boxMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.2 })
        const boxLines = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), boxMaterial)
        boxLines.position.set(0.5, 0.5, 0.5)
        scene.add(boxLines)

        // Créer les points UNE SEULE FOIS
        const geometry = new THREE.BufferGeometry()
        const posArr = new Float32Array(data.length * 3)
        const colArr = new Float32Array(data.length * 3)
        
        const tRange = stats.maxT - stats.minT || 1
        const pRange = stats.maxP - stats.minP || 1

        data.forEach((p, i) => {
          const xNorm = (p.x - coordRanges.xRange[0]) / (coordRanges.xRange[1] - coordRanges.xRange[0] || 1)
          const yNorm = (p.y - coordRanges.yRange[0]) / (coordRanges.yRange[1] - coordRanges.yRange[0] || 1)
          const zNorm = (p.z - coordRanges.zRange[0]) / (coordRanges.zRange[1] - coordRanges.zRange[0] || 1)
          
          posArr[i * 3] = xNorm
          posArr[i * 3 + 1] = yNorm
          posArr[i * 3 + 2] = zNorm
          
          let norm = 0
          if (activeVariable === 'temperature') {
            norm = (p.temperature - stats.minT) / tRange
          } else {
            norm = (p.pressure - stats.minP) / pRange
          }
          
          const hue = 0.6 * (1 - norm)
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

        // Isosurface
        const isoGeometry = new THREE.IcosahedronGeometry(0.3, 6)
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
        isoMesh.position.set(0.5, 0.5, 0.5)
        scene.add(isoMesh)

        // Boucle d'animation OPTIMISÉE - Pas de recréation de géométries
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
  }, [data, stats, activeVariable, coordRanges])

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
      
      {/* Conteneur principal avec visualiseur et échelles */}
      <div className="relative flex gap-4">
        {/* Visualiseur 3D */}
        <div ref={containerRef} className="flex-1 h-[600px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />
        
        {/* Panneau des échelles de couleurs */}
        <div className="w-32 space-y-6 flex flex-col">
          {/* Sélecteur de variable */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">Variable</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveVariable('temperature')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeVariable === 'temperature'
                    ? 'bg-red-500/30 border border-red-500/50 text-red-400'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                Température
              </button>
              <button
                onClick={() => setActiveVariable('pressure')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeVariable === 'pressure'
                    ? 'bg-blue-500/30 border border-blue-500/50 text-blue-400'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                Pression
              </button>
            </div>
          </div>

          {/* Échelle Température */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">Température (K)</p>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-48 rounded-lg overflow-hidden border border-white/20 shadow-lg"
                style={{
                  background: 'linear-gradient(to top, rgb(0, 0, 255), rgb(0, 255, 0), rgb(255, 0, 0))'
                }}
              />
              <div className="text-center w-full">
                <p className="text-xs font-bold text-red-400">{Math.round(stats.maxT)}</p>
                <p className="text-[10px] text-gray-500">—</p>
                <p className="text-xs font-bold text-blue-400">{Math.round(stats.minT)}</p>
              </div>
            </div>
          </div>

          {/* Échelle Pression */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">Pression (kPa)</p>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-48 rounded-lg overflow-hidden border border-white/20 shadow-lg"
                style={{
                  background: 'linear-gradient(to top, rgb(0, 0, 255), rgb(0, 255, 0), rgb(255, 0, 0))'
                }}
              />
              <div className="text-center w-full">
                <p className="text-xs font-bold text-red-400">{Math.round(stats.maxP)}</p>
                <p className="text-[10px] text-gray-500">—</p>
                <p className="text-xs font-bold text-blue-400">{Math.round(stats.minP)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerAdvancedV3
