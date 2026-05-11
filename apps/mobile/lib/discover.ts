import { supabase } from './supabase';
import { getProfileImageUrls, getProfileImageUrl } from './storage';
import { getPreferences, type Preferences } from './preferences';
import { passesHardFilters, scoreCompatibility, applyWildcardMix, getMatchReasons } from './matching';
import { sendPushNotification } from './pushNotifications';

export type PromptEntry = { question: string; answer: string };

export type DiscoverProfile = {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  bio: string | null;
  hobbies: string[] | null;
  interests: Record<string, string[]>;  // grouped by category e.g. { fitness: ['Gym', 'Yoga'] }
  prompts: PromptEntry[];
  photoUrls: string[];         // profile photos + listing photos combined
  profilePhotoCount: number;   // split point: photoUrls[0..n-1] are profile, rest are listing
  location: string;
  hasListing: boolean;
  roomType: string | null;
  listingRoomType: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  compatibilityScore: number;  // 0–100, display as "XX% Match"
  matchReasons: string[];      // why these profiles match (premium display)
};

/** Returns candidate IDs from the server — nearby filtering, swipe exclusion, and block
 *  exclusion all handled in Postgres. Returns null on error (caller falls back gracefully). */
async function getCandidateIds(limit: number): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('get_discover_candidates', { p_limit: limit });
  if (error || !data) return null;
  return (data as { user_id: string }[]).map((r) => r.user_id);
}

