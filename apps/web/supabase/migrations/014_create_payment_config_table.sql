-- Create payment_config table to store Paddle and other payment provider settings
CREATE TABLE IF NOT EXISTS public.payment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow service_role to do everything
CREATE POLICY "Allow service_role full access on payment_config" ON public.payment_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow authenticated users to read config (needed for the admin page to load it)
-- In a real production app, you might want to restrict this further to only admins
CREATE POLICY "Allow authenticated users to read payment_config" ON public.payment_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow authenticated users to upsert config (needed for the admin page to save it)
-- The application code checks if the user is an admin before calling this
CREATE POLICY "Allow authenticated users to upsert payment_config" ON public.payment_config
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
