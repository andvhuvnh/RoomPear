import { supabase } from './supabase';

export type ConversationSummary = {
  conversationId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  otherUserId: string;
  otherDisplayName: string;
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
    .select('id, last_message_at, last_message_preview')
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
  let namesById = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', otherIds);
    namesById = new Map(
      (profiles ?? []).map((p) => [p.id, displayNameFromProfile(p.name, p.id)])
    );
  }

  const summaries: ConversationSummary[] = (convos ?? []).map((c) => {
    const otherId = otherIdsByConv.get(c.id) ?? '';
    return {
      conversationId: c.id,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      otherUserId: otherId,
      otherDisplayName: namesById.get(otherId) ?? (otherId ? `User ${otherId.slice(0, 6)}` : 'Chat'),
    };
  });

  summaries.sort((a, b) => {
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return tb - ta;
  });

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
