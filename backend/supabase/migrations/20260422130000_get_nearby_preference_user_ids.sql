-- Returns preference user IDs that fall within the signed-in user's search radius.
-- Uses Haversine distance on stored search_lat/search_lng values.

CREATE OR REPLACE FUNCTION public.get_nearby_preference_user_ids()
RETURNS TABLE (
  user_id uuid,
  distance_miles double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_pref AS (
    SELECT
      p.search_lat AS lat,
      p.search_lng AS lng,
      p.search_radius_miles AS radius_miles
    FROM public.preferences p
    JOIN me ON p.user_id = me.uid
    WHERE p.search_lat IS NOT NULL
      AND p.search_lng IS NOT NULL
      AND p.search_radius_miles IS NOT NULL
      AND p.search_radius_miles > 0
    LIMIT 1
  ),
  candidate_pref AS (
    SELECT
      p.user_id,
      p.search_lat AS lat,
      p.search_lng AS lng
    FROM public.preferences p
    JOIN me ON p.user_id <> me.uid
    WHERE p.search_lat IS NOT NULL
      AND p.search_lng IS NOT NULL
  ),
  with_distance AS (
    SELECT
      c.user_id,
      (
        3958.7613 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS(c.lat - m.lat) / 2), 2) +
            COS(RADIANS(m.lat)) * COS(RADIANS(c.lat)) *
            POWER(SIN(RADIANS(c.lng - m.lng) / 2), 2)
          )
        )
      ) AS distance_miles,
      m.radius_miles
    FROM candidate_pref c
    CROSS JOIN my_pref m
  )
  SELECT
    wd.user_id,
    wd.distance_miles
  FROM with_distance wd
  WHERE wd.distance_miles <= wd.radius_miles
  ORDER BY wd.distance_miles ASC;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_preference_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_preference_user_ids() TO authenticated;
