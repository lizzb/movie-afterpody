# Movie Afterparty — current consolidated roadmap

**This is the only active plan file.** Everything in `.lovable/plan/archive/` is historical and superseded — read it for background only. When a pass ships, its entry moves to "Already done" below with a `— shipped YYYY-MM-DD` stamp in the same edit.

Priority reflects the app's current state: a personal tool for one user, refining the match engine on a small data set. Anything aimed at a wider audience or large-scale automatic ingestion is deliberately low priority. Token estimates are build-cost ballparks.

---

# Not yet done

## Do next

### Pass R2 — Episode-level noise handling — ~20k — Priority 1
The only remaining piece of Pass R (R1 and R3 both shipped — see "Already done"). Original detail: `.lovable/plan/archive/pass-r-shrink-working-set-2026-08-20.md`.

Bulk "Retire remaining unmatched" on one show (marks every still-unmatched episode `not_about_a_movie`, logged in `match_actions`, undoable), plus the separately-labelled destructive "Delete episodes, keep the show".

### New backlog passes (approved 2026-08-23, not scheduled)

#### Pass X — Leaving-soon streaming windows — ~45k (or ~15k for the honest subset) — Priority 11
**What the data supports:** TMDB `/watch/providers` (JustWatch-sourced) returns *current* availability only — no leave dates, no offer expiry, no "recently added". Neither does the free JustWatch surface. Real leave-date feeds exist only in paid/licensed products (JustWatch partner API, Reelgood, Watchmode "expiring" endpoints). So there are two honest options:

- **X1 — Self-derived change detection (~15k, no new provider).** We already stamp `availability_checked_at`. Add an `availability_history` table (movie, service, offer type, first_seen, last_seen) written on every availability run. That gives real "Added in the last 30 days" and "Disappeared since <date>" signals, plus a "leaving soon" *heuristic* only if a provider ever exposes dates. Honest labels: "New on your services", "Was on Netflix until 12 Aug".
- **X2 — Licensed expiry data (~45k + subscription cost).** Watchmode or Reelgood expiring-titles endpoint keyed per region, stored as `leaves_on` on `movie_availability`, surfaced as a "Leaving soon" filter on Tonight and Movies, a countdown badge on cards, and a sort option. Requires a paid API key and a scheduled refresh (ties to Pass L).

Recommendation: build X1 first — it is free, needs no new vendor, and answers "what changed" — and only take X2 if true leave dates become a must.

#### Pass Y — MPA / TV content-rating filters — ~25k — Priority 7b (folded into Pass H)
Available from TMDB at no extra cost per movie beyond one call we can fold into enrichment: `/movie/{id}/release_dates` gives the US `certification` (G, PG, PG-13, R, NC-17, NR) and `/tv/{id}/content_ratings` gives TV ratings (TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA) for Pass V.

- Migration: `certification text` + `certification_system text` on `movies`, backfilled by a new "Backfill content ratings" admin action (chunked, resumable, same shape as availability sync).
- Normalised ladder so movie and TV ratings sort together: TV-Y < TV-Y7 < G/TV-G < PG/TV-PG < PG-13/TV-14 < R/TV-MA < NC-17, with unrated handled explicitly (its own opt-in toggle, never silently included or excluded).
- Filters: a max-rating chip row in the Movies filter sheet and the same allowance applied to Tonight; stored in `prefs` next to services and year range. Unrated titles show a small "NR" marker.



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

### Pass W — Franchise and sequel disambiguation — shipped 2026-08-25
`matching.server.ts` gained a franchise post-pass plus three new signals (`episodeCoverage`, `distinguisherPenalty`, `familySuppressed`): sequel markers in the episode title (II/III, digits, "return", "part", "chapter", "revenge") penalise a candidate that lacks them; within a title-stem family a sibling carrying the marker suppresses any title whose words are a subset of it; the longest fully-covered title wins, and an exact hit settles the family outright; symmetric coverage docks candidates that account for little of what the episode names; and candidates sharing a TMDB collection collapse to the best-scoring one. `collection_id` added to `movies` (indexed), read from `belongs_to_collection` in the enrich, add-movie and availability passes (availability never overwrites a known id with null) and selected into every candidate query. `matcher-eval.server.ts` reports lift for the three new signals, so before/after runs of "Score the matcher" compare directly.