export async function fetchDiscoverProfiles(
  userId: string,
  limit = 10,
  options?: {
    useAdvancedFilters?: boolean;
    isPremium?: boolean;
    /** Profiles already in the deck — excluded from this fetch to avoid duplicates. */
    excludeIds?: string[];
  }
): Promise<DiscoverProfile[]> {
  // Fetch viewer's prefs + server-side candidate IDs in parallel
  const [myPrefs, candidateIds] = await Promise.all([
    getPreferences(userId),
    getCandidateIds(limit),
  ]);

  // RPC returned empty — no one nearby / all swiped
  if (Array.isArray(candidateIds) && candidateIds.length === 0) return [];

  // Filter out profiles already in the deck (client-side excludeIds only — swipes/blocks are server-side)
  const deckExcludeSet = new Set(options?.excludeIds ?? []);
  const allowedIds = candidateIds?.filter((id) => !deckExcludeSet.has(id));

  // If RPC failed (null), fall back gracefully with no candidate filter
  let query = supabase
    .from('profiles')
    .select(
      'id, name, age, occupation, bio, hobbies, prompts, has_listing, profile_photo_url, subscription_tier, ethnicity, created_at, updated_at, last_active_at, ' +
      'preferences(city, state, min_budget, max_budget, cleanliness_level, social_preference, ' +
      'work_schedule, interests, dealbreakers, pets_allowed, smoking_allowed, room_type, move_in_date, search_lat, search_lng, ethnicity_preference)'
    )
    .neq('id', userId)
    .not('profile_photo_url', 'is', null)
    .neq('is_paused', true)
    .limit(50);

  if (myPrefs?.has_listing_only === true) {
    query = query.eq('has_listing', true);
  }

  if (myPrefs?.gender_preference) {
    query = query.or(`gender.eq.${myPrefs.gender_preference},gender.is.null`);
  }

  if (Array.isArray(allowedIds)) {
    if (allowedIds.length === 0) return [];
    query = query.in('id', allowedIds);
  }

  const { data: rows, error } = await query as any;
  if (error || !rows) return [];

  // Score each candidate, applying hard filters when we have preference data
  type ScoredRow = { row: typeof rows[0]; score: number; reasons: string[] };
  const scored: ScoredRow[] = [];

  for (const row of rows) {
    const theirPrefs = (
      Array.isArray(row.preferences) ? row.preferences[0] : row.preferences
    ) as Preferences | null;

    if (myPrefs && theirPrefs) {
      // Age hard filter
      if (myPrefs.min_age != null && myPrefs.max_age != null && row.age != null) {
        if (row.age < myPrefs.min_age || row.age > myPrefs.max_age) continue;
      }
      if (!passesHardFilters(myPrefs, theirPrefs, options?.isPremium ?? false)) continue;
      if (options?.useAdvancedFilters && !passesPremiumAdvancedFilters(myPrefs, theirPrefs)) {
        continue;
      }
      const theirMeta = {
        subscription_tier: row.subscription_tier,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_active_at: row.last_active_at,
        name: row.name,
        age: row.age,
        bio: row.bio,
        hobbies: row.hobbies,
        ethnicity: row.ethnicity,
      };
      const score = scoreCompatibility(myPrefs, theirPrefs, theirMeta, { has_listing_only: myPrefs.has_listing_only ?? false });
      const reasons = getMatchReasons(myPrefs, theirPrefs, theirMeta);
      scored.push({ row, score, reasons });
    } else {
      // No preferences data on one side — include with neutral score
      scored.push({ row, score: 0.5, reasons: [] });
    }
  }

  // Feed mixing: free 70/20/10, premium 85/10/5
  const reasonsByRow = new Map(scored.map(s => [s.row, s.reasons]));
  let mixed = applyWildcardMix(
    scored.map(s => ({ item: s.row, score: s.score })),
    Math.min(limit, scored.length),
    options?.isPremium ?? false,
  );

  // Ethnicity cap: no more than 75% of the feed should match the viewer's ethnicity preference.
  // This ensures diversity and prevents ethnicity from dominating the feed.
  const ethPref = myPrefs?.ethnicity_preference ?? [];
  if (ethPref.length > 0 && mixed.length > 0) {
    const CAP = 0.90;
    const maxEthMatch = Math.floor(mixed.length * CAP);
    const ethMatch = (eth: string | string[]) => Array.isArray(eth) ? eth.some(e => ethPref.includes(e)) : ethPref.includes(eth);
    let ethCount = mixed.filter(x => ethMatch(x.item.ethnicity)).length;
    if (ethCount > maxEthMatch) {
      // Swap excess ethnicity-matches with non-matching rows from scored pool
      const nonEthRows = scored
        .filter(s => !ethMatch(s.row.ethnicity) && !mixed.find(m => m.item === s.row))
        .sort((a, b) => b.score - a.score);
      const toSwap = ethCount - maxEthMatch;
      let swapped = 0;
      mixed = mixed.map(entry => {
        if (swapped >= toSwap) return entry;
        if (ethMatch(entry.item.ethnicity) && nonEthRows.length > 0) {
          const replacement = nonEthRows.shift()!;
          swapped++;
          return { item: replacement.row, score: replacement.score };
        }
        return entry;
      });
    }
  }

  // Load photos for all profiles in parallel to avoid sequential network stalls
  async function buildProfile(row: typeof rows[0], score: number): Promise<DiscoverProfile | null> {
    const prefs = (
      Array.isArray(row.preferences) ? row.preferences[0] : row.preferences
    ) as Preferences | null;

    const city = prefs?.city?.trim() ?? '';
    const state = prefs?.state?.trim() ?? '';
    const location = city && state ? `${city}, ${state}` : city || state;

    const interests: Record<string, string[]> = prefs?.interests ?? {};
    const interestChips = Object.values(interests).flat() as string[];
    const hobbies = interestChips.length > 0 ? null : (row.hobbies ?? null);

    let listingRoomType: string | null = null;
    const listingFetch: Promise<string[]> = row.has_listing === true
      ? (async () => {
          const { data: listing } = await supabase
            .from('listings')
            .select('listing_photos, room_type')
            .eq('user_id', row.id)
            .maybeSingle();
          listingRoomType = listing?.room_type ?? null;
          const paths: string[] = Array.isArray(listing?.listing_photos)
            ? listing.listing_photos
            : [];
          const signed = await Promise.all(paths.map((p: string) => getProfileImageUrl(p)));
          return signed.filter((u): u is string => u !== null);
        })()
      : Promise.resolve([]);

    const [urls, listingPhotoUrls] = await Promise.all([
      getProfileImageUrls(row.profile_photo_url),
      listingFetch,
    ]);

    if (!urls || urls.length === 0) return null;

    const prompts: PromptEntry[] = Array.isArray(row.prompts)
      ? row.prompts.filter((p: any) => p?.question && p?.answer)
      : [];

    return {
      id: row.id,
      name: row.name ?? 'Unknown',
      age: row.age ?? null,
      occupation: row.occupation ?? null,
      bio: row.bio ?? null,
      hobbies,
      interests,
      prompts,
      photoUrls: [...urls, ...listingPhotoUrls],
      profilePhotoCount: urls.length,
      hasListing: row.has_listing === true,
      location,
      roomType: prefs?.room_type ?? null,
      listingRoomType,
      minBudget: prefs?.min_budget ?? null,
      maxBudget: prefs?.max_budget ?? null,
      compatibilityScore: Math.min(100, Math.round(score * 100)),
      matchReasons: reasonsByRow.get(row) ?? [],
    };
  }

  const settled = await Promise.all(mixed.map(({ item: row, score }) => buildProfile(row, score)));
  return settled.filter((p): p is DiscoverProfile => p !== null);
}

