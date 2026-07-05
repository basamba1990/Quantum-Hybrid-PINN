-- Ajouter la colonne user_id à la table analyses si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='user_id') THEN
        ALTER TABLE public.analyses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ajouter la colonne results à la table analyses si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='results') THEN
        ALTER TABLE public.analyses ADD COLUMN results JSONB DEFAULT '{}';
    END IF;
END $$;

-- Ajouter la colonne status à la table projects si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='status') THEN
        ALTER TABLE public.projects ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Mettre à jour les politiques pour analyses pour inclure user_id
DROP POLICY IF EXISTS "Users can insert analyses for their projects" ON public.analyses;
CREATE POLICY "Users can insert analyses for their projects" ON public.analyses 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view analyses of their projects" ON public.analyses;
CREATE POLICY "Users can view analyses of their projects" ON public.analyses 
    FOR SELECT USING (auth.uid() = user_id);
