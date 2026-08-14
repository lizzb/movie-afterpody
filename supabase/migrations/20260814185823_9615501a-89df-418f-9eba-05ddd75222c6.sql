-- ENUMS
CREATE TYPE public.media_type AS ENUM ('movie', 'tv');
CREATE TYPE public.offer_type AS ENUM ('subscription', 'free_ads', 'rent', 'buy');
CREATE TYPE public.podcast_activity AS ENUM ('active', 'slow', 'dormant', 'ended');
CREATE TYPE public.podcast_preference AS ENUM ('preferred', 'neutral', 'blocked');
CREATE TYPE public.episode_rating AS ENUM ('disliked', 'meh', 'loved');
CREATE TYPE public.listening_status AS ENUM ('not_started', 'started', 'finished');
CREATE TYPE public.production_quality AS ENUM ('poor', 'okay', 'good');
CREATE TYPE public.source_access_tier AS ENUM ('public', 'premium', 'private');
CREATE TYPE public.match_method AS ENUM ('seed', 'deterministic', 'heuristic', 'ai', 'manual');

-- CATALOG
CREATE TABLE public.genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE public.streaming_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  accent text NOT NULL DEFAULT 'coral',
  provider_ref text,
  sort_order integer NOT NULL DEFAULT 100
);

CREATE TABLE public.movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type public.media_type NOT NULL DEFAULT 'movie',
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  release_year integer,
  release_date date,
  runtime_minutes integer,
  synopsis text,
  tagline text,
  poster_url text,
  backdrop_url text,
  accent text NOT NULL DEFAULT 'coral',
  tmdb_id integer UNIQUE,
  imdb_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.movie_genres (
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, genre_id)
);

CREATE TABLE public.movie_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.streaming_services(id) ON DELETE CASCADE,
  offer_type public.offer_type NOT NULL DEFAULT 'subscription',
  region text NOT NULL DEFAULT 'US',
  deep_link text,
  provider_source text NOT NULL DEFAULT 'seed',
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movie_id, service_id, offer_type, region)
);

CREATE TABLE public.podcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  artwork_url text,
  accent text NOT NULL DEFAULT 'purple',
  episode_count integer NOT NULL DEFAULT 0,
  latest_episode_at date,
  activity_status public.podcast_activity NOT NULL DEFAULT 'active',
  feed_url text,
  website_url text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_source text NOT NULL DEFAULT 'seed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.podcast_external_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  rating numeric(3,2),
  rating_count integer,
  external_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (podcast_id, platform)
);

CREATE TABLE public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  released_at date,
  duration_seconds integer,
  episode_number integer,
  provider_source text NOT NULL DEFAULT 'seed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.episode_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  access_tier public.source_access_tier NOT NULL DEFAULT 'public',
  is_primary boolean NOT NULL DEFAULT false,
  embeddable boolean NOT NULL DEFAULT false,
  UNIQUE (episode_id, platform)
);

CREATE TABLE public.episode_movies (
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  match_method public.match_method NOT NULL DEFAULT 'seed',
  match_confidence numeric(3,2) NOT NULL DEFAULT 1.00,
  is_primary_subject boolean NOT NULL DEFAULT true,
  PRIMARY KEY (episode_id, movie_id)
);

-- USER DATA
CREATE TABLE public.user_streaming_services (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.streaming_services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id)
);

CREATE TABLE public.user_podcast_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  podcast_id uuid NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  preference public.podcast_preference NOT NULL DEFAULT 'neutral',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, podcast_id)
);

CREATE TABLE public.user_episode_ratings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  rating public.episode_rating NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);

CREATE TABLE public.user_episode_listening (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  status public.listening_status NOT NULL DEFAULT 'not_started',
  position_seconds integer,
  duration_seconds integer,
  completion_percent numeric(5,2),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);

CREATE TABLE public.user_production_quality (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  quality public.production_quality NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);

CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  accent text NOT NULL DEFAULT 'berry',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.watchlist_movies (
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watchlist_id, movie_id)
);

CREATE TABLE public.user_movie_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  watched_on date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_id, watched_on)
);

