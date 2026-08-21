ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS availability_checked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS movies_availability_checked_at_idx
  ON public.movies (availability_checked_at NULLS FIRST);