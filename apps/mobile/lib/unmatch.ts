import { supabase } from './supabase';

/**
 * Ends a mutual match: both users' like/top_pick rows become passes with a new timestamp
 * (30-day discover cooldown, same as a normal pass). Hides any shared DM from both lists.
 */
export async function unmatchPeer(otherUserId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('unmatch_peer', { p_other_user_id: otherUserId });
  if (error) return { error: error.message };
  return { error: null };
}
