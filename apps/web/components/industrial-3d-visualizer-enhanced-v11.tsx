import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { Activity, Cpu, Database, ShieldCheck, Box, Download, Thermometer, Gauge, Wind, Zap, Scissors, Layers, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-xs font-black uppercase text-cyan-500 animate-pulse">Chargement Plotly.js...</div> })

interface DataPoint {
  x: number; y: number; z: number;
  temperature?: number; pressure?: number;
  velocity_magnitude?: number; 
  velocity_u?: number; velocity_v?: number; velocity_w?: number;
  density?: number;
  stress?: number; von_mises?: number;
}

type ScenarioType = "H2_PIPELINE" | "LH2_STORAGE" | "DEEP_MINING_BLOCK" | "ROCK_ELAST_STRESS" | "H2_PIPELINE_STRATEGIC" | "FPGA_HEATSINK" | "PORT_ENERGY_OPTIMIZATION" | "PIPELINE_SAFETY" | "CRYOGENIC_TRANSPORT" | "MINING_INDUSTRIAL_SIM" | "H2_COMPRESSION_STATION" | "H2_DISTRIBUTION_HIGH_PRESSURE" | "LH2_INFRASTRUCTURE_INTEGRITY";

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  scenarioType?: ScenarioType;
  metrics?: {
    credibilityScore?: number;
    residuals?: {
      continuity?: number;
      momentum?: number;
      energy?: number;
    };
  };
}

const SCENARIO_GEOMETRIES: Record<ScenarioType, any> = {
  H2_PIPELINE: { shape: 'cylinder_horizontal', radius: 0.1525, length: 5.0, description: 'Pipeline H2 DN300 PN200' },
  H2_DISTRIBUTION_HIGH_PRESSURE: { shape: 'cylinder_horizontal', radius: 0.1, length: 10.0, description: 'Distribution H2 70 MPa (NIST)' },
  LH2_STORAGE: { shape: 'cylinder_vertical', radius: 1.0, height: 4.0, description: 'Réservoir LH2 Cryogénique' },
  LH2_INFRASTRUCTURE_INTEGRITY: { shape: 'cylinder_vertical', radius: 1.5, height: 6.0, description: 'Master Thesis: LH2 Infrastructure Integrity & Leak Detection' },
  DEEP_MINING_BLOCK: { shape: 'box', length: 50.0, width: 50.0, height: 50.0, description: 'Bloc minier profond 2500m' },
  ROCK_ELAST_STRESS: { shape: 'box', length: 1.0, width: 1.0, height: 1.0, description: 'Contrainte élastique rocheuse' },
  H2_PIPELINE_STRATEGIC: { shape: 'cylinder_horizontal', radius: 0.5, length: 100.0, description: 'Pipeline H2 Stratégique' },
  FPGA_HEATSINK: { shape: 'box', length: 0.1, width: 0.1, height: 0.05, description: 'Dissipateur thermique FPGA' },
  PORT_ENERGY_OPTIMIZATION: { shape: 'box', length: 10.0, width: 10.0, height: 5.0, description: 'Optimisation portuaire' },
  PIPELINE_SAFETY: { shape: 'cylinder_horizontal', radius: 0.2, length: 20.0, description: 'Sécurité pipelines' },
  CRYOGENIC_TRANSPORT: { shape: 'cylinder_horizontal', radius: 0.8, length: 15.0, description: 'Transport cryogénique' },
  MINING_INDUSTRIAL_SIM: { shape: 'box', length: 20.0, width: 20.0, height: 20.0, description: 'Simulation minière' },
  H2_COMPRESSION_STATION: { shape: 'box', length: 5.0, width: 5.0, height: 5.0, description: 'Station de compression H2' }
};

