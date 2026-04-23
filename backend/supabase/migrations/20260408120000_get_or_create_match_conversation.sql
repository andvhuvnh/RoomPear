-- Create a DM thread for two mutually matched users (both swiped like).
-- Runs as SECURITY DEFINER so we do not need broad INSERT policies on conversations.

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
    WHERE swiper_id = v_me AND swiped_id = p_other_user_id AND direction = 'like'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = p_other_user_id AND swiped_id = v_me AND direction = 'like'
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
