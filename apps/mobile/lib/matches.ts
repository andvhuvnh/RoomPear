import { supabase } from './supabase';
import { getProfileImageUrls } from './storage';

export type Match = {
  id: string;
  name: string;
  age: number | null;
  location: string;
  photoUrls: string[];
  matchedAt: string;
};

export async function fetchMatches(userId: string): Promise<Match[]> {
  // Get everyone the current user liked
  const { data: myLikes } = await supabase
    .from('swipes')
    .select('swiped_id, created_at')
    .eq('swiper_id', userId)
    .eq('direction', 'like');

  if (!myLikes || myLikes.length === 0) return [];

  const likedIds = myLikes.map((r: any) => r.swiped_id);

  // Of those, find who also liked the current user back
  const { data: mutualLikes } = await supabase
    .from('swipes')
    .select('swiper_id, created_at')
    .eq('swiped_id', userId)
    .eq('direction', 'like')
    .in('swiper_id', likedIds);

  if (!mutualLikes || mutualLikes.length === 0) return [];

  const matchedUserIds = mutualLikes.map((r: any) => r.swiper_id);

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
      mutualLikes.find((r: any) => r.swiper_id === profile.id)?.created_at ?? '';

    result.push({
      id: profile.id,
      name: profile.name ?? 'Unknown',
      age: profile.age ?? null,
      location,
      photoUrls: urls,
      matchedAt,
    });
  }

  // Most recent matches first
  result.sort((a, b) => b.matchedAt.localeCompare(a.matchedAt));

  return result;
}
