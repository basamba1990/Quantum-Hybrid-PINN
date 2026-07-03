# Diagnostic Report - Quantum-Hybrid-PINN

## Errors Identified

### 1. TypeScript Build Error (Vercel) - BLOCKING
**File**: `apps/web/app/dashboard/projects/[id]/ProjectDetailClient.tsx:217:40`
**Error**: `Parameter 'p' implicitly has an 'any' type.`
**Cause**: The `predictions3d` array comes from `results.predictions3d` which is typed as `any` via the `latestAnalysis` state (`useState<any>(null)`). The `.map()` callback parameter `p` has no explicit type.
**Fix**: Add explicit type annotations to the state and the map callback.

### 2. Tensor Dimension Error (Backend) - BLOCKING
**File**: `apps/api/main.py` - lines 638-644, 518-521
**Error**: `⚠️ Erreur calcul scenario_outputs (domaine physique): Tensors must have same number of dimensions: got 2 and 1`
**Cause**: The `DeepKalmanFilter.assimilate_batch()` method returns a tensor of shape `(batch, state_dim)` (2D). When calling `.flatten()` on it, the result becomes a 1D tensor. However, the error message says "got 2 and 1", which suggests the issue is elsewhere - likely in the `scenario_outputs` calculation where tensor operations mix 1D and 2D tensors.

Looking at the code flow:
- Line 581: `scenario_outputs = engine_func(request.scenario_inputs)` - this calls a pure Python function that returns a dict, NOT tensors
- The error "Tensors must have same number of dimensions" likely comes from the `compute_residuals` call or from torch operations in the validate-3d endpoint

Actually, re-reading the logs more carefully:
```
⚠️ Erreur calcul scenario_outputs (domaine physique): Tensors must have same number of dimensions: got 2 and 1
```

This happens in the `try/except` block around the spatial scan in the `validate-3d` endpoint (lines 350-376). The issue is that `torch.sqrt(u_scan**2 + v_scan**2 + w_scan**2)` produces a 2D tensor (shape [10,1]), and then `.mean().item()` works fine. But the error "got 2 and 1" suggests a broadcasting issue somewhere in the compute_residuals call at line 323-325.

The real issue: In `pinn_3d_navier_stokes.py`, the `compute_residuals` method clones and requires_grad on the outputs at lines 71-75. These are 2D tensors (shape [N_points, 1]). The _safe_grad method then computes gradients, and somewhere the dimensions mismatch between 2D and 1D results.

### 3. Supabase Schema Error (Reports table) - BLOCKING
**File**: `apps/api/main.py` - lines 811-816
**Error**: `Could not find the 'type' column of 'reports' in the schema cache`
**Cause**: The code inserts `type: "PDF"` into the reports table, but the schema (defined in `init.sql`) only has columns: `id, project_id, name, file_url, created_at, updated_at`. There is no `type` column.
**Fix**: Remove the `type` field from the insert operation. Alternatively, add a migration to add the column.

### 4. Scores de Crédibilité Bas - ANALYSIS NEEDED
**Observation**: Scores show 53.5/100 and 53.8/100 in the UI.
**Cause Analysis**:
- The Edge Function (`verify-physics-logic`) calculates credibility using:
  - Van't Hoff thermodynamic check (25pt penalty for >40% deviation)
  - Kalman correction quality (pressureQuality * 0.35)
  - Residual quality (residualQuality * 0.65)
  - Anomaly penalty (8 points per anomaly)
- The backend hybrid simulation calculates:
  - Score from PINN residuals via logarithmic formula
  - Combines with scenario_outputs.coherenceScore (60/40 weight)
  - Clamped between 5 and 100

The low scores are caused by:
1. The residual-based scoring is very sensitive - a residual of 1e-2 already gives ~75%, 1e-1 gives ~50%
2. The Kalman assimilation may be producing large corrections (pressureQuality penalized)
3. The Edge Function and Backend may be writing different scores to different tables
4. The `analyses` table in the current production schema (from `init.sql`) does NOT have a `credibility_score` column, so the Edge Function writes to `physics_validations` but the UI reads from `analyses.credibility_score`

### 5. Edge Function Integration Issues
**File**: `apps/web/app/dashboard/assistant/page.tsx`
- Line 141: Uses `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the user's actual session token
- Line 158: Parses `result.data` but the Edge Function returns top-level JSON fields directly

### 6. Schema Drift
The `analyses` table has `credibility_score` in the `001_init_schema.sql` but NOT in `init.sql`. This means if the production database was created from `init.sql`, the column doesn't exist.
