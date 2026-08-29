# Evidence-Grade Readiness Audit — Quantum Hybrid PINN

## Executive conclusion

Quantum Hybrid PINN currently contains useful validation components: CFD import authentication, topology checks, G0–G5 gate services, contract tests, and a deterministic SHA-256 provenance pack for a public NACA 0012 archive. It does not yet contain a complete evidence-grade PINN validation run.

The current NACA 0012 pack proves the provenance and integrity of a public source artifact. It does not prove PINN accuracy, solver agreement, physical residual quality, industrial validation, or certification.

## Verified evidence

| Item | Verified status |
|---|---|
| Public source | NLR Data Catalog NACA 0012 dataset, DOI `10.7799/3014033` |
| Local artifact | `NACA0012.zip`, 15,657,902 bytes |
| SHA-256 | `0e1a5456ace00e1df4ebfdabce2a59beb6f87d09a77023c7fe5a02c43d7a95d4` |
| Hash tests | 4/4 passed |
| Manifest status | `PUBLIC_BENCHMARK_PROVENANCE_ONLY` |
| Metrics | `UNAVAILABLE` |
| Decision | `INCONCLUSIVE` |

## Blocking gaps

The production path `/v2/validate-3d` performs PINN inference and explicitly marks residual evidence as unavailable because it does not execute a solver. It is therefore not a CFD/PINN validation endpoint. It also samples a generic model domain rather than a documented NACA 0012 mesh and boundary-condition contract.

The frontend credibility scorer contains fallback values and global thresholds for PVT coherence, CFD stability and residual quality. These values may be used only as exploratory indicators. They must not determine G0–G5 or produce a validation claim.

The Edge Function also contains fallback logic for missing thermodynamic parameters, missing states, assimilation failures and report residuals. These paths must return `UNAVAILABLE` and a blocked gate rather than a default physical value.

The repository does not currently contain a trained NACA 0012 PINN checkpoint, a complete NACA geometry/mesh-to-model adapter, a solver configuration, a pinned runtime image, or a second-run reproduction record. A real PINN proof cannot be claimed until those artefacts exist.

## Required completion sequence

1. Freeze the exact NACA 0012 case, source revision, license conditions, units, geometry, mesh and boundary conditions.
2. Produce or import an independent solver reference and preserve its configuration and logs.
3. Define metrics and tolerances before the PINN run.
4. Implement a NACA-specific model input contract; reject generic pipeline defaults.
5. Run the actual model with a persisted seed, configuration, code commit and environment digest.
6. Compute residuals from the model and the explicitly versioned equations.
7. Persist predictions, residuals, logs, metrics and hashes.
8. Reproduce the run in a clean environment.
9. Evaluate G0–G5 and publish only `PASS`, `FAIL` or `INCONCLUSIVE` with the evidence graph.

## Permitted public claim at the current stage

> We have verified the provenance and SHA-256 integrity of a public NACA 0012 CFD archive. PINN execution, quantitative comparison and G0–G5 validation remain pending. The platform is designed to expose demonstrated evidence, blocked gates and missing information instead of turning a score into a certification.

## References

[1]: https://data.nlr.gov/submissions/311 "NLR Data Catalog — High-Fidelity Simulation Aerodynamics Dataset of NACA 0012 and 0021 Airfoils"

[2]: https://github.com/Extrality/AirfRANS "AirfRANS official repository"

[3]: https://airfrans.readthedocs.io/en/latest/notes/introduction.html "AirfRANS documentation and license information"
