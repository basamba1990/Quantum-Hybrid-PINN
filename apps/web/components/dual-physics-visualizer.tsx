'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { Wind, Thermometer } from 'lucide-react'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  temperature?: number;
  pressure?: number;
  velocity_magnitude?: number;
  residual_continuity?: number;
  residual_momentum?: number;
  residual_energy?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
}

/**
 * DUAL PHYSICS VISUALIZER - VUE COMPARATIVE
 * Affiche deux visualisations côte à côte :
 * - Gauche : Thermique (Température)
 * - Droite : Dynamique (Pression/Vitesse)
 * Permet de comparer les deux aspects de la simulation en temps réel
 */
const DualPhysicsVisualizer: React.FC<Props> = ({ 
  data = [], 
  title = "DUAL PHYSICS COMPARISON",
  quality = 'ultra'
}) => {
  const leftContainerRef = useRef<HTMLDivElement>(null)
  const rightContainerRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState({ 
    minT: 0, maxT: 0, minP: 0, maxP: 0, minV: 0, maxV: 0,
    count: 0
  })
  const [activeView, setActiveView] = useState<'thermal' | 'dynamic'>('thermal')

  const resolution = useMemo(() => {
    switch(quality) {
      case 'low': return 64;
      case 'medium': return 96;
      case 'high': return 112;
      case 'ultra': return 128;
      default: return 128;
    }
  }, [quality])

  // RBF Interpolation
  const rbfInterpolate = (points: DataPoint[], queryPoint: [number, number, number], variable: string, epsilon: number = 0.1) => {
    if (points.length === 0) return 0;
    
    let numerator = 0;
    let denominator = 0;
    
    for (const p of points) {
      const dx = p.x - queryPoint[0];
      const dy = p.y - queryPoint[1];
      const dz = p.z - queryPoint[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + epsilon;
      
      const rbfValue = 1 / (1 + dist * dist);
      let val = 0;
      
      if (variable === 'temperature') val = p.temperature || 0;
      else if (variable === 'pressure') val = p.pressure || 0;
      else if (variable === 'velocity') val = p.velocity_magnitude || 0;
      
      numerator += rbfValue * val;
      denominator += rbfValue;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  };

  // Création du visualiseur 3D
  const createVisualizer = (containerRef: React.RefObject<HTMLDivElement>, variable: string) => {
    if (!containerRef.current || !data.length) return;

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(6, 6, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.localClippingEnabled = true
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2)
    mainLight.position.set(15, 15, 15)
    scene.add(mainLight)

    // Clipping plane
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5)
    
    // Material
    const material = new THREE.MeshPhongMaterial({
      color: 0x1e3a8a,
      transparent: false,
      opacity: 1.0,
      side: THREE.DoubleSide,
      shininess: 150,
      specular: 0x666666,
      clippingPlanes: [clipPlane],
      clipShadows: true
    })

    const mc = new MarchingCubes(resolution, material, true, true, 500000)
    mc.scale.set(3.5, 3.5, 3.5)
    scene.add(mc)

    // Data processing
    const values = data.map(p => {
      if (variable === 'temperature') return p.temperature || 0;
      if (variable === 'pressure') return p.pressure || 0;
      if (variable === 'velocity') return p.velocity_magnitude || 0;
      return 0;
    })
    
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)

    const xCoords = data.map(p => p.x)
    const yCoords = data.map(p => p.y)
    const zCoords = data.map(p => p.z)
    const xMin = Math.min(...xCoords), xMax = Math.max(...xCoords)
    const yMin = Math.min(...yCoords), yMax = Math.max(...yCoords)
    const zMin = Math.min(...zCoords), zMax = Math.max(...zCoords)

    // Voxelization
    const updateVolume = () => {
      mc.reset()
      
      for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
          for (let k = 0; k < resolution; k++) {
            const nx = i / (resolution - 1)
            const ny = j / (resolution - 1)
            const nz = k / (resolution - 1)
            
            const x = xMin + nx * (xMax - xMin)
            const y = yMin + ny * (yMax - yMin)
            const z = zMin + nz * (zMax - zMin)
            
            const value = rbfInterpolate(data, [x, y, z], variable)
            const normalizedValue = (value - minVal) / (maxVal - minVal || 1)
            
            mc.setCell(i, j, k, normalizedValue)
          }
        }
      }
      
      mc.update()
    }

    updateVolume()

    // Color gradient
    if (mc.geometry && mc.geometry.attributes.position) {
      const positions = mc.geometry.attributes.position.array as Float32Array;
      const colors = new Float32Array(positions.length);
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        
        const nx = (x / 3.5 + 1) / 2;
        const ny = (y / 3.5 + 1) / 2;
        const nz = (z / 3.5 + 1) / 2;
        
        const px = xMin + nx * (xMax - xMin);
        const py = yMin + ny * (yMax - yMin);
        const pz = zMin + nz * (zMax - zMin);
        
        const value = rbfInterpolate(data, [px, py, pz], variable);
        const normalizedValue = (value - minVal) / (maxVal - minVal || 1);
        
        let r, g, b;
        if (normalizedValue < 0.25) {
          r = 0; g = normalizedValue * 4; b = 1;
        } else if (normalizedValue < 0.5) {
          r = 0; g = 1; b = 1 - (normalizedValue - 0.25) * 4;
        } else if (normalizedValue < 0.75) {
          r = (normalizedValue - 0.5) * 4; g = 1; b = 0;
        } else {
          r = 1; g = 1 - (normalizedValue - 0.75) * 4; b = 0;
        }
        
        colors[i] = r;
        colors[i + 1] = g;
        colors[i + 2] = b;
      }
      
      mc.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const colorMaterial = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 150,
        specular: 0x666666,
        clippingPlanes: [clipPlane],
        clipShadows: true
      });
      mc.material = colorMaterial;
    }

    // Animation loop
    let frameId: number = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return { renderer, frameId }
  }

  useEffect(() => {
    if (!data.length) return;

    const temps = data.map(p => p.temperature || 0)
    const press = data.map(p => p.pressure || 0)
    const vels = data.map(p => p.velocity_magnitude || 0)

    setStats({
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      minP: Math.min(...press),
      maxP: Math.max(...press),
      minV: Math.min(...vels),
      maxV: Math.max(...vels),
      count: data.length
    })

    const leftViz = createVisualizer(leftContainerRef, 'temperature')
    const rightViz = createVisualizer(rightContainerRef, 'pressure')

    return () => {
      if (leftViz) {
        cancelAnimationFrame(leftViz.frameId)
        leftViz.renderer.dispose()
      }
      if (rightViz) {
        cancelAnimationFrame(rightViz.frameId)
        rightViz.renderer.dispose()
      }
    }
  }, [data])

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h3>
        <div className="text-xs font-mono text-gray-500">
          Points: {stats.count.toLocaleString()}
        </div>
      </div>

      {/* Dual View */}
      <div className="grid grid-cols-2 gap-6">
        {/* Thermal View */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl w-fit">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-white uppercase">Thermal Field</span>
          </div>
          <div ref={leftContainerRef} className="w-full h-[500px] bg-slate-950 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <p className="text-gray-500 text-[9px]">Min</p>
              <p className="text-red-400 font-mono">{stats.minT.toFixed(1)} K</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <p className="text-gray-500 text-[9px]">Max</p>
              <p className="text-red-400 font-mono">{stats.maxT.toFixed(1)} K</p>
            </div>
          </div>
        </div>

        {/* Dynamic View */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl w-fit">
            <Wind className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-white uppercase">Dynamic Field</span>
          </div>
          <div ref={rightContainerRef} className="w-full h-[500px] bg-slate-950 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <p className="text-gray-500 text-[9px]">Min</p>
              <p className="text-blue-400 font-mono">{stats.minP.toFixed(0)} Pa</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <p className="text-gray-500 text-[9px]">Max</p>
              <p className="text-blue-400 font-mono">{stats.maxP.toFixed(0)} Pa</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DualPhysicsVisualizer
