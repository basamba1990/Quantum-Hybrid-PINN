export type ScenarioType = 
  | 'H2_PIPELINE' 
  | 'LH2_STORAGE' 
  | 'PORT_ENERGY_OPTIMIZATION' 
  | 'PIPELINE_SAFETY' 
  | 'CRYOGENIC_TRANSPORT' 
  | 'MINING_INDUSTRIAL_SIM'
  | 'H2_COMPRESSION_STATION'
  | 'FPGA_HEATSINK'
  | 'SMART_RADIATOR'
  | 'LH2_INFRASTRUCTURE_INTEGRITY'
  | 'LH2_LARGE_SCALE_STORAGE_1250M3'
  | 'HEAVY_DUTY_HYDROGEN_REFUELING'
  | 'PCCV_TRANSIENT_THERMO_V1';

export interface ScenarioConfig {
  id: ScenarioType;
  name: string;
  description: string;
  inputs: ScenarioInput[];
  outputs: ScenarioOutput[];
}

export interface ScenarioInput {
  name: string;
  label: string;
  type: 'number' | 'string' | 'select';
  unit?: string;
  defaultValue: any;
  options?: { label: string; value: any }[];
}

export interface ScenarioOutput {
  name: string;
  label: string;
  unit?: string;
}

export const INDUSTRIAL_SCENARIOS: Record<ScenarioType, ScenarioConfig> = {
  H2_PIPELINE: {
    id: 'H2_PIPELINE',
    name: 'Pipeline Gaz/Hydrogène (GTA)',
    description: 'Simulation de transport gaz/hydrogène, détection des pertes de pression et optimisation des débits.',
    inputs: [
      { name: 'length', label: 'Longueur', type: 'number', unit: 'km', defaultValue: 100 },
      { name: 'diameter', label: 'Diamètre', type: 'number', unit: 'm', defaultValue: 0.5 },
      { name: 'pressure', label: 'Pression Entrée', type: 'number', unit: 'bar', defaultValue: 80 },
      { name: 'temperature', label: 'Température', type: 'number', unit: 'K', defaultValue: 300 },
      { name: 'flowRate', label: 'Débit', type: 'number', unit: 'kg/s', defaultValue: 2 },
      { name: 'fluid', label: 'Fluide', type: 'select', defaultValue: 'H2', options: [
        { label: 'Hydrogène (H2)', value: 'H2' },
        { label: 'Gaz Naturel (CH4)', value: 'CH4' },
        { label: 'Mélange H2/CH4', value: 'H2_CH4' }
      ]}
    ],
    outputs: [
      { name: 'pressureDrop', label: 'Perte de Pression', unit: 'bar' },
      { name: 'velocity', label: 'Vitesse Fluide', unit: 'm/s' },
      { name: 'turbulence', label: 'Zone de Turbulence', unit: '%' },
      { name: 'thermalStability', label: 'Stabilité Thermique', unit: 'K' },
      { name: 'leakRisk', label: 'Risque de Fuite', unit: '%' },
      { name: 'safetyScore', label: 'Score de Sécurité', unit: '/100' }
    ]
  },
  LH2_STORAGE: {
    id: 'LH2_STORAGE',
    name: 'Stockage Hydrogène Liquide (LH2)',
    description: 'Simulation thermodynamique avancée de réservoirs cryogéniques (LH2). Calcule le taux d\'évaporation (Boil-Off Rate) via les équations de transfert thermique, la convection naturelle interne et la montée en pression isochore pour garantir l\'intégrité structurelle.',
    inputs: [
      { name: 'volume', label: 'Volume', type: 'number', unit: 'm3', defaultValue: 50 },
      { name: 'pressure', label: 'Pression Interne', type: 'number', unit: 'bar', defaultValue: 1.2 },
      { name: 'temperature', label: 'Température Cryo', type: 'number', unit: 'K', defaultValue: 20 },
      { name: 'ambientTemp', label: 'Température Ambiante', type: 'number', unit: 'K', defaultValue: 300 }
    ],
    outputs: [
      { name: 'boilOffRate', label: 'Taux d\'évaporation', unit: '%/jour' },
      { name: 'internalPressure', label: 'Pression Interne', unit: 'bar' },
      { name: 'convectionVelocity', label: 'Vitesse Convection', unit: 'm/s' },
      { name: 'stabilityScore', label: 'Score de Stabilité', unit: '/100' }
    ]
  },
  PORT_ENERGY_OPTIMIZATION: {
    id: 'PORT_ENERGY_OPTIMIZATION',
    name: 'Optimisation Énergétique Portuaire',
    description: 'Modèle d\'optimisation multi-physique pour hubs énergétiques portuaires. Analyse l\'efficacité des systèmes de refroidissement industriels, l\'empreinte carbone (tCO2/an) et optimise la demande énergétique variable via une approche de contrôle prédictif.',
    inputs: [
      { name: 'portLocation', label: 'Port', type: 'select', defaultValue: 'Dakar', options: [
        { label: 'Dakar', value: 'Dakar' },
        { label: 'Abidjan', value: 'Abidjan' },
        { label: 'Tanger Med', value: 'Tanger Med' },
        { label: 'Durban', value: 'Durban' }
      ]},
      { name: 'energyDemand', label: 'Demande Énergétique', type: 'number', unit: 'MW', defaultValue: 10 },
      { name: 'coolingLoad', label: 'Charge de Refroidissement', type: 'number', unit: 'kW', defaultValue: 500 }
    ],
    outputs: [
      { name: 'energyEfficiency', label: 'Efficacité Énergétique', unit: '%' },
      { name: 'costReduction', label: 'Réduction Coûts', unit: '%' },
      { name: 'carbonFootprint', label: 'Empreinte Carbone', unit: 'tCO2/an' },
      { name: 'hvacOptimization', label: 'Optimisation HVAC', unit: '%' }
    ]
  },
  PIPELINE_SAFETY: {
    id: 'PIPELINE_SAFETY',
    name: 'Sécurité Pipeline Pétrole/Gaz',
    description: 'Système de surveillance prédictive basé sur l\'analyse des ondes de pression transitoires. Détecte les micro-fuites et les anomalies structurelles en temps réel, calculant la probabilité de défaillance et optimisant l\'intervalle de maintenance préventive.',
    inputs: [
      { name: 'length', label: 'Longueur', type: 'number', unit: 'km', defaultValue: 200 },
      { name: 'sensorInterval', label: 'Intervalle Capteurs', type: 'number', unit: 'km', defaultValue: 5 }
    ],
    outputs: [
      { name: 'detectionTime', label: 'Temps Détection', unit: 's' },
      { name: 'predictionAccuracy', label: 'Précision Prédiction', unit: '%' },
      { name: 'riskReduction', label: 'Réduction Risques', unit: '%' },
      { name: 'operationalStability', label: 'Stabilité Opérationnelle', unit: '%' }
    ]
  },
  CRYOGENIC_TRANSPORT: {
    id: 'CRYOGENIC_TRANSPORT',
    name: 'Transport Cryogénique (GNL/LH2)',
    description: 'Simulation de transport maritime et terrestre de fluides cryogéniques. Modélise les ponts thermiques, la stratification du fluide et les pertes par évaporation (BOG) sous conditions environnementales variables pour assurer la sécurité des cargaisons GNL/LH2.',
    inputs: [
      { name: 'cargoType', label: 'Type de Cargaison', type: 'select', defaultValue: 'LH2', options: [
        { label: 'Hydrogène Liquide (LH2)', value: 'LH2' },
        { label: 'Gaz Naturel Liquéfié (GNL)', value: 'GNL' }
      ]},
      { name: 'transitTime', label: 'Temps de Transit', type: 'number', unit: 'h', defaultValue: 48 }
    ],
    outputs: [
      { name: 'thermalLoss', label: 'Pertes Thermiques', unit: 'W' },
      { name: 'evaporationLoss', label: 'Pertes Évaporation', unit: 'kg' },
      { name: 'containerSafety', label: 'Sécurité Container', unit: '/100' }
    ]
  },
  MINING_INDUSTRIAL_SIM: {
    id: 'MINING_INDUSTRIAL_SIM',
    name: 'Simulation Industrielle Minière',
    description: 'Modélisation de la dynamique des fluides (CFD) pour la ventilation souterraine et la gestion thermique des mines profondes. Analyse la dispersion des gaz toxiques, la qualité de l\'air et les contraintes géo-mécaniques pour l\'extraction sécurisée de minerais critiques.',
    inputs: [
      { name: 'mineType', label: 'Type de Mine', type: 'select', defaultValue: 'Cobalt', options: [
        { label: 'Cuivre', value: 'Cuivre' },
        { label: 'Cobalt', value: 'Cobalt' },
        { label: 'Lithium', value: 'Lithium' },
        { label: 'Uranium', value: 'Uranium' },
        { label: 'Roche générique', value: 'generique' },
        { label: 'Roche élastique (Endommagement)', value: 'generic_rock' }
      ]},
      { name: 'depth', label: 'Profondeur', type: 'number', unit: 'm', defaultValue: 500 },
      { name: 'ventilationRate', label: 'Taux Ventilation', type: 'number', unit: 'm3/s', defaultValue: 100 }
    ],
    outputs: [
      { name: 'airQuality', label: 'Qualité de l\'Air', unit: '%' },
      { name: 'thermalComfort', label: 'Confort Thermique', unit: 'K' },
      { name: 'gasSafety', label: 'Sécurité Gaz', unit: '/100' },
      { name: 'fluidCirculation', label: 'Circulation Fluides', unit: 'm3/h' }
    ]
  },
  H2_COMPRESSION_STATION: {
    id: 'H2_COMPRESSION_STATION',
    name: 'Station de Compression – H2',
    description: 'Validation thermodynamique des compresseurs H2 : efficacité isentropique, bilan thermique et puissance.',
    inputs: [
      { name: 'pressure_in', label: 'Pression Entrée', type: 'number', unit: 'bar', defaultValue: 10 },
      { name: 'pressure_out', label: 'Pression Sortie', type: 'number', unit: 'bar', defaultValue: 60 },
      { name: 'temperature_in', label: 'Température Entrée', type: 'number', unit: 'K', defaultValue: 290 },
      { name: 'temperature_out', label: 'Température Sortie', type: 'number', unit: 'K', defaultValue: 380 },
      { name: 'flowRate', label: 'Débit Massique', type: 'number', unit: 'kg/s', defaultValue: 5 },
      { name: 'power', label: 'Puissance Nominale', type: 'number', unit: 'MW', defaultValue: 2.5 },
      { name: 'efficiency', label: 'Efficacité Polytropique', type: 'number', unit: '%', defaultValue: 85 }
    ],
    outputs: [
      { name: 'compressionRatio', label: 'Rapport de Compression', unit: '' },
      { name: 'isentropicEfficiency', label: 'Efficacité Isentropique', unit: '%' },
      { name: 'powerActual', label: 'Puissance Réelle', unit: 'MW' },
      { name: 'thermalDelta', label: 'Delta T', unit: 'K' },
      { name: 'coherenceScore', label: 'Score de Cohérence', unit: '/100' },
      { name: 'status', label: 'État Système', unit: '' }
    ]
  },
  FPGA_HEATSINK: {
    id: 'FPGA_HEATSINK',
    name: 'Dissipateur Thermique (FPGA/Quantum)',
    description: 'Analyse de la dissipation thermique pour processeurs haute performance et ordinateurs quantiques. Calcule l\'efficacité du flux thermique et la distribution de température.',
    inputs: [
      { name: 'heatFlux', label: 'Flux Thermique', type: 'number', unit: 'W', defaultValue: 500 },
      { name: 'temperature', label: 'Température Ambiante', type: 'number', unit: 'K', defaultValue: 300 },
      { name: 'flowRate', label: 'Débit Refroidissement', type: 'number', unit: 'm3/s', defaultValue: 0.1 }
    ],
    outputs: [
      { name: 'maxTemperature', label: 'Température Max', unit: 'K' },
      { name: 'dissipationEfficiency', label: 'Efficacité Dissipation', unit: '%' },
      { name: 'heatFluxActual', label: 'Flux Thermique Réel', unit: 'W/m2' }
    ]
  },
  SMART_RADIATOR: {
    id: 'SMART_RADIATOR',
    name: 'Radiateur Intelligent (Cryogénie)',
    description: 'Optimisation d\'un échangeur de chaleur intelligent pour moteurs quantiques. Utilise l\'IA pour minimiser le boil-off et maximiser la stabilité thermique.',
    inputs: [
      { name: 'heatFlux', label: 'Flux Thermique Moteur', type: 'number', unit: 'W', defaultValue: 500 },
      { name: 'inletTemp', label: 'Température Entrée (LH2)', type: 'number', unit: 'K', defaultValue: 20 },
      { name: 'pressure', label: 'Pression de Circulation', type: 'number', unit: 'bar', defaultValue: 20 },
      { name: 'flowRate', label: 'Débit Massique', type: 'number', unit: 'kg/s', defaultValue: 0.5 }
    ],
    outputs: [
      { name: 'dissipationEfficiency', label: 'Efficacité Dissipation', unit: '%' },
      { name: 'boilOffRisk', label: 'Risque d\'Évaporation', unit: '%' },
      { name: 'thermalStability', label: 'Stabilité Thermique', unit: 'K' },
      { name: 'aiCorrectionFactor', label: 'Facteur Correction IA', unit: '' }
    ]
  },
  LH2_LARGE_SCALE_STORAGE_1250M3: {
    id: 'LH2_LARGE_SCALE_STORAGE_1250M3',
    name: 'Stockage LH2 grande capacité (1 250 m³)',
    description: 'Scénario de stockage cryogénique grande capacité. Les paramètres, le maillage, les champs et la validation restent pilotés par les artefacts persistés du cas.',
    inputs: [],
    outputs: []
  },
  HEAVY_DUTY_HYDROGEN_REFUELING: {
    id: 'HEAVY_DUTY_HYDROGEN_REFUELING',
    name: 'Ravitaillement hydrogène poids lourds',
    description: 'Scénario de ravitaillement rapide pour véhicules lourds conforme au contrat de cas SAE J2601-2 / PRHYDE lorsque les artefacts correspondants sont persistés.',
    inputs: [],
    outputs: []
  },
  LH2_INFRASTRUCTURE_INTEGRITY: {
    id: 'LH2_INFRASTRUCTURE_INTEGRITY',
    name: 'Intégrité Infrastructures LH2 (Kelly Senecal)',
    description: 'Modélisation PINN avancée des discontinuités de fuite cryogénique (20.28K, 1.2 MPa), gradients thermiques et contraintes de von Mises avec validation des résidus Navier-Stokes.',
    inputs: [
      { name: 'operating_pressure', label: 'Pression de Service', type: 'number', unit: 'MPa', defaultValue: 1.2 },
      { name: 'storage_temp', label: 'Température Stockage', type: 'number', unit: 'K', defaultValue: 20.28 },
      { name: 'leak_diameter', label: 'Diamètre Discontinuité de Fuite', type: 'number', unit: 'mm', defaultValue: 5.0 },
      { name: 'ambient_temp', label: 'Température Ambiante', type: 'number', unit: 'K', defaultValue: 293.15 }
    ],
    outputs: [
      { name: 'credibilityScore', label: 'Score de Crédibilité PINN', unit: '%' },
      { name: 'massResidual', label: 'Résidu Masse', unit: '' },
      { name: 'momentumResidual', label: 'Résidu Momentum', unit: '' },
      { name: 'energyResidual', label: 'Résidu Énergie', unit: '' },
      { name: 'maxStress', label: 'Contrainte Von Mises Max', unit: 'MPa' },
      { name: 'reynoldsNumber', label: 'Nombre de Reynolds', unit: '' }
    ]
  },
  PCCV_TRANSIENT_THERMO_V1: {
    id: 'PCCV_TRANSIENT_THERMO_V1',
    name: 'Vanne cinq voies — écoulement transitoire',
    description: 'Contrat thermo-hydraulique à géométrie mobile. Exécution bloquée tant qu’un maillage et un oracle CFD vérifiables ne sont pas enregistrés.',
    inputs: [
      { name: 'geometry_uri', label: 'URI géométrie CAO', type: 'string', defaultValue: '' },
      { name: 'geometry_checksum_sha256', label: 'Checksum géométrie SHA-256', type: 'string', defaultValue: '' },
      { name: 'initial_angle_deg', label: 'Angle initial', type: 'number', unit: 'deg', defaultValue: 0 },
      { name: 'final_angle_deg', label: 'Angle final', type: 'number', unit: 'deg', defaultValue: 90 },
      { name: 'angular_speed_deg_s', label: 'Vitesse angulaire', type: 'number', unit: 'deg/s', defaultValue: 30 },
      { name: 'duration_s', label: 'Durée', type: 'number', unit: 's', defaultValue: 3 }
    ],
    outputs: [
      { name: 'port_mass_flow', label: 'Débit massique par port', unit: 'kg/s' },
      { name: 'pressure_loss', label: 'Perte de pression', unit: 'Pa' },
      { name: 'mixed_temperature', label: 'Température de mélange', unit: 'K' },
      { name: 'hydraulic_torque', label: 'Couple hydraulique', unit: 'N·m' }
    ]
  }
};

