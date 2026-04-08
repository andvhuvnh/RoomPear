-- Make profile-images bucket private for better security
-- This migration updates the bucket to be private and restricts access to authenticated users only

-- Update bucket to be private
UPDATE storage.buckets
SET public = false
WHERE id = 'profile-images';

-- Drop the old public access policy
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

-- Create new policy: Only authenticated users can view profile images
-- This ensures that only logged-in users can access images, not random people on the internet
CREATE POLICY "Authenticated users can view profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-images');

-- Note: The existing policies for INSERT, UPDATE, and DELETE remain unchanged
-- They already restrict access to users' own files only

