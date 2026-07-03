-- Migration 012: Fix Schema Issues for Reports and Analyses
-- Fixes:
-- 1. Add file_type column to reports table (used by backend API)
-- 2. Add credibility_score column to analyses table (if missing from init.sql schema)
-- 3. Add analysis_type column to analyses table (if missing)
-- 4. Add results JSONB column to analyses table (if missing)
-- 5. Add transcription column to analyses table (if missing)

-- ============================================================================
-- 1. Add file_type to reports table
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'PDF';

-- ============================================================================
-- 2. Ensure analyses table has all required columns
-- ============================================================================
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS credibility_score DECIMAL(5, 2);

ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'physics_verification';

ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS results JSONB;

ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS transcription TEXT;

ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- 3. Create reports_storage bucket if not exists
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for reports storage
DROP POLICY IF EXISTS "Allow authenticated users to upload reports" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload reports"
ON storage.objects FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

DROP POLICY IF EXISTS "Allow authenticated users to select reports" ON storage.objects;
CREATE POLICY "Allow authenticated users to select reports"
ON storage.objects FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

DROP POLICY IF EXISTS "Allow authenticated users to delete reports" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete reports"
ON storage.objects FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

-- ============================================================================
-- 4. Add type column to reports for backward compatibility
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PDF';

-- ============================================================================
-- 5. Ensure RLS is enabled on reports
-- ============================================================================
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Add index on file_type for faster queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_reports_file_type ON public.reports(file_type);

-- ============================================================================
-- 7. Add index on credibility_score for faster queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_analyses_credibility ON public.analyses(credibility_score DESC NULLS LAST);

-- ============================================================================
-- Migration complete - verifying schema
-- ============================================================================
SELECT 
  'reports' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'reports'
  AND table_schema = 'public'
UNION ALL
SELECT 
  'analyses',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'analyses'
  AND table_schema = 'public';
