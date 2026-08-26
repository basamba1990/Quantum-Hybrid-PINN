# deep_mining_block acoustic pulse RD1

This is a **synthetic, non-operational, low-amplitude acoustic benchmark** for testing volumetric CFD rendering, time animation, pressure-front transport and boundary reflection handling. It is not an explosion model, mine asset, blast design, detonation simulation or safety certification.

The archive contains eight VTU frames with shared tetrahedral connectivity and the fields `temperature` (K), `pressure` (MPa), `velocity` (m/s), `gas_concentration` (ppm), `leak_indicator` (1), `wavefront_indicator` (1), and `region_id` (cell integer).

The sidecar declares `eventType: ABSTRACT_PRESSURE_PULSE`, provenance, arrival time, peak overpressure and a surrogate reflection model. Residuals are explicitly null and the correct scientific status is `UNVALIDATED`. No explosive-charge, detonation-energy or initiation parameters are included.
