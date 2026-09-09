CREATE OR REPLACE FUNCTION public.admin_podcast_coverage()
RETURNS TABLE (
  podcast_id uuid,
  stored bigint,
  retired bigint,
  linked bigint,
  awaiting_review bigint,
  reviewed bigint,
  episodes_reviewed bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ep AS (
    SELECT
      e.id,
      e.podcast_id,
      (e.disposition = 'not_about_a_movie') AS is_retired,
      EXISTS (SELECT 1 FROM public.episode_movies m WHERE m.episode_id = e.id) AS has_link,
      EXISTS (
        SELECT 1 FROM public.episode_movies m
        WHERE m.episode_id = e.id AND m.review_state <> 'confirmed'
      ) AS has_open_link,
      EXISTS (
        SELECT 1 FROM public.episode_reviews r
        WHERE r.episode_id = e.id AND r.reopened_at IS NULL
      ) AS has_review
    FROM public.podcast_episodes e
  )
  SELECT
    ep.podcast_id,
    count(*) AS stored,
    count(*) FILTER (WHERE ep.is_retired) AS retired,
    count(*) FILTER (WHERE ep.has_link AND NOT ep.is_retired) AS linked,
    count(*) FILTER (WHERE ep.has_open_link AND NOT ep.is_retired) AS awaiting_review,
    count(*) FILTER (WHERE (ep.has_link AND NOT (ep.has_open_link AND NOT ep.is_retired)) OR ep.is_retired) AS reviewed,
    count(*) FILTER (WHERE ep.is_retired OR ep.has_review) AS episodes_reviewed
  FROM ep
  GROUP BY ep.podcast_id
$$;

REVOKE ALL ON FUNCTION public.admin_podcast_coverage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_podcast_coverage() FROM anon;
REVOKE ALL ON FUNCTION public.admin_podcast_coverage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_podcast_coverage() TO service_role;