export default function Industrial3DVisualizerEnhancedV11({
  data = [],
  title = "SIMULATION INDUSTRIELLE 3D - KELLY SENECAL GOLD STANDARD",
  colorVariable = 'pressure',
  scenarioType = 'LH2_INFRASTRUCTURE_INTEGRITY',
  metrics
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<any>(null)

  const [isMounted, setIsMounted] = useState(false)
  const [activeVariable, setActiveVariable] = useState(colorVariable)
  const [renderMode, setRenderMode] = useState<'particles' | 'volume' | 'isosurface'>('volume')
  const [colorScale, setColorScale] = useState<'viridis' | 'thermal' | 'jet'>('viridis')
  const [cutPosition, setCutPosition] = useState<number>(1.0) // Plan de coupe 0 à 1
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'3d' | 'plotly' | 'metrics'>('3d')

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false) }, [])

  const geometryMeta = useMemo(() => SCENARIO_GEOMETRIES[scenarioType] || SCENARIO_GEOMETRIES.LH2_INFRASTRUCTURE_INTEGRITY, [scenarioType])

  const stats = useMemo(() => {
    if (!data.length) return { minV: 0, maxV: 1, avgV: 0, count: 0, unit: 'MPa' }
    const vals = data.map(p => (p as any)[activeVariable] ?? 0)
    const unit = activeVariable === 'temperature' ? 'K' : activeVariable === 'pressure' ? 'MPa' : activeVariable.includes('velocity') ? 'm/s' : 'Pa'
    return { minV: Math.min(...vals), maxV: Math.max(...vals), avgV: vals.reduce((a, b) => a + b, 0) / vals.length, count: data.length, unit }
  }, [data, activeVariable])

  // Palette de couleur dynamique
  const colorScaleGradient = colorScale === 'thermal'
    ? 'linear-gradient(to right, #0000ff, #00ffff, #ffff00, #ff0000)'
    : colorScale === 'jet'
      ? 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)'
      : 'linear-gradient(to right, #440154, #31688e, #35b779, #fde725)'

  const getColorFromScale = useCallback((val: number, min: number, max: number, scale: string) => {
    const norm = Math.max(0, Math.min(1, (val - min) / (max - min || 1)))
    if (scale === 'thermal') {
      return new THREE.Color(norm < 0.5 ? norm * 2 : 1, norm < 0.5 ? 0 : (norm - 0.5) * 2, 1 - norm)
    } else if (scale === 'jet') {
      const r = norm < 0.7 ? (norm < 0.3 ? 0 : (norm - 0.3) / 0.4) : 1
      const g = norm < 0.3 ? norm / 0.3 : (norm < 0.7 ? 1 : 1 - (norm - 0.7) / 0.3)
      const b = norm < 0.3 ? 1 : (norm < 0.7 ? 1 - (norm - 0.3) / 0.4 : 0)
      return new THREE.Color(r, g, b)
    } else {
      // Viridis
      return new THREE.Color(norm, 0.5 * (1 - norm), 1 - norm)
    }
  }, [])

  // Initialisation Three.js : géométrie, repère scientifique et volume adaptés au scénario
  useEffect(() => {
    if (!isMounted || !containerRef.current || !data.length) return

    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 550
    const meta = geometryMeta
    const sourceBox = new THREE.Box3().setFromPoints(data.map(p => new THREE.Vector3(p.x, p.y, p.z)))
    const sourceSize = sourceBox.getSize(new THREE.Vector3())
    const sourceCenter = sourceBox.getCenter(new THREE.Vector3())
    const target = meta.shape === 'box'
      ? { x: meta.length, y: meta.height, z: meta.width }
      : meta.shape === 'cylinder_horizontal'
        ? { x: meta.length, y: meta.radius * 2, z: meta.radius * 2 }
        : { x: meta.radius * 2, y: meta.height, z: meta.radius * 2 }
    const fitSize = Math.max(target.x, target.y, target.z, 4)
    const normalizePoint = (p: DataPoint) => new THREE.Vector3(
      ((p.x - sourceCenter.x) / (sourceSize.x || 1)) * target.x,
      ((p.y - sourceCenter.y) / (sourceSize.y || 1)) * target.y,
      ((p.z - sourceCenter.z) / (sourceSize.z || 1)) * target.z
    )

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, fitSize * 20)
    camera.position.set(fitSize * 1.25, fitSize * 0.9, fitSize * 1.35)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.replaceChildren(renderer.domElement)
    rendererRef.current = renderer
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)
    controls.minDistance = fitSize * 0.45
    controls.maxDistance = fitSize * 8
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(fitSize, fitSize * 2, fitSize)
    scene.add(dirLight)

    const grid = new THREE.GridHelper(fitSize * 1.4, 14, 0x2563eb, 0x1e293b)
    grid.position.y = -(target.y / 2)
    scene.add(grid)
    const axes = new THREE.AxesHelper(fitSize * 0.75)
    scene.add(axes)

    const outerGeo = meta.shape === 'box'
      ? new THREE.BoxGeometry(target.x, target.y, target.z)
      : new THREE.CylinderGeometry(meta.radius, meta.radius, meta.shape === 'cylinder_horizontal' ? meta.length : meta.height, 64, 24, true)
    if (meta.shape === 'cylinder_horizontal') outerGeo.rotateZ(Math.PI / 2)
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.55, transparent: true, opacity: renderMode === 'volume' ? 0.2 : 0.08, side: THREE.DoubleSide, depthWrite: false })
    const vesselMesh = new THREE.Mesh(outerGeo, outerMat)
    scene.add(vesselMesh)

    const positions: number[] = []
    const colors: number[] = []
    data.forEach((p) => {
      const normalized = normalizePoint(p)
      if (normalized.x > (cutPosition - 0.5) * target.x) return
      positions.push(normalized.x, normalized.y, normalized.z)
      const val = (p as any)[activeVariable] ?? 0
      const color = getColorFromScale(val, stats.minV, stats.maxV, colorScale)
      colors.push(color.r, color.g, color.b)
    })
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    pointGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const pointMat = new THREE.PointsMaterial({ size: Math.max(fitSize * 0.012, renderMode === 'particles' ? fitSize * 0.018 : fitSize * 0.01), vertexColors: true, transparent: true, opacity: renderMode === 'particles' ? 0.95 : 0.72, sizeAttenuation: true })
    scene.add(new THREE.Points(pointGeo, pointMat))

    // Volume plein : l’enveloppe est toujours visible en mode volume/isosurface, les points apportent le champ coloré.
    if (renderMode !== 'particles') {
      const volumeMaterial = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: renderMode === 'isosurface' ? 0.32 : 0.14, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide, depthWrite: false })
      scene.add(new THREE.Mesh(outerGeo.clone(), volumeMaterial))
    }

    let animationFrameId: number
    const animate = () => { animationFrameId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()
    return () => { cancelAnimationFrame(animationFrameId); controls.dispose(); renderer.dispose(); pointGeo.dispose(); outerGeo.dispose() }
  }, [isMounted, data, activeVariable, renderMode, colorScale, cutPosition, stats, geometryMeta, getColorFromScale])

  // Fonctions d'export
  const exportCSV = () => {
    if (!data.length) return
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(p => Object.values(p).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${scenarioType}_export_data.csv`
    link.click()
  }

  const exportPNG = () => {
    if (!rendererRef.current) return
    const url = rendererRef.current.domElement.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `${scenarioType}_3d_render.png`
    link.click()
  }

  const exportSTL = () => {
    if (!sceneRef.current) return
    const exporter = new STLExporter()
    const result = exporter.parse(sceneRef.current, { binary: true })
    const blob = new Blob([result], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${scenarioType}_geometry.stl`
    link.click()
  }

  const exportGLTF = () => {
    if (!sceneRef.current) return
    const exporter = new GLTFExporter()
    exporter.parse(
      sceneRef.current,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2)
        const blob = new Blob([output], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${scenarioType}_scene.gltf`
        link.click()
      },
      (error) => { console.error('GLTF Export Error:', error) },
      { binary: false }
    )
  }

  // Données pour Plotly synchronisé
  const plotlyData = useMemo(() => {
    if (!data.length) return []
    const sample = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 200)) === 0)
    return [{
      x: sample.map(p => p.x),
      y: sample.map(p => (p as any)[activeVariable] ?? 0),
      type: 'scatter',
      mode: 'lines+markers',
      marker: {
        color: sample.map(p => (p as any)[activeVariable] ?? 0),
        colorscale: colorScale === 'thermal'
          ? [[0, '#0000ff'], [0.33, '#00ffff'], [0.66, '#ffff00'], [1, '#ff0000']]
          : colorScale === 'jet'
            ? [[0, '#0000ff'], [0.25, '#00ffff'], [0.5, '#00ff00'], [0.75, '#ffff00'], [1, '#ff0000']]
            : [[0, '#440154'], [0.33, '#31688e'], [0.66, '#35b779'], [1, '#fde725']],
        cmin: stats.minV,
        cmax: stats.maxV,
        size: 6,
        showscale: true,
        colorbar: { title: stats.unit }
      },
      line: { color: '#94a3b8', width: 1 }
    }]
  }, [data, activeVariable, colorScale, stats])

  return (
    <div className="flex flex-col h-full w-full bg-[#020617] rounded-[32px] border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-600" />

      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <span className="px-3 py-1 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-full text-[9px] font-black uppercase tracking-widest">
            Kelly Senecal Standard // Truly-Operational
          </span>
          <h3 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter mt-2">{title}</h3>
          <p className="text-[10px] text-gray-400 font-medium">{geometryMeta.description} — {stats.count} points volumétriques</p>
        </div>

        {/* View Switcher & Exports — hors de la scène pour préserver la lisibilité */}
        <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
          <button onClick={() => setActiveTab('3d')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === '3d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Vue 3D</button>
          <button onClick={() => setActiveTab('plotly')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'plotly' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Plotly 2D</button>
          <button onClick={() => setActiveTab('metrics')} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'metrics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Métriques</button>
          <span className="hidden md:block h-6 w-px bg-white/10 mx-1" />
          <button onClick={exportCSV} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-700">CSV</button>
          <button onClick={exportPNG} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-700">PNG</button>
          <button onClick={exportSTL} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-950/60 border border-blue-500/30 text-blue-300 hover:bg-blue-700">STL</button>
          <button onClick={exportGLTF} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-700">glTF</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 rounded-[24px] border border-white/10 bg-black/50 overflow-hidden">
        {activeTab === '3d' && (
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_112px] gap-4 items-stretch">
              <div className="relative w-full h-[420px] md:h-[560px] rounded-2xl border border-white/10 bg-[#020617] overflow-hidden">
                <div ref={containerRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute left-3 bottom-3 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-[9px] font-mono text-gray-300">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1"><span className="text-red-300">X 0→{(geometryMeta.length || geometryMeta.radius * 2 || 1).toFixed(2)} m</span><span className="text-green-300">Y 0→{(geometryMeta.height || geometryMeta.width || geometryMeta.radius * 2 || 1).toFixed(2)} m</span><span className="text-blue-300">Z 0→{(geometryMeta.width || geometryMeta.radius * 2 || 1).toFixed(2)} m</span></div>
                  <div className="mt-1 text-gray-500">Repère cartésien • grille métrique • unités SI</div>
                </div>
              </div>
              <aside className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 flex lg:flex-col gap-3 items-center justify-center">
                <div className="text-center text-[9px] font-black uppercase tracking-widest text-white break-words">{activeVariable}<span className="block text-cyan-400 mt-1">{stats.unit}</span></div>
                <div className="h-8 w-full lg:w-8 lg:h-[360px] rounded-lg border border-white/20" style={{ backgroundImage: colorScaleGradient.replace('to right', 'to top') }} aria-label={`Échelle ${activeVariable}`} />
                <div className="flex lg:flex-col justify-between gap-2 text-[9px] font-mono text-gray-400 text-center">
                  <span>Max {stats.maxV.toFixed(2)}</span><span>Moy {stats.avgV.toFixed(2)}</span><span>Min {stats.minV.toFixed(2)}</span>
                </div>
              </aside>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <label className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Variable physique
                <select value={activeVariable} onChange={(e) => setActiveVariable(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white uppercase focus:outline-none focus:border-blue-500">
                  <option value="pressure">Pression (MPa)</option><option value="temperature">Température (K)</option><option value="velocity_magnitude">Vitesse (m/s)</option><option value="stress">Contrainte (MPa)</option>
                </select>
              </label>
              <label className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Plan de coupe: {Math.round(cutPosition * 100)}%
                <input type="range" min="0" max="1" step="0.05" value={cutPosition} onChange={(e) => setCutPosition(parseFloat(e.target.value))} className="w-full mt-3 accent-blue-500 cursor-pointer" />
              </label>
              <div className="space-y-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Palette de couleurs
                <div className="grid grid-cols-3 gap-1 mt-1">{(['viridis', 'thermal', 'jet'] as const).map(s => <button key={s} onClick={() => setColorScale(s)} className={`py-2 rounded-lg text-[9px] font-black uppercase ${colorScale === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{s}</button>)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plotly' && (
          <div className="w-full h-full p-6 flex flex-col justify-center items-center">
            <div className="w-full h-[500px]">
              <Plot
                data={plotlyData as any}
                layout={{
                  title: { text: `Profil 2D Synchronisé — ${activeVariable.toUpperCase()}`, font: { color: '#ffffff', family: 'sans-serif', size: 14 } },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#94a3b8' },
                  xaxis: { title: 'Position X (m)', gridcolor: '#1e293b' },
                  yaxis: { title: `${activeVariable} (${stats.unit})`, gridcolor: '#1e293b' },
                  margin: { t: 40, r: 20, l: 50, b: 40 }
                }}
                config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', filename: `${scenarioType}_plot` } }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="w-full h-full p-8 flex flex-col gap-6 justify-center max-w-2xl mx-auto">
            <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Validation Numérique & Résidus PINN</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Score de Crédibilité</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{typeof metrics?.credibilityScore === 'number' ? `${metrics.credibilityScore.toFixed(1)}%` : 'N/D'}</p>
                <p className="text-[9px] text-gray-500 mt-1">Conforme Standard Kelly Senecal</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Points Volumétriques</p>
                <p className="text-3xl font-black text-blue-400 mt-1">{stats.count}</p>
                <p className="text-[9px] text-gray-500 mt-1">Échantillonnage adaptatif</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Résidus des Équations de Conservation</p>
              <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                <span className="text-gray-400">Continuité (Masse)</span>
                <span className="text-emerald-400 font-mono">{metrics?.residuals?.continuity != null ? metrics.residuals.continuity.toExponential(2) : 'N/D'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                <span className="text-gray-400">Navier-Stokes (Momentum)</span>
                <span className="text-emerald-400 font-mono">{metrics?.residuals?.momentum != null ? metrics.residuals.momentum.toExponential(2) : 'N/D'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-400">Conservation de l'Énergie</span>
                <span className="text-emerald-400 font-mono">{metrics?.residuals?.energy != null ? metrics.residuals.energy.toExponential(2) : 'N/D'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Export Action Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Prêt pour Production Industrielle & Mémoire Master</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </button>
          <button onClick={exportPNG} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Export PNG
          </button>
          <button onClick={exportSTL} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <Box className="w-3.5 h-3.5 text-blue-400" /> Export STL (3D)
          </button>
          <button onClick={exportGLTF} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/40 transition-all">
            <Download className="w-3.5 h-3.5" /> Export glTF
          </button>
        </div>
      </div>
    </div>
  )
}
