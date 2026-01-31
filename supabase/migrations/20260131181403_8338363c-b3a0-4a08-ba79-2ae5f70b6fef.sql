-- Create table for crime type breakdown per area
CREATE TABLE public.crime_type_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area TEXT NOT NULL,
    crime_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (area, crime_type)
);

-- Enable RLS
ALTER TABLE public.crime_type_counts ENABLE ROW LEVEL SECURITY;

-- Public read access (same as safety_zones)
CREATE POLICY "Anyone can view crime type counts"
ON public.crime_type_counts
FOR SELECT
USING (true);

-- Authenticated users can manage data
CREATE POLICY "Authenticated users can insert crime type counts"
ON public.crime_type_counts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update crime type counts"
ON public.crime_type_counts
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete crime type counts"
ON public.crime_type_counts
FOR DELETE
TO authenticated
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_crime_type_counts_updated_at
BEFORE UPDATE ON public.crime_type_counts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();