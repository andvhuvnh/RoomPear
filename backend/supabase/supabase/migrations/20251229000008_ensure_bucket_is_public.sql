-- Ensure the profile-images bucket exists and is public
-- This migration updates the bucket to be public if it already exists

-- Update existing bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'profile-images';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true, -- Public bucket so images can be accessed via URL
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

