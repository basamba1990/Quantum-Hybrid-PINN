export type ValidationStatus = 'DRAFT' | 'READY_FOR_RUN' | 'RUNNING' | 'VALIDATION_FAILED' | 'VALIDATED' | 'PUBLISHED'

export const LH2_SCENARIO_CONFIG = {
  scenario_type: 'LH2_INFRASTRUCTURE_INTEGRITY',
  title: 'Intégrité des infrastructures hydrogène liquide',
  description: 'Cadre de validation pour une discontinuité ou une fuite cryogénique. Les propriétés de transport doivent être évaluées à la pression et à la température du cas avec une équation d’état validée.',
  geometry: {
    shape: 'PARAMETRIC_LH2_INFRASTRUCTURE',
    dimensions_m: {
      length: null as number | null,
      width: null as number | null,
      height: null as number | null,
      radius: null as number | null,
      leak_diameter: null as number | null,
    },
    coordinate_system: 'Cartesian X/Y/Z, SI',
  },
  operating_conditions: {
    fluid: 'parahydrogen / normal hydrogen — à préciser',
    pressure_pa: null as number | null,
    temperature_k: 20.28,
    ambient_temperature_k: 293.15,
    phase: 'LIQUID_OR_TWO_PHASE_TO_BE_VALIDATED',
  },
  parameters: [
    {
      name: 'Boiling-point reference temperature',
      value: 20.28,
      unit_si: 'K',
      status: 'REFERENCE_BASELINE',
      source: 'NASA Parahydrogen Thermophysical Properties Database v05 (2024)',
      source_url: 'https://ntrs.nasa.gov/citations/20230017102',
      applicability: 'Saturation reference near 1 atm; not a substitute for a state calculation at the project pressure.',
    },
    {
      name: 'Liquid density at saturation reference',
      value: 70.85,
      unit_si: 'kg/m^3',
      status: 'REFERENCE_BASELINE',
      source: 'NIST/REFPROP family of hydrogen property models; verify with the selected hydrogen isomer and state point.',
      source_url: 'https://www.nist.gov/programs-projects/reference-fluid-thermodynamic-and-transport-properties-database-refprop',
      applicability: 'Approximate engineering reference around the normal boiling point; do not use for certification without a state-point query.',
    },
    {
      name: 'Dynamic viscosity',
      value: null,
      unit_si: 'Pa.s',
      status: 'REQUIRES_STATE_POINT_QUERY',
      source: 'NIST REFPROP or an equivalently validated hydrogen transport model',
      source_url: 'https://www.nist.gov/programs-projects/reference-fluid-thermodynamic-and-transport-properties-database-refprop',
      applicability: 'Must be evaluated for the selected pressure, temperature and hydrogen isomer.',
    },
    {
      name: 'Thermal conductivity',
      value: null,
      unit_si: 'W/(m.K)',
      status: 'REQUIRES_STATE_POINT_QUERY',
      source: 'NIST REFPROP or an equivalently validated hydrogen transport model',
      source_url: 'https://www.nist.gov/programs-projects/reference-fluid-thermodynamic-and-transport-properties-database-refprop',
      applicability: 'Must not be filled with a generic constant; it is state dependent near the critical region.',
    },
    {
      name: 'Leak discontinuity diameter',
      value: null,
      unit_si: 'm',
      status: 'REQUIRED_PROJECT_INPUT',
      source: 'Project inspection data, CAD, experiment or a cited engineering specification',
      source_url: null,
      applicability: 'Required before a leak-rate or jet calculation can be considered physical.',
    },
  ],
  validation: {
    status: 'DRAFT' as ValidationStatus,
    blocking_issues: [
      'La pression de fonctionnement et le type d’hydrogène doivent être fournis.',
      'La géométrie de l’infrastructure et la taille de la discontinuité doivent être documentées.',
      'La viscosité et la conductivité doivent être calculées au point d’état choisi.',
      'Aucun résidu PINN réel n’est accepté comme valeur par défaut.',
    ],
  },
} as const

export const LH2_SOURCES = [
  {
    label: 'NIST REFPROP — modèles thermophysiques de référence',
    url: 'https://www.nist.gov/programs-projects/reference-fluid-thermodynamic-and-transport-properties-database-refprop',
  },
  {
    label: 'NASA — Parahydrogen Properties Database v05',
    url: 'https://ntrs.nasa.gov/citations/20230017102',
  },
  {
    label: 'NIST WebBook — propriétés thermophysiques des fluides',
    url: 'https://webbook.nist.gov/chemistry/fluid/',
  },
]

export default LH2_SCENARIO_CONFIG

// Les valeurs nulles sont intentionnelles : elles empêchent l’interface de
// présenter une propriété non calculée comme une donnée scientifique réelle.
// Toute configuration complète doit être produite par une requête d’état
// documentée ou par les données expérimentales du projet.
