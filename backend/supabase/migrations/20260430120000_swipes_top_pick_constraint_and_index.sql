-- App records direction 'top_pick'; original table only allowed like/pass.
ALTER TABLE public.swipes DROP CONSTRAINT IF EXISTS swipes_direction_check;
ALTER TABLE public.swipes
  ADD CONSTRAINT swipes_direction_check CHECK (direction IN ('like', 'pass', 'top_pick'));

-- Speed daily swipe / top-pick counts (swiper_id + UTC day window on created_at).
CREATE INDEX IF NOT EXISTS swipes_swiper_created_at_idx ON public.swipes (swiper_id, created_at);
