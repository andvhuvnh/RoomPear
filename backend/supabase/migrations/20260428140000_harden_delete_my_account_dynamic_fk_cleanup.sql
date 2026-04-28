-- Harden delete_my_account() by dynamically cleaning FK child rows that point to the
-- current user, so account deletion keeps working as schema evolves.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  deleted_id UUID;
  rec RECORD;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Explicit cleanup for known cross-user tables.
  IF to_regclass('public.like_reveals') IS NOT NULL THEN
    DELETE FROM public.like_reveals WHERE user_id = uid OR liker_id = uid;
  END IF;

  IF to_regclass('public.referral_redemptions') IS NOT NULL THEN
    DELETE FROM public.referral_redemptions WHERE referee_id = uid OR referrer_id = uid;
  END IF;

  IF to_regclass('public.blocked_users') IS NOT NULL THEN
    DELETE FROM public.blocked_users WHERE blocker_id = uid OR blocked_id = uid;
  END IF;

  -- Handle self-reference first so profiles row can be deleted.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET referred_by_user_id = NULL
    WHERE referred_by_user_id = uid;
  END IF;

  -- Dynamically delete rows in any table that FK-references public.profiles(id).
  FOR rec IN
    SELECT
      c.conrelid::regclass::text AS child_table,
      a.attname AS child_column
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON TRUE
    JOIN LATERAL unnest(c.confkey) WITH ORDINALITY fk(attnum, ord) ON fk.ord = ck.ord
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ck.attnum
    JOIN pg_attribute pa
      ON pa.attrelid = c.confrelid
     AND pa.attnum = fk.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND pa.attname = 'id'
  LOOP
    -- Skip self-reference delete; we already null it above.
    IF rec.child_table = 'profiles' AND rec.child_column = 'referred_by_user_id' THEN
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM %s WHERE %I = $1', rec.child_table, rec.child_column)
    USING uid;
  END LOOP;

  -- Dynamically delete rows in any table that FK-references auth.users(id).
  FOR rec IN
    SELECT
      c.conrelid::regclass::text AS child_table,
      a.attname AS child_column
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON TRUE
    JOIN LATERAL unnest(c.confkey) WITH ORDINALITY fk(attnum, ord) ON fk.ord = ck.ord
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ck.attnum
    JOIN pg_attribute pa
      ON pa.attrelid = c.confrelid
     AND pa.attnum = fk.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND pa.attname = 'id'
  LOOP
    -- profiles.id is removed via auth.users cascade, so skip direct delete.
    IF rec.child_table = 'profiles' AND rec.child_column = 'id' THEN
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM %s WHERE %I = $1', rec.child_table, rec.child_column)
    USING uid;
  END LOOP;

  -- Final source-of-truth deletion; cascades to public.profiles(id).
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
