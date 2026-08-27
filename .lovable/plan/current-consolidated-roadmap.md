# Movie Afterparty — current consolidated roadmap

**This is the only active plan file.** Everything in `.lovable/plan/archive/` is historical and superseded — read it for background only. When a pass ships, its entry moves to "Already done" below with a `— shipped YYYY-MM-DD` stamp in the same edit.

Priority reflects the app's current state: a personal tool for one user, refining the match engine on a small data set. Anything aimed at a wider audience or large-scale automatic ingestion is deliberately low priority. Token estimates are build-cost ballparks.

---

# Not yet done

## Do next

### Pass R2 — Episode-level noise handling — ~20k — Priority 1
The only remaining piece of Pass R (R1 and R3 both shipped — see "Already done"). Original detail: `.lovable/plan/archive/pass-r-shrink-working-set-2026-08-20.md`.

Bulk "Retire remaining unmatched" on one show (marks every still-unmatched episode `not_about_a_movie`, logged in `match_actions`, undoable), plus the separately-labelled destructive "Delete episodes, keep the show".

### Post-review passes (filed 2026-08-26, backlog only — full detail in `.lovable/plan/roadmap-update-post-review-backlog-backlog-only-2026-08-26.md`)
The D/O/T5/G/H/Y repair pass is verified and closed (see "Already done"). The remaining review items are now discrete passes below. Design-first items marked NEEDS DESIGN start by presenting 2-4 visual/copy options; no code lands before a direction is chosen.

#### Tonight as a recommendation surface — Priority 2
- **Pass H2 — Tonight result volume and shape — ~25k — NEEDS DESIGN.** Top 10 by default, "Load more suggestions", count reads `Showing 10 of 121 matches`. Movies stays the catalogue surface.
- **Pass H3 — Surface sorting on Tonight — ~15k — NEEDS DESIGN.** Options: sort chip row above results; single sort button beside the result count; mode segmented control (Best match / Short / New / Most covered); right-aligned results-toolbar dropdown.
- **Pass H4 — Best-only / minimum Commentary Score — ~12k.** No hard default minimum until score distribution is measured; ship a "Best only" toggle with a visible match count first.

#### Movies gets its own filter surface — Priority 2b
- **Pass H5 — Separate Movies filters from Tonight — ~35k — NEEDS DESIGN.** Both pages share one `FilterBar` and one global filter object today, so Tonight changes silently re-filter Movies (Tonight only adds its always-hide-not-interested rule). Split into per-surface filter state with a Movies-specific layout that stays consistent with Tonight and keeps equivalent capability.

#### Sliders and touch feel — Priority 2c
- **Pass D2 — Slider treatment and touch responsiveness — ~25k — NEEDS DESIGN.** Options: thick rail with floating handles (32px handle, 48px hit area); inset rail with high-contrast grab knobs and larger touch rings; stepper-assisted slider with minus/plus; compact numeric value chips beside labels plus a larger grab zone. Build must fix drag responsiveness, not just visuals.

#### Ratings and audience controls — Priority 3
- **Pass Y2 — Rating minimum + maximum range — ~25k — NEEDS DESIGN.** Options: dual-handle rating ladder TV-Y → NC-17 with highlighted allowed band; segmented rating band with allowed steps filled; two compact Minimum/Maximum chip pickers.
- **Pass Y3 — Audience-focus tuning — ~15k.** Kids/family-heavy suggestions via ratings plus genre signals; scope confirmed only after Y2 ships.

#### Not interested and iconography — Priority 3b
- **Pass H6 — Not interested copy, icons and recovery — ~20k — NEEDS DESIGN.** Clearer copy, softer snackbar language, icon options for both "Unwatched" and "Not interested" before any metaphor change.
- **Pass H7 — Hidden / Not interested management screen — ~20k.** Review-and-restore list for hidden titles. Depends on H6.

#### Lists, watched state and sync — Priority 3c
- **Pass O2 — Watchlist interaction reliability — ~25k.** Debug in-browser: laggy add-to-list, unreliable list creation from movie cards, status not refreshing. Acceptance is a recorded browser run of add, create-from-card and remove on both Movies and movie detail.
- **Pass O3 — Account-synced lists and history — ~55k.** Migrate local-first list/watch/not-interested state to signed-in backend tables with RLS, one-time local→account migration on first sign-in, documented signed-out fallback. Lower backlog.

#### Consistency and copy — Priority 4
- **Pass E2 — Commentary Score formatting consistency — ~12k.** One score component everywhere (Tonight uses icon + label + accent badge; Lists uses a bare shaded numeric badge). Pick one canonical treatment with an explicit compact variant.
- **Pass E3 — Commentary Score explanation copy — ~8k — NEEDS COPY.** Distinguish deterministic scoring from user preference changes that intentionally change the inputs.
- **Pass D3 — Per-page info sheets — ~20k — NEEDS COPY.** The info icon opens the same sheet on every screen; give Tonight, Movies, Shows, Lists and Setup their own content with shared sections factored out.

