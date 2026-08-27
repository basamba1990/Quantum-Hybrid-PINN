# deep_mining_block acoustic pulse RD1

This is a **synthetic, non-operational, low-amplitude public-overpressure benchmark** for testing volumetric CFD rendering, time animation, pressure-front transport and boundary reflection handling. It is not an explosion model, mine asset, blast design, detonation simulation or safety certification. The cited public document provides context only; no measured pressure trace is copied into this kit.

The archive contains eight VTU frames with shared tetrahedral connectivity and the fields `temperature` (K), `pressure` (MPa), `velocity` (m/s), `gas_concentration` (ppm), `leak_indicator` (1), `wavefront_indicator` (1), and `region_id` (cell integer).

The sidecar declares `eventType: PUBLIC_OVERPRESSURE_BENCHMARK`, provenance, arrival time, a bounded synthetic reference overpressure and a surrogate reflection model. Residuals are explicitly null and the correct scientific status is `UNVALIDATED`. No explosive-charge, detonation-energy or initiation parameters are included.
