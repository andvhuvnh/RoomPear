-- Separate Discover deck filters from profile/onboarding dealbreakers.
-- Existing rows preserve prior Discover behavior by copying legacy dealbreakers into the deck filter column.

ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS discover_filter_dealbreakers jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.preferences
SET discover_filter_dealbreakers = COALESCE(dealbreakers, '{}'::jsonb)
WHERE dealbreakers IS NOT NULL
  AND dealbreakers::text NOT IN ('null', '{}');

COMMENT ON COLUMN public.preferences.dealbreakers IS 'Profile/onboarding declared dealbreakers (matching + incoming filters).';
COMMENT ON COLUMN public.preferences.discover_filter_dealbreakers IS 'Discover deck exclusions while swiping; premium-editable; independent of dealbreakers.';
