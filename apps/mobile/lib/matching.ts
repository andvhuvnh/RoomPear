/**
 * RoomPear matching algorithm.
 *
 * Layers:
 *   1. Hard filters  — location, budget, age, Discover deck filters (not others' profile dealbreakers)
 *   2. Compatibility — Lifestyle 35% | Interests 30% | Budget 20% | Dealbreakers 15%
 *   3. Boost factors — completeness, premium, new user, recently active, city, listing
 *   4. Feed mixing   — free: 70/20/10 | premium: 85/10/5 (with score thresholds + fallback)
 */

import type { Preferences } from './preferences';

export interface ProfileMeta {
  subscription_tier?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_active_at?: string | null;
  name?: string | null;
  age?: number | null;
  bio?: string | null;
  hobbies?: string[] | null;
  ethnicity?: string | null;
  has_listing?: boolean | null;
  prompts?: Array<{ question: string; answer: string }> | null;
}

// ─── Hard filters ─────────────────────────────────────────────────────────────

/**
 * Returns false if the candidate should be excluded from the deck entirely.
 * Only the swiper's Discover filters (`discover_filter_dealbreakers`) apply dealbreaker-style deck cuts.
 * Candidates' profile `dealbreakers` do not remove them from the swiper's deck (they still affect match score).
 * isPremium: pets/smoking hard deck filters apply only when the swiper has premium Discover access.
 */
export function passesHardFilters(mine: Preferences, theirs: Preferences, isPremium = false): boolean {
  // State match (location fallback when no radius is set)
  if (mine.state && theirs.state) {
    if (mine.state.trim().toLowerCase() !== theirs.state.trim().toLowerCase()) return false;
  }

  // Budget overlap
  if (mine.min_budget != null && mine.max_budget != null &&
      theirs.min_budget != null && theirs.max_budget != null) {
    if (Math.min(mine.max_budget, theirs.max_budget) < Math.max(mine.min_budget, theirs.min_budget)) return false;
  }

  // My Discover filters (deck query) — excludes candidates; pets/smoking exclusions only when premium swiper
  const myDeck = mine.discover_filter_dealbreakers ?? {};
  for (const [key, severity] of Object.entries(myDeck)) {
    if (severity !== 'hard') continue;
    if (key === 'smoking'    && theirs.smoking_allowed === true) {
      if (!isPremium) continue;
      return false;
    }
    if (key === 'pets'       && theirs.pets_allowed    === true) {
      if (!isPremium) continue;
      return false;
    }
    if (key === 'parties'    && theirs.social_preference === 'social') return false;
    if (key === 'early_bird' && theirs.work_schedule === 'Night Shift') return false;
    if (key === 'night_owl'  && theirs.work_schedule === '9-to-5') return false;
    if (key === 'messy'      && theirs.cleanliness_level != null && theirs.cleanliness_level <= 2) return false;
  }

  return true;
}

// ─── Compatibility score ──────────────────────────────────────────────────────

/**
 * Returns a compatibility score (0–1+). Boost factors can push it above 1.
 * Convert to display % with: Math.min(100, Math.round(score * 100))
 */
