import { supabase } from './supabase';

export type Listing = {
  id: string;
  user_id: string;
  rent: number | null;
  room_type: string | null;
  listing_photos: string[] | null;
};

export type ListingInput = {
  rent: number | null;
  room_type: string | null;
  listing_photos?: string[] | null;
};

export async function getListing(userId: string): Promise<Listing | null> {
  const { data } = await supabase
    .from('listings')
    .select('id, user_id, rent, room_type, listing_photos')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function saveListing(
  userId: string,
  input: ListingInput
): Promise<{ ok: boolean; error?: string }> {
  // Upsert the listing
  const { error: listErr } = await supabase
    .from('listings')
    .upsert({ user_id: userId, ...input }, { onConflict: 'user_id' });

  if (listErr) return { ok: false, error: listErr.message };

  // Mark has_listing = true on profile
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ has_listing: true })
    .eq('id', userId);

  if (profErr) return { ok: false, error: profErr.message };
  return { ok: true };
}

export async function deleteListing(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error: delErr } = await supabase
    .from('listings')
    .delete()
    .eq('user_id', userId);

  if (delErr) return { ok: false, error: delErr.message };

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ has_listing: false })
    .eq('id', userId);

  if (profErr) return { ok: false, error: profErr.message };
  return { ok: true };
}
