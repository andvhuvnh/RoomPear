-- Persist revealed liker cards so reveals do not expire between sessions.
-- A reveal remains until that liker leaves Likes flow (e.g. you swipe back and match).

CREATE TABLE IF NOT EXISTS public.like_reveals (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, liker_id)
);

CREATE INDEX IF NOT EXISTS like_reveals_liker_idx
  ON public.like_reveals (liker_id);

ALTER TABLE public.like_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own like reveals"
  ON public.like_reveals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own like reveals"
  ON public.like_reveals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own like reveals"
  ON public.like_reveals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
