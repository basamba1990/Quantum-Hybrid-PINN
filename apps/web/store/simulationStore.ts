import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Prediction3D, Analysis, AnalysisResults } from '@/types'

// Types for simulation parameters
export interface SimulationParams {
  projectId: string
  name: string
  transcription: string
}

// Zustand store state interface
interface SimulationState {
  // État des données
  analyses: Analysis[]
  currentAnalysis: Analysis | null
  predictions3d: Prediction3D[] | null

  // États de chargement et d'erreur
  isLoading: boolean
  error: string | null

  // Fonctions de mise à jour
  setAnalyses: (analyses: Analysis[]) => void
  setCurrentAnalysis: (analysis: Analysis | null) => void
  clearError: () => void
  reset: () => void

  // Action asynchrone pour lancer une simulation
  startSimulation: (params: SimulationParams) => Promise<Analysis>

  // Helper pour récupérer les prédictions d'une analyse donnée
  fetchPredictions: (analysisId: string) => Promise<Prediction3D[] | null>

  // Fallback local en cas d'échec API
  generateLocalPrediction: (point: { time: number; x: number; y: number; z: number }) => Prediction3D

  // Batch generation for fallback
  generateLocalPredictions: (points: Array<{ time: number; x: number; y: number; z: number }>) => Prediction3D[]
}

// Helper function for API calls with fallback
async function callWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorContext: string = 'API call'
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`${errorContext} failed: ${errorMsg}. Using fallback.`)
    return fallback
  }
}

export const useSimulationStore = create<SimulationState>()(
  devtools(
    (set, get) => ({
      analyses: [],
      currentAnalysis: null,
      predictions3d: null,
      isLoading: false,
      error: null,

      setAnalyses: (analyses) => set({ analyses }, false, 'setAnalyses'),
      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }, false, 'setCurrentAnalysis'),
      clearError: () => set({ error: null }, false, 'clearError'),
      reset: () =>
        set(
          {
            analyses: [],
            currentAnalysis: null,
            predictions3d: null,
            isLoading: false,
            error: null,
          },
          false,
          'reset'
        ),

      // Génération locale de prédiction (fallback)
      generateLocalPrediction: (point) => ({
        time: point.time,
        x: point.x,
        y: point.y,
        z: point.z,
        pressure: 1e5 * (1 + 0.1 * Math.sin(point.time)),
        velocity_u: 0.5 * (1 + 0.05 * Math.cos(point.time)),
        velocity_v: 0.1 * Math.sin(point.time),
        velocity_w: 0.05 * Math.cos(point.time * 0.8),
        temperature: 298 + 10 * Math.sin(point.time),
        density: 0.0899,
        timestamp: new Date().toISOString(),
      }),

      // Batch generation for multiple points
      generateLocalPredictions: (points) => {
        return points.map((point) => get().generateLocalPrediction(point))
      },

      // Fallback pour un batch de prédictions
      fetchPredictions: async (analysisId: string) => {
        const state = get()
        // Si déjà chargées et correspond à l'analyse courante, on les retourne
        if (state.currentAnalysis?.id === analysisId && state.predictions3d) {
          return state.predictions3d
        }

        // Sinon, essayer de récupérer depuis l'API
        try {
          set({ isLoading: true, error: null })
          const response = await fetch(`/api/analyses/${analysisId}/predictions`)
          if (!response.ok) throw new Error(`Failed to fetch predictions: ${response.statusText}`)
          const data = await response.json()
          const predictions = data.predictions3d as Prediction3D[]
          set({ predictions3d: predictions, isLoading: false })
          return predictions
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          set({ error: errorMsg, isLoading: false })
          console.error('Error fetching predictions:', errorMsg)
          return null
        }
      },

      startSimulation: async (params) => {
        set({ isLoading: true, error: null })
        try {
          // 1. Créer une analyse en base
          const createRes = await fetch('/api/analyses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: params.projectId,
              name: params.name,
              transcription: params.transcription,
            }),
          })
          if (!createRes.ok) {
            const errData = await createRes.json().catch(() => ({}))
            throw new Error(errData.error || `Failed to create analysis: ${createRes.statusText}`)
          }
          const analysis = (await createRes.json()) as Analysis

          // 2. Lancer l'Edge Function de vérification physique
          const edgeRes = await fetch('/api/edge/verify-physics-logic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: params.projectId,
              analysisId: analysis.id,
              transcription: params.transcription,
            }),
          })

          let result: AnalysisResults
          if (!edgeRes.ok) {
            const errData = await edgeRes.json().catch(() => ({}))
            const errorMsg = errData.error || `Physics verification failed: ${edgeRes.statusText}`
            console.warn(errorMsg, 'Using fallback predictions')

            // Fallback: generate local predictions
            const fallbackPoints = Array.from({ length: 10 }, (_, i) => ({
              time: i * 0.1,
              x: 0.5,
              y: 0.5,
              z: 0.5,
            }))
            result = {
              isPhysicallyCoherent: false,
              credibilityScore: 0.5,
              anomalies: [errorMsg],
              extractedData: {},
              predictions3d: get().generateLocalPredictions(fallbackPoints),
            }
          } else {
            result = await edgeRes.json()
          }

          // 3. Mettre à jour l'analyse avec les résultats
          const updateRes = await fetch(`/api/analyses/${analysis.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'completed',
              credibility_score: result.credibilityScore,
              results: result,
            }),
          })
          if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}))
            throw new Error(errData.error || `Failed to update analysis: ${updateRes.statusText}`)
          }

          const updatedAnalysis: Analysis = {
            ...analysis,
            status: 'completed',
            credibility_score: result.credibilityScore,
            results: result,
          }

          set(
            (state) => ({
              analyses: [updatedAnalysis, ...state.analyses],
              currentAnalysis: updatedAnalysis,
              predictions3d: result.predictions3d || null,
              isLoading: false,
            }),
            false,
            'startSimulation'
          )

          return updatedAnalysis
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          set({ error: errorMsg, isLoading: false }, false, 'startSimulation_error')
          console.error('Error starting simulation:', errorMsg)
          throw err
        }
      },
    }),
    { name: 'SimulationStore' }
  )
)
