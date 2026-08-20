
import React, { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  velocity_magnitude?: number;
}

interface Props {
  data?: DataPoint[];
  scenario?: string;
  quality?: 'low' | 'medium' | 'high';
}

const Industrial3DVisualizerV12: React.FC<Props> = ({ data = [], quality = 'medium' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  // Configuration LOD (Level of Detail) basée sur la qualité
  const resolution = useMemo(() => {
    switch(quality) {
      case 'low': return 32;
      case 'medium': return 64;
      case 'high': return 128;
      default: return 64;
    }
  }, [quality])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(8, 8, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Éclairage Industriel
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // 1. Marching Cubes pour Isosurfaces (Fronts de Pression/Température)
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x3b82f6, 
      specular: 0x111111, 
      shininess: 100, 
      transparent: true, 
      opacity: 0.7,
      side: THREE.DoubleSide 
    })
    
    const marchingCubes = new MarchingCubes(resolution, material, true, true, 100000)
    marchingCubes.position.set(0, 0, 0)
    marchingCubes.scale.set(5, 5, 5)
    scene.add(marchingCubes)

    // 2. Remplissage du champ scalaire pour Marching Cubes
    const updateMarchingCubes = () => {
      marchingCubes.reset()
      // Normalisation des données pour le cube [0, 1]
      data.forEach(p => {
        const nx = (p.x + 5) / 10
        const ny = (p.y + 5) / 10
        const nz = (p.z + 5) / 10
        const strength = p.pressure / 100 // Exemple de seuil
        marchingCubes.addBall(nx, ny, nz, strength, 12)
      })
    }
    updateMarchingCubes()

    // 3. LOD - Nuage de points pour les détails fins
    const pointGeometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(data.length * 3)
    const colArr = new Float32Array(data.length * 3)
    
    data.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z
      const color = new THREE.Color().setHSL(0.6 * (1 - p.temperature/500), 1, 0.5)
      colArr[i * 3] = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    })

    pointGeometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ size: 0.05, vertexColors: true }))
    scene.add(points)

    // Animation & Controls
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true

      const animate = () => {
        requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()
    })

    return () => {
      renderer.dispose()
    }
  }, [data, resolution])

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 p-3 bg-slate-900/80 backdrop-blur-md border border-blue-500/30 rounded-lg text-xs text-slate-300">
        <div className="font-bold text-blue-400 mb-1 uppercase tracking-wider">Industrial 3D V12</div>
        <div>Mode: Isosurfaces + LOD</div>
        <div>Resolution: {resolution}^3</div>
        <div>Points: {data.length.toLocaleString()}</div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV12;
