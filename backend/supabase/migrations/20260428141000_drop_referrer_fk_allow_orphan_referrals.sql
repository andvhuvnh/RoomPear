-- Allow referral pointer to remain even if referrer profile is deleted.
-- This intentionally permits orphan UUIDs in profiles.referred_by_user_id.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referred_by_user_id_fkey;

CREATE INDEX IF NOT EXISTS profiles_referred_by_user_id_idx
  ON public.profiles (referred_by_user_id);

COMMENT ON COLUMN public.profiles.referred_by_user_id IS
  'Referrer user id snapshot (FK intentionally removed to preserve referral linkage after referrer deletion).';