### Milestone 1 — Schema, design system, Tonight feed — shipped 2026-08-14
Relational catalog/user split, oklch "Cinema Neon" token system in `src/styles.css`, accents, deterministic `calculateCommentaryScore`, Tonight feed. Verified in the preview. Note: originally built on hand-seeded demo data, all of which has since been purged at your request.

### Milestone 2 — Movies, filters, settings, taste profile — shipped 2026-08-15
Movie list and detail routes, local-first preferences (`src/lib/prefs.ts`), discovery engine (`src/lib/discovery.ts`), `AppShell` bottom tabs, compact settings with service chips and the dual-handle `YearRange` slider. Verified.

### Milestone 3 — Podcast pages and discovery feed — shipped 2026-08-15
`usePodcasts` ranking, podcasts index with filters and stable sort (no mid-interaction re-sort), podcast detail with covered movies, cross-linking from movie detail. Verified.

### Milestone 4 — Watchlists and history — shipped 2026-08-16
Lists tab, add-to-list from cards and detail, watched history, "Watched" toggle on cards and Tonight. Verified. Not included: listening history (that is pass I).

### Milestone 5 — Real data ingestion — shipped 2026-08-17
Admin role gating, TMDB and Podcast Index providers, `/admin/ingest`, podcast-first pipeline (episode title → TMDB extraction → create movie → link), episode sync up to 1000 per show with a coverage card, batched availability + genre sync with a remembered offset, artwork backfill, `CatalogAddCard` for adding from search misses. Verified end to end against real data: 23 shows, ~7,050 episodes, 573 movies, 1,376 links.

### Pass A — 1000-row ceiling — shipped 2026-08-19
`src/lib/data.ts` and the admin helpers page every full-table read (`pageAll`), which fixed movies that looked episode-less and truncated counts. Verified by row counts.

### Pass B / Pass Q — Match review, consolidated — shipped 2026-08-20 (lightly exercised)
One Match review section with Proposed / Existing tabs, shared search including show names, confidence bands, multi-select bulk approve/reject/confirm/unlink, `match_actions` history with undo, IMDb id (`tt…`) lookup, stat tiles as anchors, rescan relocated next to Unmatched episodes. Remaining: the bulk paths have not been exercised at volume, and the "Pending review" tile definition should be re-checked against what the section actually lists.

### Pass C (part 1) — Disposition + learned penalties — shipped 2026-08-20
`disposition` on episodes (`needs_review` / `movie_matched` / `not_about_a_movie`), `signals` jsonb on links, generic one-word-title penalty, rejection-count penalty from the 193 recorded rejections. NOT included and still open: description-based scoring, and weight tuning from real counts — that is pass C2 above.

### Data purges — done deliberately
All hand-seeded podcasts, episodes and movies were removed (twice) so the catalogue contains only real ingested data. Genres and streaming services were kept as reference data.

### Availability accuracy + throughput — shipped 2026-08-21
`availability_checked_at` per movie; staleness-first queue (never-checked, then oldest) so repeat runs always progress; batches of 80 chained automatically up to 400 movies per press; per-movie region rows deleted before insert so expired offers actually disappear; freshness tiles (never checked / older than 7 days / oldest check / last run). Only `subscription` and `free_ads` count as streaming — `rent`/`buy` are stored, shown on the movie page as a muted "Rent or buy only" line, and never badge a movie as available. TMDB provider 10 (Amazon Video storefront) mapped to Prime as a rent/buy offer, which was the source of the false "on Prime" badges. Movie pages show "Availability checked N days ago" so stale data is distinguishable from a genuine rental-only title.

