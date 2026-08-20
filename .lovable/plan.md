# Movie Afterparty — consolidated roadmap (passes A–R)

Pass R (shrink the working set) is approved and parked in the backlog below — not being implemented now.

Priority reflects the app's current state: a personal tool for one user, refining the match engine on a small data set. Anything aimed at a wider audience or large-scale automatic ingestion is deliberately low priority. Token estimates are build-cost ballparks.

---

# Not yet done

## Do next

### Pass R — Shrink the working set without losing work — ~55k — Priority 1
Per-podcast Active / Parked curation status. Parked shows keep every ingested episode but drop out of all review queues, stat tiles and the user-facing app; flip back any time with nothing to re-ingest. Adds scope-aware queues, a per-show progress line (linked / reviewed / unmatched), bulk "Retire remaining unmatched" for mixed shows like Crime Writers On..., an explicitly-labelled per-show episode purge, and a "Score the matcher" action that measures precision/recall against your logged approve/reject decisions. No movie data removed. Full detail: `.lovable/plan/pass-r-shrink-working-set-2026-08-20.md`.

### Pass C2 — Description-aware matching — ~45k — Priority 2
The remaining half of pass C. Score episode↔movie using the stored episode description as well as the title (all episodes already have descriptions; nothing reads them), with year proximity from the description body. Deterministic, no AI, no tokens at runtime. This is the single biggest accuracy lever left and it pairs directly with pass R's measurement loop.

### Pass K — Ingestion throughput and honest errors — ~35k — Priority 3
"Build movies from episodes" reports why episodes were skipped instead of silently doing fewer than requested. Per-podcast sync errors surfaced, "sync all incomplete" button, and a coverage filter for shows where stored count is below feed count. Partially done already (availability sync remembers its offset and reports a range).

## Worth doing soon

### Pass D — Header consistency + info sheet — ~30k — Priority 4
Same header template across Movies, Shows, Lists, Setup; popcorn icon beside the app title; an info sheet explaining the app, Commentary Score and Match score, with per-page description paragraphs moved into it to reclaim vertical space.

### Pass E — Card cleanup — ~20k — Priority 5
Drop the redundant "Watched" badge now that the eye/check control exists, and shrink the commentary badge to icon + number with the label on tap. Recommended option: "N episodes" text with the score as a thin accent bar on the card edge.

### Pass F — Destructive actions and undo feedback — ~25k — Priority 6
Confirmation dialog before deleting a watchlist plus an undo snackbar (~8 second soft delete), the same snackbar for following a show ("Following <show name>" + Undo) which also clears up the heart ambiguity. `alert-dialog` and `sonner` are both present but unused for this.

### Pass H — Discovery controls, completed — ~35k — Priority 7
Filter/sort behind a bottom sheet: sort by episode count, runtime, year, title, availability; filter by genre, runtime, service, watched/unwatched. Adds "Not interested" on movie cards and Tonight. A compact `FilterBar` already exists, so this is an extension rather than new ground.

### Pass I — Listening history — ~20k — Priority 8
A "Listened" view on Lists & History: episodes you rated or moved between not started / started / finished, newest first. Data is already captured; nothing surfaces it.

### Pass J — Episode presentation — ~30k — Priority 9
Episode rows get truncated descriptions with expand, consistent title/date/duration/controls on both movie and podcast pages, and a segmented control on podcast pages for movie-focused vs episode-focused views. Per-episode pages stay deferred.

## Backlog (wider-audience or large-volume — hold until the engine is trustworthy)

### Pass G — App settings block — ~15k — Priority 10
Viewport lock (default on, with an accessibility opt-out to re-enable zoom) and a dim-watched-items toggle on Setup.

### Pass L — Scheduled refresh — ~40k — Priority 11
Server-side scheduled refresh (feeds daily, availability weekly, staggered) with a visible "last synced" per podcast/movie and manual override retained. Explicitly backlogged: automating volume before the matcher is accurate multiplies review work.

### Pass M — External ratings, user-controlled — ~60k — Priority 12
Per-user choice of which ratings to show, cached in the `podcast_external_metrics` shape extended to movies. Realistic sources: TMDB (already integrated), OMDb (IMDb / Metascore), Trakt; Podcast Index (integrated), Apple Podcasts (unofficial), Podchaser (paid). Letterboxd has no public API; Spotify has no ratings.

### Pass N — Tags/vibes and people-based discovery — ~70k — Priority 13
Shared tag system for movies and shows (curated starter tags, user-proposed, emoji allowed, character cap, tag filtering) plus TMDB person search leading to an actor page filtered to titles with commentary coverage.

### Pass P — Richer movie detail (cast) — ~40k — Priority 14
Top-billed cast and director from TMDB credits shown on the movie page, with an external link out for anything deeper. Needs a cast cache table and a credits fetch during enrich.

---

# Already done

### Milestone 1 — Schema, design system, Tonight feed — verified
Relational catalog/user split, oklch "Cinema Neon" token system in `src/styles.css`, accents, deterministic `calculateCommentaryScore`, Tonight feed. Verified in the preview. Note: originally built on hand-seeded demo data, all of which has since been purged at your request.

### Milestone 2 — Movies, filters, settings, taste profile — verified
Movie list and detail routes, local-first preferences (`src/lib/prefs.ts`), discovery engine (`src/lib/discovery.ts`), `AppShell` bottom tabs, compact settings with service chips and the dual-handle `YearRange` slider. Verified.

### Milestone 3 — Podcast pages and discovery feed — verified
`usePodcasts` ranking, podcasts index with filters and stable sort (no mid-interaction re-sort), podcast detail with covered movies, cross-linking from movie detail. Verified.

### Milestone 4 — Watchlists and history — verified
Lists tab, add-to-list from cards and detail, watched history, "Watched" toggle on cards and Tonight. Verified. Not included: listening history (that is pass I).

### Milestone 5 — Real data ingestion — verified
Admin role gating, TMDB and Podcast Index providers, `/admin/ingest`, podcast-first pipeline (episode title → TMDB extraction → create movie → link), episode sync up to 1000 per show with a coverage card, batched availability + genre sync with a remembered offset, artwork backfill, `CatalogAddCard` for adding from search misses. Verified end to end against real data: 23 shows, ~7,050 episodes, 573 movies, 1,376 links.

### Pass A — 1000-row ceiling — verified
`src/lib/data.ts` and the admin helpers page every full-table read (`pageAll`), which fixed movies that looked episode-less and truncated counts. Verified by row counts.

### Pass B / Pass Q — Match review, consolidated — verified in code, lightly exercised
One Match review section with Proposed / Existing tabs, shared search including show names, confidence bands, multi-select bulk approve/reject/confirm/unlink, `match_actions` history with undo, IMDb id (`tt…`) lookup, stat tiles as anchors, rescan relocated next to Unmatched episodes. Remaining: the bulk paths have not been exercised at volume, and the "Pending review" tile definition should be re-checked against what the section actually lists.

### Pass C (part 1) — Disposition + learned penalties — verified in code
`disposition` on episodes (`needs_review` / `movie_matched` / `not_about_a_movie`), `signals` jsonb on links, generic one-word-title penalty, rejection-count penalty from the 193 recorded rejections. NOT included and still open: description-based scoring, and weight tuning from real counts — that is pass C2 above.

### Data purges — done deliberately
All hand-seeded podcasts, episodes and movies were removed (twice) so the catalogue contains only real ingested data. Genres and streaming services were kept as reference data.
