'use client'
import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'

interface Industrial3DVisualizerProps {
  predictions: any[]
  title?: string
  colorScale?: string
  visualizationType?: 'trajectories' | 'isosurfaces' | 'crosssections' | 'vectorfield' | 'combined'
}

const Industrial3DVisualizer: React.FC<Industrial3DVisualizerProps> = ({
  predictions,
  title = "Visualisation 3D Industrielle",
  colorScale = "viridis",
  visualizationType = 'combined'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)

  // Fonction pour convertir une valeur en couleur selon une échelle
  const getColorFromScale = (value: number, min: number, max: number, scale: string) => {
    const normalized = (value - min) / (max - min || 1)
    const clamped = Math.max(0, Math.min(1, normalized))

    if (scale === 'viridis') {
      if (clamped < 0.25) {
        return new THREE.Color(clamped / 0.25, 0, 0.5)
      } else if (clamped < 0.5) {
        return new THREE.Color(0, (clamped - 0.25) / 0.25, 1)
      } else if (clamped < 0.75) {
        return new THREE.Color(0, 1, 1 - (clamped - 0.5) / 0.25)
      } else {
        return new THREE.Color((clamped - 0.75) / 0.25, 1, 0)
      }
    } else if (scale === 'thermal') {
      if (clamped < 0.5) {
        return new THREE.Color(0, clamped * 2, 1)
      } else {
        return new THREE.Color((clamped - 0.5) * 2, 1, 0)
      }
    }
    return new THREE.Color(clamped, clamped, clamped)
  }

  // Création des trajectoires 3D
  const createTrajectories = (scene: THREE.Scene) => {
    if (!predictions || predictions.length === 0) return

    const positions: number[] = []
    const colors: number[] = []
    const velocities = predictions.map(p => p.velocity_magnitude || p.velocity_u || 0)
    const minVel = Math.min(...velocities)
    const maxVel = Math.max(...velocities)

    predictions.forEach(p => {
      positions.push(p.x || 0, p.y || 0, p.z || 0)
      const color = getColorFromScale(p.velocity_magnitude || 0, minVel, maxVel, 'thermal')
      colors.push(color.r, color.g, color.b)
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 4,
      transparent: true,
      opacity: 0.8
    })

    const trajectory = new THREE.Line(geometry, material)
    scene.add(trajectory)

    // Ajout de points le long de la trajectoire
    const pointGeometry = new THREE.BufferGeometry()
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    })

    const points = new THREE.Points(pointGeometry, pointMaterial)
    scene.add(points)
  }

  // Création des vecteurs de vitesse
  const createVectorField = (scene: THREE.Scene) => {
    if (!predictions || predictions.length === 0) return

    const velocities = predictions.map(p => p.velocity_magnitude || 0)
    const minVel = Math.min(...velocities)
    const maxVel = Math.max(...velocities)

    // Échantillonnage tous les 5 points pour éviter la surcharge
    predictions.forEach((p, i) => {
      if (i % 5 !== 0) return

      const u = p.velocity_u || 0
      const v = p.velocity_v || 0
      const w = p.velocity_w || 0
      const magnitude = Math.sqrt(u * u + v * v + w * w)

      if (magnitude < 0.01) return

      const start = new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0)
      const direction = new THREE.Vector3(u, v, w).normalize()
      const end = start.clone().add(direction.multiplyScalar(0.05))

      const color = getColorFromScale(magnitude, minVel, maxVel, 'thermal')

      // Création d'une flèche
      const arrowHelper = new THREE.ArrowHelper(direction, start, 0.05, color.getHex(), 0.02, 0.015)
      scene.add(arrowHelper)
    })
  }

  // Création d'isosurfaces (représentation simplifiée)
  const createIsosurfaces = (scene: THREE.Scene) => {
    if (!predictions || predictions.length < 10) return

    const temperatures = predictions.map(p => p.temperature || 0)
    const minTemp = Math.min(...temperatures)
    const maxTemp = Math.max(...temperatures)
    const midTemp = (minTemp + maxTemp) / 2

    // Création d'une surface implicite basée sur la température moyenne
    const geometry = new THREE.IcosahedronGeometry(0.1, 4)
    const material = new THREE.MeshPhongMaterial({
      color: getColorFromScale(midTemp, minTemp, maxTemp, 'thermal'),
      transparent: true,
      opacity: 0.3,
      wireframe: false
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0.5, 0.5, 0.5)
    scene.add(mesh)
  }

  // Création des coupes transversales
  const createCrossSections = (scene: THREE.Scene) => {
    if (!predictions || predictions.length === 0) return

    // Coupe XY à z = 0.5
    const xyPoints: THREE.Vector3[] = []
    const xyColors: THREE.Color[] = []
    const temps = predictions.map(p => p.temperature || 0)
    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)

    predictions.forEach(p => {
      if (Math.abs((p.z || 0) - 0.5) < 0.05) {
        xyPoints.push(new THREE.Vector3(p.x || 0, p.y || 0, 0.5))
        xyColors.push(getColorFromScale(p.temperature || 0, minTemp, maxTemp, 'thermal'))
      }
    })

    if (xyPoints.length > 0) {
      const geometry = new THREE.BufferGeometry()
      geometry.setFromPoints(xyPoints)
      const colors = xyColors.map(c => [c.r, c.g, c.b]).flat()
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

      const material = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.7
      })

      const points = new THREE.Points(geometry, material)
      scene.add(points)
    }
  }

  // Ajout des axes et grille
  const addAxesAndGrid = (scene: THREE.Scene) => {
    // Axes
    const axesHelper = new THREE.AxesHelper(0.3)
    scene.add(axesHelper)

    // Grille
    const gridHelper = new THREE.GridHelper(1, 10, 0x444444, 0x222222)
    gridHelper.position.y = -0.5
    scene.add(gridHelper)

    // Boîte englobante
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
    const boxMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3 })
    const boxLines = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), boxMaterial)
    scene.add(boxLines)
  }

  useEffect(() => {
    if (!containerRef.current || !predictions || predictions.length === 0) {
      setLoading(false)
      return
    }

    // Initialisation de la scène
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    sceneRef.current = scene

    // Caméra
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(1, 1, 1)
    camera.lookAt(0.5, 0.5, 0.5)
    cameraRef.current = camera

    // Rendu
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Ajout des éléments de visualisation
    addAxesAndGrid(scene)

    if (visualizationType === 'trajectories' || visualizationType === 'combined') {
      createTrajectories(scene)
    }
    if (visualizationType === 'vectorfield' || visualizationType === 'combined') {
      createVectorField(scene)
    }
    if (visualizationType === 'isosurfaces' || visualizationType === 'combined') {
      createIsosurfaces(scene)
    }
    if (visualizationType === 'crosssections' || visualizationType === 'combined') {
      createCrossSections(scene)
    }

    // Contrôles de souris simples
    let isDragging = false
    let previousMousePosition = { x: 0, y: 0 }

    renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true
      previousMousePosition = { x: e.clientX, y: e.clientY }
    })

    renderer.domElement.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x
        const deltaY = e.clientY - previousMousePosition.y

        const rotation = new THREE.Quaternion()
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01)
        camera.position.applyQuaternion(rotation)

        rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.01)
        camera.position.applyQuaternion(rotation)

        camera.lookAt(0.5, 0.5, 0.5)
        previousMousePosition = { x: e.clientX, y: e.clientY }
      }
    })

    renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false
    })

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault()
      const direction = camera.position.clone().sub(new THREE.Vector3(0.5, 0.5, 0.5)).normalize()
      const distance = camera.position.distanceTo(new THREE.Vector3(0.5, 0.5, 0.5))
      const newDistance = distance + e.deltaY * 0.001
      camera.position.copy(new THREE.Vector3(0.5, 0.5, 0.5).add(direction.multiplyScalar(newDistance)))
    })

    // Boucle d'animation
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    setLoading(false)

    // Nettoyage
    return () => {
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [predictions, visualizationType])

  return (
    <div className="w-full h-[600px] bg-[#0f172a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-white/10 bg-black/50">
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-white/60 text-xs mt-1">Glissez pour tourner • Molette pour zoomer • Type: {visualizationType}</p>
      </div>
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50">Chargement de la visualisation 3D...</div>
        </div>
      )}
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}

export default Industrial3DVisualizer
