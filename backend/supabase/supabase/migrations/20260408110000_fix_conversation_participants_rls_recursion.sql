-- The previous SELECT policy on conversation_participants queried the same table
-- inside EXISTS, which re-entered RLS and caused infinite recursion.
-- This helper runs with definer rights so the membership check does not recurse.

CREATE OR REPLACE FUNCTION public.user_in_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_in_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_in_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants can view fellow participants"
  ON public.conversation_participants;

CREATE POLICY "Participants can view fellow participants"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (public.user_in_conversation(conversation_id));
