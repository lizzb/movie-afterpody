CREATE OR REPLACE FUNCTION public.admin_unlinked_episode_counts()
RETURNS TABLE (active_count bigint, all_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE p.curation_status = 'active') AS active_count,
    count(*) AS all_count
  FROM public.podcast_episodes e
  JOIN public.podcasts p ON p.id = e.podcast_id
  WHERE e.disposition <> 'not_about_a_movie'
    AND NOT EXISTS (SELECT 1 FROM public.episode_movies m WHERE m.episode_id = e.id)
$$;

REVOKE ALL ON FUNCTION public.admin_unlinked_episode_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unlinked_episode_counts() FROM anon;
REVOKE ALL ON FUNCTION public.admin_unlinked_episode_counts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlinked_episode_counts() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_unlinked_episodes(
  p_podcast_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  released_at date,
  duration_seconds integer,
  podcast_name text,
  match_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT e.id, e.title, e.description, e.released_at, e.duration_seconds,
           p.name AS podcast_name, p.description AS podcast_description
    FROM public.podcast_episodes e
    JOIN public.podcasts p ON p.id = e.podcast_id
    WHERE p.curation_status = 'active'
      AND e.disposition <> 'not_about_a_movie'
      AND (p_podcast_id IS NULL OR e.podcast_id = p_podcast_id)
      AND NOT EXISTS (SELECT 1 FROM public.episode_movies m WHERE m.episode_id = e.id)
  ), matched AS (
    SELECT * FROM base
    WHERE p_search IS NULL OR p_search = '' OR (
      base.title ILIKE '%' || p_search || '%'
      OR coalesce(base.description, '') ILIKE '%' || p_search || '%'
      OR base.podcast_name ILIKE '%' || p_search || '%'
      OR coalesce(base.podcast_description, '') ILIKE '%' || p_search || '%'
    )
  )
  SELECT m.id, m.title, m.description, m.released_at, m.duration_seconds, m.podcast_name,
         (SELECT count(*) FROM matched) AS match_count,
         (SELECT count(*) FROM base) AS total_count
  FROM matched m
  ORDER BY m.released_at DESC NULLS LAST, m.id
  LIMIT p_limit
$$;

REVOKE ALL ON FUNCTION public.admin_unlinked_episodes(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unlinked_episodes(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_unlinked_episodes(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlinked_episodes(uuid, text, integer) TO service_role;