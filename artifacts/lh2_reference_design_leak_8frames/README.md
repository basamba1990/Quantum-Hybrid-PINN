# LH2 reference design leak kit — RD1

This archive is a **synthetic structural and visualization dataset** classified as `REFERENCE_DESIGN` / `ENGINEERING_CONCEPT`. It resembles a horizontal cryogenic storage vessel with a cylindrical body, conceptual hemispherical closures, anti-roll baffle locations, a dip tube, a named leak-orifice region, and eight transient states.

The VTU files contain real volumetric tetrahedral connectivity and the fields `temperature` (K), `pressure` (MPa), `velocity` (m/s, 3 components), `leak_indicator` (1), `phase_fraction` (1), and `region_id` (cell integer). The fields are deterministic manufactured test data, not output from a physical CFD solver, experiment, or certified plant model.

The sidecar is the import contract and records hashes, units, named boundaries, design assumptions, references, classification and evidence. Residuals are explicitly null. The correct scientific status is `UNVALIDATED`; the kit must not be used to claim G0–G5 certification.
