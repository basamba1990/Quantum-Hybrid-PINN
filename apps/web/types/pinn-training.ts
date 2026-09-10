export type PinnClassification = 'TEST_RECOMMENDATION_NOT_VALIDATION' | 'VALIDATION_CANDIDATE'
export type PinnProjectStatus = 'STRUCTURAL_TEST_UNVALIDATED' | 'INCONCLUSIVE' | 'VALIDATION_CANDIDATE'
export type PinnSolverExecution = 'NOT_RUN' | 'RUNNING' | 'COMPLETED'

export type PinnTrainingProfile = {
  profileVersion: string
  classification: PinnClassification
  projectStatusRequired: PinnProjectStatus
  solverExecution: PinnSolverExecution
  dataset: {
    meshRevision: string
    frames: number
    pointCount: number
    cellCount: number
    sourceHash: string
  }
  modelConfig: {
    layers: number[]
    inputOrder: string[]
    outputOrder: string[]
    activation: 'tanh' | 'relu' | 'gelu' | 'sine'
    normalization: { coordinates: string; time: string; outputs: string }
    epochs: number
    learningRate: number
    optimizer: 'Adam' | 'AdamW' | 'LBFGS'
    batchSize: number
    seed: number
  }
  sampling: {
    N_pde: number
    N_boundary: number
    N_initial: number
    N_data: number
    strategy: 'Sobol_fixed_seed' | 'Random' | 'LatinHypercube'
    evaluationSplit: string
  }
  lossWeights: {
    pde_mass: number
    pde_momentum: number
    pde_energy: number
    boundary: number
    initial: number
    data: number
    regularization: number
  }
  schedule: {
    warmupEpochs: number
    reduceLROnPlateau: { factor: number; patience: number; minLearningRate: number }
    earlyStopping: { patience: number; minDelta: number }
  }
  acceptance: {
    reportResidualsAs: string
    doNotPromoteToValidated: boolean
    requiredArtifacts: string[]
  }
}

export const defaultPinnProfile: PinnTrainingProfile = {
  profileVersion: 'pinn-training-profile.v1',
  classification: 'TEST_RECOMMENDATION_NOT_VALIDATION',
  projectStatusRequired: 'STRUCTURAL_TEST_UNVALIDATED',
  solverExecution: 'NOT_RUN',
  dataset: { meshRevision: '', frames: 1, pointCount: 0, cellCount: 0, sourceHash: '' },
  modelConfig: {
    layers: [4, 64, 64, 64, 64, 5], inputOrder: ['t', 'x', 'y', 'z'],
    outputOrder: ['pressure', 'u', 'v', 'w', 'temperature'], activation: 'tanh',
    normalization: { coordinates: 'map_each_dimension_to[-1,1]', time: 'map_to[-1,1]', outputs: 'standardize_from_training_split_only' },
    epochs: 5000, learningRate: 0.001, optimizer: 'Adam', batchSize: 256, seed: 20260909,
  },
  sampling: { N_pde: 5000, N_boundary: 512, N_initial: 256, N_data: 256, strategy: 'Sobol_fixed_seed', evaluationSplit: 'independent_20_percent_hidden_from_training' },
  lossWeights: { pde_mass: 1, pde_momentum: 1, pde_energy: 0.5, boundary: 10, initial: 5, data: 1, regularization: 0.000001 },
  schedule: { warmupEpochs: 500, reduceLROnPlateau: { factor: 0.5, patience: 250, minLearningRate: 0.000001 }, earlyStopping: { patience: 750, minDelta: 0.000001 } },
  acceptance: { reportResidualsAs: 'N/D until computed by a physical solver or explicitly defined PINN residual evaluator', doNotPromoteToValidated: true, requiredArtifacts: ['config.json', 'seed.json', 'training_log.jsonl', 'model_hash', 'independent_evaluation.json', 'reproduction_2_report.json'] },
}

export function canonicalizePinnProfile(profile: PinnTrainingProfile): string {
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }
  return stable(profile)
}

export async function hashPinnProfile(profile: PinnTrainingProfile): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizePinnProfile(profile))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function safeValidationStatus(profile: Pick<PinnTrainingProfile, 'projectStatusRequired' | 'acceptance'>): PinnProjectStatus {
  return profile.acceptance.doNotPromoteToValidated && profile.projectStatusRequired === 'VALIDATION_CANDIDATE'
    ? 'VALIDATION_CANDIDATE'
    : profile.projectStatusRequired
}
