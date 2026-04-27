/**
 * Matching algorithm for RoomPear.
 *
 * 4 layers:
 *   1. Hard filters  — location (same state), budget overlap, hard dealbreakers
 *   2. Compatibility — Lifestyle 35% | Interests 30% | Budget 20% | Dealbreakers 15%
 *   3. Boost factors — profile completeness ×1.0–1.20 | premium ×1.10
 *                      new user <48 h ×1.15 | recently active <7 d ×1.05
 *   4. Wildcard mix  — 80% top scorers + 20% random from the rest
 */

import type { Preferences } from './preferences';

export interface ProfileMeta {
  subscription_tier?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  name?: string | null;
  age?: number | null;
  bio?: string | null;
  hobbies?: string[] | null;
  ethnicity?: string | null;
}

// ─── Hard filters ────────────────────────────────────────────────────────────

/**
 * Returns false if the candidate should be excluded from the deck entirely.
 */
export function passesHardFilters(mine: Preferences, theirs: Preferences): boolean {
  // Same state required (flexible for a small user base)
  if (mine.state && theirs.state) {
    if (mine.state.trim().toLowerCase() !== theirs.state.trim().toLowerCase()) {
      return false;
    }
  }

  // Budget ranges must overlap
  if (
    mine.min_budget != null && mine.max_budget != null &&
    theirs.min_budget != null && theirs.max_budget != null
  ) {
    const overlapMax = Math.min(mine.max_budget, theirs.max_budget);
    const overlapMin = Math.max(mine.min_budget, theirs.min_budget);
    if (overlapMax < overlapMin) return false;
  }

  // My hard dealbreakers vs their self-reported traits
  const myDealbreakers = mine.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(myDealbreakers)) {
    if (severity !== 'hard') continue;
    if (key === 'smoking' && theirs.smoking_allowed === true) return false;
    if (key === 'pets'    && theirs.pets_allowed    === true) return false;
  }

  // Their hard dealbreakers vs my self-reported traits (avoid wasted swipes)
  const theirDealbreakers = theirs.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(theirDealbreakers)) {
    if (severity !== 'hard') continue;
    if (key === 'smoking' && mine.smoking_allowed === true) return false;
    if (key === 'pets'    && mine.pets_allowed    === true) return false;
  }

  return true;
}

// ─── Compatibility score ──────────────────────────────────────────────────────

/**
 * Returns a raw compatibility score (0–1, higher = better).
 * Boost factors can push it above 1.
 */