### Pass K — Ingestion throughput and honest errors — shipped 2026-08-21
"Build movies from episodes" now returns a per-reason skip breakdown (not about a movie / no title extracted / no TMDB match / already rejected / errored) with counts plus examples, and reports pool vs requested vs attempted so a short run is always explained. Podcast ingest returns feed total, stored count and named per-episode failures instead of a silent console warning. Episode coverage gained a "Behind feed only" filter, a per-show missing count, and a "Sync all incomplete" button that walks every active show behind its feed, keeps going after failures and logs each outcome by name. Availability sync gained a "Run until done" mode and now reports "movies 41-80 of 491" plus the failing movie names.

### Pass C2 — Description-aware matching — shipped 2026-08-21
`matching.server.ts` now reads the episode description (first 700 chars, HTML stripped) alongside the title: a verbatim title mention lifts a weak title match to ~48-58, boosts an existing title match by 10, and years found in the description add up to 10 more (or a small penalty when a description-only match's year is absent). Guards keep short/generic titles from matching on description alone. Two new signals (`descTitle`, `descYear`) plus a `description` rule are stored on every link for pass R3's evaluation. Descriptions flow through `fetchAllEpisodes` / `fetchUnlinkedEpisodes` into suggest, rescan and first-ingest matching. Deterministic, no AI, no extra network calls.

### Pass C remnants + Pass T2 remnants — shipped 2026-08-23
- **Pass C — every episode listed.** Podcast detail pages now end with an "All episodes (N)" section: newest first, every stored episode of that show, each showing its linked movie(s) as chips or "No movie linked yet". Data comes from `usePodcasts` (`allEpisodes`), built from the catalogue's episodes + links, so nothing is hidden behind a match.
- **Pass C — cheap learning.** Delivered as Pass R3 (see below): the rejection log stays negative evidence in scoring, and the new scorecard reports per-signal lift from real approve/reject counts, which is the evidence used to tune weights. No model, no tokens.
- **Pass T2 — search.** `listEpisodeLinks` now filters entirely server-side: one `ilike` query each on `podcast_episodes.title`, `podcasts.name` and `movies.title` (PostgREST can't OR across three embedded tables), merged and deduped. No ids in the URL, so short terms like "us" no longer 400. Retired episodes are excluded in SQL via `neq` on the embedded disposition.
- **Pass T2 — empty states.** Review now distinguishes "No <rows> match “term”. Clear the search to see the rest of the queue." from "Queue clear — no proposals at or below N% confidence" / "Queue clear — every saved link in this band has been reviewed."
- **Pass T4 — Matcher accuracy — shipped 2026-08-23.** Verified in `matching.server.ts`: coverage scoring, `&`/prefix/stopword normalisation, ≤4-char cap at 15, curated + data-driven common-word corroboration rule, non-film keyword suppression, promo-scoped description signal, and all four new signals persisted onto links.

### Pass R1 — Active / Parked show curation — shipped 2026-08-21
`podcast_curation` enum + `curation_status` on podcasts; Park / Re-activate per show in "Episode coverage & show curation" with Active/Parked tabs and a linked / unmatched / not-about-a-movie progress line; `activeOnly` scoping in `ingestion-helpers.server.ts` so suggest / rescan / resolve / unmatched are active-only; `data.ts` drops parked shows, their episodes and links from the app; stat tiles split into "Active shows" / "Parked shows" so nothing is silently invisible. Parked shows are also skipped by episode sync.

### Pass R3 — Score the matcher — shipped 2026-08-23
`src/lib/matcher-eval.server.ts` + the `scoreMatcher` server fn + the "Score the matcher" admin card (`src/components/admin/MatcherScoreCard.tsx`, under Match review): replays live scoring over every non-undone approve/confirm/reject in `match_actions` plus `episode_match_rejections`, reporting precision/recall at the 25 threshold, precision per confidence band, the band where wrong matches cluster, and per-signal lift (how much more often each signal appears on approved vs rejected pairs). Database only, no TMDB calls. This is the before/after harness Pass W is measured with.
