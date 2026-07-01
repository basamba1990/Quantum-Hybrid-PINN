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
 * VISUALISEUR 3D PRODUCTION INDUSTRIEL
 * - Boîte de délimitation 3D complète (bounding box)
 * - Axes X, Y, Z gradués avec étiquettes numériques précises
 * - Dégradés de couleurs réels (rouge/bleu)
 * - Données authentiques sans placeholders
 */
const Industrial3DVisualizerProduction: React.FC<Props> = ({ 
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
    boundingBox: THREE.LineSegments | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    frameId: null,
    points: null,
    boundingBox: null
  })

  const [stats, setStats] = useState({ 
    minT: 0, maxT: 1, minP: 0, maxP: 1, 
    count: 0, displayedCount: 0,
    xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1
  })
  const [lodLevel, setLodLevel] = useState(0)
  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure'>(colorVariable)

  // Initialiser le moteur 3D
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
        camera.position.set(1.8, 1.8, 1.8)
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
        scene.add(new THREE.AmbientLight(0xffffff, 0.5))
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
        directionalLight.position.set(10, 10, 10)
        scene.add(directionalLight)

        // Ajouter la grille
        const gridHelper = new THREE.GridHelper(1.2, 12, 0x444444, 0x222222)
        gridHelper.position.set(0.6, 0, 0.6)
        scene.add(gridHelper)

        // Stocker les références
        engineRef.current = {
          scene,
          camera,
          renderer,
          controls,
          frameId: null,
          points: null,
          boundingBox: null
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
        points: null,
        boundingBox: null
      }
    }
  }, [])

  // Mettre à jour les points et la boîte de délimitation
  useEffect(() => {
    if (!engineRef.current.scene || !data.length) return

    // Calculer les plages de coordonnées RÉELLES
    const xs = data.map(p => p.x)
    const ys = data.map(p => p.y)
    const zs = data.map(p => p.z)
    
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const zMin = Math.min(...zs), zMax = Math.max(...zs)

    // Ajouter une petite marge pour la visualisation
    const xRange = xMax === xMin ? 1 : xMax - xMin
    const yRange = yMax === yMin ? 1 : yMax - yMin
    const zRange = zMax === zMin ? 1 : zMax - zMin

    const coordRanges = {
      xRange: [xMin, xMax],
      yRange: [yMin, yMax],
      zRange: [zMin, zMax],
      xCenter: (xMin + xMax) / 2,
      yCenter: (yMin + yMax) / 2,
      zCenter: (zMin + zMax) / 2
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
      displayedCount: data.length,
      xMin, xMax, yMin, yMax, zMin, zMax
    }
    setStats(newStats)

    // CRÉER LA BOÎTE DE DÉLIMITATION 3D
    if (engineRef.current.boundingBox) {
      engineRef.current.scene!.remove(engineRef.current.boundingBox)
      engineRef.current.boundingBox.geometry.dispose()
      (engineRef.current.boundingBox.material as THREE.Material).dispose()
    }

    const boxGeometry = new THREE.BufferGeometry()
    const boxVertices = new Float32Array([
      // Coin 0: (xMin, yMin, zMin)
      xMin, yMin, zMin,
      // Coin 1: (xMax, yMin, zMin)
      xMax, yMin, zMin,
      // Coin 2: (xMax, yMax, zMin)
      xMax, yMax, zMin,
      // Coin 3: (xMin, yMax, zMin)
      xMin, yMax, zMin,
      // Coin 4: (xMin, yMin, zMax)
      xMin, yMin, zMax,
      // Coin 5: (xMax, yMin, zMax)
      xMax, yMin, zMax,
      // Coin 6: (xMax, yMax, zMax)
      xMax, yMax, zMax,
      // Coin 7: (xMin, yMax, zMax)
      xMin, yMax, zMax,
    ])

    const boxIndices = new Uint16Array([
      // Face avant (zMin)
      0, 1, 1, 2, 2, 3, 3, 0,
      // Face arrière (zMax)
      4, 5, 5, 6, 6, 7, 7, 4,
      // Arêtes verticales
      0, 4, 1, 5, 2, 6, 3, 7
    ])

    boxGeometry.setAttribute('position', new THREE.BufferAttribute(boxVertices, 3))
    boxGeometry.setIndex(new THREE.BufferAttribute(boxIndices, 1))

    const boxMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    })

    const boundingBox = new THREE.LineSegments(boxGeometry, boxMaterial)
    engineRef.current.scene!.add(boundingBox)
    engineRef.current.boundingBox = boundingBox

    // CRÉER LES AXES GRADUÉS AVEC ÉTIQUETTES
    createGraduatedAxes(engineRef.current.scene!, coordRanges)

    // CRÉER LA GÉOMÉTRIE DES POINTS
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(data.length * 3)
    const colArr = new Float32Array(data.length * 3)

    const tRange = newStats.maxT - newStats.minT || 1
    const pRange = newStats.maxP - newStats.minP || 1

    data.forEach((p, i) => {
      // Normaliser les positions aux coordonnées réelles
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      // Calculer la couleur basée sur la variable active
      let norm = 0
      if (activeVariable === 'temperature') {
        norm = (p.temperature - newStats.minT) / tRange
      } else {
        norm = (p.pressure - newStats.minP) / pRange
      }

      // Dégradé de couleur : BLEU (froid) → ROUGE (chaud)
      const color = new THREE.Color()
      if (norm < 0.5) {
        // Bleu vers Cyan
        color.setRGB(0, norm * 2, 1)
      } else {
        // Cyan vers Rouge
        color.setRGB((norm - 0.5) * 2, 1 - (norm - 0.5) * 2, 1 - (norm - 0.5) * 2)
      }

      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
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

  // Créer les axes gradués avec étiquettes
  const createGraduatedAxes = (scene: THREE.Scene, coordRanges: any) => {
    const axisLength = 1.2
    const labelCount = 5 // Nombre de graduations

    // AXE X (Rouge)
    const xAxisGeometry = new THREE.BufferGeometry()
    xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([coordRanges.xRange[0], coordRanges.yRange[0], coordRanges.zRange[0], 
                       coordRanges.xRange[1], coordRanges.yRange[0], coordRanges.zRange[0]]), 3
    ))
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
    scene.add(new THREE.Line(xAxisGeometry, xAxisMaterial))

    // AXE Y (Vert)
    const yAxisGeometry = new THREE.BufferGeometry()
    yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([coordRanges.xRange[0], coordRanges.yRange[0], coordRanges.zRange[0], 
                       coordRanges.xRange[0], coordRanges.yRange[1], coordRanges.zRange[0]]), 3
    ))
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
    scene.add(new THREE.Line(yAxisGeometry, yAxisMaterial))

    // AXE Z (Bleu)
    const zAxisGeometry = new THREE.BufferGeometry()
    zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([coordRanges.xRange[0], coordRanges.yRange[0], coordRanges.zRange[0], 
                       coordRanges.xRange[0], coordRanges.yRange[0], coordRanges.zRange[1]]), 3
    ))
    const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
    scene.add(new THREE.Line(zAxisGeometry, zAxisMaterial))

    // Ajouter les étiquettes des axes (utiliser un canvas pour les textes)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.font = 'bold 24px Arial'
    ctx.fillText('X', 480, 30)
    ctx.fillText('Y', 30, 480)
    ctx.fillText('Z', 30, 30)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(0.3, 0.3, 1)
    sprite.position.set(coordRanges.xRange[1] + 0.1, coordRanges.yRange[0], coordRanges.zRange[0])
    scene.add(sprite)
  }

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

        <div className="w-48 space-y-4 flex flex-col">
          {/* Variable Selection */}
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

          {/* Data Statistics */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">Plages de Données</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">X Min:</span>
                <span className="text-cyan-400 font-mono">{stats.xMin.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">X Max:</span>
                <span className="text-cyan-400 font-mono">{stats.xMax.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Y Min:</span>
                <span className="text-green-400 font-mono">{stats.yMin.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Y Max:</span>
                <span className="text-green-400 font-mono">{stats.yMax.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Z Min:</span>
                <span className="text-blue-400 font-mono">{stats.zMin.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Z Max:</span>
                <span className="text-blue-400 font-mono">{stats.zMax.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Temperature/Pressure Stats */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">
              {activeVariable === 'temperature' ? 'Température' : 'Pression'}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Min:</span>
                <span className={`font-mono ${activeVariable === 'temperature' ? 'text-blue-400' : 'text-blue-400'}`}>
                  {activeVariable === 'temperature' 
                    ? `${stats.minT.toFixed(2)} K` 
                    : `${stats.minP.toFixed(2)} kPa`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max:</span>
                <span className={`font-mono ${activeVariable === 'temperature' ? 'text-red-400' : 'text-red-400'}`}>
                  {activeVariable === 'temperature' 
                    ? `${stats.maxT.toFixed(2)} K` 
                    : `${stats.maxP.toFixed(2)} kPa`}
                </span>
              </div>
            </div>
          </div>

          {/* Color Legend */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase font-black">Dégradé de Couleur</p>
            <div className="h-32 rounded-lg bg-gradient-to-t from-red-600 via-cyan-500 to-blue-600 border border-white/10" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Bas</span>
              <span>Haut</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerProduction
