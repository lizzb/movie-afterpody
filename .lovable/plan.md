# Movie Afterparty — MVP Plan

A mobile-first app for finding the movie that will give you the best combined movie + commentary night.

## Visual direction: bright cinematic editorial

Warm ivory/cream canvas, dark navy/charcoal text, and a lively movie-poster accent palette (coral/tomato, berry red, golden yellow, muted purple, occasional teal). Posters are the visual anchor: rounded cards, generous spacing, subtle shadows, crisp metadata hierarchy built for fast scanning. Clean modern sans-serif throughout, with a display face used sparingly on major headings only. Bright, warm, playful, polished, slightly cheeky — a place to browse movies for fun. No dark/noir archive aesthetics, no black-dominant canvas, no film-scholar seriousness, no corporate SaaS look, no cartoon styling.

## What you'll be able to do

- **Tonight** (home): a ranked feed of movies available on the streaming services you've selected, each card showing poster, year/runtime, service badge, a 0-100 **Commentary Score**, a one-line reason it scored well, and how many commentary tracks exist. Filter chips for genre, year, runtime, unwatched, commentary availability, commentary score, and preferred podcasts.
- **Movie detail**: synopsis, availability, watched/watch-date toggle, watchlist add, and every known commentary episode ranked for you — podcast artwork, duration, preferred-podcast marker, "Listen ↗" to the best external destination, listening status (Not started / Started / Finished), 😞/😐/😊 rating, and an optional production-quality note (poor / okay / good).
- **Podcasts**: browse the catalog, mark a podcast **Preferred**, and on a podcast's page see the movies it has covered that you can stream right now.
- **Discover podcasts**: ranked by backlog size, recent activity, external rating and rating count, movies covered, and fit with your taste.
- **Lists**: create watchlists (Date Night, Halloween, Rom-Coms, …); a movie can live in many.
- **Settings**: pick and change your streaming services at any time; see watch history.

## Build order

The first milestone is a usable, clickable product on seeded data — no external APIs, no AI, no large-scale ingestion. Later phases layer real data in behind the same interfaces.

**Milestone 1 — playable vertical slice (seeded data)**

1. Lovable Cloud + the full core schema, RLS, grants, streaming-service reference data.
2. Design system tokens for the bright cinematic editorial direction.
3. App shell and bottom tab navigation.
4. Tonight discovery screen with working filters, on seeded movies.
5. Movie detail screen.
6. Commentary episode display on the movie detail.
7. Podcast preference toggles and episode rating / listening-status interactions.
8. Deterministic Commentary Score + explanations over the seeded data.
9. Watchlists and watched/unwatched state.

At the end of milestone 1 you can browse seeded movies, filter them, inspect Commentary Score and its explanation, view commentary episodes, mark podcasts preferred, and rate episodes.

**Milestone 2 — real data**

10. Streaming-provider integration behind the provider abstraction (TMDB, whose JustWatch-backed data supplies availability, posters, runtimes, genres, synopses, external IDs).
11. Podcast catalog ingestion via Podcast Index, provider-neutral source records.
12. Deterministic episode-to-movie matching (normalized titles, episode-title patterns, year hints, sanity checks).
13. One-time AI fallback for the genuinely ambiguous leftovers only, persisted after the single pass.

I'll ask for a TMDB API read token and a Podcast Index key + secret when milestone 2 starts — nothing is needed before then.

## Data scope

- **Seed data** for milestone 1: a representative set of movies plus roughly 20-25 representative movie-commentary podcasts with a subset of their episodes, inserted as literal rows in the migration.
- The prototype's 20-25 podcasts is a seeding scope, **not** an application limit — schema, ingestion, and pagination are designed for 100+ podcasts with full historical backlogs.
- Streaming availability is always provider-sourced once milestone 2 lands; never hand-entered.
- AI is never called on page load, filtering, scoring, or ranking. Enrichment runs once and persists, and the app works fully when AI is unavailable.

## Commentary Score

Deterministic, computed and stored per user per movie — never an LLM at runtime. Inputs: episode count, distinct podcast count, preferred podcasts covering it, podcasts you tend to finish, your episode ratings, podcast external rating and rating count, podcast activity, similarity to what you've enjoyed, and production quality as a light secondary signal only (a small podcast with rough audio and great commentary must not get buried). Each score saves a short human-readable explanation, which is what the card shows.

## Technical notes

- Canonical catalog data is strictly separated from user data; every user table is keyed by `user_id` with RLS from day one so multi-user works later without migration.
- Tables: `movies`, `genres`, `movie_genres`, `streaming_services`, `movie_availability`, `podcasts`, `podcast_external_metrics`, `podcast_episodes`, `episode_movies` (many-to-many, with match method + confidence), `episode_sources` (platform, URL, access tier for premium/private), plus user-scoped `user_streaming_services`, `user_podcast_preferences` (preferred / neutral, with room for "do not recommend"), `user_episode_ratings`, `user_episode_listening` (status now; position/duration/percent columns reserved for embedded playback), `user_production_quality`, `watchlists`, `watchlist_movies`, `user_movie_watches`, and `commentary_scores` with its explanation. Movies carry a `media_type` column so TV can be added later.
- Providers live behind `src/lib/providers/streaming/*` and `src/lib/providers/podcasts/*` with a shared interface; milestone 1 ships a seeded/local implementation of each, so milestone 2 swaps the adapter without touching screens.
- `episode_sources` covers RSS, Apple, Spotify, website archives, and Patreon-style premium tiers from the start, so no platform is canonical and future sources need no schema change.
- Recommendation and scoring logic is pure, explicit-rule TypeScript with the weights in one config object (availability > genre > runtime > preferred podcasts > commentary quality > year > movie preferences), so weighting becomes configurable later without a rewrite.

## Deferred, but designed for

Embedded playback, Patreon ingestion, website/archive scraping, TV support, ML recommendations, detailed movie ratings, smart/dynamic watchlists, social features, and configurable recommendation weights. These stay out of the build but keep their place in the schema and provider interfaces.

## Explicitly out of scope

Manual per-episode cataloging, manual listening percentages, native/embedded audio playback, and multi-user collaboration features.
