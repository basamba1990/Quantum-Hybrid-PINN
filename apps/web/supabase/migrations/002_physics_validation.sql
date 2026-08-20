-- Physics validation results table
CREATE TABLE IF NOT EXISTS physics_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  extracted_data JSONB,
  pinn_results JSONB,
  credibility_score DECIMAL(5,2),
  is_physically_coherent BOOLEAN DEFAULT false,
  anomalies JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sovereignty score table
CREATE TABLE IF NOT EXISTS sovereignty_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_security_score DECIMAL(5,2),
  intellectual_property_score DECIMAL(5,2),
  independence_score DECIMAL(5,2),
  overall_sovereignty_index DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend projects table with additional fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Extend analyses table with additional fields
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'physics_verification';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS results JSONB;

-- Enable RLS on new tables
ALTER TABLE physics_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereignty_scores ENABLE ROW LEVEL SECURITY;

-- Policies for physics_validations
CREATE POLICY "Users can view physics validations of their projects" ON physics_validations FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = physics_validations.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert physics validations for their projects" ON physics_validations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = physics_validations.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update physics validations of their projects" ON physics_validations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = physics_validations.project_id AND projects.user_id = auth.uid())
);

-- Policies for sovereignty_scores
CREATE POLICY "Users can view sovereignty scores of their projects" ON sovereignty_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = sovereignty_scores.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert sovereignty scores for their projects" ON sovereignty_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = sovereignty_scores.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update sovereignty scores of their projects" ON sovereignty_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = sovereignty_scores.project_id AND projects.user_id = auth.uid())
);