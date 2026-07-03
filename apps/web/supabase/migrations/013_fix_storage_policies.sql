-- Migration 013: Fix Storage Policies for Reports Upload (REVISED)
-- Purpose: Ensure storage policies allow authenticated users to upload reports
-- Note: We avoid ALTER TABLE storage.objects and UPDATE storage.buckets as they 
-- often require superuser permissions not available in all migration environments.

-- ============================================================================
-- 1. Create reports bucket if it doesn't exist (safe way)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- 2. Drop existing custom policies (if they exist)
-- ============================================================================
-- Note: We only drop policies that we have permission to manage
DROP POLICY IF EXISTS "Allow users to upload their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to select their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload reports v2" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select reports v2" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete reports v2" ON storage.objects;

-- ============================================================================
-- 3. Create permissive policies for reports bucket
-- ============================================================================
-- We use unique names to avoid conflicts
CREATE POLICY "reports_upload_policy_v3"
ON storage.objects FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "reports_select_policy_v3"
ON storage.objects FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "reports_delete_policy_v3"
ON storage.objects FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

-- ============================================================================
-- Migration complete
-- ============================================================================
