-- ============================================
-- Quantum-Hybrid PINN V8 - Model Trainings Table
-- ============================================

CREATE TABLE IF NOT EXISTS model_trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_type VARCHAR(100) NOT NULL,
    scenario VARCHAR(255),
    metrics JSONB NOT NULL,
    model_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE model_trainings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view training records
CREATE POLICY "Allow authenticated users to view training records" ON model_trainings
    FOR SELECT USING (true);

-- Allow service role to insert records (used by MLOps pipeline)
CREATE POLICY "Allow service role to insert records" ON model_trainings
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON model_trainings TO authenticated;
GRANT ALL ON model_trainings TO service_role;
