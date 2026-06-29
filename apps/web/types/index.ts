export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  category?: string
  status?: string
  video_url?: string
  transcription?: string
  created_at: string
  updated_at: string
}

export interface Prediction3D {
  pressure: number;
  velocity_u: number;
  velocity_v: number;
  velocity_w: number;
  temperature: number;
  density: number;
  time: number;
  x: number;
  y: number;
  z: number;
  timestamp: string;
  velocity_magnitude?: number;
  damage?: number;
  tke?: number;
  epsilon?: number;
  stress?: number;
  uncertainty?: number;
  residual?: number;
}

export interface AnalysisResults {
  isPhysicallyCoherent: boolean;
  credibilityScore: number;
  anomalies: string[];
  extractedData: any;
  predictions3d: Prediction3D[];
  assimilation?: {
    initial_state: number[];
    observation: number[];
    assimilated_state: number[];
  };
}

export interface Analysis {
  id: string
  project_id: string
  title: string
  name?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  results?: AnalysisResults
  credibility_score?: number
  created_at: string
  updated_at: string
  reynolds?: number
  mach?: number
  domain_bounds?: {
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    zMin: number
    zMax: number
  }
  fluid_properties?: {
    density: number
    viscosity: number
    temperature_ref: number
  }
  boundary_conditions?: string
  convergence_metrics?: {
    residual_max: number
    residual_avg: number
    iterations: number
  }
}

export interface Report {
  id: string
  project_id: string
  name: string
  file_url: string
  created_at: string
  updated_at: string
  file_type?: string
  file_size_kb?: number
  file_name?: string
}

export interface User {
  id: string
  email?: string
  user_metadata?: {
    name?: string
  }
}