export function scoreCompatibility(
  mine: Preferences,
  theirs: Preferences,
  theirMeta: ProfileMeta,
  myMeta?: { has_listing_only?: boolean },
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
    lifestyleRaw += socialPreferenceScore(mine.social_preference, theirs.social_preference) * 0.35;
    lifestyleWeightSum += 0.35;
  }
  if (mine.work_schedule && theirs.work_schedule) {
    lifestyleRaw += workScheduleScore(mine.work_schedule, theirs.work_schedule) * 0.25;
    lifestyleWeightSum += 0.25;
  }

  score += (lifestyleWeightSum > 0 ? lifestyleRaw / lifestyleWeightSum : 0.5) * 0.35;

  // ── Interests (30%) ────────────────────────────────────────────────────────
  const myInterests = flattenInterests(mine.interests);
  const theirInterests = flattenInterests(theirs.interests);

  if (myInterests.size > 0 && theirInterests.size > 0) {
    const intersection = new Set([...myInterests].filter(x => theirInterests.has(x)));
    const union = new Set([...myInterests, ...theirInterests]);
    score += (intersection.size / union.size) * 0.30;
  } else {
    score += 0.15; // neutral fallback
  }

  // ── Budget (20%) ───────────────────────────────────────────────────────────
  if (mine.min_budget != null && mine.max_budget != null &&
      theirs.min_budget != null && theirs.max_budget != null) {
    const overlapMin = Math.max(mine.min_budget, theirs.min_budget);
    const overlapMax = Math.min(mine.max_budget, theirs.max_budget);
    const rangeMin   = Math.min(mine.min_budget, theirs.min_budget);
    const rangeMax   = Math.max(mine.max_budget, theirs.max_budget);
    const overlap    = Math.max(0, overlapMax - overlapMin);
    const range      = rangeMax - rangeMin;
    score += (range > 0 ? overlap / range : 1) * 0.20;
  } else {
    score += 0.10;
  }

  // ── Dealbreakers (15%) ─────────────────────────────────────────────────────
  // hard conflict (free users only, since premium hard-filters them out): -0.10
  // soft conflict: -0.05
  let dealScore = 0.15;
  const myDB = mine.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(myDB)) {
    if (severity !== 'hard' && severity !== 'soft') continue;
    const penalty = severity === 'hard' ? 0.10 : 0.05;
    if (key === 'smoking'    && theirs.smoking_allowed === true) dealScore -= penalty;
    if (key === 'pets'       && theirs.pets_allowed    === true) dealScore -= penalty;
    if (key === 'parties'    && theirs.social_preference === 'social') dealScore -= penalty;
    if (key === 'early_bird' && theirs.work_schedule === 'Night Shift') dealScore -= penalty;
    if (key === 'night_owl'  && theirs.work_schedule === '9-to-5') dealScore -= penalty;
    if (key === 'messy'      && theirs.cleanliness_level != null && theirs.cleanliness_level <= 2) dealScore -= penalty;
  }
  const theirDB = theirs.dealbreakers ?? {};
  for (const [key, severity] of Object.entries(theirDB)) {
    if (severity !== 'hard' && severity !== 'soft') continue;
    const penalty = severity === 'hard' ? 0.10 : 0.05;
    if (key === 'smoking'    && mine.smoking_allowed === true) dealScore -= penalty;
    if (key === 'pets'       && mine.pets_allowed    === true) dealScore -= penalty;
    if (key === 'parties'    && mine.social_preference === 'social') dealScore -= penalty;
    if (key === 'early_bird' && mine.work_schedule === 'Night Shift') dealScore -= penalty;
    if (key === 'night_owl'  && mine.work_schedule === '9-to-5') dealScore -= penalty;
    if (key === 'messy'      && mine.cleanliness_level != null && mine.cleanliness_level <= 2) dealScore -= penalty;
  }
  score += Math.max(0, dealScore);

  // ── Soft boosts (move-in, lease, ethnicity, city) ──────────────────────────
  if (mine.move_in_date && theirs.move_in_date) {
    const flex = (d: string) => d.toLowerCase() === 'flexible';
    if (flex(mine.move_in_date) || flex(theirs.move_in_date) || mine.move_in_date === theirs.move_in_date) {
      score += 0.04;
    }
  }
  if (mine.lease_duration_months != null && theirs.lease_duration_months != null) {
    if (mine.lease_duration_months === 0 || theirs.lease_duration_months === 0 ||
        mine.lease_duration_months === theirs.lease_duration_months) {
      score += 0.03;
    }
  }

  // Ethnicity — strong soft boost, never a hard filter
  const myEthPref = mine.ethnicity_preference ?? [];
  if (myEthPref.length > 0 && theirMeta.ethnicity && myEthPref.includes(theirMeta.ethnicity)) {
    score += 0.08;
  }

  if (mine.city && theirs.city &&
      mine.city.trim().toLowerCase() === theirs.city.trim().toLowerCase()) {
    score += 0.05;
  }

  // Has listing boost — only when viewer prefers listings
  if (myMeta?.has_listing_only && theirMeta.has_listing === true) {
    score += 0.06;
  }

  // ── Boost factors ──────────────────────────────────────────────────────────
  score *= profileCompletenessBoost(theirMeta, theirs);

  if (theirMeta.subscription_tier === 'premium') score *= 1.10;

  if (theirMeta.created_at) {
    const ageHours = (Date.now() - new Date(theirMeta.created_at).getTime()) / 3_600_000;
    if (ageHours < 48) score *= 1.15;
  }

  const lastActive = theirMeta.last_active_at ?? theirMeta.updated_at;
  if (lastActive) {
    const idleDays = (Date.now() - new Date(lastActive).getTime()) / 86_400_000;
    if (idleDays < 1)       score *= 1.10;
    else if (idleDays < 7)  score *= 1.05;
    else if (idleDays < 30) score *= 1.02;
  }

  return score;
}

