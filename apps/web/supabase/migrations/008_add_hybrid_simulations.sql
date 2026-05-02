-- Migration 008: Add hybrid_simulations table and RLS policies
-- Clean version (UUID-safe + Supabase best practices)

-- Table
CREATE TABLE IF NOT EXISTS hybrid_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- IMPORTANT: on référence directement auth.users
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    job_name TEXT NOT NULL,
    case_path TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),

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

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hybrid_simulations ENABLE ROW LEVEL SECURITY;

-- =========================
-- RLS POLICIES (FIXED)
-- =========================

-- SELECT
DROP POLICY IF EXISTS "Users can view their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can view their own hybrid simulations"
ON hybrid_simulations
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT
DROP POLICY IF EXISTS "Users can insert their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can insert their own hybrid simulations"
ON hybrid_simulations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE
DROP POLICY IF EXISTS "Users can update their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can update their own hybrid simulations"
ON hybrid_simulations
FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE (optionnel mais recommandé)
DROP POLICY IF EXISTS "Users can delete their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can delete their own hybrid simulations"
ON hybrid_simulations
FOR DELETE
USING (auth.uid() = user_id);

-- =========================
-- INDEXES (PERFORMANCE)
-- =========================

CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_user_id
ON hybrid_simulations(user_id);

CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_project_id
ON hybrid_simulations(project_id);

CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_status
ON hybrid_simulations(status);
