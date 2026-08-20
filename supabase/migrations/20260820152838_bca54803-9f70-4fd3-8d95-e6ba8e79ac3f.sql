CREATE TYPE public.episode_disposition AS ENUM ('needs_review', 'movie_matched', 'not_about_a_movie');

ALTER TABLE public.podcast_episodes
  ADD COLUMN disposition public.episode_disposition NOT NULL DEFAULT 'needs_review';

ALTER TABLE public.episode_movies
  ADD COLUMN signals jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TYPE public.match_action AS ENUM ('approve', 'reject', 'unlink', 'relink', 'confirm', 'not_about_a_movie');

CREATE TABLE public.match_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.match_action NOT NULL,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  movie_id uuid REFERENCES public.movies(id) ON DELETE CASCADE,
  previous_movie_id uuid REFERENCES public.movies(id) ON DELETE SET NULL,
  previous_method public.match_method,
  previous_confidence numeric,
  undone_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX match_actions_created_at_idx ON public.match_actions (created_at DESC);
CREATE INDEX match_actions_episode_idx ON public.match_actions (episode_id);

GRANT SELECT ON public.match_actions TO authenticated;
GRANT ALL ON public.match_actions TO service_role;

ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read match actions"
  ON public.match_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));