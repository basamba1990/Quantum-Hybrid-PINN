-- Add video_url and transcription columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Create videos bucket if not exists
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for authenticated users to upload videos
CREATE POLICY "Allow authenticated users to upload videos"
ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'videos');

CREATE POLICY "Allow authenticated users to select videos"
ON storage.objects FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'videos');

CREATE POLICY "Allow authenticated users to delete videos"
ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'videos');
