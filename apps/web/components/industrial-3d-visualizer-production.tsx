'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  temperature: number;
  pressure: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure';
  maxPointsDisplay?: number;
}

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
    minT: 0, maxT: 0, minP: 0, maxP: 0, count: 0, 
    displayedCount: 0,
    xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1
  })

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const initEngine = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0a0a)

        const width = containerRef.current!.clientWidth
        const height = containerRef.current!.clientHeight
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(3, 3, 3)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(window.devicePixelRatio)

        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(5, 5, 5)
        scene.add(directionalLight)

        // Axes gradués industriels
        const axesHelper = new THREE.AxesHelper(2)
        scene.add(axesHelper)

        engineRef.current = {
          scene,
          camera,
          renderer,
          controls,
          frameId: null,
          points: null,
          boundingBox: null
        }

        const animate = () => {
          engineRef.current.frameId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

      } catch (e) {
        console.error('Three.js Init Error:', e)
      }
    }

    initEngine()

    return () => {
      if (engineRef.current.frameId) {
        cancelAnimationFrame(engineRef.current.frameId)
      }
      if (engineRef.current.renderer) {
        engineRef.current.renderer.dispose()
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  useEffect(() => {
    if (!engineRef.current.scene || !data.length) return

    const pointsToUse = data.slice(0, maxPointsDisplay)
    
    // Calculer les limites spatiales réelles
    const xMin = Math.min(...pointsToUse.map(p => p.x))
    const xMax = Math.max(...pointsToUse.map(p => p.x))
    const yMin = Math.min(...pointsToUse.map(p => p.y))
    const yMax = Math.max(...pointsToUse.map(p => p.y))
    const zMin = Math.min(...pointsToUse.map(p => p.z))
    const zMax = Math.max(...pointsToUse.map(p => p.z))

    // Calculer les statistiques
    const temps = pointsToUse.map(p => p.temperature)
    const press = pointsToUse.map(p => p.pressure)
    const newStats = {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      count: data.length,
      displayedCount: pointsToUse.length,
      xMin, xMax, yMin, yMax, zMin, zMax
    }
    setStats(newStats)

    // CRÉER LA BOÎTE DE DÉLIMITATION 3D
    if (engineRef.current.boundingBox) {
      engineRef.current.scene!.remove(engineRef.current.boundingBox)
      if (engineRef.current.boundingBox.geometry) {
        engineRef.current.boundingBox.geometry.dispose()
      }
      if (engineRef.current.boundingBox.material) {
        if (Array.isArray(engineRef.current.boundingBox.material)) {
          engineRef.current.boundingBox.material.forEach(m => m.dispose())
        } else {
          engineRef.current.boundingBox.material.dispose()
        }
      }
    }

    const boxGeometry = new THREE.BoxGeometry(xMax - xMin, yMax - yMin, zMax - zMin)
    const boxEdges = new THREE.EdgesGeometry(boxGeometry)
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x444444 }))
    boxLine.position.set((xMax + xMin) / 2, (yMax + yMin) / 2, (zMax + zMin) / 2)
    engineRef.current.scene!.add(boxLine)
    engineRef.current.boundingBox = boxLine

    // GÉOMÉTRIE DES POINTS
    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(pointsToUse.length * 3)
    const colArr = new Float32Array(pointsToUse.length * 3)

    const tMin = newStats.minT
    const tMax = newStats.maxT
    const pMin = newStats.minP
    const pMax = newStats.maxP

    pointsToUse.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      let norm = 0
      if (colorVariable === 'temperature') {
        norm = (p.temperature - tMin) / (tMax - tMin || 1)
      } else {
        norm = (p.pressure - pMin) / (pMax - pMin || 1)
      }

      // Dégradé industriel: Bleu (bas) -> Rouge (haut)
      const color = new THREE.Color()
      color.setHSL(0.66 * (1 - norm), 1, 0.5)
      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    })

    if (engineRef.current.points) {
      engineRef.current.scene!.remove(engineRef.current.points)
      engineRef.current.points.geometry.dispose()
      if (Array.isArray(engineRef.current.points.material)) {
        engineRef.current.points.material.forEach(m => m.dispose())
      } else {
        engineRef.current.points.material.dispose()
      }
    }

    const points = new THREE.Points(geometry, material)
    engineRef.current.scene!.add(points)
    engineRef.current.points = points

  }, [data, colorVariable, maxPointsDisplay])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-4">
        <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
        <div className="flex gap-4 text-[10px] font-mono text-gray-500">
          <span>Points: {stats.displayedCount.toLocaleString()} / {stats.count.toLocaleString()}</span>
          <span>X: [{stats.xMin.toFixed(2)}, {stats.xMax.toFixed(2)}]</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[600px] bg-black/40 rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4">
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <p className="text-[9px] text-gray-500 uppercase">Temp Min/Max</p>
          <p className="text-xs font-mono text-orange-400">{stats.minT.toFixed(1)}K / {stats.maxT.toFixed(1)}K</p>
        </div>
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <p className="text-[9px] text-gray-500 uppercase">Pres Min/Max</p>
          <p className="text-xs font-mono text-blue-400">{stats.minP.toFixed(1)}Pa / {stats.maxP.toFixed(1)}Pa</p>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerProduction
