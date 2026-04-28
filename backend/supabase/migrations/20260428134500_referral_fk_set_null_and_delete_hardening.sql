-- Preserve referral context while allowing account deletion.
-- 1) Add referred_by_code snapshot on profiles
-- 2) Change referred_by_user_id FK to ON DELETE SET NULL
-- 3) Update redeem_referral_code() to set both id + code
-- 4) Harden delete_my_account() against restrictive FKs

-- ─── Profiles referral columns / FK ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

UPDATE public.profiles p
SET referred_by_code = r.referral_code
FROM public.profiles r
WHERE p.referred_by_user_id = r.id
  AND p.referred_by_code IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referred_by_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referred_by_user_id_fkey
  FOREIGN KEY (referred_by_user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.referred_by_code IS
  'Snapshot of the referrer referral code at redemption time (survives referrer account deletion).';

-- ─── Referral redemption RPC update ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cleaned TEXT;
  ref_profile public.profiles%ROWTYPE;
BEGIN
  PERFORM set_config('roompear.profile_system_update', 'true', TRUE);

  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  cleaned := upper(btrim(p_code));
  IF cleaned = '' OR length(cleaned) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO ref_profile FROM public.profiles WHERE referral_code = cleaned;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF ref_profile.id = uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND referred_by_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_referred');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE referee_id = uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO public.referral_redemptions (referrer_id, referee_id)
  VALUES (ref_profile.id, uid);

  UPDATE public.profiles
  SET
    bonus_reveal_balance = bonus_reveal_balance + 1,
    referred_by_user_id = ref_profile.id,
    referred_by_code = ref_profile.referral_code
  WHERE id = uid;

  UPDATE public.profiles
  SET bonus_reveal_balance = bonus_reveal_balance + 1
  WHERE id = ref_profile.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;

-- ─── Delete-account RPC hardening ────────────────────────────────────────────

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

  DELETE FROM public.swipes
  WHERE swiper_id = uid OR swiped_id = uid;

  DELETE FROM public.conversation_participants
  WHERE user_id = uid;

  DELETE FROM public.preferences
  WHERE user_id = uid;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET referred_by_user_id = NULL
    WHERE referred_by_user_id = uid;
  END IF;

  -- Delete auth row first; profiles is auth.users(id) FK with ON DELETE CASCADE.
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
