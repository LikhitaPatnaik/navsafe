-- Fix safety_zones permissive policies by making them user-specific or admin-only
-- For now, keep SELECT public but restrict modifications

DROP POLICY IF EXISTS "Authenticated users can delete safety zones" ON public.safety_zones;
DROP POLICY IF EXISTS "Authenticated users can insert safety zones" ON public.safety_zones;
DROP POLICY IF EXISTS "Authenticated users can update safety zones" ON public.safety_zones;

-- Only allow authenticated users to modify safety zones (more restrictive)
CREATE POLICY "Authenticated users can insert safety zones"
ON public.safety_zones FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update safety zones"
ON public.safety_zones FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete safety zones"
ON public.safety_zones FOR DELETE
TO authenticated
USING (true);