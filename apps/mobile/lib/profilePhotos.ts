/**
 * Shared profile photo path updates (Supabase + storage).
 * Used by Home (edit photos) and ProfileCardScreen (first-time upload).
 */

import { supabase } from './supabase';
import { uploadProfileImage, deleteProfileImage } from './storage';
import { profilePhotoPathsFromRow } from './profileDisplay';

export const MIN_PROFILE_PHOTOS = 3;
export const MAX_PROFILE_PHOTOS = 6;

export async function getPhotoPathsForUser(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('profile_photo_url')
    .eq('id', userId)
    .single();
  return profilePhotoPathsFromRow(data?.profile_photo_url);
}

/**
 * Upload local images and merge paths into profiles.profile_photo_url (after existing paths).
 */
export async function uploadStagedPhotosAndMerge(
  userId: string,
  localUris: string[]
): Promise<{ ok: boolean; error?: string }> {
  const uploadedPaths: string[] = [];
  for (const uri of localUris) {
    const { path, error } = await uploadProfileImage(userId, uri);
    if (error || !path) {
      return { ok: false, error: error ?? 'Upload failed' };
    }
    uploadedPaths.push(path);
  }
  const existing = await getPhotoPathsForUser(userId);
  const merged = [...existing, ...uploadedPaths].slice(0, MAX_PROFILE_PHOTOS);
  const { error } = await supabase
    .from('profiles')
    .update({ profile_photo_url: JSON.stringify(merged) })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Add one photo (already used on Home). */
export async function appendProfilePhoto(
  userId: string,
  imageUri: string
): Promise<{ ok: boolean; error?: string }> {
  const paths = await getPhotoPathsForUser(userId);
  if (paths.length >= MAX_PROFILE_PHOTOS) {
    return { ok: false, error: 'Maximum photos' };
  }
  const { path, error } = await uploadProfileImage(userId, imageUri);
  if (error || !path) return { ok: false, error: error ?? 'Upload failed' };
  const next = [...paths, path].slice(0, MAX_PROFILE_PHOTOS);
  const { error: upErr } = await supabase
    .from('profiles')
    .update({ profile_photo_url: JSON.stringify(next) })
    .eq('id', userId);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}

/** Replace photo at index with a new image; no count change. */
export async function replaceProfilePhotoAt(
  userId: string,
  index: number,
  imageUri: string
): Promise<{ ok: boolean; error?: string }> {
  const paths = await getPhotoPathsForUser(userId);
  if (index < 0 || index >= paths.length) {
    return { ok: false, error: 'Invalid photo' };
  }
  const { path, error } = await uploadProfileImage(userId, imageUri);
  if (error || !path) return { ok: false, error: error ?? 'Upload failed' };
  const removed = paths[index];
  const next = paths.map((p, i) => (i === index ? path : p));
  const { error: upErr } = await supabase
    .from('profiles')
    .update({ profile_photo_url: JSON.stringify(next) })
    .eq('id', userId);
  if (upErr) return { ok: false, error: upErr.message };
  // Delete old file after DB is updated so we never lose the reference
  await deleteProfileImage(userId, removed);
  return { ok: true };
}

/** Remove photo by index; enforces MIN_PROFILE_PHOTOS. */
export async function removeProfilePhotoAt(
  userId: string,
  index: number
): Promise<{ ok: boolean; error?: string }> {
  const paths = await getPhotoPathsForUser(userId);
  if (index < 0 || index >= paths.length) {
    return { ok: false, error: 'Invalid photo' };
  }
  const next = paths.filter((_, i) => i !== index);
  if (next.length < MIN_PROFILE_PHOTOS) {
    return {
      ok: false,
      error: `Keep at least ${MIN_PROFILE_PHOTOS} photos`,
    };
  }
  const removed = paths[index];
  await deleteProfileImage(userId, removed);
  const { error } = await supabase
    .from('profiles')
    .update({ profile_photo_url: JSON.stringify(next) })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
