# Performance architecture audit — catalogue reads and long pages

Created: 2026-09-05
Scope: diagnosis only. No UI redesign, no card changes, no implementation in this pass.

## 0. Measured dataset (live data, 2026-09-05)

| Table | Rows | Active (non-parked) |
| --- | --- | --- |
| movies | 2,606 | — |
| movie_genres | 6,656 | — |
| movie_availability | 5,633 | — |
| podcasts | 53 | 32 |
| podcast_episodes | 14,318 | 11,128 |
| episode_sources | 14,318 | (filtered client-side) |
| episode_movies | 9,399 | 7,838 |
| podcast_external_metrics | 0 | 0 |

Column weight: active episode `description` alone is **5.77 MB** in Postgres; `movies.synopsis` is 708 kB. JSON-encoded, the single `["catalog"]` read is on the order of **8-11 MB across ~40 paged REST requests** before any consumer page renders.

## 1. Where the cost actually is

Every consumer surface (`/`, `/movies`, `/movies/$slug`, `/podcasts`, `/podcasts/$slug`, `/lists`, `/settings`) goes through `useDiscovery()` -> `useCatalog()` -> `fetchCatalog()` in `src/lib/data.ts`. There is exactly one data path, so all consumer pages share the same cost profile.

**Network / DB (before first render)**
- 10 tables read in full, each paged at 1,000 rows in parallel waves of 6 (`WAVE = 6`). Episodes need 12+ pages, links 10, sources 15.
- Parking is applied **after** transfer (`data.ts` lines 150-168): 3,190 parked episodes plus their sources and ~1,561 links are downloaded and then discarded.
- Episode `description` and movie `synopsis` are fetched for the whole catalogue even though only ~30-40 descriptions are visible on any screen.
- `episode_sources` is fetched whole (14,318 rows) to produce one listen URL per rendered row.

**Client-side derivation (after transfer, still before first paint)**
- `buildEntries` (`discovery.ts`) indexes genres/availability/sources/links into maps once (post-L1) and then builds a `MovieEntry` for **all 2,606 movies**, including a fully materialised `episodes[]` array per movie with `alsoCovers` title lookups and a sort per movie.
- `scoreAllMovies` (`scoring.ts`) scores all 2,606 movies over 7,838 links.
- `usePodcasts` builds `allEpisodes` rows for **all 11,128 episodes** (object allocation + per-show sort) even when rendering the shows list, plus per-movie `PodcastMovie` grouping for all 32 shows.
- `applyFilters` filters + sorts the full derived array on every filter/search keystroke commit.
- `ExpandableText.toPlainText` runs HTML stripping on every render of every rendered card (bounded by the render cap, so minor).

**Refetch / invalidation cascades (the sharpest remaining hazard)**
- `src/lib/link-review.ts` invalidates `["catalog"]` after a single flag/confirm -> full 8-11 MB refetch + full re-derivation.
- `src/lib/episode-reviews.ts` calls `queryClient.invalidateQueries()` with **no key** in `useMarkEpisodeNotAboutMovie` and `useUndoEpisodeRetirement` -> invalidates everything, catalogue included.
- `CatalogAddCard` also invalidates `["catalog"]`.
- Net effect: an admin acting from a consumer episode row pays a full catalogue reload per action.

**DOM**
- Render is capped (Movies 40, Shows 30, show detail 30 episodes / 24 movies), and "Show more" grows the cap by a fixed step. No virtualization, so a user who clicks "Show 30 more" repeatedly on a 900-episode show still grows the DOM without bound.

**Admin / ingest surfaces — different, and already correct**
- Match Review, coverage, suggestions, unmatched, stats all run through `createServerFn` in `src/lib/ingestion.functions.ts` with server-side `.limit(data.limit)` / offset paging and server-side aggregation. Client payloads are per-page.
- The heavy full-table scans there (`movies`, `episode_movies`, `episode_match_rejections`) happen **on the server** inside the matcher/stat functions, which is the correct side.
- Remaining admin cost is invalidation fan-out after actions, already partly debounced in Pass U13.

## 2. Bounded render vs bounded architecture — where each page sits

Correctness test applied: does the page consider the full relevant dataset, and does it transfer/render only what the current window needs?

| Surface | Full-scope correctness | Bounded transfer | Bounded render |
| --- | --- | --- | --- |
| `/` Tonight | Yes (client, full set) | **No** | Yes |
| `/movies` | Yes (client, full set) | **No** | Yes |
| `/movies/$slug` | Yes | **No** (whole catalogue for one movie) | Yes |
| `/podcasts` | Yes (client, full set) | **No** | Yes |
| `/podcasts/$slug` | Yes | **No** (whole catalogue for one show) | Yes |
| `/lists`, `/settings` | Yes | **No** | n/a |
| Match Review / ingest | Yes (server) | **Yes** | Yes |

Important and reassuring: **no page is currently incorrect.** Filtering, sorting, ranking, counts and Commentary Score all evaluate the full candidate universe; "Show more" is a deterministic slice of an already-correct, already-computed ordered result set and triggers **no** refetch or recompute (the derived entries are memoised in a `WeakMap` keyed by catalogue + prefs). The defect is purely that full-scope correctness is being bought with full-scope transfer and full-scope client compute.

So the failure mode we hit was not "we render too much" — it was "the browser is the query engine".

## 3. What L1 solved vs did not solve

Per page, before first render:

