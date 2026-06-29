import { useMemo } from 'react'

interface AuditData {
  predictions3d?: any[]
  convergence_metrics?: {
    residual_max: number
    residual_avg: number
    iterations: number
  }
  uncertainty?: number
  credibility_score?: number
}

interface AuditResult {
  convergenceOk: boolean
  physicsOk: boolean
  uncertaintyOk: boolean
  validationOk: boolean
  allOk: boolean
  warnings: string[]
  errors: string[]
}

export function useScientificAudit(data: AuditData | undefined): AuditResult {
  return useMemo(() => {
    const result: AuditResult = {
      convergenceOk: true,
      physicsOk: true,
      uncertaintyOk: true,
      validationOk: true,
      allOk: true,
      warnings: [],
      errors: [],
    }

    if (!data) return result

    // Vérification de la convergence
    if (data.convergence_metrics) {
      const { residual_max, residual_avg } = data.convergence_metrics
      if (residual_max > 1e-2) {
        result.convergenceOk = false
        result.errors.push(`Convergence faible: résidu max = ${residual_max.toExponential(2)}`)
      } else if (residual_max > 1e-3) {
        result.warnings.push(`Convergence acceptable: résidu max = ${residual_max.toExponential(2)}`)
      }
    }

    // Vérification des limites physiques
    if (data.predictions3d && data.predictions3d.length > 0) {
      const physicalErrors: string[] = []
      
      data.predictions3d.forEach((p, idx) => {
        if (p.temperature < 0) {
          physicalErrors.push(`Point ${idx}: Température < 0K`)
        }
        if (p.temperature > 10000) {
          result.warnings.push(`Point ${idx}: Température extrême (${p.temperature}K)`)
        }
        if (p.pressure < 0) {
          physicalErrors.push(`Point ${idx}: Pression négative`)
        }
        if (p.velocity_magnitude !== undefined && p.velocity_magnitude > 500) {
          result.warnings.push(`Point ${idx}: Vitesse extrême (${p.velocity_magnitude}m/s)`)
        }
      })

      if (physicalErrors.length > 0) {
        result.physicsOk = false
        result.errors.push(...physicalErrors)
      }
    }

    // Vérification de l'incertitude
    if (data.uncertainty !== undefined) {
      if (data.uncertainty > 0.2) {
        result.uncertaintyOk = false
        result.errors.push(`Incertitude trop élevée: ${(data.uncertainty * 100).toFixed(1)}%`)
      } else if (data.uncertainty > 0.1) {
        result.warnings.push(`Incertitude moyenne: ${(data.uncertainty * 100).toFixed(1)}%`)
      }
    }

    // Vérification globale de validation
    if (data.credibility_score !== undefined) {
      if (data.credibility_score < 50) {
        result.validationOk = false
        result.errors.push(`Score de crédibilité faible: ${data.credibility_score.toFixed(1)}/100`)
      } else if (data.credibility_score < 75) {
        result.warnings.push(`Score de crédibilité acceptable: ${data.credibility_score.toFixed(1)}/100`)
      }
    }

    // Déterminer si tout est OK
    result.allOk = result.convergenceOk && result.physicsOk && result.uncertaintyOk && result.validationOk

    return result
  }, [data])
}
