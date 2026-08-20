-- New tables and modifications for PINN 3D V8 features

-- Table for 3D PINN model configurations and training results
CREATE TABLE IF NOT EXISTS pinn_3d_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL UNIQUE,
  layers JSONB NOT NULL,
  epochs INTEGER,
  learning_rate DECIMAL(10,8),
  final_loss DECIMAL(20,10),
  model_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for 3D PINN prediction results (for /v2/validate-3d endpoint)
CREATE TABLE IF NOT EXISTS pinn_3d_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES pinn_3d_models(id) ON DELETE CASCADE,
  time_input DECIMAL(10,5) NOT NULL,
  x_input DECIMAL(10,5) NOT NULL,
  y_input DECIMAL(10,5) NOT NULL,
  z_input DECIMAL(10,5) NOT NULL,
  pressure DECIMAL(20,10),
  velocity_u DECIMAL(20,10),
  velocity_v DECIMAL(20,10),
  velocity_w DECIMAL(20,10),
  temperature DECIMAL(20,10),
  density DECIMAL(20,10),
  predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Deep Kalman Filter assimilation results (for /v2/assimilate endpoint)
CREATE TABLE IF NOT EXISTS dkf_assimilations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES pinn_3d_models(id) ON DELETE CASCADE,
  initial_state JSONB NOT NULL, -- [rho, u, v, w, T]
  observation JSONB NOT NULL, -- [pressure, temperature, flow_rate]
  assimilated_state JSONB NOT NULL, -- [rho, u, v, w, T] after assimilation
  assimilated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE pinn_3d_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinn_3d_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dkf_assimilations ENABLE ROW LEVEL SECURITY;

-- Policies for pinn_3d_models (assuming models are public or linked to projects later)
CREATE POLICY "Allow read access to all pinn_3d_models" ON pinn_3d_models FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access for pinn_3d_models" ON pinn_3d_models FOR INSERT WITH CHECK (TRUE);

-- Policies for pinn_3d_predictions (assuming predictions are public or linked to projects later)
CREATE POLICY "Allow read access to all pinn_3d_predictions" ON pinn_3d_predictions FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access for pinn_3d_predictions" ON pinn_3d_predictions FOR INSERT WITH CHECK (TRUE);

-- Policies for dkf_assimilations (assuming assimilations are public or linked to projects later)
CREATE POLICY "Allow read access to all dkf_assimilations" ON dkf_assimilations FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access for dkf_assimilations" ON dkf_assimilations FOR INSERT WITH CHECK (TRUE);