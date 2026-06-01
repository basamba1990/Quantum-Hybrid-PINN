export type ScenarioType = 
  | 'H2_PIPELINE' 
  | 'LH2_STORAGE' 
  | 'PORT_ENERGY_OPTIMIZATION' 
  | 'PIPELINE_SAFETY' 
  | 'CRYOGENIC_TRANSPORT' 
  | 'MINING_INDUSTRIAL_SIM';

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
    description: 'Simulation de réservoir LH2, stabilité thermique et évaporation.',
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
    description: 'Optimisation de la consommation énergétique, refroidissement industriel et logistique.',
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
    description: 'Détection d\'anomalies de pression, prédiction de fuites et de ruptures.',
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
    description: 'Simulation des pertes thermiques et de la sécurité pendant le transport.',
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
    description: 'Ventilation, transfert thermique et sécurité gaz dans les mines (Cuivre, Cobalt, Lithium).',
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
  }
};
