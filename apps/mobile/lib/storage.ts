/**
 * Storage service for handling file uploads to Supabase Storage
 * Uses private bucket with signed URLs for security
 */

import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

const PROFILE_IMAGES_BUCKET = 'profile-images';
// Signed URLs expire after 1 year (31536000 seconds)
// This is long enough for profile images but still provides security
const SIGNED_URL_EXPIRY = 31536000;

/**
 * Stable key for image caches (expo-image `cacheKey`). Supabase `createSignedUrl` returns a new
 * query string each call, so caching by full URI misses; use storage path instead.
 */
export function profilePhotoPrimaryCacheKey(
  profilePhotoUrl: string | null | undefined
): string | null {
  if (!profilePhotoUrl?.trim()) return null;
  const raw = profilePhotoUrl.trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed[0].split('?')[0] || null;
    }
  } catch {
    // not JSON — single path or URL
  }
  if (raw.startsWith('http')) {
    const urlParts = raw.split('/');
    const bucketIndex = urlParts.findIndex((part) => part === PROFILE_IMAGES_BUCKET);
    if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
      return urlParts.slice(bucketIndex + 1).join('/').split('?')[0];
    }
    const lastTwo = urlParts.slice(-2);
    if (lastTwo.length === 2) {
      return lastTwo.join('/').split('?')[0];
    }
  }
  return raw.split('?')[0];
}

/**
 * Verify that the storage bucket exists and is accessible
 * This is a helper function for debugging
 */
export async function verifyBucketAccess(): Promise<{ exists: boolean; isAccessible: boolean; error: string | null }> {
  try {
    // Try to list files in the bucket (requires authentication)
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .list('', { limit: 1 });

    if (error) {
      console.error('Bucket access error:', error);
      return { exists: false, isAccessible: false, error: error.message };
    }

    return { exists: true, isAccessible: true, error: null };
  } catch (error: any) {
    return { exists: false, isAccessible: false, error: error.message };
  }
}

/**
 * Get signed URLs for profile images (handles both single path and JSON array)
 * @param imagePathOrUrl - The file path, JSON array string, or full URL
 * @returns Array of signed URLs, or null if error
 */
export async function getProfileImageUrls(imagePathOrUrl: string | null | undefined): Promise<string[] | null> {
  if (!imagePathOrUrl) {
    return null;
  }

  try {
    // Check if it's a JSON array
    let paths: string[] = [];
    try {
      const parsed = JSON.parse(imagePathOrUrl);
      if (Array.isArray(parsed)) {
        paths = parsed;
      } else {
        // Single path
        paths = [imagePathOrUrl];
      }
    } catch {
      // Not JSON, treat as single path
      paths = [imagePathOrUrl];
    }

    // Generate signed URLs for all paths
    const signedUrls: string[] = [];
    for (const path of paths) {
      const url = await getProfileImageUrl(path);
      if (url) {
        signedUrls.push(url);
      }
    }

    return signedUrls.length > 0 ? signedUrls : null;
  } catch (error: any) {
    console.error('Error in getProfileImageUrls:', error);
    return null;
  }
}

/**
 * Get a signed URL for a profile image
 * This function extracts the file path from a stored URL or path and generates a signed URL
 * @param imagePathOrUrl - The file path (e.g., "userId/timestamp.jpg") or full URL
 * @returns The signed URL that expires after SIGNED_URL_EXPIRY seconds, or null if error
 */
export async function getProfileImageUrl(imagePathOrUrl: string | null | undefined): Promise<string | null> {
  if (!imagePathOrUrl) {
    return null;
  }

  try {
    // Extract file path from URL if it's a full URL
    let filePath = imagePathOrUrl;

    // If it's a full URL, try to extract the path
    if (imagePathOrUrl.startsWith('http')) {
      // Check if it's already a signed URL (contains query params)
      if (imagePathOrUrl.includes('?')) {
        // It's already a signed URL, return as-is (but it might be expired)
        // For better security, we could regenerate it, but for now return it
        return imagePathOrUrl;
      }

      // Extract path from public URL format
      const urlParts = imagePathOrUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part === PROFILE_IMAGES_BUCKET);
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        // Get everything after the bucket name, remove query params if any
        filePath = urlParts.slice(bucketIndex + 1).join('/').split('?')[0];
      } else {
        // Try to extract userId/filename pattern from end of URL
        const lastTwoParts = urlParts.slice(-2);
        if (lastTwoParts.length === 2) {
          filePath = lastTwoParts.join('/').split('?')[0];
        }
      }
    }

    // Generate signed URL (createSignedUrl is async)
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error || !data) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Upload a profile image for a user
 * @param userId - The user's ID
 * @param imageUri - Local URI of the image to upload
 * @returns The file path (e.g., "userId/timestamp.jpg") to store in database, or null if error
 */
