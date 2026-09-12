ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS is_holiday boolean
  GENERATED ALWAYS AS (
    (title ~* '[[:<:]](christmas|santa)[[:>:]]')
    OR (coalesce(synopsis, '') ~* '[[:<:]](christmas|santa)[[:>:]]')
  ) STORED;

CREATE INDEX IF NOT EXISTS movies_is_holiday_idx ON public.movies (id) WHERE is_holiday;