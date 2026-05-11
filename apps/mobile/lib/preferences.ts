/**
 * Preferences service for managing user housing preferences
 */

import { supabase } from './supabase';

/**
 * preferences.user_id FK → profiles.id. If the auth trigger didn't create a row,
 * inserts would fail with 23503. Ensures a minimal profile exists before first preferences insert.
 */
async function ensureProfileExists(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr.message };
  }
  if (existing) {
    return { ok: true };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user || user.id !== userId) {
    return { ok: false, error: 'Not signed in' };
  }

  const { error: insErr } = await supabase.from('profiles').insert({
    id: userId,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string | undefined) ?? user.email ?? 'User',
    phone: (user.user_metadata?.phone as string | undefined) ?? '000-000-0000',
  });

  if (insErr) {
    // Race with handle_new_user or retry after concurrent create
    if (insErr.code === '23505') {
      return { ok: true };
    }
    return { ok: false, error: insErr.message };
  }

  return { ok: true };
}

export interface Preferences {
  user_id: string;
  location?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  /** WGS84 — search center from Google Places + Mapbox pin */
  search_lat?: number;
  search_lng?: number;
  search_radius_miles?: number;
  search_label?: string;
  min_budget?: number;
  max_budget?: number;
  room_type?: 'private' | 'shared' | 'flexible' | 'entire';
  move_in_date?: string;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  cleanliness_level?: number;
  social_preference?: 'social' | 'quiet' | 'balanced';
  work_schedule?: string;
  must_haves?: string[];
  interests?: Record<string, string[]>;
  /** Declared on profile + onboarding — used for compatibility scoring and when others swipe on you */
  dealbreakers?: Record<string, 'hard' | 'soft' | 'none'>;
  /** Premium Discover deck filters only — excludes candidates while swiping; independent of profile dealbreakers */
  discover_filter_dealbreakers?: Record<string, 'hard' | 'soft' | 'none'>;
  ethnicity_preference?: string[];
  gender_preference?: string;
  has_listing_only?: boolean;
  min_age?: number;
  max_age?: number;
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
    // Map room_type value to match database constraint
    // Database allows: 'private', 'shared', 'entire', 'flexible'
    const mappedPreferences = { ...preferences };
    const roomTypeValue = mappedPreferences.room_type as string | undefined;
    
    if (roomTypeValue) {
      const normalizedValue = roomTypeValue.trim().toLowerCase();
      if (normalizedValue.includes('either') ||
          roomTypeValue === 'either Private or Shared' ||
          roomTypeValue === 'Either Private or Shared') {
        mappedPreferences.room_type = 'flexible';
      } else if (!['private', 'shared', 'entire', 'flexible'].includes(roomTypeValue)) {
        mappedPreferences.room_type = undefined;
      }
    }

    // Check if preferences exist
    const existing = await hasPreferences(userId);

    if (existing) {
      // Update existing preferences
      const { error } = await supabase
        .from('preferences')
        .update({
          ...mappedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating preferences:', error);
        return { success: false, error: error.message };
      }
    } else {
      const ensured = await ensureProfileExists(userId);
      if (!ensured.ok) {
        console.error('Error ensuring profile before preferences:', ensured.error);
        return { success: false, error: ensured.error ?? 'Could not create profile' };
      }

      const { error } = await supabase
        .from('preferences')
        .insert({
          user_id: userId,
          ...mappedPreferences,
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

