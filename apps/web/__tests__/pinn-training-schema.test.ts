import { describe, expect, it } from 'vitest'
import { defaultPinnProfile } from '@/types/pinn-training'
import { pinnTrainingProfileSchema } from '@/lib/pinn-training-schema'

describe('PINN training contract', () => {
  it('accepts the supplied synthetic test preset', () => {
    expect(pinnTrainingProfileSchema.safeParse(defaultPinnProfile).success).toBe(true)
  })
  it('rejects a negative seed', () => {
    const result = pinnTrainingProfileSchema.safeParse({ ...defaultPinnProfile, modelConfig: { ...defaultPinnProfile.modelConfig, seed: -1 } })
    expect(result.success).toBe(false)
  })
  it('rejects incoherent input/output architecture', () => {
    const result = pinnTrainingProfileSchema.safeParse({ ...defaultPinnProfile, modelConfig: { ...defaultPinnProfile.modelConfig, layers: [3, 64, 5] } })
    expect(result.success).toBe(false)
  })
  it('rejects malformed dataset hashes', () => {
    const result = pinnTrainingProfileSchema.safeParse({ ...defaultPinnProfile, dataset: { ...defaultPinnProfile.dataset, sourceHash: 'not-a-hash' } })
    expect(result.success).toBe(false)
  })
})
