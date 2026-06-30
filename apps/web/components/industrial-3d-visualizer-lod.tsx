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
  colorVariable?: 'temperature' | 'pressure';
  maxPointsDisplay?: number;
}

/**
 * Système de LOD (Level of Detail) pour optimisation 3D
 * Réduit le nombre de points affichés en fonction de la distance caméra
 */
const Industrial3DVisualizerLOD: React.FC<Props> = ({ 
  data = [], 
  title = "3D Isosurface Visualization",
  colorVariable = 'temperature',
  maxPointsDisplay = 50000
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const pointsRef = useRef<THREE.Points | null>(null)
  
  const [stats, setStats] = useState({ minT: 0, maxT: 1, minP: 0, maxP: 1, count: 0, displayedCount: 0 })
  const [lodLevel, setLodLevel] = useState(0)
  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure'>(colorVariable)

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
      count: data.length,
      displayedCount: 0
    })
  }, [data])

  // Fonction de sélection LOD
  const selectLODData = useCallback((fullData: DataPoint[], cameraDistance: number): DataPoint[] => {
    if (fullData.length <= maxPointsDisplay) return fullData

    // Déterminer le niveau LOD basé sur la distance caméra
    let lodFactor = 1
    if (cameraDistance < 10) lodFactor = 1      // LOD 0: tous les points
    else if (cameraDistance < 20) lodFactor = 2 // LOD 1: 50% des points
    else if (cameraDistance < 40) lodFactor = 4 // LOD 2: 25% des points
    else lodFactor = 8                            // LOD 3: 12.5% des points

    const selectedData: DataPoint[] = []
    for (let i = 0; i < fullData.length; i += lodFactor) {
      selectedData.push(fullData[i])
    }
    
    setLodLevel(Math.log2(lodFactor))
    return selectedData
  }, [maxPointsDisplay])

  // Rendu Three.js avec LOD
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
        camera.position.set(8, 8, 8)
        camera.lookAt(0, 0, 0)
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
        const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222)
        scene.add(gridHelper)

        // Axes
        const axisLength = 6
        
        // Axe X (rouge)
        const xAxisGeometry = new THREE.BufferGeometry()
        xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
        ))
        const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
        scene.add(new THREE.Line(xAxisGeometry, xAxisMaterial))

        // Axe Y (vert)
        const yAxisGeometry = new THREE.BufferGeometry()
        yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
        ))
        const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
        scene.add(new THREE.Line(yAxisGeometry, yAxisMaterial))

        // Axe Z (bleu)
        const zAxisGeometry = new THREE.BufferGeometry()
        zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
        ))
        const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
        scene.add(new THREE.Line(zAxisGeometry, zAxisMaterial))

        // Boucle d'animation avec LOD dynamique
        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          controls.update()

          // Calculer la distance caméra et mettre à jour LOD
          const cameraDistance = camera.position.length()
          const lodData = selectLODData(data, cameraDistance)

          // Mettre à jour les points 3D
          if (pointsRef.current) {
            scene.remove(pointsRef.current)
          }

          const geometry = new THREE.BufferGeometry()
          const posArr = new Float32Array(lodData.length * 3)
          const colArr = new Float32Array(lodData.length * 3)
          
          const tRange = stats.maxT - stats.minT || 1
          const pRange = stats.maxP - stats.minP || 1

          lodData.forEach((p, i) => {
            posArr[i * 3] = p.x
            posArr[i * 3 + 1] = p.y
            posArr[i * 3 + 2] = p.z
            
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
          pointsRef.current = points

          setStats(prev => ({ ...prev, displayedCount: lodData.length }))

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
  }, [data, stats, activeVariable, selectLODData])

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
          LOD {lodLevel} | {stats.displayedCount.toLocaleString()} / {stats.count.toLocaleString()} Points
        </div>
      </div>
      
      {/* Conteneur principal avec visualiseur et échelles */}
      <div className="relative flex gap-4">
        {/* Visualiseur 3D */}
        <div ref={containerRef} className="flex-1 h-[600px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />
        
        {/* Panneau des contrôles et métriques */}
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

          {/* Informations LOD */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">LOD Status</p>
            <div className="space-y-2">
              <div className="text-center">
                <p className="text-2xl font-black text-blue-400">{lodLevel}</p>
                <p className="text-[10px] text-gray-500 mt-1">Level</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-400">
                  {((stats.displayedCount / stats.count) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Displayed</p>
              </div>
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

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Points Total</p>
          <p className="text-xl font-black text-blue-400">{stats.count.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Points Affichés</p>
          <p className="text-xl font-black text-cyan-400">{stats.displayedCount.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Réduction</p>
          <p className="text-xl font-black text-emerald-400">{((1 - stats.displayedCount / stats.count) * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">LOD Niveau</p>
          <p className="text-xl font-black text-yellow-400">{lodLevel}</p>
        </div>
      </div>

      {/* Info LOD */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-xs text-blue-400 font-bold">
          💡 <strong>LOD Optimization Active</strong> : Le système ajuste automatiquement le nombre de points affichés en fonction de la distance caméra pour maintenir une performance optimale. Zoomez pour voir plus de détails.
        </p>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerLOD
