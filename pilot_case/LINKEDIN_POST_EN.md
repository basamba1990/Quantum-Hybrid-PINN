# LinkedIn post — PILOT-001

**Evidence-grade CFD/PINN-T validation starts with stating exactly what has been demonstrated.**

For PILOT-001, we built a public NACA 0012 demonstrator around a traceable evidence chain. The full English report and the four evidence figures are available in the repository under `pilot_case/`:

- [English evidence-grade report](PILOT-001_FINAL_REPORT_EN.md)
- [SU2 residual history](visualizations/su2_residual_history.png)
- [SU2 force coefficients](visualizations/su2_force_coefficients.png)
- [PINN training history](visualizations/pinn_training_history.png)
- [Same-CFD anchored relative errors](visualizations/pinn_cfd_relative_errors.png)

- a public source archive with recorded provenance and SHA-256 integrity;
- a deterministic analytic mesh with structural diagnostics;
- an independent SU2 CFD run with versioned configuration and captured logs;
- a TorchScript PINN baseline with a declared input/output contract;
- a direct, hashable comparison on 4,224 aligned points;
- a condition-held-out split: training on `AoA 5°`, evaluation on `AoA 17°`;
- explicit status gates instead of an opaque credibility score.

The SU2 run reached its declared numerical convergence criterion. The PINN checkpoint and the direct comparison were reproduced with the same source, seed, contract and environment; the two comparison outputs have the same SHA-256 digest.

But this is where evidence discipline matters: the first PINN baseline was anchored on the same CFD field used for comparison. It is **not** an independent generalization result. The CFD output also requires additional physical diagnostics before it can be accepted as a trustworthy aerodynamic reference.

The condition-held-out split is ready, but the held-out PINN training/evaluation experiment has not yet been completed. Therefore, the current decision is:

```text
INCONCLUSIVE
```

The next experiment is precise: train only on the `AoA 5°` condition, evaluate only on the held-out `AoA 17°` condition, freeze the acceptance criteria beforehand, reproduce the run in a clean environment, and publish only the resulting metrics and hashes.

The objective is not to claim general superiority, automatic certification, 3-D validation, or hydrogen-reservoir validation. The recorded mesh is explicitly 2-D; no verified 3-D geometry or 3-D CFD run exists for this pilot. It is to make every claim traceable to an artifact, a version, a calculation and a decision.

#CFD #PINN #ScientificComputing #Reproducibility #AIEngineering #ModelValidation #AIgovernance

## References

[1]: https://data.nlr.gov/submissions/311 "NLR Data Catalog — NACA 0012 and NACA 0021 dataset"
[2]: https://su2code.github.io/docs/Installation/ "SU2 official installation documentation"
[3]: https://su2code.github.io/docs/Quick-Start/ "SU2 official quick-start documentation"
