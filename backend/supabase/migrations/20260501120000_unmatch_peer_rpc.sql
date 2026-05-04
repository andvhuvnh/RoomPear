-- Unmatch: clear mutual match by converting both directed swipes to `pass` with a fresh
-- `created_at` so discover exclusion matches the 30-day recycle rule for passes.
-- Also hides any existing DM thread from both users' Messages lists (does not delete messages).

CREATE OR REPLACE FUNCTION public.unmatch_peer(p_other_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid peer';
  END IF;

  UPDATE public.swipes
  SET
    direction = 'pass',
    created_at = now()
  WHERE direction IN ('like', 'top_pick')
    AND (
      (swiper_id = v_me AND swiped_id = p_other_user_id)
      OR (swiper_id = p_other_user_id AND swiped_id = v_me)
    );

  UPDATE public.conversation_participants cp
  SET hidden_from_list_at = now()
  WHERE cp.user_id IN (v_me, p_other_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants a
      JOIN public.conversation_participants b
        ON a.conversation_id = b.conversation_id
      WHERE a.conversation_id = cp.conversation_id
        AND a.user_id = v_me
        AND b.user_id = p_other_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.unmatch_peer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmatch_peer(uuid) TO authenticated;
