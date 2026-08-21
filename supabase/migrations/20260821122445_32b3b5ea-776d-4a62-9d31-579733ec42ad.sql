CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.episode_link_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  flagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  resolved_at timestamp with time zone,
  resolution text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX episode_link_flags_unique_open
  ON public.episode_link_flags (episode_id, movie_id, flagged_by)
  WHERE resolved_at IS NULL;

CREATE INDEX episode_link_flags_open_idx
  ON public.episode_link_flags (created_at DESC)
  WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_link_flags TO authenticated;
GRANT ALL ON public.episode_link_flags TO service_role;

ALTER TABLE public.episode_link_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own flags"
  ON public.episode_link_flags FOR SELECT TO authenticated
  USING (flagged_by = auth.uid());

CREATE POLICY "Admins can read all flags"
  ON public.episode_link_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can flag matches"
  ON public.episode_link_flags FOR INSERT TO authenticated
  WITH CHECK (flagged_by = auth.uid());

CREATE POLICY "Users can remove own unresolved flags"
  ON public.episode_link_flags FOR DELETE TO authenticated
  USING (flagged_by = auth.uid() AND resolved_at IS NULL);

CREATE POLICY "Admins can resolve flags"
  ON public.episode_link_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_episode_link_flags_updated_at
  BEFORE UPDATE ON public.episode_link_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();