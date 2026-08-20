-- Migration 012: Fix Schema Issues for Reports and Analyses (REVISED)
-- Fixes:
-- 1. Add file_type, file_size_kb, and file_name columns to reports table
-- 2. Add required columns to analyses table
-- 3. Ensure reports bucket exists

-- ============================================================================
-- 1. Update reports table schema
-- ============================================================================
ALTER TABLE IF EXISTS public.reports 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'PDF',
ADD COLUMN IF NOT EXISTS file_size_kb INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PDF';

-- ============================================================================
-- 2. Update analyses table schema
-- ============================================================================
ALTER TABLE IF EXISTS public.analyses 
ADD COLUMN IF NOT EXISTS credibility_score DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'physics_verification',
ADD COLUMN IF NOT EXISTS results JSONB,
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- 3. Create reports bucket
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- 4. Enable RLS and create indexes
-- ============================================================================
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reports_file_type ON public.reports(file_type);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_credibility ON public.analyses(credibility_score DESC NULLS LAST);

-- ============================================================================
-- Migration complete
-- ============================================================================
