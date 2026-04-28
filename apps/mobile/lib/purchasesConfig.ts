/**
 * RevenueCat dashboard: create an entitlement with this exact identifier and attach all paid products to it.
 * Store products (weekly / biweekly / monthly) should be linked to this entitlement in RevenueCat.
 */
export const ENTITLEMENT_ROOMPEAR_PLUS = 'RoomPear+';

/** Stored in Supabase `profiles.subscription_tier` when RoomPear+ is active (matches existing app logic). */
export const SUBSCRIPTION_TIER_PREMIUM = 'premium';
export const SUBSCRIPTION_TIER_FREE = 'free';

export type CustomerInfoLike = {
  entitlements?: { active?: Record<string, { isActive?: boolean } | undefined> };
};

export function hasRoomPearPlusEntitlement(info: CustomerInfoLike | null | undefined): boolean {
  return info?.entitlements?.active?.[ENTITLEMENT_ROOMPEAR_PLUS]?.isActive === true;
}

/**
 * Maps RevenueCat state to the profile column used across Discover / matching.
 */
export function subscriptionTierFromCustomerInfo(info: CustomerInfoLike | null | undefined): string {
  return hasRoomPearPlusEntitlement(info) ? SUBSCRIPTION_TIER_PREMIUM : SUBSCRIPTION_TIER_FREE;
}

export function formatPlanLabel(subscriptionTier: string | null | undefined): string {
  const t = (subscriptionTier || SUBSCRIPTION_TIER_FREE).toLowerCase();
  if (t === SUBSCRIPTION_TIER_PREMIUM) return 'RoomPear+';
  return 'Free';
}

/**
 * `profiles.subscription_tier` is synced to `free` / `premium` from RevenueCat; keep this
 * tolerant in case the column is set manually or legacy values appear.
 */
export function isPremiumProfileTier(subscriptionTier: string | null | undefined): boolean {
  const t = (subscriptionTier ?? '').toLowerCase().trim();
  if (!t) return false;
  if (t === SUBSCRIPTION_TIER_PREMIUM) return true;
  if (t === 'room_pear_plus' || t === 'roompear+') return true;
  if (t.replace(/\s/g, '') === 'roompear+') return true;
  if (t.startsWith('room_pear_')) return true;
  return false;
}
