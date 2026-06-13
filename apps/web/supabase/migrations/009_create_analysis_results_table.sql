-- 1) Add the missing column (if it doesn't exist yet)
ALTER TABLE public.analysis_results
ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) (Optional but recommended) If you have existing rows, you must backfill user_id.
--    Example (ONLY if you can derive user_id from analysis_id via an analyses table):
-- UPDATE public.analysis_results ar
-- SET user_id = a.user_id
-- FROM public.analyses a
-- WHERE ar.analysis_id = a.id;

-- 3) If you want NOT NULL, do it AFTER backfill:
-- ALTER TABLE public.analysis_results
-- ALTER COLUMN user_id SET NOT NULL;

-- 4) Add FK if you want referential integrity (guarded so it won’t re-add twice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analysis_results_user_id_fkey'
  ) THEN
    ALTER TABLE public.analysis_results
    ADD CONSTRAINT analysis_results_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Drop and recreate policies (otherwise reruns may error or leave stale ones)
DROP POLICY IF EXISTS "Users can view their own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can insert their own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can update their own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can delete their own analysis results" ON public.analysis_results;

-- 6) Enable RLS
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- 7) Recreate policies (best-practice: wrap auth.uid() as shown below)
CREATE POLICY "Users can view their own analysis results"
ON public.analysis_results
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own analysis results"
ON public.analysis_results
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own analysis results"
ON public.analysis_results
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own analysis results"
ON public.analysis_results
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
