-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies for projects
CREATE POLICY "Users can view their own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Policies for analyses
CREATE POLICY "Users can view analyses of their projects" ON analyses FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert analyses for their projects" ON analyses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update analyses of their projects" ON analyses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can delete analyses of their projects" ON analyses FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = analyses.project_id AND projects.user_id = auth.uid())
);

-- Policies for reports
CREATE POLICY "Users can view reports of their projects" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert reports for their projects" ON reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update reports of their projects" ON reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can delete reports of their projects" ON reports FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid())
);