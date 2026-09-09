CREATE OR REPLACE FUNCTION public.admin_match_eligible_episodes(
  p_podcast_id uuid DEFAULT NULL,
  p_exclude_confirmed boolean DEFAULT true,
  p_limit integer DEFAULT 5000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  podcast_id uuid,
  released_at date,
  duration_seconds integer,
  disposition episode_disposition,
  podcast_name text,
  matcher_strategy matcher_strategy
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.id, e.slug, e.title, e.description, e.podcast_id, e.released_at,
         e.duration_seconds, e.disposition, p.name, p.matcher_strategy
  FROM public.podcast_episodes e
  JOIN public.podcasts p ON p.id = e.podcast_id
  WHERE p.curation_status = 'active'
    AND e.disposition <> 'not_about_a_movie'
    AND (p_podcast_id IS NULL OR e.podcast_id = p_podcast_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.episode_reviews r
      WHERE r.episode_id = e.id AND r.reopened_at IS NULL
    )
    AND (
      NOT p_exclude_confirmed
      OR NOT EXISTS (
        SELECT 1 FROM public.episode_movies m
        WHERE m.episode_id = e.id
          AND m.match_method IN ('manual', 'deterministic', 'seed')
      )
    )
  ORDER BY e.released_at DESC NULLS LAST, e.id
  LIMIT p_limit OFFSET p_offset
$$;

REVOKE ALL ON FUNCTION public.admin_match_eligible_episodes(uuid, boolean, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_match_eligible_episodes(uuid, boolean, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_match_eligible_episodes(uuid, boolean, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_match_eligible_episodes(uuid, boolean, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_rejection_counts()
RETURNS TABLE (movie_id uuid, rejections bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT r.movie_id, count(*) FROM public.episode_match_rejections r GROUP BY r.movie_id
$$;

REVOKE ALL ON FUNCTION public.admin_rejection_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rejection_counts() FROM anon;
REVOKE ALL ON FUNCTION public.admin_rejection_counts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rejection_counts() TO service_role;