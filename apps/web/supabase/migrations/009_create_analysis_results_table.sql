-- Migration 009: Create analysis_results table

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extracted_parameters JSONB,
    pinn_predictions JSONB,
    assimilation_results JSONB,
    credibility_score DECIMAL(5, 2),
    anomalies TEXT[],
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis results" ON analysis_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analysis results" ON analysis_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analysis results" ON analysis_results
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analysis results" ON analysis_results
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_analysis_results_project_id ON analysis_results(project_id);
CREATE INDEX idx_analysis_results_analysis_id ON analysis_results(analysis_id);
CREATE INDEX idx_analysis_results_user_id ON analysis_results(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
