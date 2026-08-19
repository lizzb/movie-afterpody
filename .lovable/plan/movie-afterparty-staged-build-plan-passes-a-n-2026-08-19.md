# Movie Afterparty — staged build plan (passes A–N)

Each pass is a self-contained chunk. Reference them by letter. Order is roughly the order I'd build them; A–C are the highest-value ones because they fix correctness, not polish.

## Answers to your direct questions first

- **Does "add a movie manually, then rescan all podcasts" already exist?** Half of it. `enrichMovie` (admin ingest → "Enrich movie from TMDB") creates/updates a movie from a title, and `rescanEpisodeMatches` re-attempts links for already-unmatched episodes against all existing movies (skipping rejected pairs). What's missing: a way to *fix* an existing wrong link, per-podcast scoping, and any surfacing of these tools outside the admin page.
- **Why do Movies show titles with no commentary episodes, if ingestion is podcast-first?** Confirmed it is a display bug, not a data bug. In the database every one of the 491 movies has at least one episode link (0 orphans). But `src/lib/data.ts` fetches episodes and episode links with no pagination, and the backend caps a single response at 1000 rows — there are 6,618 episodes. So the app only ever sees the first ~1000, and every movie whose episodes fall outside that window looks empty. Same cause for some "Mom Can't Cook!" episodes appearing unmapped in the UI.
- **Is "Streaming availability + genres" really restarting at movie 1 every run?** The label is misleading: the function takes an offset, but the button always sends 0. It genuinely redoes the first 40 movies each press.
- **Are episode descriptions ingested?** Yes — all 6,618 episodes have a description stored. Nothing renders it.
- **UI pattern names you asked for:** the "are you sure?" popup is a **confirmation dialog** (destructive-action confirmation / **AlertDialog** in this codebase's component library). The floating "Deleted — Undo" strip is a **snackbar with an undo action** (also called a toast with an undo affordance; the underlying pattern is **optimistic delete with undo window**, sometimes **soft delete + grace period**). I'll add a short reference doc of the control vocabulary I use (dialog, sheet, popover, drawer, segmented control, chip/filter chip, stepper, skeleton, empty state, etc.) as part of pass D so we share terms.
- **Match score vs Commentary score:** Commentary Score = per-movie, computed in `src/lib/scoring.ts` from how many episodes cover it, episode length, podcast activity, and your podcast preferences. Match score = per-podcast, in `src/lib/podcasts.ts`, how well a show fits your services/era/runtime taste. Both are deterministic, no AI. User-tunable weights are a real feature but a later pass (M).

---

## Pass A — Fix the 1000-row ceiling (correctness, do first)
Rework `src/lib/data.ts` so episode and link data is fetched in pages (or narrowed per-route) instead of one unbounded query. Add a per-movie episode-count read that isn't truncated. This alone fixes: movies that look episode-less, missing episodes on movie pages, wrong counts on cards, and the "Mom Can't Cook! isn't mapping" symptom.

## Pass B — Fix wrong matches from anywhere in the app
- "Wrong movie?" control on every episode row (movie detail page + podcast page), admin-only at first: unlink, record the rejection, and open a small movie search to relink immediately.
- Admin "Review matches" gets a proper worklist: search by podcast, by movie title, by confidence band; sort by confidence; filter to unresolved only.
- No blanket "approve everything below 95%" gate — 676 links are under 95%, that's a review queue, not a wall. Instead surface a "Needs a look" badge on low-confidence links so they get corrected through normal use.

## Pass C — Better matching + classifying non-movie episodes
- Score episode↔movie using the episode **description** as well as the title, plus year proximity, and penalise generic one-word titles (the "Genius" failure). Deterministic, no AI.
- Add an explicit episode disposition: `movie_matched` / `not_about_a_movie` / `needs_review`, so ads, trailers, Q&As and admin episodes leave the unmatched pile permanently.
- Podcast pages list **every** episode chronologically, matched or not.
- Cheap "learning": keep the rejection log as negative evidence and record which signals produced approved matches, then tune the weights from real counts. No model, no tokens.

## Pass D — Header/title consistency + info sheet
Adopt the Tonight header template (icon + small-caps eyebrow, then title) on Movies, Shows, Lists, Setup, using the same font sizes. Popcorn icon to the left of the app title in the header bar. The info icon opens a real explanation sheet (what the app is, what Commentary Score and Match score mean), and the per-page description paragraphs move into it to reclaim vertical space. Title copy alternatives, no em-dash:
1. "What to watch, and what to play after."
2. "Pick a movie. Get the afterparty."
3. "Tonight's movie plus its best commentary episode."

## Pass E — Card cleanup
Drop the redundant "Watched" badge now that the eye/check control exists. Commentary badge alternatives (pick one, I'd recommend #2):
1. Popcorn icon + number only, label revealed on tap/hover.
2. Replace the number with "N episodes" and move the score into a thin accent bar on the card edge.
3. Keep the pill but shrink to icon + number, with a one-time coach-mark explaining it.
4. Swap the numeric score for 1–3 popcorn glyphs (a rough tier rather than a false-precision number).

## Pass F — Destructive actions and feedback
Confirmation dialog before deleting a watchlist, plus an undo snackbar (soft delete for ~8 seconds). Same snackbar used when hearting a show from an episode card, worded "Following <show name>" with Undo, which also resolves the "am I hearting the episode or the show?" ambiguity. Plus a lightweight ring around the heart icon and a rounder heart glyph.

## Pass G — App settings section (Setup page)
New "App settings" block: viewport lock (default on: prevents pinch zoom and pan, keeps the layout fixed) with an accessibility toggle to re-enable zoom; dim watched/listened items on/off. Professional apps overwhelmingly ship zoom enabled but design so it isn't needed; a user-controlled lock with an accessible opt-out is the responsible version of your preference.

## Pass H — Movies and Shows discovery controls
Full filter/sort panel behind a button (bottom sheet on mobile): sort by episode count, runtime, year, title, availability; filter by genre, runtime, service, watched/unwatched, and hide "not interested". Adds the "Not interested" action on movie cards and Tonight.

## Pass I — Listening history
"Listened" view on Lists & History: episodes you rated or moved between not started / started / finished, newest change first.

## Pass J — Episode presentation
Episode rows get a truncated description with expand, consistent title/date/duration/controls on both movie and podcast pages, and a segmented control on podcast pages to switch between movie-focused and episode-focused views. Dedicated per-episode pages: worth it later, once external ratings and comments exist; I'd defer.

## Pass K — Ingestion throughput and honest errors
Availability sync remembers its offset and reports "movies 41–80 of 491"; a "run until done" mode chains batches. "Build movies from episodes" reports why episodes were skipped rather than silently doing 30 of 100. Episode sync shows per-podcast errors and a "sync all incomplete" button, plus a filter on the Episode coverage list for podcasts where stored count is less than feed count.

## Pass L — Scheduled refresh
Replace manual buttons with scheduled server-side refresh (feeds daily, availability weekly, staggered), with a visible "last synced" timestamp per podcast/movie and manual override retained.

## Pass M — External ratings, user-controlled
Which services are realistically available: movies — TMDB (ratings/vote counts, already integrated), OMDb (IMDb rating, Metascore, Rotten Tomatoes when licensed), Trakt (plays/watchers); Letterboxd has no public API. Podcasts — Podcast Index (already integrated), Apple Podcasts ratings (public but unofficial), Spotify (catalogue only, no ratings), Podchaser (ratings/reviews, paid tiers); Overcast/Pocket Casts/Audible expose nothing usable. Plan: a per-user "which ratings to show" preference list, cached rating rows in the existing `podcast_external_metrics` shape extended to movies.

## Pass N — Tags/vibes and people-based discovery
Shared tag system for movies and shows: curated starter tags, user-proposed tags, emoji allowed, character cap, tag-based filtering; later crowdsourced counts. Actor discovery: TMDB person search leading to a person page with their catalogue filtered to titles that have commentary coverage.

---

## Technical notes

- Pass A is a data-layer change in `src/lib/data.ts` only; no schema change.
- Passes B/C need small schema additions: an episode disposition column (or table) and a signals column on the match log; both get GRANTs and RLS in the same migration.
- Match scoring stays deterministic in `src/lib/providers/matching.server.ts`; description text is already in the database so no re-ingest is needed.
- Sizing guess for user-tunable score weights (from M): schema for stored weights, a weight editor UI, and reworking `scoring.ts`/`podcasts.ts` to read them — roughly one full pass on its own, best done after M's rating sources exist.
- iPhone home-screen icon: `add to Home Screen` in Safari uses `apple-touch-icon`, which this project doesn't declare, so iOS falls back to a screenshot/letter tile. Fix is a 180x180 PNG plus an `apple-touch-icon` link and a web app manifest; folded into pass D. Adding via Safari is the correct route; the alternative is just a bookmark.
