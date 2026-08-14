# Movie Afterparty — MVP Plan

A mobile-first app for finding the movie that will give you the best combined movie + commentary night. Dark "editorial archival noir" look: near-black canvas, amber accent, Geist for UI, Newsreader italic for editorial lines, bottom tab nav.

## What you'll be able to do

- **Tonight** (home): a ranked feed of movies available on the streaming services you've selected, each card showing poster, year/runtime, service badge, a 0-100 **Commentary Score** with a bar, a one-line reason it scored well, and how many commentary tracks exist. Filter chips for genre, year, runtime, unwatched, commentary availability, commentary score, and preferred podcasts.
- **Movie detail**: synopsis, availability, watched/watch-date toggle, watchlist add, and every known commentary episode ranked for you — podcast artwork, duration, preferred-podcast marker, "Listen ↗" to the best external destination, listening status (Not started / Started / Finished), 😞/😐/😊 rating, and an optional production-quality note (poor / okay / good).
- **Podcasts**: browse the prepopulated catalog, mark a podcast **Preferred**, and on a podcast's page see the movies it has covered that you can stream right now.
- **Discover podcasts**: ranked by backlog size, recent activity, external rating and rating count, movies covered, and fit with your taste.
- **Lists**: create watchlists (Date Night, Halloween, Rom-Coms, …); a movie can live in many.
- **Settings**: pick and change your streaming services at any time; see watch history.

## Data and how the catalog gets built

- **Movies + streaming availability**: TMDB (titles, year, runtime, genres, synopsis, posters, external IDs, and its JustWatch-backed provider data) behind a provider abstraction so the source can be swapped later. Availability is refreshed from the provider, never hand-entered.
- **Podcasts + episodes**: Podcast Index for feed discovery and episode metadata, with provider-neutral source records (RSS, Apple, Spotify, website, Patreon-ready) so no single platform is canonical.
- **Seed scope**: ~25 hand-curated movie-commentary podcasts with their full episode backlog.
- **Episode → movie matching**: deterministic title/year parsing plus heuristics first (normalized titles, episode-title patterns, year hints, runtime sanity checks). Only genuinely ambiguous leftovers go to an AI pass, run **once** during ingestion, with results persisted. Nothing calls AI on page load, filtering, scoring, or ranking, and the app works fully if AI is unavailable. One episode can map to many movies.

I'll need two API keys from you when we get there: a **TMDB API read token** and a **Podcast Index API key + secret**. I'll ask for them securely at that step.

## Commentary Score

Deterministic, computed and stored per user per movie — never an LLM at runtime. Inputs: episode count, distinct podcast count, preferred podcasts covering it, podcasts you tend to finish, your episode ratings, podcast external rating and rating count, podcast activity, similarity to what you've enjoyed, and production quality as a light secondary signal only (a small podcast with rough audio and great commentary must not get buried). Each score saves a short human-readable explanation, which is what the card shows.

## Technical notes

- Lovable Cloud for the database; canonical catalog tables are strictly separated from user data, and every user table is keyed by `user_id` with RLS from day one so multi-user works later without migration.
- Tables: `movies`, `genres`, `movie_genres`, `streaming_services`, `movie_availability`, `podcasts`, `podcast_external_metrics`, `podcast_episodes`, `episode_movies` (many-to-many, with match method + confidence), `episode_sources` (platform, URL, access tier for premium/private), plus user-scoped `user_streaming_services`, `user_podcast_preferences` (preferred / neutral, with room for "do not recommend"), `user_episode_ratings`, `user_episode_listening` (status now; position/duration/percent columns reserved), `user_production_quality`, `watchlists`, `watchlist_movies`, `user_movie_watches`, and `commentary_scores` with its explanation. Movies carry a `media_type` column so TV can be added later.
- Providers live behind `src/lib/providers/streaming/*` and `src/lib/providers/podcasts/*` with a shared interface; ingestion and scoring run as server functions, with an admin-only ingest/refresh trigger in Settings.
- Recommendation and scoring logic is pure, explicit-rule TypeScript with the weights in one config object (availability > genre > runtime > preferred podcasts > commentary quality > year > movie preferences), so weighting becomes configurable later without a rewrite.

## Explicitly out of scope for this build

Embedded playback, Patreon ingestion, website archive scraping, TV, ML recommendations, detailed movie ratings, dynamic/smart watchlists, social features, and any manual per-episode cataloging or manual listening percentages.

## Build order

1. Cloud + full schema, RLS, grants, streaming-service seed data.
2. Design system tokens, app shell, bottom tab nav.
3. Provider abstractions + TMDB and Podcast Index ingestion server functions; seed the 25 podcasts and their backlog.
4. Deterministic matcher, then the one-time AI pass for ambiguous episodes.
5. Commentary Score engine + explanations.
6. Screens: Tonight, movie detail, podcasts, podcast detail, discover, lists, settings.
