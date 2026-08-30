# Visual review — PILOT-001

- `su2_residual_history.png` uses the real SU2 `Inner_Iter` axis from 0 to 470 and plots residuals reconstructed from the logged log10 values. The energy residual remains materially higher than mass and momentum at the end.
- `su2_force_coefficients.png` uses the real SU2 `CD` and `CL` history. `CL` settles near 0.111; `CD` settles near -0.169, which is visibly abnormal and remains a physical acceptance blocker.
- These figures are descriptive views of observed files, not validation certificates.

- `pinn_training_history.png` shows total loss decreasing from roughly 1.2e4 to 5.4e3 over 2000 epochs; the physics loss is extremely small relative to total loss, so this figure does not establish field accuracy.
- `pinn_cfd_relative_errors.png` shows the observed same-CFD anchored relative L2 errors: approximately 0.10995 for `u` and 0.35083 for `v`. The title explicitly labels the comparison as same-CFD anchored, not independent validation.
