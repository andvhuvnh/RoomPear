-- Referral codes, bonus reveal balance, and secure redemption RPC.
-- Also adds last_free_reveal_at if missing (used by mobile Likes reveal flow).

-- ─── Columns on profiles ───────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_free_reveal_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_reveal_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ─── Referrals ledger (one successful redemption per referee) ────────────────

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  referee_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referral_redemptions_referrer_idx
  ON public.referral_redemptions (referrer_id);

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_redemptions_select_own"
  ON public.referral_redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referee_id OR auth.uid() = referrer_id);

-- ─── Referral code generation (8-char, uppercase) ─────────────────────────--

CREATE OR REPLACE FUNCTION public._generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  tries INT := 0;
BEGIN
  LOOP
    candidate := upper(substring(replace(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.referral_code = candidate
    );
    tries := tries + 1;
    IF tries > 40 THEN
      RAISE EXCEPTION 'Could not generate unique referral_code';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.referral_code IS NULL OR btrim(NEW.referral_code::TEXT) = '') THEN
    NEW.referral_code := public._generate_unique_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_profile_referral_code ON public.profiles;
CREATE TRIGGER trg_set_profile_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_referral_code();

-- Backfill existing profiles (runs before economy protection trigger exists)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
    SET referral_code = public._generate_unique_referral_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_unique
  ON public.profiles (referral_code);

-- ─── Prevent clients from forging economy / referral fields ─────────────────

CREATE OR REPLACE FUNCTION public.protect_profile_economy_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('roompear.profile_system_update', TRUE) IS NOT DISTINCT FROM 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    NEW.referral_code := OLD.referral_code;
  END IF;

  IF NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id THEN
    IF OLD.referred_by_user_id IS NOT NULL THEN
      NEW.referred_by_user_id := OLD.referred_by_user_id;
    ELSIF NEW.referred_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'referred_by_user_id cannot be set directly';
    END IF;
  END IF;

  IF NEW.bonus_reveal_balance IS DISTINCT FROM OLD.bonus_reveal_balance
     AND NEW.bonus_reveal_balance > OLD.bonus_reveal_balance THEN
    RAISE EXCEPTION 'bonus_reveal_balance cannot be increased directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_economy_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_economy_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_economy_fields();

-- ─── RPC: redeem a friend’s referral code (both get +1 bonus reveal) ───────

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
    referred_by_user_id = ref_profile.id
  WHERE id = uid;

  UPDATE public.profiles
  SET bonus_reveal_balance = bonus_reveal_balance + 1
  WHERE id = ref_profile.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.redeem_referral_code(TEXT) IS
  'Apply a referral code once per user; grants +1 bonus reveal to referrer and referee.';
