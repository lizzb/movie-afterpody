ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS sync_generation integer NOT NULL DEFAULT 1;
ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

CREATE TABLE public.episode_reviews (
  episode_id uuid PRIMARY KEY REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  sync_generation integer NOT NULL DEFAULT 1,
  reopened_at timestamp with time zone,
  reopen_reason text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_reviews TO authenticated;
GRANT ALL ON public.episode_reviews TO service_role;

ALTER TABLE public.episode_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage episode reviews" ON public.episode_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_episode_reviews_current ON public.episode_reviews (sync_generation) WHERE reopened_at IS NULL;

CREATE TRIGGER update_episode_reviews_updated_at
  BEFORE UPDATE ON public.episode_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.stale_episode_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.episode_id;
  ELSE
    target := NEW.episode_id;
  END IF;

  UPDATE public.episode_reviews
     SET reopened_at = now(), reopen_reason = TG_ARGV[0]
   WHERE episode_id = target
     AND reopened_at IS NULL;

  RETURN NULL;
END;
$$;

CREATE TRIGGER episode_review_stale_on_new_link
  AFTER INSERT ON public.episode_movies
  FOR EACH ROW
  WHEN (NEW.review_state <> 'confirmed')
  EXECUTE FUNCTION public.stale_episode_review('new_link');

CREATE TRIGGER episode_review_stale_on_link_removed
  AFTER DELETE ON public.episode_movies
  FOR EACH ROW
  EXECUTE FUNCTION public.stale_episode_review('link_removed');

CREATE TRIGGER episode_review_stale_on_flag
  AFTER INSERT ON public.episode_link_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.stale_episode_review('flagged');