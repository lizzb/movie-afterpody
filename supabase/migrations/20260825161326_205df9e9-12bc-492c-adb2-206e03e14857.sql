WITH orphan_flags AS (
  SELECT f.id
  FROM public.episode_link_flags f
  LEFT JOIN public.episode_movies em
    ON em.episode_id = f.episode_id
   AND em.movie_id = f.movie_id
  WHERE f.resolved_at IS NULL
    AND em.episode_id IS NULL
)
UPDATE public.episode_link_flags f
SET resolved_at = now(),
    resolution = 'fixed',
    updated_at = now()
FROM orphan_flags o
WHERE f.id = o.id;

WITH blank_episode_links AS (
  SELECT em.episode_id, em.movie_id
  FROM public.episode_movies em
  JOIN public.podcast_episodes e ON e.id = em.episode_id
  JOIN public.podcasts p ON p.id = e.podcast_id
  WHERE btrim(coalesce(e.title, '')) = ''
    AND lower(p.name) IN ('i hate it but i love it', 'the villain was right')
), inserted_rejections AS (
  INSERT INTO public.episode_match_rejections (episode_id, movie_id, rejected_by)
  SELECT episode_id, movie_id, NULL
  FROM blank_episode_links
  ON CONFLICT (episode_id, movie_id) DO NOTHING
  RETURNING episode_id, movie_id
), removed_links AS (
  DELETE FROM public.episode_movies em
  USING blank_episode_links b
  WHERE em.episode_id = b.episode_id
    AND em.movie_id = b.movie_id
  RETURNING em.episode_id, em.movie_id, em.match_method, em.match_confidence
), resolved_blank_flags AS (
  UPDATE public.episode_link_flags f
  SET resolved_at = now(),
      resolution = 'fixed',
      updated_at = now()
  FROM blank_episode_links b
  WHERE f.episode_id = b.episode_id
    AND f.movie_id = b.movie_id
    AND f.resolved_at IS NULL
  RETURNING f.id
)
UPDATE public.podcast_episodes e
SET disposition = 'not_about_a_movie'
FROM public.podcasts p
WHERE p.id = e.podcast_id
  AND btrim(coalesce(e.title, '')) = ''
  AND lower(p.name) IN ('i hate it but i love it', 'the villain was right');