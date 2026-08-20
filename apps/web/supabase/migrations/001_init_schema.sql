-- ============================================
-- Quantum-Hybrid PINN V8 - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table (Supabase Auth Integration)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- ============================================
-- Projects Table
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================
-- Analyses Table
-- ============================================

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT,
    video_key TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    credibility_score DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_analyses_project_id ON analyses(project_id);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_status ON analyses(status);

-- ============================================
-- Jobs Table (Async Job Queue)
-- ============================================

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    priority INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_jobs_analysis_id ON jobs(analysis_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);

-- ============================================
-- Simulation Results Table
-- ============================================

CREATE TABLE IF NOT EXISTS simulation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    
    -- PINN Validation Results
    credibility_score DECIMAL(5, 2),
    continuity_residual DECIMAL(10, 6),
    momentum_residual DECIMAL(10, 6),
    energy_residual DECIMAL(10, 6),
    
    -- Physical Fields
    velocity_field JSONB,
    pressure_field JSONB,
    temperature_field JSONB,
    density_field JSONB,
    
    -- Anomalies
    anomalies TEXT[],
    
    -- Metadata
    simulation_params JSONB,
    execution_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_simulation_results_analysis_id ON simulation_results(analysis_id);
CREATE INDEX idx_simulation_results_credibility ON simulation_results(credibility_score);

-- ============================================
-- Transcriptions Table
-- ============================================

CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    text TEXT NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcriptions_analysis_id ON transcriptions(analysis_id);

-- ============================================
-- Audit Logs Table
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = auth_id);

-- Users can only see their own projects
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (user_id = auth.uid());

-- Users can only see their own analyses
CREATE POLICY "Users can view own analyses" ON analyses
    FOR SELECT USING (user_id = auth.uid());

-- Users can only see their own jobs
CREATE POLICY "Users can view own jobs" ON jobs
    FOR SELECT USING (
        analysis_id IN (
            SELECT id FROM analyses WHERE user_id = auth.uid()
        )
    );

-- Users can only see their own simulation results
CREATE POLICY "Users can view own results" ON simulation_results
    FOR SELECT USING (
        analysis_id IN (
            SELECT id FROM analyses WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_simulation_results_updated_at BEFORE UPDATE ON simulation_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Analysis Summary View
CREATE OR REPLACE VIEW analysis_summary AS
SELECT
    a.id,
    a.project_id,
    a.user_id,
    a.title,
    a.status,
    a.credibility_score,
    COUNT(j.id) as job_count,
    COUNT(sr.id) as result_count,
    a.created_at,
    a.updated_at
FROM analyses a
LEFT JOIN jobs j ON a.id = j.analysis_id
LEFT JOIN simulation_results sr ON a.id = sr.analysis_id
GROUP BY a.id, a.project_id, a.user_id, a.title, a.status, a.credibility_score, a.created_at, a.updated_at;

-- User Statistics View
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    u.id,
    u.email,
    COUNT(DISTINCT p.id) as project_count,
    COUNT(DISTINCT a.id) as analysis_count,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_analyses,
    AVG(a.credibility_score) as avg_credibility_score
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN analyses a ON u.id = a.user_id
GROUP BY u.id, u.email;

-- ============================================
-- Grants (if needed)
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON analyses TO authenticated;
GRANT SELECT, INSERT ON jobs TO authenticated;
GRANT SELECT ON simulation_results TO authenticated;
GRANT SELECT, INSERT ON transcriptions TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