CREATE TABLE public.commentary_scores (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  score integer NOT NULL,
  explanation text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

-- INDEXES
CREATE INDEX idx_movie_availability_movie ON public.movie_availability(movie_id);
CREATE INDEX idx_movie_availability_service ON public.movie_availability(service_id);
CREATE INDEX idx_movie_genres_genre ON public.movie_genres(genre_id);
CREATE INDEX idx_episodes_podcast ON public.podcast_episodes(podcast_id);
CREATE INDEX idx_episode_movies_movie ON public.episode_movies(movie_id);
CREATE INDEX idx_episode_sources_episode ON public.episode_sources(episode_id);
CREATE INDEX idx_watchlists_user ON public.watchlists(user_id);
CREATE INDEX idx_watches_user ON public.user_movie_watches(user_id);

-- GRANTS: catalog is public-read
GRANT SELECT ON public.genres TO anon, authenticated;
GRANT SELECT ON public.streaming_services TO anon, authenticated;
GRANT SELECT ON public.movies TO anon, authenticated;
GRANT SELECT ON public.movie_genres TO anon, authenticated;
GRANT SELECT ON public.movie_availability TO anon, authenticated;
GRANT SELECT ON public.podcasts TO anon, authenticated;
GRANT SELECT ON public.podcast_external_metrics TO anon, authenticated;
GRANT SELECT ON public.podcast_episodes TO anon, authenticated;
GRANT SELECT ON public.episode_sources TO anon, authenticated;
GRANT SELECT ON public.episode_movies TO anon, authenticated;
GRANT ALL ON public.genres TO service_role;
GRANT ALL ON public.streaming_services TO service_role;
GRANT ALL ON public.movies TO service_role;
GRANT ALL ON public.movie_genres TO service_role;
GRANT ALL ON public.movie_availability TO service_role;
GRANT ALL ON public.podcasts TO service_role;
GRANT ALL ON public.podcast_external_metrics TO service_role;
GRANT ALL ON public.podcast_episodes TO service_role;
GRANT ALL ON public.episode_sources TO service_role;
GRANT ALL ON public.episode_movies TO service_role;

-- GRANTS: user data
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_streaming_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_podcast_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_episode_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_episode_listening TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_production_quality TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_movies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_movie_watches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commentary_scores TO authenticated;
GRANT ALL ON public.user_streaming_services TO service_role;
GRANT ALL ON public.user_podcast_preferences TO service_role;
GRANT ALL ON public.user_episode_ratings TO service_role;
GRANT ALL ON public.user_episode_listening TO service_role;
GRANT ALL ON public.user_production_quality TO service_role;
GRANT ALL ON public.watchlists TO service_role;
GRANT ALL ON public.watchlist_movies TO service_role;
GRANT ALL ON public.user_movie_watches TO service_role;
GRANT ALL ON public.commentary_scores TO service_role;

-- RLS
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_external_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog genres are readable" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Catalog services are readable" ON public.streaming_services FOR SELECT USING (true);
CREATE POLICY "Catalog movies are readable" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Catalog movie_genres are readable" ON public.movie_genres FOR SELECT USING (true);
CREATE POLICY "Catalog availability is readable" ON public.movie_availability FOR SELECT USING (true);
CREATE POLICY "Catalog podcasts are readable" ON public.podcasts FOR SELECT USING (true);
CREATE POLICY "Catalog metrics are readable" ON public.podcast_external_metrics FOR SELECT USING (true);
CREATE POLICY "Catalog episodes are readable" ON public.podcast_episodes FOR SELECT USING (true);
CREATE POLICY "Catalog episode sources are readable" ON public.episode_sources FOR SELECT USING (true);
CREATE POLICY "Catalog episode movies are readable" ON public.episode_movies FOR SELECT USING (true);

ALTER TABLE public.user_streaming_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own streaming services" ON public.user_streaming_services FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_podcast_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own podcast preferences" ON public.user_podcast_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_episode_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own episode ratings" ON public.user_episode_ratings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_episode_listening ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own listening status" ON public.user_episode_listening FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_production_quality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own production quality" ON public.user_production_quality FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own watchlists" ON public.watchlists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.watchlist_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own watchlist movies" ON public.watchlist_movies FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));

ALTER TABLE public.user_movie_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own watch history" ON public.user_movie_watches FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.commentary_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own commentary scores" ON public.commentary_scores FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());