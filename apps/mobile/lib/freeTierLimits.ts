/**
 * Free vs RoomPear+ product rules (client-enforced; server can mirror later).
 */
export const FREE_TIER_LIMITS = {
  swipesPerDay: 10,
  topPicksPerDay: 1,
} as const;

export const PREMIUM_TIER_LIMITS = {
  topPicksPerDay: 7,
} as const;
