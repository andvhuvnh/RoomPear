-- Fix: Matches tab should clear when a DM row exists between the pair, not only after
-- first message. (Replaces prior version if 20260408140000 was already applied.)

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
      AND s.direction = 'like'
  ),
  mutual AS (
    SELECT ml.peer_id
    FROM my_likes ml
    JOIN public.swipes o
      ON o.swiper_id = ml.peer_id
     AND o.swiped_id = (SELECT uid FROM me)
     AND o.direction = 'like'
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