// ─── Profile completeness boost ──────────────────────────────────────────────

function profileCompletenessBoost(meta: ProfileMeta, prefs: Preferences): number {
  const checks = [
    !!meta.bio?.trim(),
    meta.age != null,
    Array.isArray(meta.hobbies) && meta.hobbies.length > 0,
    Array.isArray(meta.prompts) && meta.prompts.filter(p => p?.answer?.trim()).length >= 2,
    !!(prefs.city?.trim()),
    prefs.min_budget != null && prefs.max_budget != null,
    prefs.cleanliness_level != null,
    !!prefs.social_preference,
    !!prefs.work_schedule,
    prefs.interests != null && Object.values(prefs.interests).some(v => v.length > 0),
  ];
  const ratio = checks.filter(Boolean).length / checks.length;
  return 1.0 + ratio * 0.20; // 1.0 – 1.20
}

// ─── Feed mixing ──────────────────────────────────────────────────────────────

/**
 * Returns up to `count` scored items using tiered mixing:
 *   Free:    70% high (≥0.65) | 20% medium (0.40–0.65) | 10% wildcard (<0.40)
 *   Premium: 85% high         | 10% medium              |  5% wildcard
 *
 * Progressive fallback: if pool is too small, thresholds are relaxed automatically.
 */
export function applyWildcardMix<T>(
  scored: Array<{ item: T; score: number }>,
  count: number,
  isPremium = false,
): Array<{ item: T; score: number }> {
  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  const HIGH_THRESHOLD    = 0.65;
  const MED_THRESHOLD     = 0.40;
  const WILDCARD_MIN      = 0.15;
  const minPool           = isPremium ? 0.40 : 0.20;

  // Progressive fallback to avoid empty states
  let pool = scored.filter(x => x.score >= minPool);
  if (pool.length < count) pool = scored.filter(x => x.score >= WILDCARD_MIN);
  if (pool.length < count) pool = scored;

  const high     = pool.filter(x => x.score >= HIGH_THRESHOLD);
  const medium   = pool.filter(x => x.score >= MED_THRESHOLD && x.score < HIGH_THRESHOLD);
  const wildcard = pool.filter(x => x.score < MED_THRESHOLD);

  const highRatio     = isPremium ? 0.85 : 0.70;
  const medRatio      = isPremium ? 0.10 : 0.20;
  const highCount     = Math.round(count * highRatio);
  const medCount      = Math.round(count * medRatio);
  const wildcardCount = Math.max(0, count - highCount - medCount);

  const shuffle = <U>(arr: U[]): U[] => [...arr].sort(() => Math.random() - 0.5);

  const result: Array<{ item: T; score: number }> = [
    ...high.slice(0, highCount),
    ...shuffle(medium).slice(0, medCount),
    ...shuffle(wildcard).slice(0, wildcardCount),
  ];

  // Fill remainder if buckets ran dry
  if (result.length < count) {
    const used = new Set(result.map(r => r.item));
    const extras = pool.filter(x => !used.has(x.item)).slice(0, count - result.length);
    result.push(...extras);
  }

  return result.slice(0, count);
}

// ─── Top Picks selection ──────────────────────────────────────────────────────

/**
 * Returns the highest-scoring profiles that meet the Top Picks threshold.
 * No wildcards — only genuinely high-compatibility profiles.
 */
