-- Migration 013: Fix Storage Policies for Reports Upload
-- Purpose: Ensure storage policies allow authenticated users to upload reports
-- regardless of folder structure (project-based vs user-based)

-- ============================================================================
-- 1. Drop conflicting policies
-- ============================================================================
DROP POLICY IF EXISTS "Allow users to upload their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to select their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete reports" ON storage.objects;

-- ============================================================================
-- 2. Create permissive policies for reports bucket
-- ============================================================================
CREATE POLICY "Allow authenticated users to upload reports v2"
ON storage.objects FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "Allow authenticated users to select reports v2"
ON storage.objects FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

CREATE POLICY "Allow authenticated users to delete reports v2"
ON storage.objects FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'reports'
);

-- ============================================================================
-- 3. Verify bucket exists and is public
-- ============================================================================
UPDATE storage.buckets 
SET public = true 
WHERE id = 'reports';

-- ============================================================================
-- 4. Enable RLS on storage.objects
-- ============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Migration complete
-- ============================================================================
