-- Search area: map center + radius for roommate matching (US-focused flow)
ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS search_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS search_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS search_radius_miles DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS search_label TEXT;

COMMENT ON COLUMN public.preferences.search_lat IS 'WGS84 latitude of user search center (from Places or dragged pin)';
COMMENT ON COLUMN public.preferences.search_lng IS 'WGS84 longitude of user search center';
COMMENT ON COLUMN public.preferences.search_radius_miles IS 'Search radius in miles';
COMMENT ON COLUMN public.preferences.search_label IS 'Display label from Google Places (or user-confirmed area)';
