-- Enhanced Physics Validation Schema (V8.1)
-- Adds support for dynamic credibility scoring, residual tracking, and sovereignty metrics
-- Compatible with existing tables, uses ALTER TABLE for backward compatibility

-- ============================================================================
-- 1. Extend physics_validations table with new columns
-- ============================================================================

ALTER TABLE physics_validations ADD COLUMN IF NOT EXISTS 
  residuals JSONB DEFAULT '{
    "continuity": 0,
    "momentum": 0,
    "energy": 0,
    "total_norm": 0
  }';

ALTER TABLE physics_validations ADD COLUMN IF NOT EXISTS 
  physics_metrics JSONB DEFAULT '{
    "pressure_deviation": 0,
    "temperature_deviation": 0,
    "velocity_deviation": 0,
    "kalman_correction": 0
  }';

ALTER TABLE physics_validations ADD COLUMN IF NOT EXISTS 
  credibility_label TEXT DEFAULT 'Acceptable' CHECK (credibility_label IN ('Excellent', 'Acceptable', 'Critique'));

ALTER TABLE physics_validations ADD COLUMN IF NOT EXISTS 
  validation_version TEXT DEFAULT 'V8.1';

ALTER TABLE physics_validations ADD COLUMN IF NOT EXISTS 
  execution_time_ms INTEGER;

-- ============================================================================
-- 2. Create residuals tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS physics_residuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id UUID NOT NULL REFERENCES physics_validations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Navier-Stokes residuals
  continuity_residual DECIMAL(12,6),
  momentum_residual DECIMAL(12,6),
  energy_residual DECIMAL(12,6),
  total_residual_norm DECIMAL(12,6),
  
  -- Spatial/temporal information
  time_point DECIMAL(8,4),
  x_point DECIMAL(8,4),
  y_point DECIMAL(8,4),
  z_point DECIMAL(8,4),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_residuals_validation ON physics_residuals(validation_id);
CREATE INDEX IF NOT EXISTS idx_residuals_project ON physics_residuals(project_id);

-- ============================================================================
-- 3. Create credibility history table for trend analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS credibility_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  
  -- Score tracking
  credibility_score DECIMAL(5,2),
  score_label TEXT,
  
  -- Component scores
  pressure_score DECIMAL(5,2),
  temperature_score DECIMAL(5,2),
  velocity_score DECIMAL(5,2),
  residual_score DECIMAL(5,2),
  assimilation_score DECIMAL(5,2),
  
  -- Anomaly count
  anomaly_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  simulation_type TEXT,
  fluid_type TEXT DEFAULT 'H2',
  model_version TEXT DEFAULT 'V8'
);

CREATE INDEX IF NOT EXISTS idx_credibility_project ON credibility_history(project_id);
CREATE INDEX IF NOT EXISTS idx_credibility_created ON credibility_history(created_at DESC);

-- ============================================================================
-- 4. Extend sovereignty_scores with detailed metrics
-- ============================================================================

ALTER TABLE sovereignty_scores ADD COLUMN IF NOT EXISTS 
  model_ownership_score DECIMAL(5,2) DEFAULT 90;

ALTER TABLE sovereignty_scores ADD COLUMN IF NOT EXISTS 
  open_source_usage BOOLEAN DEFAULT true;

ALTER TABLE sovereignty_scores ADD COLUMN IF NOT EXISTS 
  local_computation_ratio DECIMAL(5,2) DEFAULT 100;

ALTER TABLE sovereignty_scores ADD COLUMN IF NOT EXISTS 
  data_retention_days INTEGER DEFAULT 90;

ALTER TABLE sovereignty_scores ADD COLUMN IF NOT EXISTS 
  audit_trail JSONB;

-- ============================================================================
-- 5. Create audit trail table for compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  
  -- Action tracking
  action_type TEXT NOT NULL CHECK (action_type IN (
    'validation_started',
    'extraction_completed',
    'pinn_inference_completed',
    'assimilation_completed',
    'credibility_calculated',
    'validation_completed',
    'validation_failed',
    'anomaly_detected'
  )),
  
  -- Details
  action_details JSONB,
  error_message TEXT,
  
  -- User tracking
  user_id UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON validation_audit_trail(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON validation_audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON validation_audit_trail(created_at DESC);

-- ============================================================================
-- 6. Create view for credibility trends
-- ============================================================================

CREATE OR REPLACE VIEW credibility_trends AS
SELECT 
  project_id,
  DATE(created_at) as analysis_date,
  COUNT(*) as analysis_count,
  AVG(credibility_score) as avg_credibility,
  MAX(credibility_score) as max_credibility,
  MIN(credibility_score) as min_credibility,
  SUM(CASE WHEN score_label = 'Excellent' THEN 1 ELSE 0 END) as excellent_count,
  SUM(CASE WHEN score_label = 'Acceptable' THEN 1 ELSE 0 END) as acceptable_count,
  SUM(CASE WHEN score_label = 'Critique' THEN 1 ELSE 0 END) as critique_count
FROM credibility_history
GROUP BY project_id, DATE(created_at)
ORDER BY project_id, analysis_date DESC;

-- ============================================================================
-- 7. Enable RLS on new tables
-- ============================================================================

ALTER TABLE physics_residuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE credibility_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_audit_trail ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. Create RLS policies for new tables
-- ============================================================================

-- Physics residuals policies
CREATE POLICY "Users can view residuals of their projects" ON physics_residuals FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = physics_residuals.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can insert residuals for their projects" ON physics_residuals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = physics_residuals.project_id AND projects.user_id = auth.uid())
);

