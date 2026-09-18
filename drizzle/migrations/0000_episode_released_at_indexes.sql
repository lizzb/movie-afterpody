CREATE INDEX IF NOT EXISTS podcast_episodes_released_at_idx
  ON public.podcast_episodes (released_at DESC, id);

CREATE INDEX IF NOT EXISTS podcast_episodes_podcast_released_at_idx
  ON public.podcast_episodes (podcast_id, released_at DESC);

ANALYZE public.podcast_episodes;