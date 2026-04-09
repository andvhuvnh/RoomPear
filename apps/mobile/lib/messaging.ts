import { supabase } from './supabase';
import { getProfileImageUrls } from './storage';

export type ConversationSummary = {
  conversationId: string;
  /** When the thread was created (used for sort / time when there are no messages yet). */
  conversationCreatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  otherUserId: string;
  otherDisplayName: string;
  /** First profile photo URL (same as PublicProfileCard cover / index 0). */
  otherAvatarUrl: string | null;
};

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function displayNameFromProfile(name: string | null | undefined, fallbackId: string) {
  const t = name?.trim();
  if (t) return t;
  return `User ${fallbackId.slice(0, 6)}`;
}

/**
 * Conversations the current user is in, newest activity first.
 */
export async function fetchConversationSummaries(): Promise<{
  data: ConversationSummary[];
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: [], error: new Error('Not signed in') };
  }

  const { data: myParts, error: pErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id);

  if (pErr) {
    return { data: [], error: new Error(pErr.message) };
  }

  const convIds = [...new Set((myParts ?? []).map((r) => r.conversation_id))];
  if (convIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: convos, error: cErr } = await supabase
    .from('conversations')
    .select('id, created_at, last_message_at, last_message_preview')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (cErr) {
    return { data: [], error: new Error(cErr.message) };
  }

  const { data: allParts, error: apErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds);

  if (apErr) {
    return { data: [], error: new Error(apErr.message) };
  }

  const otherIdsByConv = new Map<string, string>();
  for (const row of allParts ?? []) {
    if (row.user_id === user.id) continue;
    otherIdsByConv.set(row.conversation_id, row.user_id);
  }

  const otherIds = [...new Set(otherIdsByConv.values())];
  const namesById = new Map<string, string>();
  const avatarUrlById = new Map<string, string | null>();
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, profile_photo_url')
      .in('id', otherIds);
    for (const p of profiles ?? []) {
      namesById.set(p.id, displayNameFromProfile(p.name, p.id));
      const urls = p.profile_photo_url
        ? (await getProfileImageUrls(p.profile_photo_url)) ?? []
        : [];
      avatarUrlById.set(p.id, urls[0] ?? null);
    }
  }

  const summaries: ConversationSummary[] = (convos ?? []).map((c) => {
    const otherId = otherIdsByConv.get(c.id) ?? '';
    return {
      conversationId: c.id,
      conversationCreatedAt: c.created_at,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      otherUserId: otherId,
      otherDisplayName: namesById.get(otherId) ?? (otherId ? `User ${otherId.slice(0, 6)}` : 'Chat'),
      otherAvatarUrl: otherId ? avatarUrlById.get(otherId) ?? null : null,
    };
  });

  const activityMs = (s: ConversationSummary) => {
    if (s.lastMessageAt) return Date.parse(s.lastMessageAt);
    return Date.parse(s.conversationCreatedAt);
  };
  summaries.sort((a, b) => activityMs(b) - activityMs(a));

  return { data: summaries, error: null };
}

export async function fetchMessages(
  conversationId: string
): Promise<{ data: ChatMessageRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  return { data: (data ?? []) as ChatMessageRow[], error: null };
}

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<{ data: ChatMessageRow | null; error: Error | null }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { data: null, error: new Error('Message is empty') };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('Not signed in') };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data as ChatMessageRow, error: null };
}

/**
 * Ensures a DM exists between the current user and a mutually matched peer.
 * Safe to call repeatedly (idempotent). Requires matching `swipes` rows (both `like`).
 */
export async function ensureMatchConversation(
  otherUserId: string
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_or_create_match_conversation', {
    p_other_user_id: otherUserId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const id = typeof data === 'string' ? data : data != null ? String(data) : '';
  if (!id) {
    return { data: null, error: new Error('No conversation id returned') };
  }
  return { data: id, error: null };
}
