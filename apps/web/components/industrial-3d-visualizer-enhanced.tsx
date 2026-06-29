'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Industrial3DVisualizerEnhancedProps {
  data: any[]
}

const Industrial3DVisualizerEnhanced: React.FC<Industrial3DVisualizerEnhancedProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const [stats, setStats] = useState({ pointCount: 0, avgTemp: 0, maxVelocity: 0 })

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return

    // ✅ Initialisation Three.js
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(50, 50, 50)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ✅ Éclairage industriel
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(100, 100, 50)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // ✅ Grille 3D de référence
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222)
    scene.add(gridHelper)

    // ✅ Axes de référence
    const axesHelper = new THREE.AxesHelper(50)
    scene.add(axesHelper)

    // ✅ Calcul des statistiques
    const temps = data.map(p => p.temperature || 300)
    const vels = data.map(p => p.velocity_magnitude || p.velocity || 0)
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length
    const maxVel = Math.max(...vels)

    setStats({
      pointCount: data.length,
      avgTemp: parseFloat(avgTemp.toFixed(2)),
      maxVelocity: parseFloat(maxVel.toFixed(3))
    })

    // ✅ Trajectoires hélicoïdales avec gradient thermique
    const trajectoryGeometry = new THREE.BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []

    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)

    data.forEach((point, i) => {
      positions.push(point.x || 0, point.y || 0, point.z || 0)

      // Gradient de couleur basé sur la température
      const temp = point.temperature || 300
      const normalizedTemp = (temp - minTemp) / (maxTemp - minTemp || 1)
      
      // Gradient bleu (froid) -> rouge (chaud)
      const r = normalizedTemp
      const g = 0.5 - Math.abs(normalizedTemp - 0.5)
      const b = 1 - normalizedTemp

      colors.push(r, g, b)
    })

    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    trajectoryGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

    const trajectoryMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 3,
      fog: false
    })

    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial)
    scene.add(trajectoryLine)

    // ✅ Points de marqueurs avec taille proportionnelle à la vitesse
    const markerGeometry = new THREE.BufferGeometry()
    const markerPositions: number[] = []
    const markerColors: number[] = []
    const markerSizes: number[] = []

    data.forEach((point, i) => {
      if (i % Math.max(1, Math.floor(data.length / 100)) === 0) { // Limiter à 100 marqueurs
        markerPositions.push(point.x || 0, point.y || 0, point.z || 0)
        
        const temp = point.temperature || 300
        const normalizedTemp = (temp - minTemp) / (maxTemp - minTemp || 1)
        const r = normalizedTemp
        const g = 0.5 - Math.abs(normalizedTemp - 0.5)
        const b = 1 - normalizedTemp
        
        markerColors.push(r, g, b)
        
        const vel = point.velocity_magnitude || point.velocity || 0
        const normalizedVel = Math.min(1, vel / (maxVel || 1))
        markerSizes.push(2 + normalizedVel * 8)
      }
    })

    markerGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(markerPositions), 3))
    markerGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(markerColors), 3))
    markerGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(markerSizes), 1))

    const markerMaterial = new THREE.PointsMaterial({
      vertexColors: true,
      sizeAttenuation: true,
      fog: false
    })

    const markers = new THREE.Points(markerGeometry, markerMaterial)
    scene.add(markers)

    // ✅ Isosurfaces (plans de coupe)
    const crossSectionGeometry = new THREE.PlaneGeometry(100, 100)
    const crossSectionMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    })

    const crossSectionXY = new THREE.Mesh(crossSectionGeometry, crossSectionMaterial)
    crossSectionXY.position.z = 0
    scene.add(crossSectionXY)

    // ✅ Contrôles de caméra (orbite simple)
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

        const radius = camera.position.length()
        const theta = Math.atan2(camera.position.x, camera.position.z) + deltaX * 0.01
        const phi = Math.acos(camera.position.y / radius) + deltaY * 0.01

        camera.position.x = radius * Math.sin(phi) * Math.sin(theta)
        camera.position.y = radius * Math.cos(phi)
        camera.position.z = radius * Math.sin(phi) * Math.cos(theta)
        camera.lookAt(0, 0, 0)

        previousMousePosition = { x: e.clientX, y: e.clientY }
      }
    })

    renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false
    })

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault()
      const radius = camera.position.length()
      const newRadius = Math.max(10, Math.min(200, radius + e.deltaY * 0.1))
      const direction = camera.position.clone().normalize()
      camera.position.copy(direction.multiplyScalar(newRadius))
      camera.lookAt(0, 0, 0)
    })

    // ✅ Animation
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // ✅ Gestion du redimensionnement
    const handleResize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.domElement.remove()
    }
  }, [data])

  return (
    <div className="w-full space-y-4">
      <div ref={containerRef} className="w-full h-[600px] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl" />
      
      {/* Statistiques industrielles */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Points Analysés</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{stats.pointCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Température Moyenne</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{stats.avgTemp} K</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Vélocité Max</p>
          <p className="text-2xl font-bold text-orange-400 mt-2">{stats.maxVelocity} m/s</p>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerEnhanced
