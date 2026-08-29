# Evidence-grade implementation prompt

You are working on the repository `basamba1990/Quantum-Hybrid-PINN`.

Your objective is to make the evidence-grade layer operational for one public, non-critical CFD benchmark: NACA 0012, PILOT-001.

## Non-negotiable rules

- Do not use, request, print or commit passwords, API keys, access tokens or private keys.
- Do not invent a partner approval, solver result, PINN result, residual, metric, hash, tolerance or certification status.
- Do not use random values, fixed scores, generic defaults or synthetic fields in a production evidence path.
- Any missing evidence must be represented as `UNAVAILABLE`, `PENDING` or `INCONCLUSIVE` and must block the affected gate.
- Never report `PASS` or `VALIDATED` unless the manifest, hashes, model run, residuals, independent comparison and G0–G5 gates prove it.
- Keep raw benchmark files outside Git unless the license explicitly permits redistribution.

## Required workflow

1. Inspect the repository and identify the real model checkpoint, model input contract, NACA 0012 geometry/mesh adapter, solver reference path and current gate service.
2. Stop and report a blocker if a trained checkpoint, compatible NACA 0012 input contract or independent reference is missing. Do not replace it with a fabricated or generic model.
3. Verify the NLR NACA 0012 source record, DOI, version, retrieval date and license conditions. Preserve the local archive SHA-256.
4. Validate `pilot_case/MANIFEST.json` with `pilot_case/verify_artifact_hashes.py`.
5. Replace frontend credibility scoring as an authority with an evidence-gate result. Exploratory scores may remain labelled non-authoritative only if all missing evidence is visible.
6. Remove physical defaults and fallback residuals from the Edge Function and reporting path. Failure of assimilation or missing thermodynamic data must produce `UNAVAILABLE`.
7. Define a versioned NACA 0012 protocol with units, mesh, boundary conditions, solver configuration, independent reference, metrics and tolerances fixed before execution.
8. Run the actual PINN only when the model and inputs are present. Persist code commit, environment digest, dependency lock, seed, configuration, logs, predictions, residuals and output hashes.
9. Execute a second run in a clean environment. Compare hashes or declared numerical tolerances and record both decisions.
10. Update the manifest only with observed values. Produce a failure-first report and classify the outcome as `PASS`, `FAIL` or `INCONCLUSIVE`.

## Required deliverables

- Source record and licence review status.
- Versioned `PILOT-001` manifest.
- Deterministic SHA-256 recorder/verifier and tests.
- Evidence graph linking source, inputs, model, run, residuals, comparison and gates.
- Reproducibility capsule with no secrets.
- English audit report and LinkedIn post that mention only completed evidence.
- Exact list of unresolved blockers.

## Verification commands

```bash
python3 pilot_case/verify_artifact_hashes.py verify pilot_case/MANIFEST.json --allow-template
PYTHONPATH=pilot_case python3 -m pytest -q pilot_case/test_verify_artifact_hashes.py
```

At the end, report changed files, tests run, exact observed results, remaining blockers and the precise public claim that is justified. Do not use marketing language to hide an `INCONCLUSIVE` result.
