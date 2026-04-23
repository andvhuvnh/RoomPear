-- Unread messages: track last read per participant and compute unread counts.

ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

CREATE INDEX IF NOT EXISTS conversation_participants_user_last_read_idx
  ON public.conversation_participants(user_id, last_read_at DESC);

DROP POLICY IF EXISTS "Participants can update own read state"
  ON public.conversation_participants;

CREATE POLICY "Participants can update own read state"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Returns unread counts for the current user over a set of conversations.
CREATE OR REPLACE FUNCTION public.get_unread_counts(p_conversation_ids uuid[])
RETURNS TABLE(conversation_id uuid, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    m.conversation_id,
    COUNT(*)::int AS unread_count
  FROM public.messages m
  JOIN public.conversation_participants me
    ON me.conversation_id = m.conversation_id
   AND me.user_id = (SELECT auth.uid())
  WHERE m.conversation_id = ANY (p_conversation_ids)
    AND m.sender_id <> (SELECT auth.uid())
    AND m.created_at > COALESCE(me.last_read_at, 'epoch'::timestamptz)
  GROUP BY m.conversation_id;
$$;

REVOKE ALL ON FUNCTION public.get_unread_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_counts(uuid[]) TO authenticated;