export async function uploadProfileImage(
  userId: string,
  imageUri: string
): Promise<{ path: string | null; error: string | null }> {
  try {
    // Create a unique filename: userId/timestamp.jpg
    const timestamp = Date.now();
    // Extract file extension from URI or default to jpg
    const uriParts = imageUri.split('.');
    const fileExt = uriParts.length > 1 ? uriParts.pop()?.toLowerCase() || 'jpg' : 'jpg';
    const fileName = `${userId}/${timestamp}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log('Uploading image:', { userId, filePath, imageUri });

    // Read file as base64 using expo-file-system
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('File read as base64, length:', base64.length);

    if (!base64 || base64.length === 0) {
      throw new Error('File is empty or could not be read');
    }

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const arrayBuffer = bytes.buffer;
    console.log('ArrayBuffer created:', { size: arrayBuffer.byteLength, bytesLength: bytes.length });

    // Determine content type
    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    // Upload ArrayBuffer directly to Supabase Storage
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Error uploading image:', error);
      return { path: null, error: error.message };
    }

    console.log('Upload successful, data:', data);

    // Return the file path (not a URL) - we'll generate signed URLs when displaying
    const finalPath = data?.path || filePath;
    console.log('File path stored:', finalPath);

    // Verify the file actually exists by trying to list it
    const { data: listData, error: listError } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .list(userId, {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.warn('Could not verify file exists:', listError);
    } else {
      const fileExists = listData?.some(file => file.name === `${timestamp}.${fileExt}`);
      console.log('File verification:', { fileExists, files: listData?.map(f => f.name) });
      if (!fileExists) {
        console.error('⚠️ File was uploaded but not found in listing!');
      }
    }

    return { path: finalPath, error: null };
  } catch (error: any) {
    console.error('Error in uploadProfileImage:', error);
    return { path: null, error: error.message || 'Failed to upload image' };
  }
}

/**
 * Delete a user's profile image
 * @param userId - The user's ID
 * @param imagePathOrUrl - The file path or URL of the image to delete
 */
export async function deleteProfileImage(
  userId: string,
  imagePathOrUrl: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Extract file path from URL or use path directly
    let filePath = imagePathOrUrl;
    
    // If it's a full URL, extract the path
    if (imagePathOrUrl.startsWith('http')) {
      const urlParts = imagePathOrUrl.split('/');
      // Try to find the path after the bucket name
      const bucketIndex = urlParts.findIndex(part => part === PROFILE_IMAGES_BUCKET);
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        filePath = urlParts.slice(bucketIndex + 1).join('/');
        // Remove query params if it's a signed URL
        filePath = filePath.split('?')[0];
      } else {
        // Fallback: use last two parts
        const lastTwoParts = urlParts.slice(-2);
        if (lastTwoParts.length === 2) {
          filePath = lastTwoParts.join('/');
          filePath = filePath.split('?')[0]; // Remove query params
        }
      }
    }

    const { error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in deleteProfileImage:', error);
    return { success: false, error: error.message || 'Failed to delete image' };
  }
}

/**
 * Request permissions and pick an image from the device
 * @returns The selected image URI, or null if cancelled/error
 */
export async function pickImage(): Promise<string | null> {
  try {
    // Request camera roll permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Sorry, we need camera roll permissions to upload profile pictures!'
      );
      return null;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', // Use string literal instead of enum
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8, // Compress image
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error: any) {
    console.error('Error picking image:', error);
    return null;
  }
}

/**
 * Upload a listing photo for a user
 * Stored under userId/listings/timestamp.ext in the profile-images bucket
 */
export async function uploadListingPhoto(
  userId: string,
  imageUri: string
): Promise<{ path: string | null; error: string | null }> {
  try {
    const timestamp = Date.now();
    const uriParts = imageUri.split('.');
    const fileExt = uriParts.length > 1 ? uriParts.pop()?.toLowerCase() || 'jpg' : 'jpg';
    const filePath = `${userId}/listings/${timestamp}.${fileExt}`;

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length === 0) throw new Error('File is empty');

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .upload(filePath, bytes.buffer, { contentType, upsert: true, cacheControl: '3600' });

    if (error) return { path: null, error: error.message };
    return { path: data?.path || filePath, error: null };
  } catch (error: any) {
    return { path: null, error: error.message || 'Failed to upload listing photo' };
  }
}

/**
 * Pick a listing photo (4:3 aspect ratio)
 */
export async function pickListingImage(): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload listing photos.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  } catch {
    return null;
  }
}

/**
 * Take a photo with the camera
 * @returns The captured image URI, or null if cancelled/error
 */
export async function takePhoto(): Promise<string | null> {
  try {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Sorry, we need camera permissions to take photos!'
      );
      return null;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error: any) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Upload profile image and update user profile in one step
 * @param userId - The user's ID
 * @param imageUri - Local URI of the image to upload
 * @returns The file path stored in database, or null if error
 */
export async function uploadAndUpdateProfileImage(
  userId: string,
  imageUri: string
): Promise<{ path: string | null; error: string | null }> {
  try {
    // Upload the image
    const { path, error: uploadError } = await uploadProfileImage(userId, imageUri);
    
    if (uploadError || !path) {
      return { path: null, error: uploadError || 'Failed to upload image' };
    }

    // Update the profile with the file path (not a URL)
    // We'll generate signed URLs when displaying images
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_photo_url: path })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // Image was uploaded but profile update failed - try to clean up
      await deleteProfileImage(userId, path);
      return { path: null, error: updateError.message };
    }

    return { path, error: null };
  } catch (error: any) {
    console.error('Error in uploadAndUpdateProfileImage:', error);
    return { path: null, error: error.message || 'Failed to upload and update profile image' };
  }
}

