-- Align match RPCs with app logic: top_pick counts as a like for mutual matches
-- (recordSwipe + fetchLikers already treat top_pick like 'like').

CREATE OR REPLACE FUNCTION public.match_peers_without_messages()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_likes AS (
    SELECT s.swiped_id AS peer_id
    FROM public.swipes s
    CROSS JOIN me
    WHERE s.swiper_id = me.uid
      AND s.direction IN ('like', 'top_pick')
  ),
  mutual AS (
    SELECT ml.peer_id
    FROM my_likes ml
    JOIN public.swipes o
      ON o.swiper_id = ml.peer_id
     AND o.swiped_id = (SELECT uid FROM me)
     AND o.direction IN ('like', 'top_pick')
  )
  SELECT m.peer_id
  FROM mutual m
  CROSS JOIN me
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp_me
    JOIN public.conversation_participants cp_peer
      ON cp_me.conversation_id = cp_peer.conversation_id
    WHERE cp_me.user_id = me.uid
      AND cp_peer.user_id = m.peer_id
  );
$$;

REVOKE ALL ON FUNCTION public.match_peers_without_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_peers_without_messages() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_match_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
  v_lo uuid;
  v_hi uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid peer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = v_me AND swiped_id = p_other_user_id AND direction IN ('like', 'top_pick')
  ) OR NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = p_other_user_id AND swiped_id = v_me AND direction IN ('like', 'top_pick')
  ) THEN
    RAISE EXCEPTION 'Users are not matched';
  END IF;

  v_lo := LEAST(v_me, p_other_user_id);
  v_hi := GREATEST(v_me, p_other_user_id);
  PERFORM pg_advisory_xact_lock(hashtext(v_lo::text), hashtext(v_hi::text));

  SELECT cp1.conversation_id INTO v_conv
  FROM public.conversation_participants cp1
  INNER JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = v_me
    AND cp2.user_id = p_other_user_id
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    RETURN v_conv;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO v_conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
    (v_conv, v_me),
    (v_conv, p_other_user_id);

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_match_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_match_conversation(uuid) TO authenticated;
