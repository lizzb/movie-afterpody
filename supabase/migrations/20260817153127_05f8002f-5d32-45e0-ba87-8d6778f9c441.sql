CREATE TABLE public.episode_match_rejections (
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (episode_id, movie_id)
);

GRANT SELECT ON public.episode_match_rejections TO authenticated;
GRANT ALL ON public.episode_match_rejections TO service_role;

ALTER TABLE public.episode_match_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read match rejections"
ON public.episode_match_rejections
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));