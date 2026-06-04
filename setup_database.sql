-- Script SQL pour créer la table des résultats d'analyse PINN
-- À exécuter dans le SQL Editor de votre tableau de bord Supabase

CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    analysis_id UUID NOT NULL,
    extracted_parameters JSONB NOT NULL,
    pinn_predictions JSONB,
    assimilation_results JSONB,
    credibility_score NUMERIC NOT NULL,
    anomalies TEXT[],
    context TEXT,
    user_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    turbulence_intensity NUMERIC,
    turbulence_length_scale NUMERIC
);

-- Activation de la sécurité au niveau des lignes (RLS)
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Politique permettant à l'Edge Function (via la clé service_role ou anon) d'insérer des données
CREATE POLICY "Allow all for service role" ON public.analysis_results
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Politique permettant aux utilisateurs authentifiés de lire leurs propres résultats
CREATE POLICY "Allow authenticated users to read analysis_results" ON public.analysis_results
    FOR SELECT
    TO authenticated
    USING (true);
