
CREATE TABLE public.trip_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  route_type TEXT NOT NULL,
  total_distance DOUBLE PRECISION NOT NULL,
  time_taken INTEGER NOT NULL,
  safety_score INTEGER NOT NULL,
  alerts_raised INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trip history" ON public.trip_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own trip history" ON public.trip_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trip history" ON public.trip_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
