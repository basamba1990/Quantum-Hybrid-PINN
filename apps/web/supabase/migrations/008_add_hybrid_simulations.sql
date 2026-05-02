-- Migration 008: Add hybrid_simulations table and RLS policies
-- This table tracks hybrid CFD-ML simulation jobs and their real-time progress

CREATE TABLE IF NOT EXISTS hybrid_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_name TEXT NOT NULL,
    case_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    config JSONB DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '{
        "iteration": 0,
        "cfdTime": 0,
        "mlTime": 0,
        "residuals": {},
        "log": "Initialisation...",
        "credibilityScore": 0
    }'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hybrid_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can view their own hybrid simulations" ON hybrid_simulations
    FOR SELECT USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

DROP POLICY IF EXISTS "Users can insert their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can insert their own hybrid simulations" ON hybrid_simulations
    FOR INSERT WITH CHECK (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

DROP POLICY IF EXISTS "Users can update their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can update their own hybrid simulations" ON hybrid_simulations
    FOR UPDATE USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_user_id ON hybrid_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_project_id ON hybrid_simulations(project_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_status ON hybrid_simulations(status);
