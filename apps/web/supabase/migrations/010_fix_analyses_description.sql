-- Fix for missing description column in analyses table
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Ensure RLS is enabled and policies are correct
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Re-verify columns for the schema cache
COMMENT ON COLUMN public.analyses.description IS 'Scientific description of the analysis';