export function scoreCompatibility(
  mine: Preferences,
  theirs: Preferences,
  theirMeta: ProfileMeta
): number {
  let score = 0;

  // ── Lifestyle (35%) ────────────────────────────────────────────────────────
  let lifestyleRaw = 0;
  let lifestyleWeightSum = 0;

  if (mine.cleanliness_level != null && theirs.cleanliness_level != null) {
    const diff = Math.abs(mine.cleanliness_level - theirs.cleanliness_level);
    lifestyleRaw += (1 - diff / 4) * 0.40;
    lifestyleWeightSum += 0.40;
  }
  if (mine.social_preference && theirs.social_preference) {
    lifestyleRaw += (mine.social_preference === theirs.social_preference ? 1 : 0) * 0.35;
    lifestyleWeightSum += 0.35;
  }
  if (mine.work_schedule && theirs.work_schedule) {
    lifestyleRaw += (mine.work_schedule === theirs.work_schedule ? 1 : 0) * 0.25;
    lifestyleWeightSum += 0.25;
  }

  // Neutral (0.5) when no lifestyle data available
  score += (lifestyleWeightSum > 0 ? lifestyleRaw / lifestyleWeightSum : 0.5) * 0.35;

  // ── Interests (30%) ────────────────────────────────────────────────────────
  const myInterests = flattenInterests(mine.interests);
  const theirInterests = flattenInterests(theirs.interests);

  if (myInterests.size > 0 && theirInterests.size > 0) {
    const intersection = new Set([...myInterests].filter(x => theirInterests.has(x)));
    const union = new Set([...myInterests, ...theirInterests]);
    score += (intersection.size / union.size) * 0.30;
  } else {
    score += 0.15; // neutral when no interests data
  }

  // ── Budget (20%) ───────────────────────────────────────────────────────────
  if (
    mine.min_budget != null && mine.max_budget != null &&
    theirs.min_budget != null && theirs.max_budget != null
  ) {
    const overlapMin = Math.max(mine.min_budget, theirs.min_budget);
    const overlapMax = Math.min(mine.max_budget, theirs.max_budget);
    const rangeMin = Math.min(mine.min_budget, theirs.min_budget);
    const rangeMax = Math.max(mine.max_budget, theirs.max_budget);
    const overlap = Math.max(0, overlapMax - overlapMin);
    const range = rangeMax - rangeMin;
    score += (range > 0 ? overlap / range : 1) * 0.20;
  } else {
    score += 0.10; // neutral
  }

  // ── Dealbreakers (15%) ─────────────────────────────────────────────────────
  let dealScore = 0.15;
  const myDealbreakers = mine.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(myDealbreakers)) {
    if (severity !== 'soft') continue;
    if (key === 'smoking' && theirs.smoking_allowed === true) dealScore -= 0.05;
    if (key === 'pets'    && theirs.pets_allowed    === true) dealScore -= 0.05;
  }
  // Also penalise if their soft dealbreakers conflict with my traits
  const theirDealbreakers = theirs.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(theirDealbreakers)) {
    if (severity !== 'soft') continue;
    if (key === 'smoking' && mine.smoking_allowed === true) dealScore -= 0.05;
    if (key === 'pets'    && mine.pets_allowed    === true) dealScore -= 0.05;
  }
  score += Math.max(0, dealScore);

  // ── Move-in date compatibility (soft boost) ────────────────────────────────
  if (mine.move_in_date && theirs.move_in_date) {
    const flexVals = ['flexible', 'Flexible'];
    const mineFlex = flexVals.includes(mine.move_in_date);
    const theirsFlex = flexVals.includes(theirs.move_in_date);
    if (mineFlex || theirsFlex || mine.move_in_date === theirs.move_in_date) {
      score += 0.04;
    }
  }

  // ── Lease duration compatibility (soft boost) ──────────────────────────────
  if (mine.lease_duration_months != null && theirs.lease_duration_months != null) {
    const mineFlex = mine.lease_duration_months === 0;
    const theirsFlex = theirs.lease_duration_months === 0;
    if (mineFlex || theirsFlex || mine.lease_duration_months === theirs.lease_duration_months) {
      score += 0.03;
    }
  }

  // ── Ethnicity preference (soft boost) ──────────────────────────────────────
  // Only applied when the viewer has set a preference — never hard-filters.
  const myEthPref = mine.ethnicity_preference ?? [];
  if (myEthPref.length > 0 && theirMeta.ethnicity) {
    if (myEthPref.includes(theirMeta.ethnicity)) score += 0.08;
  }

  // ── City match bonus ────────────────────────────────────────────────────────
  if (
    mine.city && theirs.city &&
    mine.city.trim().toLowerCase() === theirs.city.trim().toLowerCase()
  ) {
    score += 0.05;
  }

  // ── Boost factors ──────────────────────────────────────────────────────────

  // Profile completeness (like Hinge/CMB — rewards users who filled out their profile)
  // Max boost: ×1.20 for a fully completed profile
  const completeness = profileCompletenessBoost(theirMeta, theirs);
  score *= completeness;

  if (theirMeta.subscription_tier === 'premium') {
    score *= 1.10;
  }
  if (theirMeta.created_at) {
    const ageHours = (Date.now() - new Date(theirMeta.created_at).getTime()) / 3_600_000;
    if (ageHours < 48) score *= 1.15;
  }
  if (theirMeta.updated_at) {
    const idleDays = (Date.now() - new Date(theirMeta.updated_at).getTime()) / 86_400_000;
    if (idleDays < 7) score *= 1.05;
  }

  return score;
}

// ─── Profile completeness boost ──────────────────────────────────────────────

/**
 * Returns a multiplier between 1.0 and 1.20 based on how complete the profile is.
 * Incentivises users to fill out their profile — same signal Hinge/CMB use.
 *
 * Fields checked (each worth equal share of the 0.20 range):
 *   Profile: bio, hobbies (≥1), age
 *   Preferences: city/state, budget, cleanliness, social_preference, work_schedule, interests (≥1 category)
 */
function profileCompletenessBoost(meta: ProfileMeta, prefs: Preferences): number {
  const checks = [
    !!meta.bio?.trim(),
    Array.isArray(meta.hobbies) && meta.hobbies.length > 0,
    meta.age != null,
    !!(prefs.city?.trim()),
    prefs.min_budget != null && prefs.max_budget != null,
    prefs.cleanliness_level != null,
    !!prefs.social_preference,
    !!prefs.work_schedule,
    prefs.interests != null && Object.values(prefs.interests).some(v => v.length > 0),
  ];

  const filled = checks.filter(Boolean).length;
  const ratio = filled / checks.length; // 0 to 1
  return 1.0 + ratio * 0.20;            // 1.0 to 1.20
}

// ─── Wildcard mix ─────────────────────────────────────────────────────────────

/**
 * Returns `count` items: 80% from the top scorers, 20% random from the rest.
 * Prevents filter-bubble lock-in.
 */
export function applyWildcardMix<T>(
  scored: Array<{ item: T; score: number }>,
  count: number
): T[] {
  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  const topCount = Math.ceil(count * 0.8);
  const wildcardCount = count - topCount;

  const top = scored.slice(0, topCount).map(x => x.item);
  const rest = scored
    .slice(topCount)
    .sort(() => Math.random() - 0.5)
    .slice(0, wildcardCount)
    .map(x => x.item);

  return [...top, ...rest];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenInterests(interests?: Record<string, string[]>): Set<string> {
  if (!interests) return new Set();
  const all: string[] = [];
  for (const items of Object.values(interests)) {
    all.push(...items.map(s => s.toLowerCase().trim()));
  }
  return new Set(all);
}
