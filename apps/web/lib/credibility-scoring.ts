/**
 * Credibility Scoring System for Physics Validations
 * Implements dynamic scoring based on physics residuals and model agreement
 * Ready for integration into Supabase Edge Functions and backend services
 */

export interface CredibilityMetrics {
  pressureDeviation: number
  temperatureDeviation: number
  velocityDeviation: number
  residualNorm: number
  kalmanCorrection: number
  physicalBoundsViolations: number
}

export interface CredibilityScore {
  overallScore: number
  pressureScore: number
  temperatureScore: number
  velocityScore: number
  residualScore: number
  assimilationScore: number
  anomalies: string[]
  label: 'Excellent' | 'Acceptable' | 'Critique'
}

/**
 * Calculate credibility score from physics metrics
 * Formula: Score = 100 × (1 - mean(physics_residuals))
 */
export function calculateCredibilityScore(
  metrics: CredibilityMetrics,
  fluidType: string = 'H2'
): CredibilityScore {
  let overallScore = 100
  const anomalies: string[] = []

  // 1. Pressure deviation scoring (weight: 30%)
  const pressureScore = calculatePressureScore(
    metrics.pressureDeviation,
    fluidType,
    anomalies
  )
  overallScore -= (100 - pressureScore) * 0.30

  // 2. Temperature deviation scoring (weight: 20%)
  const temperatureScore = calculateTemperatureScore(
    metrics.temperatureDeviation,
    fluidType,
    anomalies
  )
  overallScore -= (100 - temperatureScore) * 0.20

  // 3. Velocity deviation scoring (weight: 15%)
  const velocityScore = calculateVelocityScore(
    metrics.velocityDeviation,
    fluidType,
    anomalies
  )
  overallScore -= (100 - velocityScore) * 0.15

  // 4. Residual norm scoring (weight: 20%)
  const residualScore = calculateResidualScore(
    metrics.residualNorm,
    anomalies
  )
  overallScore -= (100 - residualScore) * 0.20

  // 5. Kalman Filter correction scoring (weight: 15%)
  const assimilationScore = calculateAssimilationScore(
    metrics.kalmanCorrection,
    anomalies
  )
  overallScore -= (100 - assimilationScore) * 0.15

  // Normalize final score
  overallScore = Math.max(0, Math.min(100, overallScore))

  // Determine label
  let label: 'Excellent' | 'Acceptable' | 'Critique'
  if (overallScore >= 80) {
    label = 'Excellent'
  } else if (overallScore >= 60) {
    label = 'Acceptable'
  } else {
    label = 'Critique'
  }

  return {
    overallScore: Math.round(overallScore),
    pressureScore: Math.round(pressureScore),
    temperatureScore: Math.round(temperatureScore),
    velocityScore: Math.round(velocityScore),
    residualScore: Math.round(residualScore),
    assimilationScore: Math.round(assimilationScore),
    anomalies,
    label,
  }
}

/**
 * Calculate pressure-specific credibility score
 * Hydrogen: 1-1000 bar acceptable range
 */
function calculatePressureScore(
  deviation: number,
  fluidType: string,
  anomalies: string[]
): number {
  let maxDeviation = 0.3 // 30% default

  // Adjust thresholds by fluid type
  switch (fluidType) {
    case 'H2':
      maxDeviation = 0.25 // 25% for hydrogen
      break
    case 'NH3':
      maxDeviation = 0.20 // 20% for ammonia
      break
    case 'CH4':
      maxDeviation = 0.22 // 22% for methane
      break
    case 'sCO2':
      maxDeviation = 0.28 // 28% for supercritical CO2
      break
  }

  if (deviation > maxDeviation) {
    anomalies.push(
      `Pressure deviation ${(deviation * 100).toFixed(1)}% exceeds ${fluidType} threshold`
    )
    return Math.max(0, 100 - (deviation / maxDeviation) * 100)
  }

  return 100 - (deviation / maxDeviation) * 100
}

/**
 * Calculate temperature-specific credibility score
 * Hydrogen liquid range: 14-33 K, extended to 500 K for supercritical
 */
