-- Self-service account deletion RPC for authenticated users.
-- Called by mobile Profile settings: supabase.rpc('delete_my_account')

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  deleted_id UUID;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Optional tables that may not exist in every local/dev branch.
  IF to_regclass('public.like_reveals') IS NOT NULL THEN
    DELETE FROM public.like_reveals
    WHERE user_id = uid OR liker_id = uid;
  END IF;

  IF to_regclass('public.referral_redemptions') IS NOT NULL THEN
    DELETE FROM public.referral_redemptions
    WHERE referee_id = uid OR referrer_id = uid;
  END IF;

  IF to_regclass('public.blocked_users') IS NOT NULL THEN
    DELETE FROM public.blocked_users
    WHERE blocker_id = uid OR blocked_id = uid;
  END IF;

  IF to_regclass('public.listings') IS NOT NULL THEN
    DELETE FROM public.listings
    WHERE user_id = uid;
  END IF;

  -- Explicit cleanup for tables that reference profile/auth IDs.
  DELETE FROM public.swipes
  WHERE swiper_id = uid OR swiped_id = uid;

  DELETE FROM public.conversation_participants
  WHERE user_id = uid;

  DELETE FROM public.preferences
  WHERE user_id = uid;

  -- Self-referential FK on profiles.referred_by_user_id can block profile deletion.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET referred_by_user_id = NULL
    WHERE referred_by_user_id = uid;
  END IF;

  DELETE FROM public.profiles
  WHERE id = uid;

  -- Final source-of-truth deletion; cascades to auth-linked rows.
  DELETE FROM auth.users
  WHERE id = uid
  RETURNING id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'Deletes the currently authenticated user and related RoomPear data.';