#### Seasonal — Priority 4b
- **Pass H8 — Holiday exclusion (crude first pass) — ~15k.** Exclude titles with standalone `Santa` or `Christmas` in title or description; control inside the expanded Filters & Sort panel; default excluding Jan 8 – Nov 2, default off Nov 3 – Jan 7.
- **Pass H9 — Full seasonal include/exclude UX — ~35k.** Robust seasonal tagging beyond the keyword rule. Follows H8; lower backlog.

#### Setup and ordering stability — Priority 4c
- **Pass G3 — Setup: stop rows re-sorting on toggle — ~12k.** Following/preferred toggles must not move a podcast row until the next page load, matching the existing no-resort-mid-interaction rule.
- **Pass G4 — Saveable Tonight defaults in Setup — ~20k.** User saves preferred default Tonight parameters; Reset restores those instead of app defaults.

#### Admin and podcast pages — Priority 4d
- **Pass T6 — Show curation sort direction toggle — ~10k.** Ascending/descending on every sort property in "Episode coverage and show curation".
- **Pass T7 — Sort shows by highest external rating — ~10k — blocked on Pass M** landing a per-show ratings cache.
- **Pass J3 — Podcast page episode sort and filter — ~25k.** Document the current default order, then add newest/oldest, matched/unmatched, duration and title search controls.


### Pass G2 — Truly lock the layout — SHIPPED 2026-08-27
Was: viewport meta only, which iOS Safari largely ignores and which does nothing about horizontal scroll.

Shipped: `.layout-locked` on `<html>`/`<body>` from `AppShell` (`overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: pan-y`, `max-width: 100vw`); non-passive `touchmove` (multi-touch only) + `gesturestart`/`gesturechange` blockers while locked; `.scroll-rail` opt-in class (`overflow-x: auto`, `touch-action: pan-x pan-y`) for intentional sideways scrollers; `break-anywhere` utility applied to long movie/episode titles; shell wrapper clamped to `w-full max-w-full overflow-x-hidden`; Setup copy now says the toggle prevents sideways drag and pinch zoom; unlocking restores permissive viewport meta and removes class + listeners.

Verified: `scrollingElement.scrollWidth === clientWidth` on Tonight, Movies, Shows, Lists, Setup and Admin ingest at 390px, 768px and 1280px; locked state shows `touch-action: pan-y` + locked meta, unlocked state returns `touch-action: auto` and permissive meta.


### Pass G5 — Theme defaults and toggle placement — ~24k (approved backlog 2026-08-27, not scheduled)
Context: the mobile header theme toggle was removed on 2026-08-27 (shipped); the remaining items are about defaults and where controls live.

- **G5a — Respect system defaults (~8k).** Default a first-time visitor to `system` theme so the OS light/dark choice is adopted on first launch; existing stored choices are preserved.
- **G5b — Top-level settings placement (~6k).** Guarantee the manual theme control is visible without scrolling on Setup (currently in the page header) — verify on 390px, and move it into the App settings block if that reads better.
- **G5c — Desktop mode kept separate (~10k, NEEDS DESIGN).** Any desktop/mobile view switch is a layout fallback utility, not a display theme, and must never share a control group with light/dark. Needs a decision on whether it exists at all, given browsers already offer "Request desktop site".

### New backlog passes (approved 2026-08-23, not scheduled)



#### Pass X — Leaving-soon streaming windows — ~45k (or ~15k for the honest subset) — Priority 11
**What the data supports:** TMDB `/watch/providers` (JustWatch-sourced) returns *current* availability only — no leave dates, no offer expiry, no "recently added". Neither does the free JustWatch surface. Real leave-date feeds exist only in paid/licensed products (JustWatch partner API, Reelgood, Watchmode "expiring" endpoints). So there are two honest options:

- **X1 — Self-derived change detection (~15k, no new provider).** We already stamp `availability_checked_at`. Add an `availability_history` table (movie, service, offer type, first_seen, last_seen) written on every availability run. That gives real "Added in the last 30 days" and "Disappeared since <date>" signals, plus a "leaving soon" *heuristic* only if a provider ever exposes dates. Honest labels: "New on your services", "Was on Netflix until 12 Aug".
- **X2 — Licensed expiry data (~45k + subscription cost).** Watchmode or Reelgood expiring-titles endpoint keyed per region, stored as `leaves_on` on `movie_availability`, surfaced as a "Leaving soon" filter on Tonight and Movies, a countdown badge on cards, and a sort option. Requires a paid API key and a scheduled refresh (ties to Pass L).

