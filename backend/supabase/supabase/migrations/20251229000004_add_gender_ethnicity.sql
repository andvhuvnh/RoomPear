-- Add gender and ethnicity fields to profiles table
-- These are optional fields for user profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- Add check constraint for gender (optional, but helps with data consistency)
-- You can customize these options based on your needs
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_gender_check CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say', 'other'));

