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

export const usePINNData = (apiBaseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com') => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPINNData = useCallback(async (params: PINNDataParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${apiBaseUrl}/v2/validate-3d`, {
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
        }),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.predictions3d && Array.isArray(result.predictions3d)) {
        setData(result.predictions3d)
        return result.predictions3d
      } else if (result.pressure !== undefined) {
        // Single point response - convert to array
        setData([result])
        return [result]
      } else {
        throw new Error('Invalid response format from PINN API')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching PINN data'
      setError(errorMsg)
      console.error('PINN Data Error:', errorMsg)
      return null
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

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
