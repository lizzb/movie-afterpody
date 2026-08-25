# Getting real data in: sign in, become admin, run ingestion

## Part 1 — Steps you do yourself (no code needed)

1. **Sign in.** Go to `/auth`. Either "Continue with Google" or create an email account (email + password, 6+ chars). Email signup may ask you to confirm via a link before the session sticks; Google is instant.
2. **Become admin.** Go to `/admin/ingest`. Because no admin exists yet, the page shows "You are not an admin yet" with a **Make me the first admin** button. Click it once — it only works while the roles table is empty, so it's safe. The page then reloads into the real ingest dashboard with counters (movies, podcasts, episodes, matched, pending, TMDB linked).
3. **Pull podcast episodes.** In "Ingest podcast", type a show name (e.g. `How Did This Get Made?`) or paste its RSS feed URL, then submit. It fetches the real episode list, inserts new episodes, auto-matches confident episode↔movie pairs and queues the rest. Repeat per show.
4. **Enrich movies from TMDB.** In "Enrich movie from TMDB", enter a title (+ year if ambiguous) and submit. That fills runtime, synopsis, **poster**, backdrop and the TMDB id. Posters appear on cards immediately after.
5. **Refresh availability.** Click **Refresh US availability**. This walks every movie that has a TMDB id and rewrites which services carry it.
6. **Review fuzzy matches.** In "Review matches", pick a podcast and approve/reject the suggested episode↔movie links that weren't confident enough to auto-apply.

## Part 2 — Code changes that make this practical

Step 4 today is one movie per submit, and you have ~40 seeded movies — that's 40 form submissions before any poster art exists. Same story for podcast cover art, which nothing currently fetches.

Changes to build:

1. **Bulk movie enrichment.** New admin server function `enrichAllMovies` that iterates movies missing `tmdb_id` (or missing `poster_url`), runs the existing `findBestTmdbMatch` per movie with a small delay between calls, and returns `{ updated, skipped, lowConfidence[] }`. Surfaced as an "Enrich all movies" button in `admin.ingest.tsx` with a result summary listing any low-confidence titles for manual follow-up.
2. **Podcast artwork.** Extend the Podcast Index ingest path to also store `artwork_url` (and `feed_url`, `website_url`, `latest_episode_at`, `episode_count`) on `podcasts`, so `Artwork.tsx` renders real cover art instead of letter tiles. For the 20+ already-seeded shows, add a `backfillPodcastArtwork` admin function that looks each existing podcast up by name/feed on Podcast Index and fills the missing fields.
3. **Progress feedback.** Both bulk actions report counts as they finish and refresh the stats grid, so it's obvious how much of the catalog is now real.

## Technical notes

- All new functions follow the existing pattern in `src/lib/ingestion.functions.ts`: `createServerFn` + `requireSupabaseAuth` + `requireAdmin(context)`, with `supabaseAdmin` and provider modules loaded inside the handler.
- Bulk loops stay sequential with a short sleep to respect TMDB / Podcast Index rate limits, and are capped per invocation (e.g. 25 movies) so a single request can't run long; the button can be pressed again to continue.
- No schema changes needed — `movies.poster_url`, `podcasts.artwork_url`, `feed_url`, `website_url` all already exist.
