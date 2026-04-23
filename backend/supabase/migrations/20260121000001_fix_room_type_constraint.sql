-- Fix room_type constraint to include 'flexible'
-- This ensures the constraint matches what the code is sending

ALTER TABLE public.preferences
  DROP CONSTRAINT IF EXISTS preferences_room_type_check;

ALTER TABLE public.preferences
  ADD CONSTRAINT preferences_room_type_check 
  CHECK (room_type IS NULL OR room_type IN ('private', 'shared', 'entire', 'flexible'));
