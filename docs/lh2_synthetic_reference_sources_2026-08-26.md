# LH2 synthetic reference sources

## NIST Chemistry WebBook, SRD 69

URL: https://webbook.nist.gov/chemistry/fluid/

NIST states that its Thermophysical Properties of Fluid Systems provides accurate properties for several fluids, including hydrogen, parahydrogen and orthohydrogen. The selectable properties include density, specific volume, enthalpy, internal energy, heat capacities, entropy, speed of sound, viscosity, thermal conductivity, Joule–Thomson coefficient and saturation-curve surface tension. The site explicitly supports SI choices including K, MPa, kg/m³, m/s and Pa·s. These data are suitable as a property-source reference for a synthetic LH2 case, but a case-specific solver run must still document the exact equation of state, state convention and interpolation range.

## NASA/TM–2006–214346

URL: https://ntrs.nasa.gov/api/citations/20060056194/downloads/20060056194.pdf

NASA’s review is titled “Review of Current State of the Art and Key Design Issues With Potential Solutions for Liquid Hydrogen Cryogenic Storage Tank Structures for Aircraft Applications.” It is a design-review reference on LH2 tank geometry, thermal management, insulation, penetrations, structural materials and associated design issues. It is not a design drawing or an authorization to represent any real installation. It can support the conceptual choices of a double-wall vessel, an insulation/vacuum annulus, access penetrations, internal plumbing and thermal-leakage variables.

## NFPA 2 scope reference

URL: https://h2tools.org/fuel-cell-codes-and-standards/nfpa-2-hydrogen-technologies-code

The search result identifies NFPA 2 as a safety-code reference covering hydrogen generation, installation, storage, piping, use and handling, including cryogenic liquid forms. The H2Tools page was protected by an anti-bot screen during retrieval, so no detailed normative text was copied. NFPA 2 should be treated as a safety and compliance reference for requirements review, not as a source for inventing geometry, operating limits or validation evidence.

## Design classification for the requested kit

The kit will be explicitly labelled `REFERENCE_DESIGN` or `ENGINEERING_CONCEPT`, with `synthetic=true`, `real_asset=false`, `solver_produced=false` unless an identified solver actually produces the fields, and `validation_status=UNVALIDATED`. Any generated transient fields will be marked as manufactured test data, not as experimental or industrial CFD evidence.

## Verification, validation and digital-twin references

ASME describes V&V 20 as a standard for verification and validation in computational fluid dynamics and heat transfer, with accuracy quantified for a specified variable at a specified validation point: https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-fluid-dynamics-and-heat-transfer

NASA’s CFD validation tutorial states that verification and validation examine errors in the code and in simulation results and that credibility is obtained by demonstrating acceptable levels: https://www.grc.nasa.gov/www/wind/valid/tutorial/overview.html

ISO 23247-1 provides an overview and general principles for a digital-twin framework for manufacturing, including terms, definitions and requirements: https://www.iso.org/standard/75066.html

NIST published an analysis of the ISO 23247 series and identifies it as a generic framework for manufacturing digital twins: https://www.nist.gov/publications/analysis-new-iso-23247-series-standards-digital-twin-framework-manufacturing

These references support a differentiated product strategy based on traceability, uncertainty, provenance, reproducible evidence and digital-twin lifecycle management. They do not justify claiming that the platform is certified or impossible to copy.
