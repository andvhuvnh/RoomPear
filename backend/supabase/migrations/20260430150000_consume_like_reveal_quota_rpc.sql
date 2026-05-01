-- Server-side reveal quota: one free reveal per America/Los_Angeles calendar day,
-- then bonus_reveal_balance decrements. Clients cannot forge these fields (see trigger).

CREATE OR REPLACE FUNCTION public.protect_profile_economy_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('roompear.profile_system_update', TRUE) IS NOT DISTINCT FROM 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.last_free_reveal_at IS DISTINCT FROM OLD.last_free_reveal_at THEN
    NEW.last_free_reveal_at := OLD.last_free_reveal_at;
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

  IF NEW.bonus_reveal_balance IS DISTINCT FROM OLD.bonus_reveal_balance THEN
    IF NEW.bonus_reveal_balance > OLD.bonus_reveal_balance THEN
      RAISE EXCEPTION 'bonus_reveal_balance cannot be increased directly';
    END IF;
    IF NEW.bonus_reveal_balance < OLD.bonus_reveal_balance THEN
      NEW.bonus_reveal_balance := OLD.bonus_reveal_balance;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_like_reveal_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.profiles%ROWTYPE;
  la_today date := ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles'))::date;
  reveal_la_date date;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_used');
  END IF;

  PERFORM set_config('roompear.profile_system_update', 'true', true);

  SELECT * INTO rec FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_used');
  END IF;

  IF rec.last_free_reveal_at IS NULL THEN
    reveal_la_date := NULL;
  ELSE
    reveal_la_date := ((rec.last_free_reveal_at AT TIME ZONE 'America/Los_Angeles'))::date;
  END IF;

  IF reveal_la_date IS NULL OR reveal_la_date < la_today THEN
    UPDATE public.profiles
    SET last_free_reveal_at = now()
    WHERE id = uid;
    RETURN jsonb_build_object('success', true, 'used_bonus', false);
  END IF;

  IF coalesce(rec.bonus_reveal_balance, 0) > 0 THEN
    UPDATE public.profiles
    SET bonus_reveal_balance = rec.bonus_reveal_balance - 1
    WHERE id = uid;
    RETURN jsonb_build_object('success', true, 'used_bonus', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'already_used');
END;
$$;

REVOKE ALL ON FUNCTION public.consume_like_reveal_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_like_reveal_quota() TO authenticated;

COMMENT ON FUNCTION public.consume_like_reveal_quota() IS
  'Atomically consumes one reveal quota for auth.uid(): LA daily free reveal first, else bonus_reveal_balance.';
