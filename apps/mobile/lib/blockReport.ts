import { supabase } from './supabase';

export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error && error.code !== '23505') {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function reportUser(
  reporterId: string,
  reportedId: string,
  reason: string,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
    details: details?.trim() || null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type BlockedProfile = {
  id: string;
  name: string;
  photoUrl: string | null;
};

export async function getBlockedProfiles(userId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, profiles!blocks_blocked_id_fkey(id, name, profile_photo_url)')
    .eq('blocker_id', userId);

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: p?.id ?? row.blocked_id,
      name: p?.name ?? 'Unknown',
      photoUrl: Array.isArray(p?.profile_photo_url)
        ? p.profile_photo_url[0] ?? null
        : p?.profile_photo_url ?? null,
    };
  });
}

/** Returns all user IDs that the viewer has blocked OR that have blocked the viewer. */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const [{ data: iBlocked }, { data: theyBlocked }] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', userId),
  ]);

  const ids = new Set<string>();
  iBlocked?.forEach((r: any) => ids.add(r.blocked_id));
  theyBlocked?.forEach((r: any) => ids.add(r.blocker_id));
  return Array.from(ids);
}
