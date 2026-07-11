'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DataPoint {
  x: number
  y: number
  z: number
  temperature: number
  pressure: number
  velocity_magnitude?: number
  velocity?: number
}

interface Props {
  data?: DataPoint[]
}

const Industrial3DVisualizerEnhanced: React.FC<Props> = ({ data = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState({
    pointCount: 0,
    avgTemp: 0,
    maxVelocity: 0,
  })

  useEffect(() => {
    if (!containerRef.current) return

    // Dynamic import pour OrbitControls pour éviter les erreurs de types au build
    let controls: any
    let renderer: THREE.WebGLRenderer
    let animationFrameId: number

    const init = async () => {
      // @ts-ignore - OrbitControls path is valid in runtime but may cause TS issues during build
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x020617)

      const camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current!.clientWidth / containerRef.current!.clientHeight,
        0.1,
        1000
      )
      camera.position.set(20, 20, 20)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      containerRef.current!.appendChild(renderer.domElement)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true

      const axesHelper = new THREE.AxesHelper(15)
      scene.add(axesHelper)

      const size = 20
      const divisions = 10
      const gridHelper = new THREE.GridHelper(size, divisions, 0x334155, 0x1e293b)
      gridHelper.position.y = -5
      scene.add(gridHelper)

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)
      const pointLight = new THREE.PointLight(0xffffff, 1)
      pointLight.position.set(10, 20, 10)
      scene.add(pointLight)

      if (data && data.length > 0) {
        const curvePoints = data.map(p => new THREE.Vector3(p.x, p.y, p.z))
        const curve = new THREE.CatmullRomCurve3(curvePoints)
        const tubeGeometry = new THREE.TubeGeometry(curve, 100, 0.2, 8, false)
        
        const tubeColors = []
        const tubeColor = new THREE.Color()
        for (let i = 0; i < tubeGeometry.attributes.position.count; i++) {
          const t = i / tubeGeometry.attributes.position.count
          tubeColor.setHSL(0.6 * (1 - t), 1, 0.5)
          tubeColors.push(tubeColor.r, tubeColor.g, tubeColor.b)
        }
        tubeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tubeColors, 3))

        const tubeMaterial = new THREE.MeshPhongMaterial({ 
          vertexColors: true, 
          transparent: true, 
          opacity: 0.8,
          shininess: 100 
        })
        
        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial)
        scene.add(tubeMesh)

        // Rendu des points de données
        const pointsGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(data.length * 3);
        const colors = new Float32Array(data.length * 3);

        const tempRange = Math.max(...data.map(d => d.temperature)) - Math.min(...data.map(d => d.temperature)) || 1;
        const minTemp = Math.min(...data.map(d => d.temperature));

        data.forEach((p, i) => {
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;

          const normalizedTemp = (p.temperature - minTemp) / tempRange;
          const pointColor = new THREE.Color();
          pointColor.setHSL(0.6 * (1 - normalizedTemp), 1, 0.5); // Bleu à Rouge
          colors[i * 3] = pointColor.r;
          colors[i * 3 + 1] = pointColor.g;
          colors[i * 3 + 2] = pointColor.b;
        });

        pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const pointsMaterial = new THREE.PointsMaterial({
          size: 0.1,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          sizeAttenuation: true,
        });

        const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
        scene.add(pointsMesh);

        const temps = data.map(d => d.temperature)
        const vels = data.map(d => d.velocity_magnitude || d.velocity || 0)
        setStats({
          pointCount: data.length,
          avgTemp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
          maxVelocity: Math.round(Math.max(...vels) * 10) / 10,
        })
      }

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate)
        if (controls) controls.update()
        renderer.render(scene, camera)
      }
      animate()
    }

    init()

    const handleResize = () => {
      if (!containerRef.current || !renderer) return
      // Update camera and renderer on resize if needed
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      if (renderer && containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement)
      }
      if (renderer) renderer.dispose()
    }
  }, [data])

  return (
    <div className="w-full relative group">
      <div className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scale: Temperature (K)</p>
        <div className="flex items-center gap-3">
          <div className="w-3 h-24 bg-gradient-to-t from-blue-600 via-emerald-500 to-red-500 rounded-full border border-white/10" />
          <div className="flex flex-col justify-between h-24 text-[9px] font-mono text-slate-300">
            <span>{stats.avgTemp + 50} K</span>
            <span>{stats.avgTemp} K</span>
            <span>{stats.avgTemp - 50} K</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-10 flex gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
          <span className="w-2 h-2 bg-red-500 rounded-full" /> X-AXIS (m)
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
          <span className="w-2 h-2 bg-green-500 rounded-full" /> Y-AXIS (m)
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
          <span className="w-2 h-2 bg-blue-500 rounded-full" /> Z-AXIS (m)
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[500px] bg-slate-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />
      
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Mesh Points</p>
          <p className="text-xl font-black text-blue-400 mt-1">{stats.pointCount.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Mean Temp</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{stats.avgTemp} K</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Max Velocity</p>
          <p className="text-xl font-black text-orange-400 mt-1">{stats.maxVelocity} m/s</p>
        </div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerEnhanced
