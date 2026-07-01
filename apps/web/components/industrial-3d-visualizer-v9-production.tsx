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
  colorVariable?: 'temperature' | 'pressure' | 'velocity';
  maxPointsDisplay?: number;
}

/**
 * VISUALISEUR 3D V9 - TRULY INDUSTRIAL
 * - Onglets de sélection (Température, Pression, Vitesse)
 * - Échelle de couleur verticale graduée avec chiffres exacts
 * - Axes X,Y,Z naturels et rigoureux
 * - Grille 3D complète
 * - Rendu physiquement naturel
 */
const Industrial3DVisualizerV9: React.FC<Props> = ({ 
  data = [], 
  title = "Hydrogen Flow Trajectory",
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

  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure' | 'velocity'>(colorVariable)
  const [stats, setStats] = useState({ 
    minT: 180, maxT: 380, minP: 0, maxP: 3.5, minV: 0, maxV: 20,
    xMin: 0, xMax: 12, yMin: -1, yMax: 1, zMin: 0, zMax: 12,
    count: 0
  })

  // Initialiser le moteur 3D
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const initEngine = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        // Créer la scène
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0e27)
        scene.fog = new THREE.Fog(0x0a0e27, 20, 50)

        // Créer la caméra
        const width = containerRef.current!.clientWidth || 1000
        const height = containerRef.current!.clientHeight || 600
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(8, 2, 8)
        camera.lookAt(6, 0, 6)

        // Créer le renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true

        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)

        // Créer les contrôles
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = false
        controls.enableZoom = true
        controls.enablePan = true

        // Ajouter l'éclairage réaliste
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(15, 10, 15)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        scene.add(directionalLight)

        // Ajouter une lumière de remplissage
        const fillLight = new THREE.DirectionalLight(0x6688ff, 0.3)
        fillLight.position.set(-10, 5, -10)
        scene.add(fillLight)

        // Créer la grille 3D
        createIndustrialGrid(scene)

        // Créer les axes avec étiquettes
        createIndustrialAxes(scene)

        // Créer le pipeline (tube de référence)
        createPipelineGeometry(scene)

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

  // Mettre à jour les points
  useEffect(() => {
    if (!engineRef.current.scene || !data.length) return

    // Calculer les statistiques réelles
    const xs = data.map(p => p.x)
    const ys = data.map(p => p.y)
    const zs = data.map(p => p.z)
    const temps = data.map(p => p.temperature)
    const press = data.map(p => p.pressure)
    const vels = data.map(p => p.velocity_magnitude || 0)

    const newStats = {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      minV: Math.min(...vels),
      maxV: Math.max(...vels),
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
      zMin: Math.min(...zs),
      zMax: Math.max(...zs),
      count: data.length
    }
    setStats(newStats)

    // Créer la géométrie des points
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(data.length * 3)
    const colArr = new Float32Array(data.length * 3)

    const tRange = newStats.maxT - newStats.minT || 1
    const pRange = newStats.maxP - newStats.minP || 1
    const vRange = newStats.maxV - newStats.minV || 1

    data.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      let norm = 0
      let color = new THREE.Color()

      if (activeVariable === 'temperature') {
        norm = (p.temperature - newStats.minT) / tRange
        // Dégradé: Bleu (froid) → Cyan → Jaune → Rouge (chaud)
        if (norm < 0.33) {
          color.setRGB(0, norm * 3, 1)
        } else if (norm < 0.66) {
          color.setRGB(0, 1, 1 - (norm - 0.33) * 3)
        } else {
          color.setRGB((norm - 0.66) * 3, 1 - (norm - 0.66) * 3, 0)
        }
      } else if (activeVariable === 'pressure') {
        norm = (p.pressure - newStats.minP) / pRange
        // Dégradé: Bleu → Vert → Jaune → Rouge
        if (norm < 0.33) {
          color.setRGB(0, norm * 3, 1)
        } else if (norm < 0.66) {
          color.setRGB(0, 1, 1 - (norm - 0.33) * 3)
        } else {
          color.setRGB((norm - 0.66) * 3, 1 - (norm - 0.66) * 3, 0)
        }
      } else {
        // Vitesse
        norm = (p.velocity_magnitude || 0 - newStats.minV) / vRange
        if (norm < 0.5) {
          color.setRGB(0, norm * 2, 1)
        } else {
          color.setRGB((norm - 0.5) * 2, 1 - (norm - 0.5) * 2, 0)
        }
      }

      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
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

  }, [data, activeVariable])

  // Créer la grille 3D industrielle
  const createIndustrialGrid = (scene: THREE.Scene) => {
    const gridHelper = new THREE.GridHelper(12, 12, 0x2a4a6a, 0x1a2a4a)
    gridHelper.position.set(6, -1.2, 6)
    scene.add(gridHelper)
  }

  // Créer les axes avec étiquettes
  const createIndustrialAxes = (scene: THREE.Scene) => {
    // Axe X (Rouge)
    const xAxisGeometry = new THREE.BufferGeometry()
    xAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 12, 0, 0]), 3
    ))
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 3 })
    scene.add(new THREE.Line(xAxisGeometry, xAxisMaterial))

    // Axe Y (Vert)
    const yAxisGeometry = new THREE.BufferGeometry()
    yAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, -1, 0, 0, 1, 0]), 3
    ))
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 3 })
    scene.add(new THREE.Line(yAxisGeometry, yAxisMaterial))

    // Axe Z (Bleu)
    const zAxisGeometry = new THREE.BufferGeometry()
    zAxisGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, 12]), 3
    ))
    const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 3 })
    scene.add(new THREE.Line(zAxisGeometry, zAxisMaterial))

    // Ajouter les étiquettes des axes (petits cubes)
    const labelGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
    const xLabelMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 })
    const xLabel = new THREE.Mesh(labelGeometry, xLabelMaterial)
    xLabel.position.set(12.5, 0, 0)
    scene.add(xLabel)

    const yLabelMaterial = new THREE.MeshBasicMaterial({ color: 0x44ff44 })
    const yLabel = new THREE.Mesh(labelGeometry, yLabelMaterial)
    yLabel.position.set(0, 1.5, 0)
    scene.add(yLabel)

    const zLabelMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff })
    const zLabel = new THREE.Mesh(labelGeometry, zLabelMaterial)
    zLabel.position.set(0, 0, 12.5)
    scene.add(zLabel)
  }

  // Créer la géométrie du pipeline
  const createPipelineGeometry = (scene: THREE.Scene) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3, 0.2, 3),
      new THREE.Vector3(6, -0.1, 6),
      new THREE.Vector3(9, 0.1, 9),
      new THREE.Vector3(12, 0, 12)
    ])

    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.3, 8, false)
    const tubeMaterial = new THREE.MeshPhongMaterial({
      color: 0x4a4a4a,
      opacity: 0.3,
      transparent: true,
      shininess: 30
    })
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial)
    scene.add(tube)
  }

  // Fonction pour obtenir les valeurs min/max et unités
  const getScaleInfo = () => {
    if (activeVariable === 'temperature') {
      return {
        min: stats.minT.toFixed(1),
        max: stats.maxT.toFixed(1),
        unit: 'K',
        steps: [180, 220, 260, 300, 340, 380]
      }
    } else if (activeVariable === 'pressure') {
      return {
        min: stats.minP.toFixed(2),
        max: stats.maxP.toFixed(2),
        unit: 'MPa',
        steps: [0, 0.7, 1.4, 2.1, 2.8, 3.5]
      }
    } else {
      return {
        min: stats.minV.toFixed(1),
        max: stats.maxV.toFixed(1),
        unit: 'm/s',
        steps: [0, 4, 8, 12, 16, 20]
      }
    }
  }

  const scaleInfo = getScaleInfo()

  return (
    <div className="w-full space-y-4">
      {/* Onglets de sélection */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveVariable('temperature')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-all ${
            activeVariable === 'temperature'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Temperature
        </button>
        <button
          onClick={() => setActiveVariable('pressure')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-all ${
            activeVariable === 'pressure'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Pressure
        </button>
        <button
          onClick={() => setActiveVariable('velocity')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-all ${
            activeVariable === 'velocity'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Velocity
        </button>
      </div>

      {/* Visualiseur 3D avec échelle graduée */}
      <div className="relative flex gap-4">
        {/* Canvas 3D */}
        <div ref={containerRef} className="flex-1 h-[600px] bg-slate-950 rounded-lg border border-white/10 overflow-hidden shadow-2xl" />

        {/* Échelle de couleur graduée */}
        <div className="w-20 flex flex-col">
          {/* Barre de gradient */}
          <div className="flex-1 rounded-lg overflow-hidden border border-white/20 relative bg-gradient-to-t from-red-600 via-yellow-500 to-blue-600 shadow-lg">
            {/* Étiquettes graduées */}
            <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[10px] text-gray-300 pr-1">
              {scaleInfo.steps.reverse().map((step, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="font-mono">{step}</span>
                  <div className="w-2 h-px bg-white/30" />
                </div>
              ))}
            </div>
          </div>

          {/* Unité */}
          <div className="text-center text-[11px] text-gray-400 mt-2 font-mono">
            {scaleInfo.unit}
          </div>

          {/* Min/Max */}
          <div className="text-center text-[9px] text-gray-500 mt-1 space-y-1">
            <div>Max: {scaleInfo.max}</div>
            <div>Min: {scaleInfo.min}</div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400">X Range</div>
          <div className="text-cyan-400 font-mono">{stats.xMin.toFixed(1)} - {stats.xMax.toFixed(1)} m</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400">Y Range</div>
          <div className="text-green-400 font-mono">{stats.yMin.toFixed(1)} - {stats.yMax.toFixed(1)} m</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <div className="text-gray-400">Z Range</div>
          <div className="text-blue-400 font-mono">{stats.zMin.toFixed(1)} - {stats.zMax.toFixed(1)} m</div>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV9
