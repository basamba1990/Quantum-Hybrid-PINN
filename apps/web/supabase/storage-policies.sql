-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for authenticated users
CREATE POLICY "Allow users to upload their own reports"
ON storage.objects FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' 
  AND bucket_id = 'reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to select their own reports"
ON storage.objects FOR SELECT USING (
  auth.role() = 'authenticated' 
  AND bucket_id = 'reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow authenticated users to delete reports"
ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'reports');