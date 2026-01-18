-- Create emergency_contacts table
CREATE TABLE public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Public access policies (for demo - no auth required)
CREATE POLICY "Anyone can view emergency contacts" 
ON public.emergency_contacts 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert emergency contacts" 
ON public.emergency_contacts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update emergency contacts" 
ON public.emergency_contacts 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete emergency contacts" 
ON public.emergency_contacts 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_emergency_contacts_updated_at
BEFORE UPDATE ON public.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();