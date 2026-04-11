-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for authenticated users
CREATE POLICY "Allow authenticated users to upload reports"
ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'reports');

CREATE POLICY "Allow authenticated users to select reports"
ON storage.objects FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'reports');

CREATE POLICY "Allow authenticated users to delete reports"
ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'reports');