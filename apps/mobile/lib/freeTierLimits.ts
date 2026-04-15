/**
 * Free vs RoomPear+ product rules (client-enforced; server can mirror later).
 * Premium: unlimited swipes, top picks, undos, and see-all likers (Likes tab).
 */
export const FREE_TIER_LIMITS = {
  swipesPerDay: 10,
  topPicksPerDay: 1,
} as const;