export function selectTopPicks<T>(
  scored: Array<{ item: T; score: number }>,
  count: number,
): Array<{ item: T; score: number }> {
  const TOP_PICKS_THRESHOLD = 0.70;
  return scored
    .filter(x => x.score >= TOP_PICKS_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// ─── Match reasons ────────────────────────────────────────────────────────────

/**
 * Returns up to 5 human-readable reasons why two profiles are compatible.
 * Premium-only display feature — compute freely, gate rendering in UI.
 */
export function getMatchReasons(
  mine: Preferences,
  theirs: Preferences,
  theirMeta: ProfileMeta,
): string[] {
  const reasons: string[] = [];

  // Shared interests
  const myInterests = flattenInterests(mine.interests);
  const theirInterests = flattenInterests(theirs.interests);
  const shared = [...myInterests].filter(x => theirInterests.has(x));
  if (shared.length >= 3) {
    reasons.push(`${shared.length} shared interests`);
  } else if (shared.length === 2) {
    reasons.push(`Both into ${shared[0]} & ${shared[1]}`);
  } else if (shared.length === 1) {
    reasons.push(`Both into ${shared[0]}`);
  }

  // Cleanliness
  if (mine.cleanliness_level != null && theirs.cleanliness_level != null) {
    if (Math.abs(mine.cleanliness_level - theirs.cleanliness_level) <= 1) {
      reasons.push('Similar cleanliness habits');
    }
  }

  // Social preference
  if (mine.social_preference && theirs.social_preference && mine.social_preference === theirs.social_preference) {
    const label: Record<string, string> = {
      quiet: 'Both prefer a quiet home',
      balanced: 'Both balanced socially',
      social: 'Both love socializing',
    };
    reasons.push(label[mine.social_preference] ?? 'Similar social vibe');
  }

  // Work schedule
  if (mine.work_schedule && theirs.work_schedule) {
    if (mine.work_schedule === theirs.work_schedule) {
      reasons.push(`Both on ${mine.work_schedule} schedule`);
    } else {
      const flex = (s: string) => s === 'Flexible' || s === 'Remote';
      if (flex(mine.work_schedule) || flex(theirs.work_schedule)) {
        reasons.push('Flexible schedule match');
      }
    }
  }

  // Budget overlap
  if (mine.min_budget != null && mine.max_budget != null &&
      theirs.min_budget != null && theirs.max_budget != null) {
    const overlapMin = Math.max(mine.min_budget, theirs.min_budget);
    const overlapMax = Math.min(mine.max_budget, theirs.max_budget);
    if (overlapMax >= overlapMin) {
      reasons.push(`Budget overlap $${overlapMin}–$${overlapMax}/mo`);
    }
  }

  // Move-in timing
  if (mine.move_in_date && theirs.move_in_date) {
    const flex = (d: string) => d.toLowerCase() === 'flexible';
    if (flex(mine.move_in_date) || flex(theirs.move_in_date) || mine.move_in_date === theirs.move_in_date) {
      reasons.push('Move-in timing lines up');
    }
  }

  // Same city
  if (mine.city && theirs.city &&
      mine.city.trim().toLowerCase() === theirs.city.trim().toLowerCase()) {
    reasons.push(`Both looking in ${theirs.city.trim()}`);
  }

  return reasons.slice(0, 5);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function socialPreferenceScore(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a === 'balanced' || b === 'balanced') return 0.5; // adjacent
  return 0.0; // quiet ↔ social: opposite ends
}

function workScheduleScore(a: string, b: string): number {
  if (a === b) return 1.0;
  const isFlexible = (s: string) => s === 'Flexible' || s === 'Remote';
  if (isFlexible(a) || isFlexible(b)) return 0.7;
  if ((a === '9-to-5' && b === 'Night Shift') || (a === 'Night Shift' && b === '9-to-5')) return 0.0;
  return 0.4;
}

function flattenInterests(interests?: Record<string, string[]>): Set<string> {
  if (!interests) return new Set();
  const all: string[] = [];
  for (const items of Object.values(interests)) {
    all.push(...items.map(s => s.toLowerCase().trim()));
  }
  return new Set(all);
}
