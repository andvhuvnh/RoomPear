import { supabase } from './supabase';
import { isPremiumProfileTier } from './purchasesConfig';

/** Reads `profiles.subscription_tier` (source of truth with RevenueCat + dev override). */
export async function fetchProfileIsPremium(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return isPremiumProfileTier(data?.subscription_tier as string | undefined);
}
