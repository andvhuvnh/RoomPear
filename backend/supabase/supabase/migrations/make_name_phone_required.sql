-- Make name and phone required fields in profiles table
-- This migration updates the schema to enforce mandatory name and phone

-- First, update existing NULL values (if any) - set defaults for existing records
UPDATE public.profiles
SET name = COALESCE(name, email)
WHERE name IS NULL;

UPDATE public.profiles
SET phone = COALESCE(phone, '000-000-0000')
WHERE phone IS NULL;

-- Now make the columns NOT NULL
ALTER TABLE public.profiles
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;

-- Update the trigger function to include phone number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', '000-000-0000')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

