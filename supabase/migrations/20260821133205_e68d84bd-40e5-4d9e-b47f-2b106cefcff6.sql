DO $$ BEGIN
  CREATE TYPE public.podcast_curation AS ENUM ('active', 'parked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS curation_status public.podcast_curation NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS podcasts_curation_status_idx
  ON public.podcasts (curation_status);