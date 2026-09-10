import { z } from 'zod'

const nonNegativeInt = z.number().int().nonnegative()
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 attendu (64 caractères hexadécimaux)')

export const pinnTrainingProfileSchema = z.object({
  profileVersion: z.string().min(1),
  classification: z.enum(['TEST_RECOMMENDATION_NOT_VALIDATION', 'VALIDATION_CANDIDATE']),
  projectStatusRequired: z.enum(['STRUCTURAL_TEST_UNVALIDATED', 'INCONCLUSIVE', 'VALIDATION_CANDIDATE']),
  solverExecution: z.enum(['NOT_RUN', 'RUNNING', 'COMPLETED']),
  dataset: z.object({ meshRevision: z.string(), frames: z.number().int().positive(), pointCount: nonNegativeInt, cellCount: nonNegativeInt, sourceHash: z.union([sha256, z.literal('')]) }),
  modelConfig: z.object({
    layers: z.array(z.number().int().positive()).min(2), inputOrder: z.array(z.string().min(1)).min(1), outputOrder: z.array(z.string().min(1)).min(1),
    activation: z.enum(['tanh', 'relu', 'gelu', 'sine']),
    normalization: z.object({ coordinates: z.string().min(1), time: z.string().min(1), outputs: z.string().min(1) }),
    epochs: z.number().int().positive().max(10_000_000), learningRate: z.number().positive().max(10), optimizer: z.enum(['Adam', 'AdamW', 'LBFGS']), batchSize: z.number().int().positive(), seed: z.number().int().nonnegative(),
  }).superRefine((value, ctx) => {
    if (value.layers[0] !== value.inputOrder.length) ctx.addIssue({ code: 'custom', path: ['layers'], message: 'La première couche doit correspondre au nombre d’entrées.' })
    if (value.layers[value.layers.length - 1] !== value.outputOrder.length) ctx.addIssue({ code: 'custom', path: ['layers'], message: 'La dernière couche doit correspondre au nombre de sorties.' })
  }),
  sampling: z.object({ N_pde: nonNegativeInt, N_boundary: nonNegativeInt, N_initial: nonNegativeInt, N_data: nonNegativeInt, strategy: z.enum(['Sobol_fixed_seed', 'Random', 'LatinHypercube']), evaluationSplit: z.string().min(1) }),
  lossWeights: z.object({ pde_mass: z.number().nonnegative(), pde_momentum: z.number().nonnegative(), pde_energy: z.number().nonnegative(), boundary: z.number().nonnegative(), initial: z.number().nonnegative(), data: z.number().nonnegative(), regularization: z.number().nonnegative() }),
  schedule: z.object({ warmupEpochs: nonNegativeInt, reduceLROnPlateau: z.object({ factor: z.number().positive().max(1), patience: nonNegativeInt, minLearningRate: z.number().positive() }), earlyStopping: z.object({ patience: nonNegativeInt, minDelta: z.number().nonnegative() }) }),
  acceptance: z.object({ reportResidualsAs: z.string(), doNotPromoteToValidated: z.boolean(), requiredArtifacts: z.array(z.string()) }),
})

export type PinnTrainingProfileInput = z.input<typeof pinnTrainingProfileSchema>
