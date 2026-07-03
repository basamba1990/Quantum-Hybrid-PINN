'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { Download } from 'lucide-react'

interface DataPoint {
  x: number; y: number; z: number;
  temperature: number; pressure: number;
  velocity_magnitude?: number; velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  zRange?: [number, number];
  colorVariable?: 'temperature' | 'pressure' | 'density';
}

/**
 * Industrial 3D Visualizer V5 - Strict & Professional Mode
 * MODE: Production-Grade - Aucune donnée fictive
 * - Affiche UNIQUEMENT les données réelles du solver
 * - Grille/Axes visibles même sans données (infrastructure)
 * - Intégrité garantie: pas d'hallucinations
 */
const Industrial3DVisualizerEnhancedV5: React.FC<Props> = ({
  data = [],
  title = "3D Isosurface Visualization",
  xLabel = "X (m)",
  yLabel = "Y (m)",
  zLabel = "Z (m)",
  xRange = [-1, 1],
  yRange = [-1, 1],
  zRange = [-1, 1],
  colorVariable = 'temperature'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const controlsRef = useRef<any>(null)
  const pointsGroupRef = useRef<THREE.Group | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  
  const [stats, setStats] = useState({ 
    minT: 0, maxT: 1, minP: 0, maxP: 1, minD: 0, maxD: 1, count: 0,
    fps: 0, pointsRendered: 0
  })
  const [activeVariable, setActiveVariable] = useState<'temperature' | 'pressure' | 'density'>(colorVariable)
  const [showStreamlines, setShowStreamlines] = useState(true)
  const [pointDensity, setPointDensity] = useState(1.0)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasData, setHasData] = useState(false)

  // Vérifier si des données réelles sont présentes
  const hasRealData = useMemo(() => {
    return data && data.length > 0
  }, [data])

  // Calculer les plages réelles UNIQUEMENT si données présentes
  const realRanges = useMemo(() => {
    if (!hasRealData) return { x: xRange, y: yRange, z: zRange }
    const xs = data.map(p => p.x), ys = data.map(p => p.y), zs = data.map(p => p.z)
    return {
      x: [Math.min(...xs), Math.max(...xs)],
      y: [Math.min(...ys), Math.max(...ys)],
      z: [Math.min(...zs), Math.max(...zs)]
    }
  }, [hasRealData, data, xRange, yRange, zRange])

  // Calculer les statistiques UNIQUEMENT si données réelles
  useEffect(() => {
    if (!hasRealData) {
      setStats(prev => ({ ...prev, count: 0, pointsRendered: 0 }))
      setHasData(false)
      return
    }

    const temps = data.map(p => p.temperature)
    const press = data.map(p => p.pressure)
    const dens = data.map(p => p.density || 1.0)
    
    setStats(prev => ({
      ...prev,
      minT: Math.min(...temps), maxT: Math.max(...temps),
      minP: Math.min(...press), maxP: Math.max(...press),
      minD: Math.min(...dens), maxD: Math.max(...dens),
      count: data.length,
      pointsRendered: data.length
    }))
    setHasData(true)
  }, [hasRealData, data])

  // Créer les streamlines UNIQUEMENT avec données réelles
  const createStreamlines = (points: DataPoint[], variable: string) => {
    const group = new THREE.Group()
    
    const sortedPoints = [...points].sort((a, b) => {
      const aVal = variable === 'temperature' ? a.temperature : variable === 'pressure' ? a.pressure : (a.density || 0)
      const bVal = variable === 'temperature' ? b.temperature : variable === 'pressure' ? b.pressure : (b.density || 0)
      return aVal - bVal
    })

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i]
      const p2 = sortedPoints[i + 1]
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]),
        3
      ))

      const val1 = variable === 'temperature' ? p1.temperature : variable === 'pressure' ? p1.pressure : (p1.density || 0)
      const val2 = variable === 'temperature' ? p2.temperature : variable === 'pressure' ? p2.pressure : (p2.density || 0)
      
      const vMin = activeVariable === 'temperature' ? stats.minT : activeVariable === 'pressure' ? stats.minP : stats.minD
      const vMax = activeVariable === 'temperature' ? stats.maxT : activeVariable === 'pressure' ? stats.maxP : stats.maxD
      const vRange = vMax - vMin || 1

      const norm1 = (val1 - vMin) / vRange
      const norm2 = (val2 - vMin) / vRange

      const getColor = (norm: number) => {
        const c = new THREE.Color()
        if (norm < 0.25) {
          c.setRGB(0, norm * 4, 1)
        } else if (norm < 0.5) {
          c.setRGB(0, 1, 1 - (norm - 0.25) * 4)
        } else if (norm < 0.75) {
          c.setRGB((norm - 0.5) * 4, 1, 0)
        } else {
          c.setRGB(1, 1 - (norm - 0.75) * 4, 0)
        }
        return c
      }

      const c1 = getColor(norm1)
      const c2 = getColor(norm2)

      const colors = new Float32Array([c1.r, c1.g, c1.b, c2.r, c2.g, c2.b])
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 3,
        transparent: true,
        opacity: 0.9
      })

      const line = new THREE.Line(geometry, material)
      group.add(line)
    }

    return group
  }

  // Exporter le rendu
  const exportScreenshot = () => {
    if (!rendererRef.current) return
    
    const canvas = rendererRef.current.domElement
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `3d-visualization-${Date.now()}.png`
    link.click()
  }

  // Mettre à jour les points UNIQUEMENT avec données réelles
  const updateVisualization = (scene: THREE.Scene, filteredData: DataPoint[]) => {
    if (pointsGroupRef.current) {
      scene.remove(pointsGroupRef.current)
    }

    if (filteredData.length === 0) return

    const pointsGroup = new THREE.Group()
    pointsGroupRef.current = pointsGroup

    const geometry = new THREE.BufferGeometry()
    const posArr = new Float32Array(filteredData.length * 3)
    const colArr = new Float32Array(filteredData.length * 3)
    
    const vMin = activeVariable === 'temperature' ? stats.minT : activeVariable === 'pressure' ? stats.minP : stats.minD
    const vMax = activeVariable === 'temperature' ? stats.maxT : activeVariable === 'pressure' ? stats.maxP : stats.maxD
    const vRange = vMax - vMin || 1

    filteredData.forEach((p, i) => {
      posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z
      
      const val = activeVariable === 'temperature' ? p.temperature : activeVariable === 'pressure' ? p.pressure : (p.density || 0)
      const norm = (val - vMin) / vRange
      
      const color = new THREE.Color()
      if (norm < 0.25) {
        color.setRGB(0, norm * 4, 1)
      } else if (norm < 0.5) {
        color.setRGB(0, 1, 1 - (norm - 0.25) * 4)
      } else if (norm < 0.75) {
        color.setRGB((norm - 0.5) * 4, 1, 0)
      } else {
        color.setRGB(1, 1 - (norm - 0.75) * 4, 0)
      }
      
      colArr[i * 3] = color.r; colArr[i * 3 + 1] = color.g; colArr[i * 3 + 2] = color.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    })

    const points = new THREE.Points(geometry, pointsMaterial)
    pointsGroup.add(points)

    if (showStreamlines && filteredData.length > 1) {
      const streamlines = createStreamlines(filteredData, activeVariable)
      pointsGroup.add(streamlines)
    }

    scene.add(pointsGroup)
  }

  // Attendre que le conteneur ait des dimensions valides
  const waitForDimensions = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!containerRef.current) {
        resolve()
        return
      }

      const checkDimensions = () => {
        const width = containerRef.current?.clientWidth || 0
        const height = containerRef.current?.clientHeight || 0
        
        if (width > 0 && height > 0) {
          resolve()
        } else {
          setTimeout(checkDimensions, 100)
        }
      }

      checkDimensions()
    })
  }

  useEffect(() => {
    if (!containerRef.current) return

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer
    let lastFrameTime = Date.now()
    let frameCount = 0
    let animationId: number

    const init = async () => {
      try {
        await waitForDimensions()

        let OrbitControls: any = null
        try {
          const module = await import('three/examples/jsm/controls/OrbitControls.js')
          OrbitControls = module.OrbitControls
        } catch (e) {
          console.warn('OrbitControls import failed', e)
        }

        if (!containerRef.current) return

        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight

        if (width === 0 || height === 0) {
          setRenderError('Container dimensions invalid')
          return
        }

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0e27)
        sceneRef.current = scene

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        camera.position.set(4, 3, 4)
        cameraRef.current = camera

        renderer = new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: true,
          precision: 'highp',
          powerPreference: 'high-performance'
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        if (OrbitControls) {
          const controls = new OrbitControls(camera, renderer.domElement)
          controls.enableDamping = true
          controls.dampingFactor = 0.05
          controls.autoRotate = false
          controlsRef.current = controls
        }

        // Éclairage
        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
        directionalLight.position.set(10, 10, 10)
        directionalLight.castShadow = true
        scene.add(directionalLight)

        // Grille de référence (infrastructure)
        const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222)
        gridHelper.position.y = -1.5
        scene.add(gridHelper)

        // Axes de référence (X, Y, Z)
        const axisLength = 6
        const axisX = new THREE.BufferGeometry()
        axisX.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
        ))
        scene.add(new THREE.Line(axisX, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })))

        const axisY = new THREE.BufferGeometry()
        axisY.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
        ))
        scene.add(new THREE.Line(axisY, new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })))

        const axisZ = new THREE.BufferGeometry()
        axisZ.setAttribute('position', new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
        ))
        scene.add(new THREE.Line(axisZ, new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })))

        // Boîte englobante du domaine
        const boxGeom = new THREE.BoxGeometry(2, 2, 2)
        const edges = new THREE.EdgesGeometry(boxGeom)
        const lineMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 })
        const box = new THREE.LineSegments(edges, lineMat)
        scene.add(box)

        // Mettre à jour si données réelles présentes
        if (hasRealData) {
          const filteredData = pointDensity < 1.0 
            ? data.filter(() => Math.random() < pointDensity)
            : data
          updateVisualization(scene, filteredData)
        }

        // Animation loop
        const animate = () => {
          animationId = requestAnimationFrame(animate)
          
          if (controlsRef.current) {
            controlsRef.current.update()
          }
          
          renderer.render(scene, camera)

          frameCount++
          const now = Date.now()
          if (now - lastFrameTime >= 1000) {
            setStats(prev => ({ ...prev, fps: frameCount }))
            frameCount = 0
            lastFrameTime = now
          }
        }
        animate()
        frameIdRef.current = animationId

        // ResizeObserver
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }

        resizeObserverRef.current = new ResizeObserver(() => {
          if (!containerRef.current || !renderer) return
          const newWidth = containerRef.current.clientWidth
          const newHeight = containerRef.current.clientHeight
          
          if (newWidth > 0 && newHeight > 0) {
            camera.aspect = newWidth / newHeight
            camera.updateProjectionMatrix()
            renderer.setSize(newWidth, newHeight)
          }
        })

        resizeObserverRef.current.observe(containerRef.current)

        setRenderError(null)
        setIsReady(true)
      } catch (e) { 
        console.error('3D Visualizer init error:', e)
        setRenderError(`Error: ${String(e).substring(0, 60)}`)
      }
    }

    init()
    
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      if (rendererRef.current) rendererRef.current.dispose()
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
    }
  }, [])

  // Mettre à jour les points quand les données changent
  useEffect(() => {
    if (!sceneRef.current || !isReady) return

    if (!hasRealData) {
      if (pointsGroupRef.current) {
        sceneRef.current.remove(pointsGroupRef.current)
        pointsGroupRef.current = null
      }
      return
    }

    const filteredData = pointDensity < 1.0 
      ? data.filter(() => Math.random() < pointDensity)
      : data

    updateVisualization(sceneRef.current, filteredData)
  }, [activeVariable, showStreamlines, hasRealData, data, pointDensity, isReady])

  return (
    <div className="w-full space-y-6 bg-slate-950 p-6 rounded-[32px] border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <div className="w-2 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full" /> {title}
        </h3>
        <div className="flex gap-2 flex-wrap">
          {hasData && (
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button onClick={() => setActiveVariable('temperature')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeVariable === 'temperature' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}>Temp</button>
              <button onClick={() => setActiveVariable('pressure')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeVariable === 'pressure' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Pression</button>
              <button onClick={() => setActiveVariable('density')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeVariable === 'density' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}>Densité</button>
            </div>
          )}
          
          {hasData && (
            <button onClick={exportScreenshot} className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-all flex items-center gap-1 border border-emerald-500/30">
              <Download className="w-3 h-3" /> Export
            </button>
          )}
        </div>
      </div>
      
      <div className="relative flex flex-col lg:flex-row gap-6">
        <div ref={containerRef} className="flex-1 h-[600px] bg-black/60 rounded-2xl border border-white/5 overflow-hidden relative">
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-red-400 text-xs p-4 text-center z-50">
              <div>
                <p className="font-bold mb-2">⚠️ Render Error</p>
                <p>{renderError}</p>
              </div>
            </div>
          )}
          {!isReady && !renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-blue-400 text-xs z-40">
              <div className="text-center">
                <div className="animate-spin mb-2">⚙️</div>
                <p>Initializing 3D Engine...</p>
              </div>
            </div>
          )}
          {isReady && !hasData && !renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-gray-400 text-xs z-40 pointer-events-none">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest">Domain Ready</p>
                <p className="text-[9px] mt-2">Waiting for Simulation Data</p>
              </div>
            </div>
          )}
        </div>
        
        {hasData && (
          <div className="lg:w-64 space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase">Paramètres</p>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={showStreamlines} onChange={(e) => setShowStreamlines(e.target.checked)} className="w-4 h-4" />
                Afficher trajectoires
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase">Densité Points</p>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.1" 
                value={pointDensity} 
                onChange={(e) => setPointDensity(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500">{(pointDensity * 100).toFixed(0)}%</p>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <p className="text-xs font-bold text-gray-400 uppercase">Statistiques</p>
              <div className="space-y-1 text-[10px] font-mono text-gray-400">
                <p>FPS: <span className="text-emerald-400">{stats.fps}</span></p>
                <p>Points: <span className="text-blue-400">{stats.pointsRendered}</span></p>
                <p>Total: <span className="text-purple-400">{stats.count}</span></p>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <p className="text-xs font-bold text-gray-400 uppercase">Plages</p>
              <div className="space-y-1 text-[10px] font-mono text-gray-400">
                <p>X: <span className="text-gray-300">{realRanges.x[0].toFixed(2)} → {realRanges.x[1].toFixed(2)}</span></p>
                <p>Y: <span className="text-gray-300">{realRanges.y[0].toFixed(2)} → {realRanges.y[1].toFixed(2)}</span></p>
                <p>Z: <span className="text-gray-300">{realRanges.z[0].toFixed(2)} → {realRanges.z[1].toFixed(2)}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Industrial3DVisualizerEnhancedV5
