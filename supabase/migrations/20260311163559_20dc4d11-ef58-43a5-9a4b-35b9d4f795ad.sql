-- Ensure emergency contacts policies are explicit and safe for authenticated users
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can insert their own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can update their own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can delete their own emergency contacts" ON public.emergency_contacts;

CREATE POLICY "Users can view their own emergency contacts"
ON public.emergency_contacts
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own emergency contacts"
ON public.emergency_contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own emergency contacts"
ON public.emergency_contacts
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own emergency contacts"
ON public.emergency_contacts
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id::text);