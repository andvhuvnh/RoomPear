/**
 * Preferences service for managing user housing preferences
 */

import { supabase } from './supabase';

export interface Preferences {
  user_id: string;
  location?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  min_budget?: number;
  max_budget?: number;
  room_type?: 'private' | 'shared' | 'either Private or Shared';
  move_in_date?: string;
  lease_duration_months?: number;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  cleanliness_level?: number;
  social_preference?: 'social' | 'quiet' | 'balanced';
  work_schedule?: string;
  must_haves?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Check if user has completed preferences
 */
export async function hasPreferences(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, means no preferences
      console.error('Error checking preferences:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking preferences:', error);
    return false;
  }
}

/**
 * Get user preferences
 */
export async function getPreferences(userId: string): Promise<Preferences | null> {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - user hasn't set preferences yet
        return null;
      }
      console.error('Error fetching preferences:', error);
      return null;
    }

    return data as Preferences;
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return null;
  }
}

/**
 * Save or update user preferences
 */
export async function savePreferences(
  userId: string,
  preferences: Partial<Preferences>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if preferences exist
    const existing = await hasPreferences(userId);

    if (existing) {
      // Update existing preferences
      const { error } = await supabase
        .from('preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating preferences:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Insert new preferences
      const { error } = await supabase
        .from('preferences')
        .insert({
          user_id: userId,
          ...preferences,
        });

      if (error) {
        console.error('Error creating preferences:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error saving preferences:', error);
    return { success: false, error: error.message };
  }
}

