'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  velocity_u?: number; velocity_v?: number; velocity_w?: number;
  velocity_magnitude?: number;
}

interface StreamlineProps {
  data: DataPoint[]
  title?: string
}

/**
 * Composant Streamline 3D Industrial-Gold
 * Calcule les lignes de courant par intégration RK4 du champ vectoriel (u, v, w)
 * Cela remplace la simple connexion de points par une vraie analyse de trajectoire physique
 */
const Streamline3DVisualizer: React.FC<StreamlineProps> = ({
  data,
  title = "Streamlines - Industrial-Gold"
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const [loading, setLoading] = useState(true)

  // Interpolation trilinéaire du champ de vitesse
  const interpolateVelocity = (x: number, y: number, z: number): [number, number, number] => {
    if (data.length === 0) return [0, 0, 0]

    // Trouver les 8 points voisins les plus proches (grille cubique)
    let minDist = Infinity
    let nearestPoints: DataPoint[] = []

    data.forEach(p => {
      const dist = Math.sqrt((p.x - x)**2 + (p.y - y)**2 + (p.z - z)**2)
      if (dist < minDist) minDist = dist
      nearestPoints.push({ ...p, distance: dist })
    })

    // Garder les 8 points les plus proches
    nearestPoints.sort((a, b) => (a as any).distance - (b as any).distance)
    nearestPoints = nearestPoints.slice(0, 8)

    // Moyenne pondérée inverse de la distance
    let u_interp = 0, v_interp = 0, w_interp = 0
    let weight_sum = 0

    nearestPoints.forEach(p => {
      const dist = Math.sqrt((p.x - x)**2 + (p.y - y)**2 + (p.z - z)**2)
      const weight = dist < 1e-6 ? 1 : 1 / (dist + 1e-8)
      
      u_interp += (p.velocity_u || 0) * weight
      v_interp += (p.velocity_v || 0) * weight
      w_interp += (p.velocity_w || 0) * weight
      weight_sum += weight
    })

    if (weight_sum > 0) {
      u_interp /= weight_sum
      v_interp /= weight_sum
      w_interp /= weight_sum
    }

    return [u_interp, v_interp, w_interp]
  }

  // Intégration RK4 pour calculer une streamline
  const computeStreamline = (startPoint: DataPoint, maxSteps: number = 100): THREE.Vector3[] => {
    const streamline: THREE.Vector3[] = []
    let x = startPoint.x, y = startPoint.y, z = startPoint.z
    const dt = 0.01 // Pas de temps

    for (let i = 0; i < maxSteps; i++) {
      streamline.push(new THREE.Vector3(x, y, z))

      // RK4 Integration
      const [u1, v1, w1] = interpolateVelocity(x, y, z)
      const [u2, v2, w2] = interpolateVelocity(x + u1 * dt / 2, y + v1 * dt / 2, z + w1 * dt / 2)
      const [u3, v3, w3] = interpolateVelocity(x + u2 * dt / 2, y + v2 * dt / 2, z + w2 * dt / 2)
      const [u4, v4, w4] = interpolateVelocity(x + u3 * dt, y + v3 * dt, z + w3 * dt)

      x += (u1 + 2*u2 + 2*u3 + u4) * dt / 6
      y += (v1 + 2*v2 + 2*v3 + v4) * dt / 6
      z += (w1 + 2*w2 + 2*w3 + w4) * dt / 6

      // Critère d'arrêt: sortie du domaine
      const xs = data.map(p => p.x)
      const ys = data.map(p => p.y)
      const zs = data.map(p => p.z)
      const xBound = [Math.min(...xs), Math.max(...xs)]
      const yBound = [Math.min(...ys), Math.max(...ys)]
      const zBound = [Math.min(...zs), Math.max(...zs)]

      if (x < xBound[0] || x > xBound[1] || 
          y < yBound[0] || y > yBound[1] || 
          z < zBound[0] || z > zBound[1]) {
        break
      }
    }

    return streamline
  }

  useEffect(() => {
    if (!containerRef.current || data.length === 0) {
      setLoading(false)
      return
    }

    // Initialisation Three.js
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    sceneRef.current = scene

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(2, 2, 2)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

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

    // Calculer les streamlines
    const streamlines: THREE.Vector3[][] = []
    const sampledPoints = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 20)) === 0)
    
    sampledPoints.forEach(point => {
      const streamline = computeStreamline(point, 150)
      if (streamline.length > 2) {
        streamlines.push(streamline)
      }
    })

    // Rendu des streamlines
    streamlines.forEach((streamline, idx) => {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(streamline.length * 3)
      const colors = new Float32Array(streamline.length * 3)

      streamline.forEach((point, i) => {
        positions[i * 3] = point.x
        positions[i * 3 + 1] = point.y
        positions[i * 3 + 2] = point.z

        // Gradient de couleur basé sur la progression
        const t = i / streamline.length
        colors[i * 3] = t // Rouge
        colors[i * 3 + 1] = 1 - t // Vert
        colors[i * 3 + 2] = 0.5 // Bleu
      })

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      })

      const line = new THREE.Line(geometry, material)
      scene.add(line)
    })

    // Points de données
    const pointGeometry = new THREE.BufferGeometry()
    const pointPositions = new Float32Array(data.length * 3)
    const pointColors = new Float32Array(data.length * 3)

    data.forEach((p, i) => {
      pointPositions[i * 3] = p.x
      pointPositions[i * 3 + 1] = p.y
      pointPositions[i * 3 + 2] = p.z

      const temp = p.temperature
      const norm = (temp - 273) / 100
      pointColors[i * 3] = Math.max(0, Math.min(1, norm))
      pointColors[i * 3 + 1] = 0.5
      pointColors[i * 3 + 2] = 1 - Math.max(0, Math.min(1, norm))
    })

    pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3))

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    })

    const points = new THREE.Points(pointGeometry, pointMaterial)
    scene.add(points)

    // Animation
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    setLoading(false)

    return () => {
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [data])

  return (
    <div className="w-full h-[600px] bg-[#0f172a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-white/10 bg-black/50">
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-white/60 text-xs mt-1">Streamlines calculées par intégration RK4 du champ vectoriel</p>
      </div>
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50">Calcul des streamlines...</div>
        </div>
      )}
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}

export default Streamline3DVisualizer
