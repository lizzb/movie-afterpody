WITH targets AS (
  SELECT id
  FROM public.podcast_episodes
  WHERE title ILIKE 'Listen Now%The Big Flop%'
     OR title ILIKE 'Introducing The Big Flop%'
), removed_links AS (
  DELETE FROM public.episode_movies em
  USING targets t
  WHERE em.episode_id = t.id
  RETURNING em.episode_id, em.movie_id
)
INSERT INTO public.episode_match_rejections (episode_id, movie_id, rejected_by)
SELECT episode_id, movie_id, NULL
FROM removed_links
ON CONFLICT (episode_id, movie_id) DO NOTHING;

UPDATE public.podcast_episodes
SET disposition = 'not_about_a_movie'
WHERE id IN (
  SELECT id
  FROM public.podcast_episodes
  WHERE title ILIKE 'Listen Now%The Big Flop%'
     OR title ILIKE 'Introducing The Big Flop%'
);