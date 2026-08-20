'use client'

import React, { useEffect, useRef, useState } from 'react'
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
 * Composant 3D STABLE et ISOLÉ
 * - Pas de recréation de géométries dans la boucle d'animation
 * - Gestion complète du cycle de vie du renderer
 * - Nettoyage approprié des ressources
 */
const Industrial3DVisualizerStable: React.FC<Props> = ({ 
  data = [], 
  title = "3D Isosurface Visualization",
  colorVariable = 'temperature',
  maxPointsDisplay = 50000
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    controls: any
    frameId: number | null
    points: THREE.Points | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    frameId: null,
    points: null
  })

  const [stats, setStats] = useState({ minT: 0, maxT: 1, minP: 0, maxP: 1, count: 0, displayedCount: 0 })
  const [lodLevel, setLodLevel] = useState(0)
  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure'>(colorVariable)

  // Initialiser le moteur 3D UNE SEULE FOIS
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const initEngine = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        // Créer la scène
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)

        // Créer la caméra
        const width = containerRef.current!.clientWidth || 1000
        const height = containerRef.current!.clientHeight || 600
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(1.5, 1.5, 1.5)
        camera.lookAt(0.5, 0.5, 0.5)

        // Créer le renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)

        // Créer les contrôles
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = false

        // Ajouter l'éclairage
        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 10)
        scene.add(directionalLight)

        // Ajouter la grille
        const gridHelper = new THREE.GridHelper(1.2, 12, 0x444444, 0x222222)
        gridHelper.position.set(0.6, 0, 0.6)
        scene.add(gridHelper)

        // Ajouter les axes
        const axisLength = 1.2
        const xAxisGeometry = new THREE.BufferGeometry()
        xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
        ))
        const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
        scene.add(new THREE.Line(xAxisGeometry, xAxisMaterial))

        const yAxisGeometry = new THREE.BufferGeometry()
        yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
        ))
        const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
        scene.add(new THREE.Line(yAxisGeometry, yAxisMaterial))

        const zAxisGeometry = new THREE.BufferGeometry()
        zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
        ))
        const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
        scene.add(new THREE.Line(zAxisGeometry, zAxisMaterial))

        // Stocker les références
        engineRef.current = {
          scene,
          camera,
          renderer,
          controls,
          frameId: null,
          points: null
        }

        // Lancer la boucle d'animation
        const animate = () => {
          engineRef.current.frameId = requestAnimationFrame(animate)
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
      // Nettoyage complet
      if (engineRef.current.frameId) {
        cancelAnimationFrame(engineRef.current.frameId)
      }
      if (engineRef.current.renderer) {
        engineRef.current.renderer.dispose()
        engineRef.current.renderer.forceContextLoss()
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      engineRef.current = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        frameId: null,
        points: null
      }
    }
  }, [])

  // Mettre à jour les points quand les données changent
  useEffect(() => {
    if (!engineRef.current.scene || !data.length) return

    // Calculer les plages de coordonnées
    const xs = data.map(p => p.x)
    const ys = data.map(p => p.y)
    const zs = data.map(p => p.z)
    
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const zMin = Math.min(...zs), zMax = Math.max(...zs)

    const coordRanges = {
      xRange: [xMin, xMax === xMin ? xMin + 1 : xMax],
      yRange: [yMin, yMax === yMin ? yMin + 1 : yMax],
      zRange: [zMin, zMax === zMin ? zMin + 1 : zMax]
    }

    // Calculer les statistiques
    const temps = data.map(p => p.temperature)
    const press = data.map(p => p.pressure)
    const newStats = {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      count: data.length,
      displayedCount: data.length
    }
    setStats(newStats)

    // Créer la géométrie des points
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(data.length * 3)
    const colArr = new Float32Array(data.length * 3)

    const tRange = newStats.maxT - newStats.minT || 1
    const pRange = newStats.maxP - newStats.minP || 1

    data.forEach((p, i) => {
      const xNorm = (p.x - coordRanges.xRange[0]) / (coordRanges.xRange[1] - coordRanges.xRange[0])
      const yNorm = (p.y - coordRanges.yRange[0]) / (coordRanges.yRange[1] - coordRanges.yRange[0])
      const zNorm = (p.z - coordRanges.zRange[0]) / (coordRanges.zRange[1] - coordRanges.zRange[0])

      posArr[i * 3] = xNorm
      posArr[i * 3 + 1] = yNorm
      posArr[i * 3 + 2] = zNorm

      let norm = 0
      if (activeVariable === 'temperature') {
        norm = (p.temperature - newStats.minT) / tRange
      } else {
        norm = (p.pressure - newStats.minP) / pRange
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

    // Supprimer les anciens points
    if (engineRef.current.points) {
      engineRef.current.scene!.remove(engineRef.current.points);
      (engineRef.current.points.geometry as THREE.BufferGeometry).dispose();
      (engineRef.current.points.material as THREE.Material).dispose();
    }

    // Ajouter les nouveaux points
    const points = new THREE.Points(geometry, pointsMaterial)
    engineRef.current.scene!.add(points)
    engineRef.current.points = points

    setLodLevel(0)
  }, [data, activeVariable])

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

      <div className="relative flex gap-4">
        <div ref={containerRef} className="flex-1 h-[600px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />

        <div className="w-32 space-y-6 flex flex-col">
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
          <p className="text-xl font-black text-emerald-400">0.0%</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">LOD Niveau</p>
          <p className="text-xl font-black text-yellow-400">{lodLevel}</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-xs text-blue-400 font-bold">
          💡 <strong>Moteur 3D Stable</strong> : Rendu optimisé et fluide sans blocage.
        </p>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerStable
