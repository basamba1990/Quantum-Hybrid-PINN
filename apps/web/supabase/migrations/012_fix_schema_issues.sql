-- Migration 012: Fix Schema Issues for Reports and Analyses
-- Fixes:
-- 1. Add file_type column to reports table (used by backend API)
-- 2. Add file_size_kb and file_name columns to reports table
-- 3. Add credibility_score column to analyses table (if missing from init.sql schema)
-- 4. Add analysis_type column to analyses table (if missing)
-- 5. Add results JSONB column to analyses table (if missing)
-- 6. Add transcription column to analyses table (if missing)
-- 7. Fix storage policies to allow project-based uploads

-- ============================================================================
-- 1. Add file_type to reports table
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'PDF';

-- ============================================================================
-- 2. Add file_size_kb and file_name columns to reports table
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS file_size_kb INT DEFAULT 0;

ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- ============================================================================
-- 3. Ensure analyses table has all required columns
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
-- 4. Create reports_storage bucket if not exists
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Fix storage policies - Allow authenticated users to upload/manage reports
-- ============================================================================
DROP POLICY IF EXISTS "Allow users to upload their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to select their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete reports" ON storage.objects;

-- New permissive policies for reports bucket
CREATE POLICY "Allow authenticated users to upload reports"
ON storage.objects FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "Allow authenticated users to select reports"
ON storage.objects FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "Allow authenticated users to delete reports"
ON storage.objects FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

-- ============================================================================
-- 6. Add type column to reports for backward compatibility
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PDF';

-- ============================================================================
-- 7. Ensure RLS is enabled on reports
-- ============================================================================
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. Add indexes for faster queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_reports_file_type ON public.reports(file_type);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports(project_id);
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
