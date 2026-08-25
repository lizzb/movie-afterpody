ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS collection_id integer;
CREATE INDEX IF NOT EXISTS movies_collection_id_idx ON public.movies (collection_id) WHERE collection_id IS NOT NULL;