Recommendation: build X1 first — it is free, needs no new vendor, and answers "what changed" — and only take X2 if true leave dates become a must.





## Worth doing soon

### Pass E — Card cleanup — ~20k — Priority 5
Drop the redundant "Watched" badge now that the eye/check control exists, and shrink the commentary badge to icon + number with the label on tap. Recommended option: "N episodes" text with the score as a thin accent bar on the card edge.

### Pass F — Destructive actions and undo feedback — ~25k — Priority 6
Confirmation dialog before deleting a watchlist plus an undo snackbar (~8 second soft delete), the same snackbar for following a show ("Following <show name>" + Undo) which also clears up the heart ambiguity. `alert-dialog` and `sonner` are both present but unused for this.

### Pass Z — Admin queue reset and matcher replay — ~25k — Priority 7c
Admin-only maintenance action that purges current non-manual proposed/weak saved links from active shows, keeps human labels (`match_actions`, `episode_match_rejections`, `not_about_a_movie`) intact, then reruns the current matcher over the now-unmatched active episodes. Best practice: dry-run first with counts by link type and confidence band, require a confirmation phrase, never delete manual/confirmed links, never touch parked shows unless explicitly opted in, and log a single maintenance action for audit/undo context. Useful after major matcher changes, but risky enough to keep behind a guarded tool rather than a routine workflow.

### Pass I — Listening history — ~20k — Priority 8
A "Listened" view on Lists & History: episodes you rated or moved between not started / started / finished, newest first. Data is already captured; nothing surfaces it.

### Pass J1 — Episode row presentation — ~25k — Priority 9
Episode rows get truncated descriptions with expand, consistent title/date/duration/controls on both movie and podcast pages, and a segmented control on podcast pages for movie-focused vs episode-focused views.

### Pass J2 — Dedicated episode pages — ~25k — Priority 9b
Dedicated per-episode pages are deferred until external ratings/comments or similar episode-level social/context data exists.

## Backlog (wider-audience or large-volume — hold until the engine is trustworthy)

### Pass L — Scheduled refresh — ~40k — Priority 11
Server-side scheduled refresh (feeds daily, availability weekly, staggered) with a visible "last synced" per podcast/movie and manual override retained. Explicitly backlogged: automating volume before the matcher is accurate multiplies review work.

### Pass M — External ratings, user-controlled — ~60k — Priority 12
Per-user choice of which ratings to show, cached in the `podcast_external_metrics` shape extended to movies. Realistic sources: TMDB (already integrated), OMDb (IMDb / Metascore), Trakt; Podcast Index (integrated), Apple Podcasts (unofficial), Podchaser (paid). Letterboxd has no public API; Spotify has no ratings. **Dependency:** Pass T5's "sort shows by highest external rating" is blocked on this pass landing a per-show ratings cache; until then show curation sorting stays A–Z / episode count / unmatched / missing count.

### Pass N — Tags/vibes and people-based discovery — ~70k — Priority 13
Shared tag system for movies and shows (curated starter tags, user-proposed, emoji allowed, character cap, tag filtering) plus TMDB person search leading to an actor page filtered to titles with commentary coverage.

### Pass P — Richer movie detail (cast) — ~40k — Priority 14
Top-billed cast and director from TMDB credits shown on the movie page, with an external link out for anything deeper. Needs a cast cache table and a credits fetch during enrich.

### Pass V — TV shows and miniseries via TMDB — ~90k — Priority 15
Expand from movies-only to both `movie` and `tv` catalog items using the existing `media_type` column. Scope: TMDB TV search/detail/enrichment, season/episode-aware title extraction, TV/miniseries runtime and first-air-year handling, watch-provider refresh for `/tv/{id}`, TV content ratings, detail pages that clearly label films vs series, and discovery filters that can include/exclude TV. Design impacts to decide before building: cards need media-type badges; “runtime” becomes episode runtime or total runtime; release year becomes first-air year; podcast episode links may target a series, a season, or a specific episode; availability can differ by season; and “movie detail” copy/navigation should become “title detail” or similar so the UI does not feel movie-only.

---

# Already done

### Repair pass — D/O/T5/G/H/Y verification and remnants — shipped 2026-08-25
Verified in the 2026-08-26 review at base level: iOS/PWA safe-area top bar, corrected page header labels, Tonight controls split from the Movies variant, slider fill and enlarged touch targets, Tonight defaulting to "Unwatched", watchlist/watched controls with named snackbars, visible and consistent dim-watched styling, navigable Setup podcast rows, and T5 show-curation search/filter/sort verified rather than rebuilt. Remaining refinements were re-filed as discrete passes (H2–H9, D2, D3, E2, E3, O2, O3, Y2, Y3, G3, G4, T6, T7, J3) rather than kept inside this pass.



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