-- Credibility history policies
CREATE POLICY "Users can view credibility history of their projects" ON credibility_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = credibility_history.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can insert credibility history for their projects" ON credibility_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = credibility_history.project_id AND projects.user_id = auth.uid())
);

-- Audit trail policies
CREATE POLICY "Users can view audit trail of their projects" ON validation_audit_trail FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = validation_audit_trail.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can insert audit trail for their projects" ON validation_audit_trail FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = validation_audit_trail.project_id AND projects.user_id = auth.uid())
);

-- ============================================================================
-- 9. Create trigger for automatic audit trail logging
-- ============================================================================

CREATE OR REPLACE FUNCTION log_validation_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO validation_audit_trail (
    project_id,
    analysis_id,
    action_type,
    action_details,
    user_id
  ) VALUES (
    NEW.project_id,
    NEW.analysis_id,
    'validation_completed',
    jsonb_build_object(
      'credibility_score', NEW.credibility_score,
      'is_coherent', NEW.is_physically_coherent,
      'anomaly_count', jsonb_array_length(COALESCE(NEW.anomalies, '[]'::jsonb))
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER physics_validation_audit_trigger
AFTER INSERT ON physics_validations
FOR EACH ROW
EXECUTE FUNCTION log_validation_action();

-- ============================================================================
-- 10. Create function for credibility score calculation
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_credibility_score(
  pressure_deviation DECIMAL,
  temperature_deviation DECIMAL,
  velocity_deviation DECIMAL,
  residual_norm DECIMAL,
  kalman_correction DECIMAL
)
RETURNS TABLE (
  overall_score DECIMAL,
  pressure_score DECIMAL,
  temperature_score DECIMAL,
  velocity_score DECIMAL,
  residual_score DECIMAL,
  assimilation_score DECIMAL,
  score_label TEXT
) AS $$
DECLARE
  v_pressure_score DECIMAL := 100;
  v_temperature_score DECIMAL := 100;
  v_velocity_score DECIMAL := 100;
  v_residual_score DECIMAL := 100;
  v_assimilation_score DECIMAL := 100;
  v_overall_score DECIMAL;
  v_label TEXT;
BEGIN
  -- Calculate component scores
  v_pressure_score := GREATEST(0, 100 - (pressure_deviation * 100 / 0.25));
  v_temperature_score := GREATEST(0, 100 - (temperature_deviation * 100 / 0.10));
  v_velocity_score := GREATEST(0, 100 - (velocity_deviation * 100 / 0.20));
  
  -- Residual score based on norm
  IF residual_norm < 1000 THEN
    v_residual_score := 100;
  ELSIF residual_norm < 10000 THEN
    v_residual_score := 85;
  ELSIF residual_norm < 100000 THEN
    v_residual_score := 60;
  ELSE
    v_residual_score := 30;
  END IF;
  
  -- Assimilation score based on Kalman correction
  IF kalman_correction < 5 THEN
    v_assimilation_score := 100;
  ELSIF kalman_correction < 20 THEN
    v_assimilation_score := 85;
  ELSIF kalman_correction < 50 THEN
    v_assimilation_score := 65;
  ELSE
    v_assimilation_score := 40;
  END IF;
  
  -- Calculate overall score (weighted average)
  v_overall_score := (
    v_pressure_score * 0.30 +
    v_temperature_score * 0.20 +
    v_velocity_score * 0.15 +
    v_residual_score * 0.20 +
    v_assimilation_score * 0.15
  );
  
  -- Determine label
  IF v_overall_score >= 80 THEN
    v_label := 'Excellent';
  ELSIF v_overall_score >= 60 THEN
    v_label := 'Acceptable';
  ELSE
    v_label := 'Critique';
  END IF;
  
  RETURN QUERY SELECT
    ROUND(v_overall_score, 2),
    ROUND(v_pressure_score, 2),
    ROUND(v_temperature_score, 2),
    ROUND(v_velocity_score, 2),
    ROUND(v_residual_score, 2),
    ROUND(v_assimilation_score, 2),
    v_label;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 11. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_physics_validations_credibility 
  ON physics_validations(credibility_score DESC);

CREATE INDEX IF NOT EXISTS idx_physics_validations_coherence 
  ON physics_validations(is_physically_coherent);

CREATE INDEX IF NOT EXISTS idx_credibility_history_score 
  ON credibility_history(credibility_score DESC);

-- ============================================================================
-- 12. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON physics_residuals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON credibility_history TO authenticated;
GRANT SELECT, INSERT ON validation_audit_trail TO authenticated;
GRANT SELECT ON credibility_trends TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_credibility_score TO authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verify migration
SELECT 
  'physics_validations' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'physics_validations'
UNION ALL
SELECT 
  'physics_residuals',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'physics_residuals'
UNION ALL
SELECT 
  'credibility_history',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'credibility_history';
