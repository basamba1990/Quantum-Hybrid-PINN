-- Migration 013: Add credibility_score column to analyses table
-- This column is expected by the frontend (analyses/page.tsx) but may be missing
-- if the database was created from init.sql (which doesn't define it)
-- or if it was lost during schema migrations.

-- Add credibility_score to analyses table
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS credibility_score DECIMAL(5, 2);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_analyses_credibility_score 
ON public.analyses(credibility_score DESC NULLS LAST);

-- Add analysis_type column if missing (used by new analysis flow)
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'physics_verification';

-- Add results JSONB column if missing (used by hybrid simulation flow)
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS results JSONB;

-- Add transcription column if missing
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Add description column if missing
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Verify the schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'analyses'
  AND table_schema = 'public'
ORDER BY ordinal_position;
