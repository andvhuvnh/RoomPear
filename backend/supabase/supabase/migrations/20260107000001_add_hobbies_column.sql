-- Add hobbies column to profiles table
-- Hobbies will be stored as a JSON array of strings

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hobbies TEXT[];

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.hobbies IS 'Array of user hobbies and interests';

