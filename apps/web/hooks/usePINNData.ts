import { useState, useCallback, useEffect } from 'react'

interface PINNDataParams {
  time?: number
  x?: number
  y?: number
  z?: number
  scan_spatial?: boolean
  n_points?: number
  reynolds?: number
  pressure?: number
  temperature?: number
}

/**
 * CORRECTION: Hook robuste pour récupérer les données PINN
 * - Retry automatique avec backoff exponentiel
 * - Validation stricte des données (pas de fallback)
 * - Gestion d'erreurs transparente
 * - Timeout pour éviter les blocages
 */
export const usePINNData = (apiBaseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com') => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          return response
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)

        if (attempt < maxRetries) {
          const delay = delayMs * Math.pow(2, attempt)
          console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < maxRetries) {
          const delay = delayMs * Math.pow(2, attempt)
          console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }, [])

  const fetchPINNData = useCallback(async (params: PINNDataParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetchWithRetry(
        `${apiBaseUrl}/v2/validate-3d`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: params.time ?? 0.0,
            x: params.x ?? 0.5,
            y: params.y ?? 0.5,
            z: params.z ?? 0.5,
            scan_spatial: params.scan_spatial ?? true,
            n_points: params.n_points ?? 50,
            pressure: params.pressure ?? 101325.0,
            temperature: params.temperature ?? 293.15,
            density: 1.0,
            velocity_magnitude: 0.5
          })
        },
        3,
        1000
      )

      const result = await response.json()
      
      // Validation stricte: pas de fallback
      if (result.predictions3d && Array.isArray(result.predictions3d)) {
        // Filtrer uniquement les points avec coordonnées complètes
        const validPoints = result.predictions3d.filter((p: any) =>
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          typeof p.z === 'number' &&
          typeof p.temperature === 'number' &&
          typeof p.pressure === 'number'
        )

        if (validPoints.length === 0) {
          throw new Error('No valid 3D points in response')
        }

        setData(validPoints)
        return validPoints
      } else if (result.pressure !== undefined && typeof result.x === 'number' && typeof result.y === 'number' && typeof result.z === 'number') {
        // Single point response - convert to array
        const singlePoint = {
          x: result.x,
          y: result.y,
          z: result.z,
          temperature: result.temperature || 0,
          pressure: result.pressure,
          density: result.density,
          velocity_magnitude: result.velocity_magnitude
        }
        setData([singlePoint])
        return [singlePoint]
      } else {
        throw new Error('Invalid response format from PINN API: missing required fields')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching PINN data'
      setError(errorMsg)
      console.error('PINN Data Error:', errorMsg)
      setData([])
      return null
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, fetchWithRetry])

  return {
    data,
    loading,
    error,
    fetchPINNData,
    reset: () => {
      setData([])
      setError(null)
    }
  }
}
