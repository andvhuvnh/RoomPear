import { supabase } from './supabase';
import { laCalendarDayBounds } from './usageDay';

export type DiscoverDailyUsage = {
  swipes: number;
  topPicks: number;
};

/**
 * Today's swipe and top-pick counts for the user, derived from `swipes` rows
 * (America/Los_Angeles calendar day — same bucketing as server-stored `timestamptz`).
 */
export async function getDiscoverUsage(userId: string): Promise<DiscoverDailyUsage> {
  const { startIso, endIso } = laCalendarDayBounds();
  const { data, error } = await supabase
    .from('swipes')
    .select('direction')
    .eq('swiper_id', userId)
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (error) {
    console.warn('getDiscoverUsage', error.message);
    return { swipes: 0, topPicks: 0 };
  }
  const rows = data ?? [];
  return {
    swipes: rows.length,
    topPicks: rows.filter((r) => r.direction === 'top_pick').length,
  };
}