| Page | Data fetched before first render | Client work before first render | Merely capped at render | Load-more refetch? |
| --- | --- | --- | --- | --- |
| `/movies` | whole catalogue (~8-11 MB) | index all rows, derive 2,606 entries, score all, filter+sort all | cards 40 | No — pure slice |
| `/podcasts` | whole catalogue | above + 11,128 episode row objects + per-show grouping/sorts | cards 30 | No |
| `/podcasts/$slug` | whole catalogue | identical to `/podcasts` (shared hook) | 30 eps / 24 movies | No |
| `/movies/$slug` | whole catalogue | identical to `/movies` | full detail | No |
| Match Review | one page of rows | per-page only | per-page | No — server page |

L1 **did** remove the quadratic client scans, memoise derived entries, and stop the unbounded DOM that produced Chrome "page unresponsive". Cold load fell ~25s -> ~14s (parallel waves) and interaction became usable again.

L1 **did not** reduce bytes transferred, did not stop parked rows being shipped, did not stop the browser from being the query engine, and did not stop `["catalog"]` invalidations from paying the entire cost again per admin action.

## 4. Definition of "stable" (gate before card roadmap resumes)

Measured against the live dataset at 390px (PWA) and desktop:

1. First meaningful content on `/movies`, `/podcasts`, `/podcasts/$slug` within ~2s warm / ~4s cold.
2. No blank screen, no runtime fetch failure, no `page unresponsive` on any surface.
3. A show with 900+ episodes scrolls and expands descriptions without a page-level rerender stall.
4. Load-more and every mutation trigger a bounded refetch (never a whole-catalogue reload).
5. Filters, search, sort and counts still reflect the full dataset, verified against a SQL count for at least two filter combinations.
6. Commentary Score / Tonight ranking still evaluated over the full candidate set.
7. Peak JS heap on the heaviest page stays flat across three navigations (no accumulation).

## 5. Options assessed against this codebase

- **A — cap rendered results.** Correct emergency mitigation; already shipped as L1. Not sufficient: bytes and client compute are untouched, and it is the thing that tempts scope-limiting bugs. Keep, do not extend.
- **B — move list/query work server-side (filter, sort, paginate, aggregate).** Foundational, and already proven in this repo by the ingest/Match Review server functions. This is the only option that fixes transfer, compute, memory and invalidation cost at once, and the only one that keeps full-scope correctness cheap. **Needed now.**
- **C — virtualization.** Real but secondary: it only helps after a user repeatedly clicks "Show more". Cheap once B exists (windowed data + windowed DOM align naturally). Backlog.
- **D — progressive/lazy loading (descriptions, posters, sources on demand).** Largest single easy win overlaps B: descriptions are 5.8 MB of the payload. Best delivered as part of B's column split rather than as a separate mechanism; image `loading="lazy"` is independently cheap. Backlog + folded into B.
- **E — separate mobile/desktop rendering.** No evidence it is needed. Both platforms suffer the same root cause; divergence would double the surface to verify. Later UX optimisation only.

Your hypothesis holds. One amendment: **D is not merely supporting** — dropping episode descriptions and parked rows from the list-level read is the single biggest byte reduction available and should ride along in B's first step, not wait.

## 6. Smallest safe next implementation step (proposed Pass L2a)

Do not rewrite all pages onto server queries at once. Sequence:

**L2a — stop paying for what is not on screen (S/M, no correctness change):**
1. Drop `description` from the catalogue-level episode read and `synopsis` from the catalogue-level movie read; fetch them per show / per movie where they are displayed. (~6 MB of ~10 MB.)
2. Filter parked shows in the query (`.neq('curation_status','parked')` plus `.in('podcast_id', activeIds)` batching) so ~3,190 episodes, their sources and ~1,561 links are never transferred.
3. Replace the two keyless `invalidateQueries()` calls in `episode-reviews.ts` and the `["catalog"]` invalidation in `link-review.ts` with targeted keys.
4. Drop the full `episode_sources` read in favour of primary-source-only columns at list level.

Expected: catalogue payload roughly 10 MB -> 2-3 MB, no change to any filter/sort/count semantics, and admin actions from consumer rows stop reloading the catalogue. Verify against clause 5/6 of the stability definition.

**L2b — server-side list architecture (L, the real B):** RPC/server functions returning `{ rows, total }` for Movies, Tonight and podcast detail, with filtering/sorting/scoring executed over the full dataset server-side and deterministic offset/keyset paging. Commentary Score inputs move to a server-computed materialised form so ranking stays full-scope. This is the pass that lets card work resume safely on top of a stable contract.

## 7. Acceptance checklist for this pass

- **Verified:** dataset sizes and column weights measured against live data (SQL, 2026-09-05).
- **Verified:** every consumer surface confirmed to share the single `["catalog"]` full read (`rg` over `useDiscovery`/`useCatalog` call sites).
- **Verified:** load-more confirmed as a pure slice with no refetch/recompute (`WeakMap` memoisation in `discovery.ts`, `ChunkedMovies`/`ChunkedPodcasts` slice logic).
- **Verified:** admin/ingest surfaces confirmed already server-paged (`limit`/`offset` in `ingestion.functions.ts`).
- **Verified:** catalogue-wide invalidation hazards located (`link-review.ts`, `episode-reviews.ts`, `CatalogAddCard.tsx`).
- **Deferred:** no application code changed this turn; no emergency fix was required, since the app is currently usable after L1.
- **Needs follow-up:** L2a and L2b filed on the roadmap; virtualization (L3), lazy content (L4) and mobile divergence (L5) filed as backlog.
