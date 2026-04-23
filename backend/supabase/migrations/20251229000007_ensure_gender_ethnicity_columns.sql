-- Ensure gender and ethnicity columns exist in profiles table
-- This migration explicitly adds the columns if they don't exist
-- and helps refresh the PostgREST schema cache

DO $$ 
BEGIN
  -- Add gender column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN gender TEXT;
  END IF;

  -- Add ethnicity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'ethnicity'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN ethnicity TEXT;
  END IF;
END $$;

