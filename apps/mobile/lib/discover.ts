import { supabase } from './supabase';
import { getProfileImageUrls, getProfileImageUrl } from './storage';
import { getPreferences, type Preferences } from './preferences';
import { passesHardFilters, scoreCompatibility, applyWildcardMix } from './matching';
import { sendPushNotification } from './pushNotifications';
import { isWithinRadiusMiles } from './distance';
import { getBlockedIds } from './blockReport';

export type PromptEntry = { question: string; answer: string };

export type DiscoverProfile = {
  id: string;
  name: string;
  age: number | null;
  bio: string | null;
  hobbies: string[] | null;
  interests: Record<string, string[]>;  // grouped by category e.g. { fitness: ['Gym', 'Yoga'] }
  prompts: PromptEntry[];
  photoUrls: string[];         // profile photos + listing photos combined
  profilePhotoCount: number;   // split point: photoUrls[0..n-1] are profile, rest are listing
  location: string;
  hasListing: boolean;
  roomType: string | null;
  maxBudget: number | null;
};

type PreferenceCoordinateRow = {
  user_id: string;
  search_lat: number | null;
  search_lng: number | null;
};

type NearbyRpcRow = {
  user_id: string;
  distance_miles: number;
};

async function getNearbyCandidateIdsViaRpc(): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('get_nearby_preference_user_ids');

  if (error || !data) {
    return null;
  }

  const nearbyRows = data as NearbyRpcRow[];
  return nearbyRows.map((row) => row.user_id);
}

async function getNearbyCandidateIds(
  viewerId: string,
  viewerPreferences: Preferences | null
): Promise<string[] | null> {
  const centerLat = viewerPreferences?.search_lat;
  const centerLng = viewerPreferences?.search_lng;
  const radiusMiles = viewerPreferences?.search_radius_miles;

  // If the viewer has no location/radius configured, skip distance filtering.
  if (
    centerLat == null ||
    centerLng == null ||
    radiusMiles == null ||
    !Number.isFinite(radiusMiles) ||
    radiusMiles <= 0
  ) {
    return null;
  }

  const rpcNearbyIds = await getNearbyCandidateIdsViaRpc();
  if (Array.isArray(rpcNearbyIds)) {
    return rpcNearbyIds;
  }

  const { data, error } = await supabase
    .from('preferences')
    .select('user_id, search_lat, search_lng')
    .neq('user_id', viewerId)
    .not('search_lat', 'is', null)
    .not('search_lng', 'is', null);

  if (error || !data) {
    return null;
  }

  const center = { lat: centerLat, lng: centerLng };
  const nearbyIds: string[] = [];

  for (const row of data as PreferenceCoordinateRow[]) {
    if (row.search_lat == null || row.search_lng == null) continue;
    const withinRadius = isWithinRadiusMiles(
      center,
      { lat: row.search_lat, lng: row.search_lng },
      radiusMiles
    );
    if (withinRadius) nearbyIds.push(row.user_id);
  }

  return nearbyIds;
}