function calculateTemperatureScore(
  deviation: number,
  fluidType: string,
  anomalies: string[]
): number {
  let maxDeviation = 0.15 // 15% default

  switch (fluidType) {
    case 'H2':
      maxDeviation = 0.10 // Stricter for hydrogen
      break
    case 'NH3':
      maxDeviation = 0.12
      break
    case 'CH4':
      maxDeviation = 0.12
      break
    case 'sCO2':
      maxDeviation = 0.15
      break
  }

  if (deviation > maxDeviation) {
    anomalies.push(
      `Temperature deviation ${(deviation * 100).toFixed(1)}% exceeds ${fluidType} threshold`
    )
    return Math.max(0, 100 - (deviation / maxDeviation) * 100)
  }

  return 100 - (deviation / maxDeviation) * 100
}

/**
 * Calculate velocity-specific credibility score
 * Typical flow velocities: 0-500 m/s
 */
function calculateVelocityScore(
  deviation: number,
  fluidType: string,
  anomalies: string[]
): number {
  const maxDeviation = 0.20 // 20% deviation acceptable

  if (deviation > maxDeviation) {
    anomalies.push(
      `Velocity deviation ${(deviation * 100).toFixed(1)}% exceeds acceptable threshold`
    )
    return Math.max(0, 100 - (deviation / maxDeviation) * 100)
  }

  return 100 - (deviation / maxDeviation) * 100
}

/**
 * Calculate residual norm score
 * Based on Navier-Stokes equation residuals
 * Lower residuals indicate better physics adherence
 */
function calculateResidualScore(
  residualNorm: number,
  anomalies: string[]
): number {
  // Residual norm thresholds (Pa for pressure residuals)
  const excellentThreshold = 1e3 // < 1 kPa
  const acceptableThreshold = 1e4 // < 10 kPa
  const criticalThreshold = 1e5 // < 100 kPa

  if (residualNorm < excellentThreshold) {
    return 100
  } else if (residualNorm < acceptableThreshold) {
    return 85
  } else if (residualNorm < criticalThreshold) {
    anomalies.push(
      `High Navier-Stokes residual norm: ${(residualNorm / 1e3).toFixed(1)} kPa`
    )
    return 60
  } else {
    anomalies.push(
      `Critical Navier-Stokes residual norm: ${(residualNorm / 1e3).toFixed(1)} kPa`
    )
    return 30
  }
}

/**
 * Calculate assimilation score based on Kalman Filter correction
 * Measures agreement between model predictions and observations
 */
function calculateAssimilationScore(
  kalmanCorrection: number,
  anomalies: string[]
): number {
  // Correction magnitude thresholds
  const smallCorrection = 5 // < 5% correction
  const moderateCorrection = 20 // < 20% correction
  const largeCorrection = 50 // < 50% correction

  if (kalmanCorrection < smallCorrection) {
    return 100 // Excellent agreement
  } else if (kalmanCorrection < moderateCorrection) {
    return 85 // Good agreement
  } else if (kalmanCorrection < largeCorrection) {
    anomalies.push(
      `Moderate Kalman Filter correction: ${kalmanCorrection.toFixed(1)}% state adjustment`
    )
    return 65 // Acceptable agreement
  } else {
    anomalies.push(
      `Large Kalman Filter correction: ${kalmanCorrection.toFixed(1)}% state adjustment`
    )
    return 40 // Poor agreement
  }
}

/**
 * Compute physics residuals from 3D PINN predictions
 * Evaluates adherence to Navier-Stokes equations
 */
