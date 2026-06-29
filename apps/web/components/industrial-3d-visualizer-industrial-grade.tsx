'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'

interface ScenarioMetadata {
  reynolds?: number
  mach?: number
  domainBounds?: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number }
  fluidProperties?: { density: number; viscosity: number; temperature_ref: number }
  boundaryConditions?: string
  description?: string
}

interface DataPoint {
  x: number
  y: number
  z: number
  temperature: number
  pressure: number
  velocity_magnitude?: number
  velocity_u?: number
  velocity_v?: number
  velocity_w?: number
  damage?: number
  tke?: number
  epsilon?: number
  stress?: number
  uncertainty?: number
  residual?: number
}

interface Props {
  data?: DataPoint[]
  scenario?: ScenarioMetadata
  title?: string
  showValidation?: boolean
}

interface ValidationResult {
  massConservation: boolean
  physicalLimits: boolean
  convergence: boolean
  warnings: string[]
  errors: string[]
}

const Industrial3DVisualizerIndustrialGrade: React.FC<Props> = ({ 
  data = [], 
  scenario,
  title = "Visualisation Scientifique 3D - Grade Industriel",
  showValidation = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState({
    pointCount: 0,
    avgTemp: 0,
    maxVelocity: 0,
    minPressure: 0,
    maxPressure: 0,
    minTemp: 0,
    maxTemp: 0,
  })
  const [validation, setValidation] = useState<ValidationResult>({
    massConservation: true,
    physicalLimits: true,
    convergence: true,
    warnings: [],
    errors: [],
  })
  const [domainBounds, setDomainBounds] = useState({
    xMin: 0, xMax: 1,
    yMin: 0, yMax: 1,
    zMin: 0, zMax: 1,
  })

  // Calcul des limites du domaine à partir des données
  const calculateDomainBounds = (points: DataPoint[]) => {
    if (points.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }
    
    let xMin = points[0].x, xMax = points[0].x
    let yMin = points[0].y, yMax = points[0].y
    let zMin = points[0].z, zMax = points[0].z

    points.forEach(p => {
      xMin = Math.min(xMin, p.x)
      xMax = Math.max(xMax, p.x)
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
      zMin = Math.min(zMin, p.z)
      zMax = Math.max(zMax, p.z)
    })

    // Ajouter 10% de marge pour la visualisation
    const xMargin = (xMax - xMin) * 0.1 || 0.5
    const yMargin = (yMax - yMin) * 0.1 || 0.5
    const zMargin = (zMax - zMin) * 0.1 || 0.5

    return {
      xMin: xMin - xMargin,
      xMax: xMax + xMargin,
      yMin: yMin - yMargin,
      yMax: yMax + yMargin,
      zMin: zMin - zMargin,
      zMax: zMax + zMargin,
    }
  }

  // Validation physique des données
  const validatePhysics = (points: DataPoint[]): ValidationResult => {
    const result: ValidationResult = {
      massConservation: true,
      physicalLimits: true,
      convergence: true,
      warnings: [],
      errors: [],
    }

    if (points.length === 0) return result

    // Vérification des limites physiques
    points.forEach((p, idx) => {
      if (p.temperature < 0) {
        result.physicalLimits = false
        result.errors.push(`Point ${idx}: Température < 0K (${p.temperature}K)`)
      }
      if (p.temperature > 10000) {
        result.warnings.push(`Point ${idx}: Température extrême (${p.temperature}K)`)
      }
      if (p.pressure < 0) {
        result.physicalLimits = false
        result.errors.push(`Point ${idx}: Pression négative (${p.pressure}Pa)`)
      }
      if (p.velocity_magnitude !== undefined && p.velocity_magnitude > 500) {
        result.warnings.push(`Point ${idx}: Vitesse extrême (${p.velocity_magnitude}m/s)`)
      }
    })

    // Vérification de la convergence (résidus)
    const residuals = points.filter(p => p.residual !== undefined).map(p => p.residual!)
    if (residuals.length > 0) {
      const maxResidual = Math.max(...residuals)
      if (maxResidual > 1e-3) {
        result.convergence = false
        result.warnings.push(`Convergence faible: résidu max = ${maxResidual.toExponential(2)}`)
      }
    }

    // Vérification des incertitudes
    const uncertainties = points.filter(p => p.uncertainty !== undefined).map(p => p.uncertainty!)
    if (uncertainties.length > 0) {
      const avgUncertainty = uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length
      if (avgUncertainty > 0.1) {
        result.warnings.push(`Incertitude moyenne élevée: ${(avgUncertainty * 100).toFixed(1)}%`)
      }
    }

    return result
  }

  // Calcul des statistiques
  const calculateStats = (points: DataPoint[]) => {
    if (points.length === 0) return

    const temps = points.map(p => p.temperature)
    const vels = points.map(p => p.velocity_magnitude || 0)
    const pressures = points.map(p => p.pressure)

    const newStats = {
      pointCount: points.length,
      avgTemp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
      maxVelocity: Math.max(...vels),
      minPressure: Math.min(...pressures),
      maxPressure: Math.max(...pressures),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
    }

    setStats(newStats)
    const bounds = calculateDomainBounds(points)
    setDomainBounds(bounds)
    const validation = validatePhysics(points)
    setValidation(validation)
  }

  useEffect(() => {
    if (!containerRef.current) return

    calculateStats(data)

    const init = async () => {
      // @ts-ignore
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x020617)

      const camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current!.clientWidth / containerRef.current!.clientHeight,
        0.1,
        10000
      )

      // Positionner la caméra au centre du domaine
      const centerX = (domainBounds.xMin + domainBounds.xMax) / 2
      const centerY = (domainBounds.yMin + domainBounds.yMax) / 2
      const centerZ = (domainBounds.zMin + domainBounds.zMax) / 2
      const distance = Math.max(
        domainBounds.xMax - domainBounds.xMin,
        domainBounds.yMax - domainBounds.yMin,
        domainBounds.zMax - domainBounds.zMin
      ) * 1.5

      camera.position.set(centerX + distance, centerY + distance, centerZ + distance)
      camera.lookAt(centerX, centerY, centerZ)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      containerRef.current!.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.target.set(centerX, centerY, centerZ)

      // Axes avec vraies étiquettes
      const axesHelper = new THREE.AxesHelper(distance * 0.3)
      scene.add(axesHelper)

      // Grille adaptative
      const gridSize = Math.max(
        domainBounds.xMax - domainBounds.xMin,
        domainBounds.yMax - domainBounds.yMin,
        domainBounds.zMax - domainBounds.zMin
      )
      const divisions = Math.ceil(gridSize / 10) || 10
      const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x334155, 0x1e293b)
      gridHelper.position.set(centerX, domainBounds.yMin, centerZ)
      scene.add(gridHelper)

      // Boîte englobante du domaine
      const boxGeometry = new THREE.BoxGeometry(
        domainBounds.xMax - domainBounds.xMin,
        domainBounds.yMax - domainBounds.yMin,
        domainBounds.zMax - domainBounds.zMin
      )
      const boxMaterial = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, transparent: true, opacity: 0.6 })
      const boxLines = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), boxMaterial)
      boxLines.position.set(centerX, centerY, centerZ)
      scene.add(boxLines)

      // Éclairage
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)
      const pointLight = new THREE.PointLight(0xffffff, 1)
      pointLight.position.set(centerX + distance, centerY + distance, centerZ + distance)
      scene.add(pointLight)

      // Visualisation des données
      if (data && data.length > 0) {
        // Créer des points avec couleurs basées sur la température
        const positions: number[] = []
        const colors: number[] = []
        const temps = data.map(p => p.temperature)
        const minTemp = Math.min(...temps)
        const maxTemp = Math.max(...temps)
        const tempRange = maxTemp - minTemp || 1

        data.forEach(p => {
          positions.push(p.x, p.y, p.z)
          const normalized = (p.temperature - minTemp) / tempRange
          const color = new THREE.Color().setHSL(0.6 * (1 - normalized), 1, 0.5)
          colors.push(color.r, color.g, color.b)
        })

        // Géométrie des points
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

        // Points de données
        const pointMaterial = new THREE.PointsMaterial({
          size: 0.5,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
        })
        const points = new THREE.Points(geometry, pointMaterial)
        scene.add(points)

        // Tube le long des trajectoires (si les points sont ordonnés)
        if (data.length > 2) {
          const curvePoints = data.map(p => new THREE.Vector3(p.x, p.y, p.z))
          const curve = new THREE.CatmullRomCurve3(curvePoints)
          const tubeGeometry = new THREE.TubeGeometry(curve, Math.min(data.length, 100), 0.3, 8, false)

          const tubeMaterial = new THREE.MeshPhongMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.3,
            shininess: 100,
          })
          const tube = new THREE.Mesh(tubeGeometry, tubeMaterial)
          scene.add(tube)
        }
      }

      // Animation
      const animate = () => {
        requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Nettoyage
      return () => {
        renderer.dispose()
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement)
        }
      }
    }

    init()
  }, [data, domainBounds])

  return (
    <div className="w-full space-y-4">
      {/* Visualiseur 3D */}
      <div className="w-full relative group">
        {/* Légende de température */}
        <div className="absolute top-6 right-6 z-10 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Échelle: Température (K)</p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-24 bg-gradient-to-t from-blue-600 via-emerald-500 to-red-500 rounded-full border border-white/10" />
            <div className="flex flex-col justify-between h-24 text-[9px] font-mono text-slate-300">
              <span>{stats.maxTemp.toFixed(0)} K</span>
              <span>{((stats.maxTemp + stats.minTemp) / 2).toFixed(0)} K</span>
              <span>{stats.minTemp.toFixed(0)} K</span>
            </div>
          </div>
        </div>

        {/* Axes avec unités */}
        <div className="absolute bottom-6 left-6 z-10 flex gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
            <span className="w-2 h-2 bg-red-500 rounded-full" /> X: [{domainBounds.xMin.toFixed(1)}, {domainBounds.xMax.toFixed(1)}] m
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
            <span className="w-2 h-2 bg-green-500 rounded-full" /> Y: [{domainBounds.yMin.toFixed(1)}, {domainBounds.yMax.toFixed(1)}] m
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono">
            <span className="w-2 h-2 bg-blue-500 rounded-full" /> Z: [{domainBounds.zMin.toFixed(1)}, {domainBounds.zMax.toFixed(1)}] m
          </div>
        </div>

        {/* Canvas 3D */}
        <div ref={containerRef} className="w-full h-[500px] bg-slate-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl" />
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Points</p>
          <p className="text-xl font-black text-blue-400 mt-1">{stats.pointCount.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Temp Moy</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{stats.avgTemp} K</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Vitesse Max</p>
          <p className="text-xl font-black text-orange-400 mt-1">{stats.maxVelocity.toFixed(2)} m/s</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Pression</p>
          <p className="text-xl font-black text-purple-400 mt-1">{(stats.maxPressure / 1e5).toFixed(2)} bar</p>
        </div>
      </div>

      {/* Validation Physique */}
      {showValidation && (
        <div className="space-y-3">
          {validation.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">⚠️ Erreurs Physiques</p>
              {validation.errors.map((err, idx) => (
                <p key={idx} className="text-[10px] text-red-300 font-mono">{err}</p>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">⚡ Avertissements</p>
              {validation.warnings.map((warn, idx) => (
                <p key={idx} className="text-[10px] text-amber-300 font-mono">{warn}</p>
              ))}
            </div>
          )}
          {validation.errors.length === 0 && validation.warnings.length === 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">✅ Validation Physique Réussie</p>
            </div>
          )}
        </div>
      )}

      {/* Métadonnées de Scénario */}
      {scenario && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scénario Industriel</p>
          {scenario.reynolds && <p className="text-[10px] text-gray-300 font-mono">Reynolds: {scenario.reynolds.toExponential(2)}</p>}
          {scenario.mach && <p className="text-[10px] text-gray-300 font-mono">Mach: {scenario.mach.toFixed(3)}</p>}
          {scenario.description && <p className="text-[10px] text-gray-300">{scenario.description}</p>}
        </div>
      )}
    </div>
  )
}

export default Industrial3DVisualizerIndustrialGrade
