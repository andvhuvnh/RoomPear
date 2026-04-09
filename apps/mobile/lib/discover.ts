import { supabase } from './supabase';
import { getProfileImageUrls } from './storage';

export type DiscoverProfile = {
  id: string;
  name: string;
  age: number | null;
  bio: string | null;
  hobbies: string[] | null;
  photoUrls: string[];
  location: string;
};

export async function fetchDiscoverProfiles(
  userId: string,
  limit = 10
): Promise<DiscoverProfile[]> {
  // Get IDs the user has already swiped on
  const { data: swipedRows } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId);

  const swipedIds = swipedRows?.map((r: any) => r.swiped_id) ?? [];

  // Fetch other profiles, excluding self and already-swiped
  let query = supabase
    .from('profiles')
    .select('id, name, age, bio, hobbies, profile_photo_url, preferences(city, state)')
    .neq('id', userId)
    .not('profile_photo_url', 'is', null)
    .limit(limit);

  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.join(',')})`);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  const result: DiscoverProfile[] = [];

  for (const row of rows) {
    const urls = await getProfileImageUrls(row.profile_photo_url);
    if (!urls || urls.length === 0) continue;

    // Supabase returns 1:many as array even for 1:1 relationships
    const prefs = Array.isArray(row.preferences) ? row.preferences[0] : row.preferences;
    const city = prefs?.city?.trim() ?? '';
    const state = prefs?.state?.trim() ?? '';
    const location = city && state ? `${city}, ${state}` : city || state;

    result.push({
      id: row.id,
      name: row.name ?? 'Unknown',
      age: row.age ?? null,
      bio: row.bio ?? null,
      hobbies: row.hobbies ?? null,
      photoUrls: urls,
      location,
    });
  }

  return result;
}

export async function recordSwipe(
  swiperId: string,
  swipedId: string,
  direction: 'like' | 'pass'
): Promise<{ isMatch: boolean }> {
  await supabase.from('swipes').insert({
    swiper_id: swiperId,
    swiped_id: swipedId,
    direction,
  });

  if (direction !== 'like') return { isMatch: false };

  // Check if the other person already liked us back
  const { data } = await supabase
    .from('swipes')
    .select('id')
    .eq('swiper_id', swipedId)
    .eq('swiped_id', swiperId)
    .eq('direction', 'like')
    .maybeSingle();

  return { isMatch: !!data };
}
