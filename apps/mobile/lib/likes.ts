import { supabase } from './supabase';
import { getProfileImageUrls } from './storage';

export type Liker = {
  id: string;
  name: string;
  age: number | null;
  location: string;
  photoUrls: string[];
  likedAt: string;
};

/**
 * Returns profiles of people who liked/top-picked you but you haven't swiped back on yet.
 */
export async function fetchLikers(userId: string): Promise<Liker[]> {
  // Who liked me
  const { data: likeRows } = await supabase
    .from('swipes')
    .select('swiper_id, created_at')
    .eq('swiped_id', userId)
    .in('direction', ['like', 'top_pick']);

  if (!likeRows || likeRows.length === 0) return [];

  // Who I've already swiped back on
  const { data: mySwipes } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId);

  const alreadySwiped = new Set((mySwipes ?? []).map((r: any) => r.swiped_id));
  const pending = likeRows.filter((r: any) => !alreadySwiped.has(r.swiper_id));

  if (pending.length === 0) return [];

  const likerIds = pending.map((r: any) => r.swiper_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, age, profile_photo_url, preferences(city, state)')
    .in('id', likerIds);

  if (!profiles) return [];

  const result: Liker[] = [];

  for (const profile of profiles) {
    const urls = profile.profile_photo_url
      ? (await getProfileImageUrls(profile.profile_photo_url)) ?? []
      : [];

    const prefs = Array.isArray(profile.preferences)
      ? profile.preferences[0]
      : profile.preferences;
    const city = prefs?.city?.trim() ?? '';
    const state = prefs?.state?.trim() ?? '';
    const location = city && state ? `${city}, ${state}` : city || state;

    const row = pending.find((r: any) => r.swiper_id === profile.id);

    result.push({
      id: profile.id,
      name: profile.name ?? 'Unknown',
      age: profile.age ?? null,
      location,
      photoUrls: urls,
      likedAt: row?.created_at ?? '',
    });
  }

  // Most recent first
  result.sort((a, b) => b.likedAt.localeCompare(a.likedAt));

  return result;
}

/**
 * Attempts to use the daily free reveal.
 * Returns { success: true } if the reveal was granted,
 * or { success: false, reason: 'already_used' } if today's reveal is spent.
 */
export async function useDailyReveal(
  userId: string
): Promise<{ success: boolean; reason?: 'already_used' }> {
  const { data } = await supabase
    .from('profiles')
    .select('last_free_reveal_at')
    .eq('id', userId)
    .single();

  const lastReveal: string | null = data?.last_free_reveal_at ?? null;
  const todayStr = new Date().toDateString();

  if (lastReveal && new Date(lastReveal).toDateString() === todayStr) {
    return { success: false, reason: 'already_used' };
  }

  await supabase
    .from('profiles')
    .update({ last_free_reveal_at: new Date().toISOString() })
    .eq('id', userId);

  return { success: true };
}
