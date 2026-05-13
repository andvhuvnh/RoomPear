import { supabase } from './supabase';
import { getProfileImageUrls, profilePhotoPrimaryCacheKey } from './storage';

export type Match = {
  id: string;
  name: string;
  age: number | null;
  location: string;
  photoUrls: string[];
  /** First photo; use with expo-image `cacheKey` when showing `photoUrls[0]`. */
  primaryPhotoCacheKey: string | null;
  matchedAt: string;
};

export async function fetchMatches(userId: string): Promise<Match[]> {
  // Mutual matches where no DM row exists yet. Opening chat creates the DM (both disappear
  // from Matches). Messages tab lists a thread only after at least one message.
  const { data: peerRows, error: rpcErr } = await supabase.rpc('match_peers_without_messages');
  if (rpcErr) {
    console.warn('fetchMatches: match_peers_without_messages', rpcErr.message);
    return [];
  }

  const matchedUserIds = (peerRows ?? []) as string[];
  if (matchedUserIds.length === 0) return [];

  const { data: mutualLikes } = await supabase
    .from('swipes')
    .select('swiper_id, created_at')
    .eq('swiped_id', userId)
    .in('direction', ['like', 'top_pick'])
    .in('swiper_id', matchedUserIds);

  // Fetch their profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, age, profile_photo_url, preferences(city, state)')
    .in('id', matchedUserIds);

  if (!profiles) return [];

  const result: Match[] = [];

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

    const matchedAt =
      (mutualLikes ?? []).find((r: any) => r.swiper_id === profile.id)?.created_at ?? '';

    result.push({
      id: profile.id,
      name: profile.name ?? 'Unknown',
      age: profile.age ?? null,
      location,
      photoUrls: urls,
      primaryPhotoCacheKey: profilePhotoPrimaryCacheKey(profile.profile_photo_url),
      matchedAt,
    });
  }

  // Most recent matches first
  result.sort((a, b) => b.matchedAt.localeCompare(a.matchedAt));

  return result;
}

const LIKE_DIRECTIONS = ['like', 'top_pick'] as const;

/** True when both users have a like/top_pick on each other (same rule as discover match). */
export async function areMutuallyMatched(currentUserId: string, otherUserId: string): Promise<boolean> {
  const { data: myLike, error: e1 } = await supabase
    .from('swipes')
    .select('id')
    .eq('swiper_id', currentUserId)
    .eq('swiped_id', otherUserId)
    .in('direction', [...LIKE_DIRECTIONS])
    .maybeSingle();

  if (e1 || !myLike) return false;

  const { data: theirLike, error: e2 } = await supabase
    .from('swipes')
    .select('id')
    .eq('swiper_id', otherUserId)
    .eq('swiped_id', currentUserId)
    .in('direction', [...LIKE_DIRECTIONS])
    .maybeSingle();

  if (e2 || !theirLike) return false;

  return true;
}