export async function fetchDiscoverProfiles(
  userId: string,
  limit = 10,
  options?: { useAdvancedFilters?: boolean; isPremium?: boolean }
): Promise<DiscoverProfile[]> {
  // Fetch viewer's own preferences for filtering + scoring
  const myPrefs = await getPreferences(userId);
  const nearbyIds = await getNearbyCandidateIds(userId, myPrefs);

  if (Array.isArray(nearbyIds) && nearbyIds.length === 0) {
    return [];
  }

  // Get IDs the user has already swiped on + blocked (either direction)
  const [{ data: swipedRows }, blockedIds] = await Promise.all([
    supabase.from('swipes').select('swiped_id').eq('swiper_id', userId),
    getBlockedIds(userId),
  ]);

  const swipedIds = swipedRows?.map((r: any) => r.swiped_id) ?? [];
  const excludedIds = Array.from(new Set([...swipedIds, ...blockedIds]));

  // Fetch a larger candidate pool so filtering still leaves enough results
  let query = supabase
    .from('profiles')
    .select(
      'id, name, age, bio, hobbies, prompts, has_listing, profile_photo_url, subscription_tier, ethnicity, created_at, updated_at, last_active_at, ' +
      'preferences(city, state, min_budget, max_budget, cleanliness_level, social_preference, ' +
      'work_schedule, interests, dealbreakers, pets_allowed, smoking_allowed, room_type, move_in_date, lease_duration_months, search_lat, search_lng, ethnicity_preference)'
    )
    .neq('id', userId)
    .not('profile_photo_url', 'is', null)
    .neq('is_paused', true)
    .limit(50);

  if (myPrefs?.has_listing_only === true) {
    query = query.eq('has_listing', true);
  }

  if (myPrefs?.gender_preference) {
    query = query.eq('gender', myPrefs.gender_preference);
  }

  if (excludedIds.length > 0) {
    query = query.not('id', 'in', `(${excludedIds.join(',')})`);
  }

  if (Array.isArray(nearbyIds)) {
    query = query.in('id', nearbyIds);
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
      // Age hard filter
      if (myPrefs.min_age != null && myPrefs.max_age != null && row.age != null) {
        if (row.age < myPrefs.min_age || row.age > myPrefs.max_age) continue;
      }
      if (!passesHardFilters(myPrefs, theirPrefs, options?.isPremium ?? false)) continue;
      if (options?.useAdvancedFilters && !passesPremiumAdvancedFilters(myPrefs, theirPrefs)) {
        continue;
      }
      const score = scoreCompatibility(myPrefs, theirPrefs, {
        subscription_tier: row.subscription_tier,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_active_at: row.last_active_at,
        name: row.name,
        age: row.age,
        bio: row.bio,
        hobbies: row.hobbies,
        ethnicity: row.ethnicity,
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

    const interests: Record<string, string[]> = prefs?.interests ?? {};
    const interestChips = Object.values(interests).flat() as string[];
    const hobbies = interestChips.length > 0 ? null : (row.hobbies ?? null);

    // Fetch listing photos if this user has a place listed
    let listingPhotoUrls: string[] = [];
    if (row.has_listing === true) {
      const { data: listing } = await supabase
        .from('listings')
        .select('listing_photos')
        .eq('user_id', row.id)
        .maybeSingle();

      const paths: string[] = Array.isArray(listing?.listing_photos)
        ? listing.listing_photos
        : [];

      const signed = await Promise.all(paths.map(p => getProfileImageUrl(p)));
      listingPhotoUrls = signed.filter((u): u is string => u !== null);
    }

    const prompts: PromptEntry[] = Array.isArray(row.prompts)
      ? row.prompts.filter((p: any) => p?.question && p?.answer)
      : [];

    result.push({
      id: row.id,
      name: row.name ?? 'Unknown',
      age: row.age ?? null,
      bio: row.bio ?? null,
      hobbies,
      interests,
      prompts,
      photoUrls: [...urls, ...listingPhotoUrls],
      profilePhotoCount: urls.length,
      hasListing: row.has_listing === true,
      location,
      roomType: prefs?.room_type ?? null,
      maxBudget: prefs?.max_budget ?? null,
    });
  }

  return result;
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

  // Dealbreakers: for premium filtering, treat both hard and soft conflicts as excludes.
  const mineDealbreakers = mine.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(mineDealbreakers)) {
    if (severity !== 'hard' && severity !== 'soft') continue;
    if (key === 'smoking' && theirs.smoking_allowed === true) return false;
    if (key === 'pets' && theirs.pets_allowed === true) return false;
  }

  const theirDealbreakers = theirs.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(theirDealbreakers)) {
    if (severity !== 'hard' && severity !== 'soft') continue;
    if (key === 'smoking' && mine.smoking_allowed === true) return false;
    if (key === 'pets' && mine.pets_allowed === true) return false;
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
