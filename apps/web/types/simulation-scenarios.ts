export type ScenarioType = 
  | 'H2_PIPELINE' 
  | 'LH2_STORAGE' 
  | 'PORT_ENERGY_OPTIMIZATION' 
  | 'PIPELINE_SAFETY' 
  | 'CRYOGENIC_TRANSPORT' 
  | 'MINING_INDUSTRIAL_SIM'
  | 'H2_COMPRESSION_STATION';

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
  }
};