function passesPremiumAdvancedFilters(mine: Preferences, theirs: Preferences): boolean {
  // Room type: if viewer is specific (non-flexible), require a compatible candidate room type.
  if (mine.room_type && mine.room_type !== 'flexible') {
    const candidateRoomType = theirs.room_type;
    if (
      candidateRoomType &&
      candidateRoomType !== 'flexible' &&
      candidateRoomType !== mine.room_type
    ) {
      return false;
    }
  }

  // Move-in date: keep candidates within a practical planning window.
  if (mine.move_in_date && theirs.move_in_date) {
    const mineTs = new Date(mine.move_in_date).getTime();
    const theirTs = new Date(theirs.move_in_date).getTime();
    const DAY_MS = 86_400_000;
    const maxGapDays = 60;
    if (
      Number.isFinite(mineTs) &&
      Number.isFinite(theirTs) &&
      Math.abs(mineTs - theirTs) > maxGapDays * DAY_MS
    ) {
      return false;
    }
  }

  // Discover deck filters: treat both hard and soft conflicts as excludes for premium layering.
  const mineDeckFilters = mine.discover_filter_dealbreakers ?? {};
  for (const [key, severity] of Object.entries(mineDeckFilters)) {
    if (severity !== 'hard' && severity !== 'soft') continue;
    if (key === 'smoking'    && theirs.smoking_allowed === true) return false;
    if (key === 'pets'       && theirs.pets_allowed === true) return false;
    if (key === 'early_bird' && theirs.work_schedule === 'Night Shift') return false;
    if (key === 'night_owl'  && theirs.work_schedule === '9-to-5') return false;
    if (key === 'messy'      && theirs.cleanliness_level != null && theirs.cleanliness_level <= 2) return false;
  }

  return true;
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

  if (isMatch) {
    // Fetch both names for the match notification
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', [swiperId, swipedId]);

    const swiperName = profiles?.find((p: any) => p.id === swiperId)?.name ?? 'Someone';
    const swipedName = profiles?.find((p: any) => p.id === swipedId)?.name ?? 'Someone';

    // Notify both users simultaneously
    sendPushNotification(swiperId, "It's a Match! 🍐", `You and ${swipedName} both want to be roommates!`);
    sendPushNotification(swipedId, "It's a Match! 🍐", `You and ${swiperName} both want to be roommates!`);
  } else {
    // Notify the person who was liked (don't reveal who liked them)
    sendPushNotification(swipedId, 'Someone liked your profile! 💚', 'Open RoomPear to see who it is.');
  }

  return { isMatch };
}