export const SCENARIO_ALIASES: Record<string, ScenarioType> = {
  PIPELINE: 'H2_PIPELINE',
  H2_PIPELINE: 'H2_PIPELINE',
  'H2 PIPELINE': 'H2_PIPELINE',
  H2_DISTRIBUTION_HIGH_PRESSURE: 'H2_PIPELINE',
  'HIGH-PRESSURE H2': 'H2_PIPELINE',
  'HIGH PRESSURE H2': 'H2_PIPELINE',
  PIPELINE_SAFETY: 'PIPELINE_SAFETY',
  CRYOGENIC_TRANSPORT: 'CRYOGENIC_TRANSPORT',
  LH2_STORAGE: 'LH2_STORAGE',
  LH2_INFRASTRUCTURE_INTEGRITY: 'LH2_INFRASTRUCTURE_INTEGRITY',
  LH2_LARGE_SCALE_STORAGE_1250M3: 'LH2_LARGE_SCALE_STORAGE_1250M3',
  'LH2 LARGE SCALE STORAGE 1250M3': 'LH2_LARGE_SCALE_STORAGE_1250M3',
  HEAVY_DUTY_HYDROGEN_REFUELING: 'HEAVY_DUTY_HYDROGEN_REFUELING',
  'HEAVY DUTY HYDROGEN REFUELING': 'HEAVY_DUTY_HYDROGEN_REFUELING',
  'INTÉGRITÉ INFRASTRUCTURES LH2 (KELLY SENECAL)': 'LH2_INFRASTRUCTURE_INTEGRITY',
  'INTEGRITE INFRASTRUCTURES LH2 (KELLY SENECAL)': 'LH2_INFRASTRUCTURE_INTEGRITY',
  MINING_INDUSTRIAL_SIM: 'MINING_INDUSTRIAL_SIM',
  H2_COMPRESSION_STATION: 'H2_COMPRESSION_STATION',
  FPGA_HEATSINK: 'FPGA_HEATSINK',
  SMART_RADIATOR: 'SMART_RADIATOR',
  PORT_ENERGY_OPTIMIZATION: 'PORT_ENERGY_OPTIMIZATION',
  PCCV_TRANSIENT_THERMO_V1: 'PCCV_TRANSIENT_THERMO_V1',
  PCCV: 'PCCV_TRANSIENT_THERMO_V1',
};

export function normalizeScenarioType(value?: string | null): ScenarioType | null {
  if (!value) return null;
  const key = value.trim().toUpperCase().replace(/[–—]/g, '-');
  const direct = SCENARIO_ALIASES[key];
  if (direct) return direct;
  if (key.includes('LH2') && (key.includes('INTEGR') || key.includes('INFRA'))) return 'LH2_INFRASTRUCTURE_INTEGRITY';
  if (key.includes('HIGH-PRESSURE H2') || key.includes('HIGH PRESSURE H2')) return 'H2_PIPELINE';
  if (key.includes('PIPELINE')) return 'H2_PIPELINE';
  return null;
}

export function inferScenarioTypeFromProject(project: { name?: string | null; category?: string | null; scenario_type?: string | null }): ScenarioType | null {
  return normalizeScenarioType(project.scenario_type) || normalizeScenarioType(project.category) || normalizeScenarioType(project.name);
}

export function getScenarioDisplayName(value?: string | null): string {
  const normalized = normalizeScenarioType(value);
  return normalized ? INDUSTRIAL_SCENARIOS[normalized].name : (value?.trim() || 'Projet scientifique');
}
