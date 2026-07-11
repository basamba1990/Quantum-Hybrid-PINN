-- Migration 016: Add scenario_type column to analyses table
ALTER TABLE IF EXISTS public.analyses
ADD COLUMN IF NOT EXISTS scenario_type TEXT DEFAULT 'H2_PIPELINE';

-- Set default value for existing rows if needed (optional, depending on data integrity needs)
-- UPDATE public.analyses SET scenario_type = 'H2_PIPELINE' WHERE scenario_type IS NULL;
