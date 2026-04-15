import { supabase } from './supabase';
import { getProfileImageUrls } from './storage';
import { getPreferences, type Preferences } from './preferences';
import { passesHardFilters, scoreCompatibility, applyWildcardMix } from './matching';

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
  // Fetch viewer's own preferences for filtering + scoring
  const myPrefs = await getPreferences(userId);

  // Get IDs the user has already swiped on
  const { data: swipedRows } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId);

  const swipedIds = swipedRows?.map((r: any) => r.swiped_id) ?? [];

  // Fetch a larger candidate pool so filtering still leaves enough results
  let query = supabase
    .from('profiles')
    .select(
      'id, name, age, bio, hobbies, profile_photo_url, subscription_tier, created_at, updated_at, ' +
      'preferences(city, state, min_budget, max_budget, cleanliness_level, social_preference, ' +
      'work_schedule, interests, dealbreakers, pets_allowed, smoking_allowed)'
    )
    .neq('id', userId)
    .not('profile_photo_url', 'is', null)
    .limit(50);

  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.join(',')})`);
  }

  const { data: rows, error } = await query as any;
  if (error || !rows) return [];

  // Score each candidate, applying hard filters when we have preference data
  type ScoredRow = { row: typeof rows[0]; score: number };
  const scored: ScoredRow[] = [];

  for (const row of rows) {
    const theirPrefs = (
      Array.isArray(row.preferences) ? row.preferences[0] : row.preferences
    ) as Preferences | null;

    if (myPrefs && theirPrefs) {
      if (!passesHardFilters(myPrefs, theirPrefs)) continue;
      const score = scoreCompatibility(myPrefs, theirPrefs, {
        subscription_tier: row.subscription_tier,
        created_at: row.created_at,
        updated_at: row.updated_at,
        name: row.name,
        age: row.age,
        bio: row.bio,
        hobbies: row.hobbies,
      });
      scored.push({ row, score });
    } else {
      // No preferences data on one side — include with neutral score
      scored.push({ row, score: 0.5 });
    }
  }

  // 80% top scorers + 20% wildcards, capped at limit
  const mixed = applyWildcardMix(
    scored.map(s => ({ item: s.row, score: s.score })),
    Math.min(limit, scored.length)
  );

  // Load photos and build the final list
  const result: DiscoverProfile[] = [];

  for (const row of mixed) {
    const urls = await getProfileImageUrls(row.profile_photo_url);
    if (!urls || urls.length === 0) continue;

    const prefs = (
      Array.isArray(row.preferences) ? row.preferences[0] : row.preferences
    ) as Preferences | null;

    const city = prefs?.city?.trim() ?? '';
    const state = prefs?.state?.trim() ?? '';
    const location = city && state ? `${city}, ${state}` : city || state;

    // Prefer flattened preferences.interests over legacy profiles.hobbies
    const interestChips = Object.values(prefs?.interests ?? {}).flat() as string[];
    const hobbies = interestChips.length > 0 ? interestChips : (row.hobbies ?? null);

    result.push({
      id: row.id,
      name: row.name ?? 'Unknown',
      age: row.age ?? null,
      bio: row.bio ?? null,
      hobbies,
      photoUrls: urls,
      location,
    });
  }

  return result;
}

export async function recordSwipe(
  swiperId: string,
  swipedId: string,
  direction: 'like' | 'pass' | 'top_pick'
): Promise<{ isMatch: boolean }> {
  await supabase.from('swipes').insert({
    swiper_id: swiperId,
    swiped_id: swipedId,
    direction,
  });

  // top_pick counts as a like for match detection
  if (direction !== 'like' && direction !== 'top_pick') return { isMatch: false };

  // Check if the other person already liked or top-picked us back
  const { data } = await supabase
    .from('swipes')
    .select('id')
    .eq('swiper_id', swipedId)
    .eq('swiped_id', swiperId)
    .in('direction', ['like', 'top_pick'])
    .maybeSingle();

  const isMatch = !!data;
  // Do not create a DM here — Matches stays visible until someone opens chat from Matches
  // (ensureMatchConversation). Messages list only shows threads after at least one message.

  return { isMatch };
}
