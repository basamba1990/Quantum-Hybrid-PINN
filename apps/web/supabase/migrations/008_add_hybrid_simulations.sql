-- Migration 008: Hybrid simulations (final safe version)

-- =========================
-- EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- TABLE
-- =========================
CREATE TABLE IF NOT EXISTS hybrid_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
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

-- =========================
-- CLEAN DATA BEFORE CAST
-- =========================
-- Supprime les valeurs invalides AVANT conversion
DELETE FROM hybrid_simulations
WHERE user_id IS NOT NULL
  AND user_id::text !~* '^[0-9a-f-]{36}$';

DELETE FROM hybrid_simulations
WHERE project_id IS NOT NULL
  AND project_id::text !~* '^[0-9a-f-]{36}$';

-- =========================
-- SAFE TYPE CONVERSION
-- =========================
DO $$
BEGIN
  -- user_id → UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hybrid_simulations'
      AND column_name = 'user_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE hybrid_simulations
    ALTER COLUMN user_id TYPE UUID
    USING user_id::uuid;
  END IF;

  -- project_id → UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hybrid_simulations'
      AND column_name = 'project_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE hybrid_simulations
    ALTER COLUMN project_id TYPE UUID
    USING project_id::uuid;
  END IF;
END $$;

-- =========================
-- FK SAFETY (rebind propre)
-- =========================
ALTER TABLE hybrid_simulations
DROP CONSTRAINT IF EXISTS hybrid_simulations_user_id_fkey;

ALTER TABLE hybrid_simulations
ADD CONSTRAINT hybrid_simulations_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- =========================
-- RLS
-- =========================
ALTER TABLE hybrid_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hybrid_simulations FORCE ROW LEVEL SECURITY;

-- =========================
-- POLICIES
-- =========================

DROP POLICY IF EXISTS "Users can view their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can view their own hybrid simulations"
ON hybrid_simulations
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can insert their own hybrid simulations"
ON hybrid_simulations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can update their own hybrid simulations"
ON hybrid_simulations
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own hybrid simulations" ON hybrid_simulations;
CREATE POLICY "Users can delete their own hybrid simulations"
ON hybrid_simulations
FOR DELETE
USING (auth.uid() = user_id);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_user_id
ON hybrid_simulations(user_id);

CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_project_id
ON hybrid_simulations(project_id);

CREATE INDEX IF NOT EXISTS idx_hybrid_simulations_status
ON hybrid_simulations(status);

-- =========================
-- AUTO updated_at
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hybrid_simulations_updated_at ON hybrid_simulations;

CREATE TRIGGER update_hybrid_simulations_updated_at
BEFORE UPDATE ON hybrid_simulations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
