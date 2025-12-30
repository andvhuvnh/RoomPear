-- Add 'flexible' as a room type option
-- This allows users to indicate they're flexible about room type

ALTER TABLE public.preferences
  DROP CONSTRAINT IF EXISTS preferences_room_type_check;

ALTER TABLE public.preferences
  ADD CONSTRAINT preferences_room_type_check 
  CHECK (room_type IN ('private', 'shared', 'entire', 'flexible'));