export function computePhysicsResiduals(
  predictions: Array<{
    pressure: number
    velocity_u: number
    velocity_v: number
    velocity_w: number
    temperature: number
    density: number
    time: number
    x: number
    y: number
    z: number
  }>
): {
  continuityResidual: number
  momentumResidual: number
  energyResidual: number
  totalResidualNorm: number
} {
  if (predictions.length < 2) {
    return {
      continuityResidual: 0,
      momentumResidual: 0,
      energyResidual: 0,
      totalResidualNorm: 0,
    }
  }

  // Compute spatial gradients (simplified finite differences)
  const p1 = predictions[0]
  const p2 = predictions[1]
  const p3 = predictions[predictions.length - 1]

  // Continuity equation: ∂ρ/∂t + ∇·(ρu) = 0
  const drho_dt = (p2.density - p1.density) / (p2.time - p1.time + 1e-8)
  const div_rhou = (p3.density * p3.velocity_u - p1.density * p1.velocity_u) / (p3.x - p1.x + 1e-8)
  const continuityResidual = Math.abs(drho_dt + div_rhou)

  // Momentum equation: ρ(∂u/∂t + u·∇u) = -∇p + μ∇²u
  const du_dt = (p2.velocity_u - p1.velocity_u) / (p2.time - p1.time + 1e-8)
  const dp_dx = (p3.pressure - p1.pressure) / (p3.x - p1.x + 1e-8)
  const momentumResidual = Math.abs(p1.density * du_dt + dp_dx)

  // Energy equation: ρCp(∂T/∂t + u·∇T) = k∇²T + pressure work
  const dT_dt = (p2.temperature - p1.temperature) / (p2.time - p1.time + 1e-8)
  const Cp = 14300 // J/(kg·K) for H2
  const energyResidual = Math.abs(p1.density * Cp * dT_dt)

  // Total residual norm (L2 norm)
  const totalResidualNorm = Math.sqrt(
    continuityResidual ** 2 + momentumResidual ** 2 + energyResidual ** 2
  )

  return {
    continuityResidual,
    momentumResidual,
    energyResidual,
    totalResidualNorm,
  }
}

/**
 * Generate credibility report for storage/display
 */
export function generateCredibilityReport(
  score: CredibilityScore,
  residuals: ReturnType<typeof computePhysicsResiduals>
): string {
  let report = `# Rapport de Crédibilité Physique\n\n`
  report += `## Score Global: ${score.overallScore}/100 (${score.label})\n\n`
  report += `### Scores Détaillés:\n`
  report += `- Pression: ${score.pressureScore}/100\n`
  report += `- Température: ${score.temperatureScore}/100\n`
  report += `- Vélocité: ${score.velocityScore}/100\n`
  report += `- Résidus: ${score.residualScore}/100\n`
  report += `- Assimilation: ${score.assimilationScore}/100\n\n`

  report += `### Résidus Navier-Stokes:\n`
  report += `- Continuité: ${residuals.continuityResidual.toExponential(2)} Pa\n`
  report += `- Momentum: ${residuals.momentumResidual.toExponential(2)} Pa\n`
  report += `- Énergie: ${residuals.energyResidual.toExponential(2)} J/(kg·s)\n`
  report += `- Norme totale: ${residuals.totalResidualNorm.toExponential(2)}\n\n`

  if (score.anomalies.length > 0) {
    report += `### Anomalies Détectées:\n`
    score.anomalies.forEach(anomaly => {
      report += `- ${anomaly}\n`
    })
  } else {
    report += `### Aucune anomalie majeure détectée.\n`
  }

  return report
}

/**
 * Sovereignty score calculation
 * Evaluates data security, IP protection, and independence
 */
export interface SovereigntyScore {
  dataSecurityScore: number
  intellectualPropertyScore: number
  independenceScore: number
  overallSovereigntyIndex: number
}

export function calculateSovereigntyScore(
  credibilityScore: CredibilityScore,
  hasLocalModel: boolean = true,
  usesOpenSource: boolean = true
): SovereigntyScore {
  // Data security: based on credibility (higher credibility = more trustworthy data)
  const dataSecurityScore = Math.min(100, credibilityScore.overallScore + 15)

  // Intellectual property: based on model ownership
  const intellectualPropertyScore = hasLocalModel ? 90 : 60

  // Independence: based on open-source usage and local computation
  const independenceScore = usesOpenSource ? 85 : 70

  // Overall sovereignty index (weighted average)
  const overallSovereigntyIndex = Math.round(
    dataSecurityScore * 0.35 +
    intellectualPropertyScore * 0.35 +
    independenceScore * 0.30
  )

  return {
    dataSecurityScore: Math.round(dataSecurityScore),
    intellectualPropertyScore,
    independenceScore,
    overallSovereigntyIndex,
  }
}
