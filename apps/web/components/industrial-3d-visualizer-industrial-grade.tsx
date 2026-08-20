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
  scenario?: any;
  showValidation?: boolean;
}

const Industrial3DVisualizerIndustrialGrade: React.FC<Props> = ({ data = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameIdRef = useRef<number | null>(null)

  // 1. Stats mémorisées
  const stats = useMemo(() => {
    if (!data.length) return { minT: 0, maxT: 1, avgT: 0, count: 0 }
    const temps = data.map(p => p.temperature)
    return {
      minT: Math.min(...temps),
      maxT: Math.max(...temps),
      avgT: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
      count: data.length
    }
  }, [data])

  // 2. Rendu Three.js ultra-stable
  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let controls: any

    const init = async () => {
      try {
        // @ts-ignore
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x020617)

        const width = containerRef.current!.clientWidth || 800
        const height = containerRef.current!.clientHeight || 500
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(5, 5, 5)
        camera.lookAt(0, 0, 0)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        containerRef.current!.innerHTML = ''
        containerRef.current!.appendChild(renderer.domElement)
        rendererRef.current = renderer

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true

        // Objets
        scene.add(new THREE.GridHelper(10, 10, 0x334155, 0x1e293b))
        scene.add(new THREE.AxesHelper(2))
        scene.add(new THREE.AmbientLight(0xffffff, 0.8))

        // Nuage de points
        const geometry = new THREE.BufferGeometry()
        const posArr = new Float32Array(data.length * 3)
        const colArr = new Float32Array(data.length * 3)
        const tRange = stats.maxT - stats.minT || 1

        data.forEach((p, i) => {
          posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z
          const norm = (p.temperature - stats.minT) / tRange
          const color = new THREE.Color().setHSL(0.6 * (1 - norm), 1, 0.5)
          colArr[i * 3] = color.r; colArr[i * 3 + 1] = color.g; colArr[i * 3 + 2] = color.b
        })

        geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
        scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.1, vertexColors: true })))

        const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()
      } catch (e) { console.error(e) }
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
  }, [data, stats.minT, stats.maxT])

  return (
    <div className="w-full space-y-4">
      <div ref={containerRef} className="w-full h-[500px] bg-slate-950 rounded-3xl border border-white/10 overflow-hidden" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Points</p>
          <p className="text-xl font-black text-blue-400">{stats.count}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase font-black">Temp Moy</p>
          <p className="text-xl font-black text-emerald-400">{stats.avgT} K</p>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerIndustrialGrade;
