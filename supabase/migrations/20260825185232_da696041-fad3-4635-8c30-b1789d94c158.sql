ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS certification text,
  ADD COLUMN IF NOT EXISTS certification_system text,
  ADD COLUMN IF NOT EXISTS certification_checked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS movies_certification_idx ON public.movies (certification);