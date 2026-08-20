/**
 * Metrics Utilities - Dynamic Labels for Industrial Physics
 * Maps physical variables to their SI units and display formats
 */

export interface MetricConfig {
  label: string;
  unit: string;
  format: (value: number) => string;
  min: number;
  max: number;
  description: string;
}

export const METRICS_CONFIG: Record<string, MetricConfig> = {
  temperature: {
    label: 'Température',
    unit: 'K',
    format: (v) => `${v.toFixed(2)} K`,
    min: 273.15,
    max: 500,
    description: 'Température absolue (Kelvin)'
  },
  pressure: {
    label: 'Pression',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 300,
    description: 'Pression (Mégapascals)'
  },
  stress: {
    label: 'Contrainte',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 200,
    description: 'Contrainte mécanique'
  },
  von_mises: {
    label: 'Contrainte Von Mises',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 250,
    description: 'Contrainte équivalente de Von Mises'
  },
  sigma_1: {
    label: 'Contrainte Principale 1',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 300,
    description: 'Contrainte principale majeure'
  },
  sigma_2: {
    label: 'Contrainte Principale 2',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 300,
    description: 'Contrainte principale intermédiaire'
  },
  sigma_3: {
    label: 'Contrainte Principale 3',
    unit: 'MPa',
    format: (v) => `${(v / 1e6).toFixed(2)} MPa`,
    min: 0,
    max: 300,
    description: 'Contrainte principale mineure'
  },
  damage: {
    label: 'Endommagement',
    unit: 'ratio',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    min: 0,
    max: 1,
    description: 'Indice d\'endommagement (0-1)'
  },
  density: {
    label: 'Densité',
    unit: 'kg/m³',
    format: (v) => `${v.toFixed(1)} kg/m³`,
    min: 0,
    max: 3000,
    description: 'Masse volumique'
  },
  velocity_magnitude: {
    label: 'Vitesse',
    unit: 'm/s',
    format: (v) => `${v.toFixed(3)} m/s`,
    min: 0,
    max: 100,
    description: 'Magnitude de la vitesse'
  },
  displacement: {
    label: 'Déplacement',
    unit: 'mm',
    format: (v) => `${(v * 1000).toFixed(2)} mm`,
    min: 0,
    max: 100,
    description: 'Déplacement mécanique'
  },
  prediction: {
    label: 'Score de Prédiction',
    unit: 'score',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    min: 0,
    max: 1,
    description: 'Score de confiance PINN'
  }
};

export function getMetricConfig(variable: string): MetricConfig {
  return METRICS_CONFIG[variable] || {
    label: variable,
    unit: 'N/A',
    format: (v) => v.toFixed(2),
    min: 0,
    max: 1,
    description: `Variable: ${variable}`
  };
}

export function formatMetricValue(variable: string, value: number): string {
  const config = getMetricConfig(variable);
  return config.format(value);
}

export function getMetricUnit(variable: string): string {
  return getMetricConfig(variable).unit;
}

export function getMetricLabel(variable: string): string {
  return getMetricConfig(variable).label;
}

/**
 * Generate dynamic statistics labels for a dataset
 */
export interface DatasetStats {
  variable: string;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export function formatDatasetStats(stats: DatasetStats): {
  minLabel: string;
  maxLabel: string;
  avgLabel: string;
  countLabel: string;
  unitLabel: string;
} {
  const config = getMetricConfig(stats.variable);
  return {
    minLabel: `Min: ${config.format(stats.min)}`,
    maxLabel: `Max: ${config.format(stats.max)}`,
    avgLabel: `Moyenne: ${config.format(stats.avg)}`,
    countLabel: `Points: ${stats.count.toLocaleString()}`,
    unitLabel: config.unit
  };
}

/**
 * Get industrial-grade credibility assessment based on metrics
 */
export function assessCredibility(
  r_squared: number,
  residual_norm: number,
  data_density: number
): { score: number; status: string; color: string } {
  let score = 0;
  let status = '';
  let color = '';

  // R² contribution (max 40 points)
  score += Math.min(40, r_squared * 40);

  // Residual norm contribution (max 35 points)
  score += Math.max(0, 35 - residual_norm * 100);

  // Data density contribution (max 25 points)
  score += Math.min(25, (data_density / 1000) * 25);

  if (score >= 95) {
    status = 'Certified Industrial';
    color = 'emerald';
  } else if (score >= 85) {
    status = 'Production Ready';
    color = 'blue';
  } else if (score >= 70) {
    status = 'Validation Required';
    color = 'yellow';
  } else {
    status = 'Development Phase';
    color = 'red';
  }

  return { score: Math.min(100, score), status, color };
}
