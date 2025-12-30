-- Create preferences table for housing preferences
CREATE TABLE IF NOT EXISTS public.preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  location TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  min_budget DECIMAL(10, 2),
  max_budget DECIMAL(10, 2),
  room_type TEXT CHECK (room_type IN ('private', 'shared', 'entire')),
  move_in_date DATE,
  lease_duration_months INTEGER,
  pets_allowed BOOLEAN,
  smoking_allowed BOOLEAN,
  cleanliness_level INTEGER CHECK (cleanliness_level >= 1 AND cleanliness_level <= 5),
  social_preference TEXT CHECK (social_preference IN ('social', 'quiet', 'balanced')),
  work_schedule TEXT,
  must_haves TEXT[], -- Array of must-have features
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON public.preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER set_preferences_updated_at
  BEFORE UPDATE ON public.preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS preferences_location_idx ON public.preferences(city, state);
CREATE INDEX IF NOT EXISTS preferences_budget_idx ON public.preferences(min_budget, max_budget);
CREATE INDEX IF NOT EXISTS preferences_room_type_idx ON public.preferences(room_type);

