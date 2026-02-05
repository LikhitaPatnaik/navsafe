-- Create area_reports table to store user reports
CREATE TABLE public.area_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  area TEXT NOT NULL,
  street TEXT,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.area_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view reports (for community safety)
CREATE POLICY "Anyone can view area reports"
ON public.area_reports
FOR SELECT
USING (true);

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
ON public.area_reports
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own reports
CREATE POLICY "Users can update their own reports"
ON public.area_reports
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
ON public.area_reports
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_area_reports_updated_at
BEFORE UPDATE ON public.area_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for location-based queries
CREATE INDEX idx_area_reports_location ON public.area_reports (area, street);
CREATE INDEX idx_area_reports_coords ON public.area_reports (latitude, longitude);