-- MIGRATION: INDUSTRIAL SOCIAL PEER-REVIEW SYSTEM
-- Version: 1.0.0 (Truly-Industrial)

-- 1. Table pour les commentaires géolocalisés sur les simulations 3D
CREATE TABLE IF NOT EXISTS public.simulation_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  
  -- Coordonnées 3D de l'annotation (pour le visualiseur)
  pos_x float8,
  pos_y float8,
  pos_z float8,
  
  -- Métadonnées de validation
  is_validation boolean DEFAULT false,
  severity text CHECK (severity IN ('info', 'warning', 'critical', 'validation')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Table pour les partages de projets (Accès Partenaires/Investisseurs)
CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  access_level text CHECK (access_level IN ('viewer', 'auditor', 'admin')),
  token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Table pour les réactions professionnelles (Proof of Credibility)
CREATE TABLE IF NOT EXISTS public.scientific_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text CHECK (reaction_type IN ('physically_coherent', 'industrial_ready', 'innovation', 'peer_reviewed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(analysis_id, user_id, reaction_type)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_sim_annotations_analysis ON public.simulation_annotations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_email ON public.project_shares(shared_with_email);

-- RLS (Row Level Security)
ALTER TABLE public.simulation_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scientific_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for Annotations
CREATE POLICY "Annotations are viewable by project members" 
  ON public.simulation_annotations FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = (SELECT analysis.project_id FROM public.analyses analysis WHERE analysis.id = analysis_id)
    AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())))
  ));

CREATE POLICY "Users can create annotations on projects they access" 
  ON public.simulation_annotations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_simulation_annotations_updated_at
    BEFORE UPDATE ON public.simulation_annotations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

COMMENT ON TABLE public.simulation_annotations IS 'Annotations géolocalisées dans l''espace 3D pour le Peer-Review industriel.';
COMMENT ON TABLE public.project_shares IS 'Gestion des accès pour les investisseurs et partenaires stratégiques.';
COMMENT ON TABLE public.scientific_reactions IS 'Validation sociale de la crédibilité scientifique des simulations.';
