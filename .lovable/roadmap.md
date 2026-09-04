# Movie Afterparty — current consolidated roadmap

**This is the only active plan file.** Everything in `.lovable/plan/archive/` is historical and superseded — read it for background only. When a pass ships, its entry moves to "Already done" below with a `— shipped YYYY-MM-DD` stamp in the same edit.

Priority reflects the app's current state: a personal tool for one user, refining the match engine on a small data set. Anything aimed at a wider audience or large-scale automatic ingestion is deliberately low priority. Estimates use credit bands, not token counts: **S ~1-2 credits**, **M ~3-5**, **L ~6-10**, **XL ~10+**. Bands are ballparks for build cost — verification loops, debugging and design rounds push a pass toward the top of its band or past it.

---

# Not yet done

## Do next

### Pass R2 — Episode-level noise handling — M (~3-5 credits) — Priority 1

The only remaining piece of Pass R (R1 and R3 both shipped — see "Already done"). Original detail: `.lovable/plan/archive/pass-r-shrink-working-set-2026-08-20.md`.

Bulk "Retire remaining unmatched" on one show (marks every still-unmatched episode `not_about_a_movie`, logged in `match_actions`, undoable), plus the separately-labelled destructive "Delete episodes, keep the show".

### Post-review passes (filed 2026-08-26, backlog only — full detail in `.lovable/plan/roadmap-update-post-review-backlog-backlog-only-2026-08-26.md`)

The D/O/T5/G/H/Y repair pass is verified and closed (see "Already done"). The remaining review items are now discrete passes below. Design-first items marked NEEDS DESIGN start by presenting 2-4 visual/copy options; no code lands before a direction is chosen.

#### Tonight as a recommendation surface — Priority 2

- **Pass H2 — Tonight result volume and shape — M (~3-5 credits) — NEEDS DESIGN.** Top 10 by default, "Load more suggestions", count reads `Showing 10 of 121 matches`. Movies stays the catalogue surface.
- **Pass H3 — Surface sorting on Tonight — S (~1-2 credits) — NEEDS DESIGN.** Options: sort chip row above results; single sort button beside the result count; mode segmented control (Best match / Short / New / Most covered); right-aligned results-toolbar dropdown.
- **Pass H4 — Best-only / minimum Commentary Score — S (~1-2 credits).** No hard default minimum until score distribution is measured; ship a "Best only" toggle with a visible match count first.

#### Movies gets its own filter surface — Priority 2b

- **Pass H5 — Separate Movies filters from Tonight — SHIPPED 2026-08-31.** Movies now has its own `movieFilters` state (baseline `NO_FILTERS`: nothing filtered, sorted Title A-Z), a search-first header with catalogue count, and a collapsed "Movie filters — N filters active" panel with clear-all. Tonight's parameter panel unchanged.

#### Sliders and touch feel — Priority 2c

- **Pass D4 — Remove the need for "Apply filters" — M (~3-5 credits)** (filed 2026-08-28). The Apply-filters button shipped 2026-08-28 as the pragmatic fix; this pass makes live filtering fast enough that Apply becomes optional. Root cause is unconfirmed — step one is measurement, not a rewrite: profile a slider drag on Tonight with the full catalogue rendered and record where time goes (`buildEntries` re-deriving on every prefs write, the per-movie `catalog.*.filter(...)` scans being O(movies x rows), `applyFilters` re-sorting, or whole-list re-render). Likely fixes once measured: index catalog rows into maps once, memoise entries independently of filter values, keep drags in local state and commit on release, memoise `MovieCard`, cap rendered rows. Acceptance: smooth sustained drag at 390px with the full catalogue loaded, then decide whether Apply stays as a preference or is removed.
  - **Added context 2026-09-02 (from the Y2 follow-up):** the Apply button is not only a performance workaround, it is a _feedback_ problem — staging changes breaks the cause/effect loop, so the user cannot tell what a filter did. D4's measurement should explicitly separate the cost of (a) recomputing the match **count** for a draft from (b) re-ranking and re-rendering the list. If the count alone is cheap, a live "N movies match" readout can restore feedback even while Apply remains, which is the cheap half of Pass U37. Whether Apply is removed is decided from measurement, not preference.
- **Pass D2 — Slider treatment and touch responsiveness — M (~3-5 credits) — NEEDS DESIGN.** Options: thick rail with floating handles (32px handle, 48px hit area); inset rail with high-contrast grab knobs and larger touch rings; stepper-assisted slider with minus/plus; compact numeric value chips beside labels plus a larger grab zone. Build must fix drag responsiveness, not just visuals.

#### Ratings and audience controls — Priority 3

- **Pass Y3 — Audience-focus tuning — S (~1-2 credits).** Kids/family-heavy suggestions via ratings plus genre signals; scope confirmed only after Y2 ships.

#### Not interested and iconography — Priority 3b

- **Pass H6 — Not interested copy, icons and recovery — M (~3-5 credits) — NEEDS DESIGN.** Clearer copy, softer snackbar language, icon options for both "Unwatched" and "Not interested" before any metaphor change.
- **Pass H7 — Hidden / Not interested management screen — M (~3-5 credits).** Review-and-restore list for hidden titles. Depends on H6.

#### Lists, watched state and sync — Priority 3c

- **Pass O2 — Watchlist interaction reliability — M (~3-5 credits).** Debug in-browser: laggy add-to-list, unreliable list creation from movie cards, status not refreshing. Acceptance is a recorded browser run of add, create-from-card and remove on both Movies and movie detail.

  Watchlist icon state:

- Not in any watchlist: gray line, no fill, no checkmark (same as current)
- In at least one watchlist: blue line + blue fill, with a white checkmark
- **Pass O3 — Account-synced lists, history and display prefs — L (~6-10 credits, upper end).** Migrate local-first list/watch/not-interested state to signed-in backend tables with RLS, one-time local→account migration on first sign-in, documented signed-out fallback. Also in scope (filed 2026-08-28): **`dimWatched` and other display preferences sync with the account, not the device**, using the same migration and fallback. Lower backlog.

#### Consistency and copy — Priority 4

- **Pass E2 — Commentary Score formatting consistency — S (~1-2 credits).** One score component everywhere (Tonight uses icon + label + accent badge; Lists uses a bare shaded numeric badge). Pick one canonical treatment with an explicit compact variant.
- **Pass E3 — Commentary Score explanation copy — S (~1-2 credits) — NEEDS COPY.** Distinguish deterministic scoring from user preference changes that intentionally change the inputs.
- **Pass D3 — Per-page info sheets — M (~3-5 credits) — NEEDS COPY.** The info icon opens the same sheet on every screen; give Tonight, Movies, Shows, Lists and Setup their own content with shared sections factored out.

#### Seasonal — Priority 4b

- **Pass H9 — Full seasonal include/exclude UX — M (~3-5 credits).** Robust seasonal tagging beyond the keyword rule. H8 shipped 2026-08-28 as the crude keyword first pass; H9 follows it, lower backlog.

#### Setup and ordering stability — Priority 4c

- **Pass G3 — Setup: stop rows re-sorting on toggle — S (~1-2 credits).** Following/preferred toggles must not move a podcast row until the next page load, matching the existing no-resort-mid-interaction rule.
- **Pass G4 — Saveable Tonight defaults in Setup — M (~3-5 credits).** User saves preferred default Tonight parameters; Reset restores those instead of app defaults.

#### Admin and podcast pages — Priority 4d

- **Pass T6 — Show curation sort direction toggle — S (~1-2 credits).** Ascending/descending on every sort property in "Episode coverage and show curation".
- **Pass T7 — Sort shows by highest external rating — S (~1-2 credits) — blocked on Pass M** landing a per-show ratings cache.
- **Pass J3 — Podcast page episode sort and filter — M (~3-5 credits). Shipped 2026-09-03.** Episode feed on `/podcasts/$slug` now has title search, match filter (All episodes / Matched / Unmatched), admin-only review filter (Any review state / Reviewed / Unreviewed), sort control (newest, oldest, most/fewest linked movies, longest/shortest, title A–Z/Z–A) and a live "X of Y episodes" result count. Default order remains newest first. Acceptance: Verified in preview at 659px — sort options render, Unmatched filter narrowed 403 → 43, "Most linked movies" reorders, count updates, no horizontal overflow. Implemented, not verified: Reviewed/Unreviewed chip filtering exercised only via code path, not a completed runtime click assertion.

### Pass G2 — Truly lock the layout — SHIPPED 2026-08-27

Was: viewport meta only, which iOS Safari largely ignores and which does nothing about horizontal scroll.

Shipped: `.layout-locked` on `<html>`/`<body>` from `AppShell` (`overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: pan-y`, `max-width: 100vw`); non-passive `touchmove` (multi-touch only) + `gesturestart`/`gesturechange` blockers while locked; `.scroll-rail` opt-in class (`overflow-x: auto`, `touch-action: pan-x pan-y`) for intentional sideways scrollers; `break-anywhere` utility applied to long movie/episode titles; shell wrapper clamped to `w-full max-w-full overflow-x-hidden`; Setup copy now says the toggle prevents sideways drag and pinch zoom; unlocking restores permissive viewport meta and removes class + listeners.

Verified: `scrollingElement.scrollWidth === clientWidth` on Tonight, Movies, Shows, Lists, Setup and Admin ingest at 390px, 768px and 1280px; locked state shows `touch-action: pan-y` + locked meta, unlocked state returns `touch-action: auto` and permissive meta.

### Pass G5 — Theme defaults and toggle placement — M (~3-5 credits) (approved backlog 2026-08-27, not scheduled)

Context: the mobile header theme toggle was removed on 2026-08-27 (shipped); the remaining items are about defaults and where controls live.

- **G5a — Respect system defaults (S).** Default a first-time visitor to `system` theme so the OS light/dark choice is adopted on first launch; existing stored choices are preserved.
- **G5b — Top-level settings placement (S).** Guarantee the manual theme control is visible without scrolling on Setup (currently in the page header) — verify on 390px, and move it into the App settings block if that reads better.
- **G5c — Desktop mode kept separate (S, NEEDS DESIGN).** Any desktop/mobile view switch is a layout fallback utility, not a display theme, and must never share a control group with light/dark. Needs a decision on whether it exists at all, given browsers already offer "Request desktop site".

### Pass U1 — Explicit review-state model — SHIPPED 2026-08-28

Verified 2026-09-02 (code review): approve, confirm, relink and bulk approve/confirm all write `review_state = 'confirmed'` with `reviewed_at`/`reviewed_by`; resolve/rescan writers stamp `auto_linked`/`proposed` by threshold; stats, `listEpisodeLinks` and per-show coverage all filter on `review_state`, not confidence.
`episode_movies` gained a `review_state` enum (`proposed` / `auto_linked` / `confirmed`) plus `reviewed_at` / `reviewed_by`, so review status is stored rather than inferred from a confidence band. Backfill: only hand-made/`manual` links are confirmed; strong automatic links are `auto_linked`; the rest `proposed`. The resolve and rescan writers stamp `auto_linked` at/above their strong threshold and `proposed` below it; approve, confirm and relink stamp `confirmed` with a timestamp and admin id. The "Existing links" queue and the "Links awaiting review" stat now filter on `review_state <> confirmed` instead of `match_method`/confidence, review rows show the state label, and per-show coverage reports `reviewed` / `awaiting review` with an "All episodes reviewed" line so a show can be proved complete. Rejections and retirement remain the existing rejection table + episode disposition.

### Pass G6 — Restore desktop trackpad scrolling — SHIPPED 2026-08-28

Pass G2's `.layout-locked` hardening is now scoped to touch-primary viewports: only `overflow-x: hidden` applies everywhere, while `overscroll-behavior: none`, `touch-action: pan-y` and `max-width: 100vw` sit behind `@media (pointer: coarse)` in `src/styles.css`. `useViewportLock` in `AppShell.tsx` skips the non-passive `touchmove`/`gesturestart`/`gesturechange` blockers and the `maximum-scale=1, user-scalable=no` viewport rewrite unless `matchMedia("(pointer: coarse)")` matches. Verified at 1280x900: `touch-action: auto`, `overscroll-behavior: auto`, wheel scroll moves the page to its full extent, and `scrollWidth === clientWidth` (no horizontal overflow).

### Matcher refinement backlog (approved 2026-08-28, not scheduled)

- **Pass U2 — Multi-movie episode editor — L (~6-10 credits).** Handle double features, trilogies, franchises and "covered in passing" vs "primary subject" by letting one episode link to multiple movies with a coverage role; UI to add/remove/reorder links per episode.
- **Pass U3 — Curated blocklist/allowlist — M (~3-5 credits).** Admin-managed high-noise phrase lists (ad/promo/joke titles) and per-title allowlist overrides feeding the matcher's keyword suppression.
- **Pass U4 — Per-podcast matcher tuning — M (~3-5 credits).** Show-level tuning because some feeds use clean title formats while others use joke/chatter titles; per-show overrides for strictness and parsing. **Design direction (added 2026-09-02):** resist solving this with one ever-growing universal matcher. Model it as a set of named, selectable per-podcast _strategies_ — clean-title parser, year-aware parser, noisy-title + description strategy, actor/name corroboration, special-word suppression, stricter confidence threshold — each independently testable against the labels via "Score the matcher", with a per-show assignment (and a default). New strategies get added as the data demonstrates the need instead of being folded into shared scoring code. **Acceptance criteria (2026-09-02):** `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`.
- **Pass U5 — Training/evaluation dashboard — M (~3-5 credits).** Turn "Score the matcher" scorecard output into recommended rule changes with before/after evals (extends `matcher-eval.server.ts`).
- **Pass U6 — Low-confidence link maintenance — S (~1-2 credits).** A safe "clear low-confidence auto links and rerun the current engine" maintenance action with a dry-run preview, guarding manual/confirmed links and parked shows (related to Pass Z).

### Review visibility, match review reliability, admin actions (approved backlog 2026-08-30, not scheduled)

Full detail and the "what exists vs. what does not" analysis: `.lovable/plan/review-state-visibility-match-review-reliability-admin-actio-2026-08-30.md`.

- **Pass U9 — Learning evidence over time — M (~3-5 credits) — Priority 3.** Persist each Score the matcher run and show current vs previous with deltas and a short history. One migration.

- **Pass U14 — Serialised admin actions — shipped 2026-09-03 (scope widened on request to every primary admin/ingest action, not just park/re-activate).** New `src/components/admin/AdminActionQueue.tsx` provides a page-wide FIFO queue (`AdminActionQueueProvider`, `useAdminQueue`, `useQueuedAction`, `AdminQueueStatus`): work runs strictly in click order, a repeat press of an action still pending is rejected instead of double-queued, a failure does not stall later queued work, and a sticky readout names the running action, the waiting queue and recent failures. Wired through: bulk TMDB enrichment, content-ratings backfill (incl. run-until-done), podcast artwork backfill, podcast ingestion, single-movie enrichment, streaming availability/genre chained batches (whole run = one queue entry, cancellation preserved), build movies from episodes, recheck-all rescan, unmatched-row retire/link/mark-reviewed, per-show park/re-activate/sync/recheck/build (per-show-per-action keys, so `busyId` is gone), sync-all-incomplete, and Match Review single + bulk decisions and relink.
  Acceptance: **Verified** — click order and non-overlap (two rapid Park clicks on different shows at `/admin/ingest`: first ran, second showed "· 1 waiting" with its label listed; test state restored to active). **Verified** — buttons report their own state (`Queued…` / working label) and only the same action on the same row is disabled, so unrelated rows stay clickable. **Verified** — typecheck clean; ingest page renders with 0 horizontal overflow and no console errors. **Implemented, not verified** — failure surfacing in the sticky readout and duplicate-press rejection message (code path exercised only by construction, no forced failure in-app). **Deferred** — folding the single-row unlink `.select()` verification gap noted under U12 into this pass.

- **Pass U15 — Summary stats for backfill and enrichment tools — S (~1-2 credits) — Priority 3.** Backfill content ratings and Enrich movies from TMDB get never-checked / checked / oldest-check / last-run readouts like the coverage card.
- **Pass U16 — Treat "live" as a special word in the matcher — shipped 2026-08-31.**
- **Pass U17 — Reconcile feed count vs stored episodes — S (~1-2 credits) — Priority 2.** Confirmed cause of the persistent "1 missing" on _Your Inner Child Is An Idiot_: 255 feed items collapse to 254 rows because episodes upsert `onConflict: "slug"` and two items normalise to the same slug. Make slugs collision-safe (episode number or feed GUID suffix, new slugs only for colliding items), report inserted/updated/collapsed from real row counts instead of the fetched array length, add a per-show diagnostic listing feed items that produced no distinct row, and make the coverage card explain a mismatch inline instead of printing a bare "1 missing". Plan: `.lovable/plan/awaiting-review-explained-fix-for-the-phantom-1-missing-epis-2026-08-30.md`.

### New backlog passes (approved 2026-08-23, not scheduled)

#### Pass X — Leaving-soon streaming windows — L (~6-10 credits) (or S for the honest subset) — Priority 11

**What the data supports:** TMDB `/watch/providers` (JustWatch-sourced) returns _current_ availability only — no leave dates, no offer expiry, no "recently added". Neither does the free JustWatch surface. Real leave-date feeds exist only in paid/licensed products (JustWatch partner API, Reelgood, Watchmode "expiring" endpoints). So there are two honest options:

- **X1 — Self-derived change detection (S, no new provider).** We already stamp `availability_checked_at`. Add an `availability_history` table (movie, service, offer type, first*seen, last_seen) written on every availability run. That gives real "Added in the last 30 days" and "Disappeared since <date>" signals, plus a "leaving soon" \_heuristic* only if a provider ever exposes dates. Honest labels: "New on your services", "Was on Netflix until 12 Aug".
- **X2 — Licensed expiry data (L + subscription cost).** Watchmode or Reelgood expiring-titles endpoint keyed per region, stored as `leaves_on` on `movie_availability`, surfaced as a "Leaving soon" filter on Tonight and Movies, a countdown badge on cards, and a sort option. Requires a paid API key and a scheduled refresh (ties to Pass L).

Recommendation: build X1 first — it is free, needs no new vendor, and answers "what changed" — and only take X2 if true leave dates become a must.

### New backlog passes (approved 2026-08-31, not scheduled)

#### Pass U18 — Cover art on show curation rows — S (~1-2 credits) — Shipped 2026-09-04

Each show card/row in "Podcast show curation & episode coverage" gets the podcast's cover art as a left thumbnail (reuse `Artwork` with `shape="cover"`, accent fallback for shows without art), so shows are recognisable at a glance instead of read line by line. Tapping the thumbnail opens that show's page.

Acceptance: Verified 2026-09-04 on `/admin/ingest` (1280px, headless, signed-in admin) — 19 active rows each render an `<img>` cover linking to `/podcasts/<slug>`; horizontal overflow 0.

Also shipped 2026-09-04 (episode action-state visibility, `EpisodeAdminActions` + Match Review rows): a reviewed episode hides "Not about a movie" and offers only "Reopen"; a retired episode ("not about a movie") renders as amber fill with white text/icon.
- Verified: reviewed rows show `Reopen` only — That Aged Well shows 345 Reopen controls and 58 "Not about a movie" controls on 58 unreviewed rows.
- Implemented, not verified: amber-filled retired state (verifying requires retiring a real episode).


#### Pass U19 — Filter unconfirmed links by link strength — M (~3-5 credits) — Priority 1

Add an explicit strength scope (Weak only / Strong only / All) alongside the existing review-state filter, so bulk workflows split cleanly: bulk-reject the weak pile, bulk-confirm the strong pile. Today the band dropdown only sets a ceiling, so "strong only" is impossible except indirectly via "auto-linked only". Needs a min-confidence argument on `listEpisodeLinks` plus persistence in the saved review view.

#### Pass U20 — Ingest page load speed and progressive stats — M (~3-5 credits) — Priority 1

Short term: skeleton/loading state for the summary-stat tiles instead of an empty box. Longer term: split the single stats server fn into fast counts (rows, shows, links) and slow aggregates (coverage, awaiting review, freshness), render each as it lands, and cache the slow set with a visible "as of <time>" plus a Recalculate button. Also audit what the Ingest route loads on first paint — collapsed cards should not fetch until opened.
NOTE: Seems even slower after implementation of U14 and U8 (2026-09-03)

#### Pass U21 — Consolidate or retire "Enrich movies from TMDB" and "Backfill content ratings" — S (~1-2 credits) — Priority 2

Investigate whether the two tools still earn separate sections: they call different TMDB endpoints (movie details/credits vs release-dates certifications), and the podcast-first pipeline may already populate both at create time. Deliverable: a written answer to "when would a movie exist without this data?", then either merge them into one "Fill in missing movie data" tool, or run each once across the whole catalogue and remove them from the UI.

#### Pass U22 — Movies filter surface refinement (follow-on to H5) — M (~3-5 credits) — Priority 3

H5 separated Movies filters from Tonight (shipped 2026-08-31) and it reads better, but the header still feels awkward. Explore search-result framing, where the active-filter summary lives, and how filters open on mobile vs desktop. Low priority.

#### Pass U23 — Cast-mention signal in the matcher — M (~3-5 credits) — Priority 4 **Acceptance criteria (2026-09-02):** `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`.

Boost a candidate when one of the movie's top 3 billed actors is named in the episode title or description ("we watched the Nic Cage one"). Deterministic string match on cast names, a new `castMention` signal stored on the link, and a modest confidence bump (plus corroboration credit for otherwise weak/common-word titles). **Dependency:** blocked on Pass P (top-billed cast cached from TMDB credits) — there is no cast data in the schema today.

#### Pass U25 — Parked shows still surface confirmed content — M (~3-5 credits) — Priority 2

Parking a show currently removes it from the app entirely: the catalogue loader drops parked podcasts plus all their episodes, metrics, sources and links regardless of review state, so a hand-confirmed link (e.g. How Did This Get Made ↔ Doppelgänger) is stored but unreachable. Change parking to mean "confirmed only" on the app side while keeping its current admin meaning (out of every queue, stat scope and episode sync). A parked show stays listed and contributes only `review_state = 'confirmed'` links and the episodes carrying them; auto-linked/proposed links stay hidden; a "Reviewed picks only" badge plus a short explanatory line keeps the trimmed feed from reading as data loss; parked shows tie-break below active ones. Show curation rows gain `N confirmed links live in the app`. No migration — reuses `review_state` and `curation_status`. Full write-up: `.lovable/plan/parked-shows-should-still-surface-confirmed-content-backlog-2026-09-01.md`.

### New backlog passes (filed 2026-09-02, not scheduled — nothing built)

Product framing for this whole group lives in `.lovable/product-principles.md` (created 2026-09-02): administrative scope ≠ consumer visibility; the app absorbs choice burden; information is only valuable if it reduces uncertainty; the review flywheel; and the primary product metric (never increase human decisions faster than useful confirmed coverage).

#### Pass U26 — Shipped-pass ledger export — M (~3-5 credits) — Priority 3

A summary table of every completed pass with: original effort estimate (band), datetime built, datetime approved in build, the prompt text that triggered it, actual credits used, and a variance note explaining why the estimate was high or low. Deliverable is an exportable table (CSV/Markdown, generated into `.lovable/` and downloadable) plus the rule that each future shipped entry appends its ledger row in the same edit.
**Known data gaps to resolve before building:** actual credit spend per pass is not visible from inside the project — it comes from account usage, so the ledger needs either a manual "actual credits" column the user fills in from usage history, or a per-pass estimate marked as such. Original prompts are recoverable from chat history but only approximately for early milestones; the ledger should mark backfilled rows as reconstructed rather than presenting them as exact. Approval datetimes exist only where a plan was formally approved.

#### Pass U27 — Goal-directed review / just-in-time curation — L (~6-10 credits) — Priority 1

Reframe admin work from "clean the database" to "unlock the thing you actually want tonight". Instead of a 843-row global queue, the app offers scoped review jobs with an obvious payoff:

- On a movie page: `1 confirmed episode · 3 possible · 5 unreviewed that might cover it` with a **Review 3 possible matches** action that opens a review session scoped to that movie only.
- From taste: "You liked these three movies — 14 unreviewed episodes from your preferred podcasts probably discuss similar ones."
- From Tonight: "23 of tonight's movies have no confirmed coverage. Review 6 likely episodes to potentially unlock 4 of them."
  Scope: a reusable scoped-review session (same row UI and actions as Match review, but filtered by movie / podcast preference / Tonight candidacy), candidate-relevance queries, entry points on movie detail and Tonight, and a completion summary that states what got unlocked ("2 movies now have confirmed commentary"). **Depends on U8** for the per-episode review record, and reads well next to U19 (strength scoping) and U24 (in-row descriptions).

#### Pass U28 — "Why this?" rationale and score decomposition — M (~3-5 credits) — Priority 2

Two levels of explanation over the existing deterministic score in `src/lib/scoring.ts` (which already returns `reasons`, currently only partly surfaced):

- **User level:** one unobtrusive line per recommendation — `Why this? 3 podcasts you follow covered it · similar to movies you've liked · available tonight`.
- **Creator/admin level:** a full breakdown behind a tap — every contributing term with its signed points (`+28 preferred-podcast coverage`, `+20 commentary quality`, `+12 runtime fit`, …), capped/clamped terms shown as capped, and the final total. Requires `scoreFromEpisodes` to return a structured contribution list rather than prose reasons, plus any Tonight-level ranking terms (runtime fit, era fit, unseen) being computed through the same accounting so the numbers add up to what is displayed.
  Acceptance: the admin breakdown's terms sum to the shown score, and no explanation invents a factor the code does not use.

#### Pass U29 — "Pick something for me" — L (~6-10 credits) — Priority 2b

Signature decision-absorbing feature with three modes: **Surprise me** (one movie), **Give me 3** (three meaningfully _different_ choices — enforced diversity across decade, genre and podcast source rather than the top 3 by score), and **Fast decision mode** (a 5-minute timed flow: one pick at a time, Watch / Not for me, next). Each pick carries its "Why this?" line (U28) and star-style commentary-coverage shorthand (U30). Reuses the existing deterministic ranking; the new work is diversity selection, the picker UI, and "Not for me" feeding hidden/not-interested state. Related to H2 (Tonight volume) — Tonight's end state is a small curated set with **Give me more**, not a browsable list.

#### Pass U30 — Coverage quality, not coverage count — M (~3-5 credits) — Priority 2c

Today a movie reports "5 podcast episodes" with no quality distinction. Split coverage into tiers derived from data already stored (`review_state`, `match_confidence`, `is_primary_subject`, link `signals`, podcast preference, episode duration): **deep dive** (confirmed primary-subject episode from a full-length episode), **possible** (auto-linked/unreviewed with decent confidence), **brief mention** (low confidence or non-primary). Surfaces as `Commentary coverage: Excellent` / `Covered by 4 podcasts` / `Deep-dive coverage` vs `Mentioned briefly`, plus the tier counts used by U27's review prompt. Feeds Commentary Score as weighted tiers instead of a flat episode count — a scoring change, so it needs a "Score the matcher"-style before/after sanity check on ranking, and the tier definitions must be written down in `.lovable/product-principles.md`.

#### Pass U31 — Coverage-vs-workload instrumentation — S (~1-2 credits) — Priority 3b

Make the primary product metric measurable: per matcher change and per review session, record confirmed movie↔commentary relationships unlocked against human decisions required, and show the ratio in the admin surface next to the matcher scorecard. Cheap, and it is the guardrail that keeps volume work honest.

### Match Review UX and filter feedback (filed 2026-09-02, backlog only — full detail in `.lovable/plan/match-review-ux-filter-feedback-backlog-2026-09-02.md`)

#### Pass U32 — Verify single-row unlink like bulk unlink — S (~1-2 credits) — Priority 2

Follow-up candidate recorded during U12 verification (not a U12 gap): the single-row `relinkEpisodeMovie` unlink deletes without the delete-then-verify readback that bulk unlink now performs. Apply the same per-pair verification, return ok/failed, and restore the row with an error toast when the delete did not persist.

#### Pass U33 — Bulk action button visual states — S (~1-2 credits) — Priority 1

Bulk buttons must match the row-action family: Approve/Confirm = green text on grey, Unlink/Reject = red text on grey, Not about a movie = amber text on grey; only the pressed button flips to white-on-colour and holds that state (with the spinner) until the operation resolves, while unpressed siblings disable as text-on-grey and never fill. Fixes today's always-green "confirm selected" reading as pre-selected during loading. Semantic tokens only. Full state table in the plan file.

#### Pass U34 — Mobile action-button sizing — S (~1-2 credits) — Priority 1b — NEEDS DESIGN APPROVAL

Grow Match Review row and bulk action buttons ~20-30% on coarse-pointer/mobile only. Present 2-3 rendered options at 390px against a real row for approval before implementing; no unilateral size/treatment choice.

#### Pass U35 — Mobile Match Review scanning flow — M (~3-5 credits) — Priority 2b — NEEDS DESIGN EXPLORATION

Reduce the scroll → select → scroll → select burden of reviewing many matches on a phone. Exploration first (no committed solution): dense row mode, one-at-a-time triage view with auto-advance, grouping by episode, sticky per-episode header, thumb-anchored action bar. Constraints: title/year/episode/date/duration/confidence visible at decision time, one-tap undo retained, no swipe-only destructive actions.

#### Pass U36 — Match Review lag and list-jump under the finger — M (~3-5 credits) — Priority 1c

Root cause: decided rows are filtered out of the derived list the instant their pending flag clears (`out.filter((r) => !done[r.key] || pending[r.key])`), and the completion also triggers query invalidation/refetch that can reorder the page — with no scroll anchoring and no post-action input guard, content moves under the finger and the next tap lands on a different row. Smallest fixes: keep decided rows mounted in a settled "Confirmed / Unlinked · Undo" state until page/tab/filter change or Refresh (S); ~250-300ms input guard after any list mutation (S); scroll anchoring on the top visible row (S). Generalisable fix: refetches never reflow the visible page mid-session, new data lands behind an explicit "N new — refresh" affordance (M). Recommendation from the current architecture: settled rows + input guard first. Acceptance: ten consecutive row actions at 390px produce zero shift under a fixed finger position. Re-verify U10 auto-advance afterwards.

#### Pass U37 — Filter interaction and feedback — M (~3-5 credits) — Priority 2c — NEEDS DESIGN

Y2's rating range is accepted; this pass addresses the broader filtering-feedback problem it exposed: (1) staged "Apply filters" breaks cause/effect — overlaps and is cross-referenced with Pass D4; (2) filter impact is invisible because the count and list sit outside the panel — candidate is a live "N movies match" readout on the draft plus cheap per-control hints; (3) the expanded filter controls are not discoverable — candidate is a clearer labelled entry point carrying the active-filter summary, plus removable applied-filter chips. Design options first, then build. Depends on D4's measurement for the live-count half.

## Worth doing soon

### Pass E — Card cleanup — M (~3-5 credits) — Priority 5

Drop the redundant "Watched" badge now that the eye/check control exists, and shrink the commentary badge to icon + number with the label on tap. Recommended option: "N episodes" text with the score as a thin accent bar on the card edge.

### Pass F — Destructive actions and undo feedback — M (~3-5 credits) — Priority 6

Confirmation dialog before deleting a watchlist plus an undo snackbar (~8 second soft delete), the same snackbar for following a show ("Following <show name>" + Undo) which also clears up the heart ambiguity. `alert-dialog` and `sonner` are both present but unused for this.

### Pass Z — Admin queue reset and matcher replay — M (~3-5 credits) — Priority 7c

Admin-only maintenance action that purges current non-manual proposed/weak saved links from active shows, keeps human labels (`match_actions`, `episode_match_rejections`, `not_about_a_movie`) intact, then reruns the current matcher over the now-unmatched active episodes. Best practice: dry-run first with counts by link type and confidence band, require a confirmation phrase, never delete manual/confirmed links, never touch parked shows unless explicitly opted in, and log a single maintenance action for audit/undo context. Useful after major matcher changes, but risky enough to keep behind a guarded tool rather than a routine workflow.

### Pass J1 — Episode row presentation — M (~3-5 credits) — Priority 9

Episode rows get truncated descriptions with expand, consistent title/date/duration/controls on both movie and podcast pages, and a segmented control on podcast pages for movie-focused vs episode-focused views.

**Partial 2026-09-03:** admin-only "Mark episode reviewed" / "Reopen" control (stacked-check icon) added to episode rows on movie detail and podcast detail, writing the same `episode_reviews` state as Match review. Acceptance: Verified — button renders admin-only on both surfaces, marking persists to the database and reverts via Reopen, no horizontal overflow. Remaining (not built): truncated descriptions with expand, fully consistent row metadata, movie-focused vs episode-focused segmented control.

### Pass J2 — Dedicated episode pages — M (~3-5 credits) — Priority 9b

Dedicated per-episode pages are deferred until external ratings/comments or similar episode-level social/context data exists.

## Backlog (wider-audience or large-volume — hold until the engine is trustworthy)

### Pass L — Scheduled refresh — L (~6-10 credits) — Priority 11

Server-side scheduled refresh (feeds daily, availability weekly, staggered) with a visible "last synced" per podcast/movie and manual override retained. Explicitly backlogged: automating volume before the matcher is accurate multiplies review work.

### Pass M — External ratings, user-controlled — L (~6-10 credits) — Priority 12

Per-user choice of which ratings to show, cached in the `podcast_external_metrics` shape extended to movies. Realistic sources: TMDB (already integrated), OMDb (IMDb / Metascore), Trakt; Podcast Index (integrated), Apple Podcasts (unofficial), Podchaser (paid). Letterboxd has no public API; Spotify has no ratings. **Dependency:** Pass T5's "sort shows by highest external rating" is blocked on this pass landing a per-show ratings cache; until then show curation sorting stays A–Z / episode count / unmatched / missing count.

### Pass N — Tags/vibes and people-based discovery — XL (~10+ credits) — Priority 13

Shared tag system for movies and shows (curated starter tags, user-proposed, emoji allowed, character cap, tag filtering) plus TMDB person search leading to an actor page filtered to titles with commentary coverage.

### Pass P — Richer movie detail (cast) — L (~6-10 credits) — Priority 14 **Acceptance criteria (2026-09-02):** `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`.

Top-billed cast and director from TMDB credits shown on the movie page, with an external link out for anything deeper. Needs a cast cache table and a credits fetch during enrich.

### Pass V — TV shows and miniseries via TMDB — XL (~10+ credits) — Priority 15

Expand from movies-only to both `movie` and `tv` catalog items using the existing `media_type` column. Scope: TMDB TV search/detail/enrichment, season/episode-aware title extraction, TV/miniseries runtime and first-air-year handling, watch-provider refresh for `/tv/{id}`, TV content ratings, detail pages that clearly label films vs series, and discovery filters that can include/exclude TV. Design impacts to decide before building: cards need media-type badges; “runtime” becomes episode runtime or total runtime; release year becomes first-air year; podcast episode links may target a series, a season, or a specific episode; availability can differ by season; and “movie detail” copy/navigation should become “title detail” or similar so the UI does not feel movie-only.

---

# Already done

### Triage fix — "Not about a movie" is now reversible from the episode row — shipped 2026-09-04 (QUICK FIX)

Finding: the retirement always *was* a reversible per-episode state (`podcast_episodes.disposition`), and undo existed only inside Recent match decisions, where it required undoing two separate records (the `not_about_a_movie` entry plus one `unlink` per removed link) and became unfindable once the log scrolled. The row control was write-only.

Fix: new `undoEpisodeRetirement` server function plus `useUndoEpisodeRetirement`. The amber row control is now a toggle — pressing it again sets the disposition back to `needs_review`, restores exactly the links that same retirement removed, clears exactly the rejections it wrote, and stamps those logged actions `undone_at` so the history cannot replay them. Only the newest un-undone retirement and the unlink entries logged with it are touched; older independent decisions are untouched, and no automatic restoration happens outside this explicit undo. Verified in the running app on `/podcasts/that-aged-well` (1280px): retire → button flips to "Undo not about a movie" → undo → disposition `needs_review`, link restored, rejection cleared, both log rows marked undone. No decision/history model change was needed, so this is not a new pass; it completes the U8 / Match review undo story.

### Triage fix — automated matching undid manual review work — shipped 2026-09-04

Root cause: the sync-time matcher inside `ingestPodcast` re-matched **every** episode in a feed on every sync with no rejection check, no reviewed-episode check and no existing-link check, so previously rejected pairs came straight back (fingerprint: `heuristic`/`proposed`, empty `signals`), and each fresh insert fired `episode_review_stale_on_new_link`, reopening episode sign-offs. Separately, a completed sync bumped `podcasts.sync_generation`, and review currency compared against that generation — so a single sync invalidated a whole show's "reviewed" marks even without any coverage change.

Fixes: sync-time matching now skips reviewed, retired and already-linked episodes and never picks a rejected pair; `resolveEpisodesToMovies` (Build movies) and `rescanEpisodeMatches` exclude reviewed episodes, and `writeLink` has a final rejected-pair guard; `fetchRejectedPairs` pages in a stable order; review currency is decided only by explicit invalidation (`reopened_at`), not by sync generation. Data repair migration removed 286 automated links on rejected pairs (manual/confirmed links untouched) and restored sign-offs reopened only by `new_link` — reopened reviews fell 178 → 10, rejected-yet-linked pairs 291 → 5 (all manual/confirmed).

### Triage fix — "Any" runtime slider silently capped results at 180m — shipped 2026-09-03

Verified 2026-09-03 in the running app at `/movies` (390px viewport): searching "Titanic" now returns _Titanic (1997), 194m_ with no filters applied. `applyFilters` in `src/lib/discovery.ts` skipped the runtime test only when `runtime <= maxRuntime`, so the top slider stop — labelled "Any" in `FilterBar` — still excluded every movie over 180 minutes on both Tonight and Movies. The filter now short-circuits when `maxRuntime >= RUNTIME_CEILING`. No other filter behaviour changed.

### Pass U16 — Treat "live" as a special word in the matcher — shipped 2026-08-31

Verified 2026-09-02 by direct scoring run against `matchEpisodeToMovies`: "LIVE at the Bell House!" and "Live from Chicago - our anniversary show" now yield no candidate for the movie _Live (2016)_, while "Live Free or Die Hard (2007)" and "Live (2016)" still score 100 on exact title + year.
`matching.server.ts` caps confidence at 15 for any non-exact candidate whose only shared token with the episode title is `live` (or whose whole title is "Live"), unless the year agrees or the description names the title with its year. Multi-word titles containing "Live" are unaffected.

### Pass U13 — Match review reliability sweep — shipped 2026-08-31

Verified 2026-09-02 (code review): `total = rawTotal` with a separate `decidedHere` counter (no `Math.max` fudge), view state persisted under `ma.matchReview.view.v1` and restored in an effect after hydration, active-queue invalidation immediate with the other four queues coalesced into one ~900ms deferred pass, and `ReviewRow` memoised behind stable `useCallback` handlers.
Counts are honest: the `Math.max(rows.length, rawTotal - done)` fudge is gone — "Showing X of Y" reports the server's total for the current filter and adds "· N decided here" for rows settled in this session, so the arithmetic can never print "Showing 41 of 0". View state (tab, submitted search, confidence band, review state, batch size) persists in `localStorage` and is restored after hydration, so a reload no longer snaps back to Flagged / ≤ 80% / 50. Invalidation fan-out is scoped: a row decision refetches only the queue you are working, while the other queues, unmatched episodes and the stats/history tiles are coalesced into one deferred pass ~1s later, so a burst of decisions costs one background refresh instead of five per click. Render cost on 200-row pages is fixed by extracting a memoised `ReviewRow` with stable callbacks (`toggleRow`, `act`, `relinkRow`), so selecting or acting on one row no longer re-renders the whole list. Stale intro copy now states that confirmed links are hidden unless requested, that every queue skips parked shows and retired episodes, and that the view is remembered. Follow-ups: U8, U9, U14.

### Pass U11 — "Updating results…" and busy-state conditions — shipped 2026-08-30

Verified 2026-09-02 (code review): `busy` derives from the explicit `intent` state (search/filter/page), never from `isFetching`; per-row `pending` keeps acted-on rows visible and dims only those rows; failures call `unmarkDone` to return the row; pending/selection cleared on scope change.
Busy state in `MatchReviewCard` is now driven by an explicit `intent` (search submit, confidence band / review state / page size change, explicit Refresh, automatic page advance) rather than `isFetching`, so background refetches, window refocus and unrelated invalidations no longer spin the header or disable Search; the intent clears once its fetch settles. Row actions get their own pending state: an acted-on row stays listed and dimmed with a "Saving…" indicator while its request is in flight, its own controls (including relink) are the only ones disabled, a failure returns the row to the queue with the error, and bulk actions mark every affected row pending. Stale pending keys are cleared with `done`/selection when the query scope changes. Follow-ups: U13 (reliability sweep), U14 (serialised admin actions).

### Pass U24 — Episode description in match review — built 2026-09-03 (implemented, not verified)

Acceptance checklist against `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`:

- **Verified (code)** — collapsed-by-default "Episode description" disclosure per row; nothing loads or changes row height until expanded (lazy `getEpisodeDescription` server fn, admin-guarded, gated on `enabled: open`).
- **Verified (code)** — description renders in place as plain text: feed HTML is stripped and entities decoded, never injected as markup; candidate movie title highlighted with a case-insensitive exact match; honest "No description stored for this episode." line when empty; primary (or first) `episode_sources` URL rendered as a `target="_blank"` link.
- **Verified (code)** — expansion state is local to each memoised row, sits outside the selection header, and touches neither multi-select, per-row pending state nor pagination. Text uses `whitespace-pre-line break-anywhere` per the G2 layout-lock rule.
- **Verified 2026-09-03 (desktop, `/admin/ingest` → Match review → Proposed)** — expanded 12 rows in the signed-in preview: descriptions render in place as plain text (feed HTML/ad boilerplate stripped), the candidate title highlights case-insensitively where present (`Tuner`/`tuner`), the source link is `target="_blank"` to the episode's primary source, expansion is per row, and page overflow stayed at 0px.
- **Implemented, not verified** — 390px mobile viewport screenshot of an expanded long description (desktop showed no overflow and the row uses `break-anywhere`), and the null/empty-description empty state (no episode with an empty description surfaced in the sampled rows).
- **Deferred** — description truncation / "Show more" (explicitly out of V1 scope), fuzzy or alternate-title highlighting.

### Pass U8 — Episode-level "review complete" — built 2026-09-02 (partially verified)

**Triage fix shipped 2026-09-04 — podcast-page review state above 400 episodes and full matcher protection.** The podcast detail hook silently sorted and truncated episode IDs to 400 before reading review state. Both affected shows exceed that size, and all 14 reported episodes fell beyond the cutoff even though their `episode_reviews` rows had persisted with `reopened_at = null`. The hook now submits the complete show episode set (up to the 1,000-episode ingestion ceiling plus headroom), while the server retains 50-ID database batches. The audit also found that the Proposed queue's `suggestEpisodeMatches` path did not exclude reviewed episodes; it now shares the same reviewed-episode guard as sync, Build movies, and recheck. These were existing U8 completeness defects, not a new pass.

Acceptance checklist against `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`:

- **Verified (SQL)** — `episode_reviews` (episode_id PK, `reviewed_at`, `reviewed_by`, `sync_generation`, `reopened_at`, `reopen_reason`, `updated_at`), RLS on with an admin-only ALL policy, grants present for `authenticated` and `service_role`; marking an episode reviewed twice leaves exactly one row.
- **Verified (SQL)** — auto-reopen triggers: new non-confirmed proposal → `new_link`, wrong-match flag → `flagged`, link removal → `link_removed`; the record is reopened (history kept), never deleted.
- **Verified (code)** — review completeness is independent of link `review_state`: episodes with no links can be marked reviewed, and a confirmed link is not reviewed until signed off. A non-reopened record remains current; a feed sync alone does not invalidate it.
- **Verified 2026-09-03 (desktop, signed-in preview)** — row-level Mark reviewed writes through (`episode_reviews` row created for "Magic (1978)", `sync_generation` 1, `reopened_at` null) and the control flips to Reopen; Reopen writes `reopened_at` + `reopen_reason = manual_reopen` and the row returns to the unreviewed queue. Coverage rows read `Reviewed 48 of 471 episodes (never synced here)` — the `as of sync D` form appears once a show has a sync timestamp.
- **Implemented, not verified** — bulk Mark reviewed / Reopen across a multi-select, the "Hide reviewed episodes" toggle empty state, Mark reviewed / Reopen on the unmatched-episodes list, and mobile (390px) rendering of these controls.
- **Needs follow-up** — coverage arithmetic (`Y - X` vs. queue count) for one show; `ingestPodcast` raises `sync_generation` even on a partial sync; reopening an episode with no record reports success as a no-op.
- **Verified (code)** — queryable by episode, and via `episode_movies` by show and by linked movie, so U27 needs no further migration.
- **Needs follow-up** — sign in to the preview, then confirm on desktop + mobile: persistence across reload, bulk marking three rows against SQL, reopen returning rows to the queue, and coverage arithmetic (`Y - X` vs. queue count) for one show. Also open: `ingestPodcast` raises `sync_generation` even on a partial sync, and reopening an episode with no record reports success as a no-op.

Server functions `setEpisodeReviewed` (single/bulk, verified per episode) and `listEpisodeReviewStates` live in `src/lib/ingestion.functions.ts`; `listPodcastCoverage` now also returns `episodesReviewed`, `episodesUnreviewed`, `syncGeneration`, `lastSyncedAt`, and `ingestPodcast` stamps `sync_generation`/`last_synced_at`. Link-level counts remain, relabelled "links reviewed / links awaiting review" so they cannot be mistaken for episode sign-off.

### Pass U12 — Bulk unlink that actually sticks — shipped 2026-08-30

Verified 2026-09-02 (code review): `bulkMatchDecision` verifies each pair (delete via `.select()` plus an existence re-check, approve/confirm re-read `review_state`, retire re-checks remaining links) and returns per-pair results; the card un-hides failed keys and reports them, and `done`/`selected`/`pending` are cleared whenever the scope key changes. Note (not a U12 gap): the single-row unlink path `relinkEpisodeMovie` deletes without the same `.select()` verification — worth folding into U14/U13 follow-up work if a single unlink is ever seen to bounce back.
`bulkMatchDecision` now returns a per-pair `results` array and verifies every decision against the database before calling it a success: deletes use `.select()` so a delete that matched nothing is detected (and only accepted when the link is genuinely already gone), approve/confirm now write `review_state = 'confirmed'` with `reviewed_at`/`reviewed_by` — previously they left rows `auto_linked`, which is why bulk-approved rows reappeared in the unconfirmed queue — and retire re-checks that no links remain. `MatchReviewCard` maps each pair back to its row key, so failed pairs are un-hidden and reported ("N row(s) could not be changed and are still listed: …") instead of silently returning on the next refresh; flags are only resolved for pairs that landed, a whole-request failure restores every row, and stale optimistic `done`/selection state is cleared whenever the query scope (tab, search, band, review state, page size, offset) changes. Follow-ups: U11 (busy state), U13 (reliability sweep).

### Pass U10 — Match review empty-state and pagination honesty — shipped 2026-08-30

Verified 2026-09-02 (code review): per-tab `offsets`, auto-advance effect gated on `!loading && !fetching && !queryError && rows.length === 0 && hasMorePages`, four distinct empty-state messages (page decided / end of queue / no search match / queue clear or empty review state) and a "Back to the start of the queue" control once exhausted.
`listFlaggedLinks` now takes an `offset` (matching `suggestEpisodeMatches` and `listEpisodeLinks`), and `MatchReviewCard` keeps a per-tab page cursor. When every visible row on a page has been decided but the filtered total runs past this page, the card advances to the next batch automatically (page size = the dropdown selection) instead of printing "Nothing flagged as wrong". Empty-state copy now names the actual reason: page decided / loading next, end of queue (with the worked total), no search match, queue clear for the confidence band, or nothing in the chosen review state — plus a "Back to the start of the queue" button once the end is reached. Changing search, confidence band, review state or page size resets the cursors, and the header shows "(from #N)" when past the first page. Follow-ups: U11 (busy state), U12 (bulk unlink), U13 (reliability sweep).

### Pass U7 — Make review progress visible — shipped 2026-08-30

Verified 2026-09-02 (code review): `listIngestionStats` returns `linksConfirmed`, `linksToReviewActive` and `linksToReviewParked` (joined through `podcasts.curation_status`); the ingest page renders the Confirmed links tile and the "A active · B parked" sub-line; `listEpisodeLinks` honours all five `reviewState` values; coverage rows print reviewed/awaiting plus active-or-parked.
`listIngestionStats` now returns `linksConfirmed` plus `linksToReviewActive` / `linksToReviewParked` (counted through the show's `curation_status`), so `/admin/ingest` shows a **Confirmed links** tile ("of N total links") and the awaiting-review tile reads "A active · B parked". `listEpisodeLinks` takes a `reviewState` filter (`unconfirmed` default, `proposed`, `auto_linked`, `confirmed`, `all`) instead of hard-excluding confirmed rows, and the Existing links tab has a **Review state** dropdown so confirmed work is inspectable; the empty state distinguishes "queue clear" from "no links in this state". Coverage rows label each show active or parked alongside its reviewed/awaiting counts. Follow-ups: U8 (episode-level review complete), U9 (learning evidence), U10–U13 (reliability).

### Pass H8 — Holiday exclusion (crude keyword first pass) — shipped 2026-08-28

`excludeHoliday` boolean added to `Filters` (`src/lib/prefs.ts`), defaulting via a date rule `defaultHolidayExclusion()` — on Jan 8 – Nov 2, off Nov 3 – Jan 7. `applyFilters` (`src/lib/discovery.ts`) drops titles whose title or synopsis matches a standalone `Santa`/`Christmas` word boundary regex. A "Seasonal" group in the expanded Filters & Sort panel (`FilterBar.tsx`) exposes an "Exclude holiday movies" chip with an explanatory line. Ships inside the same build that renamed the roadmap to `.lovable/roadmap.md` and filed G6 + U1–U6.

### Apply-filters button — shipped 2026-08-28

`FilterBar` now edits a local draft of the filter object; runtime slider, era range, genre/vibe chips, sort, rating ladder, service badges and all toggles write to the draft only. One `setFilters` call commits on **Apply filters** (labelled with the pending-change count), **Cancel** restores the applied values, **Reset** loads app defaults into the draft, and a small coral dot on the panel heading marks unapplied changes. The sheet's primary button applies and closes. Result counts continue to describe applied filters; the Movies text search stays live. Sliders are smooth with movies on screen because nothing re-ranks mid-drag. Follow-up: Pass D4.

### Repair pass — D/O/T5/G/H/Y verification and remnants — shipped 2026-08-25

Verified in the 2026-08-26 review at base level: iOS/PWA safe-area top bar, corrected page header labels, Tonight controls split from the Movies variant, slider fill and enlarged touch targets, Tonight defaulting to "Unwatched", watchlist/watched controls with named snackbars, visible and consistent dim-watched styling, navigable Setup podcast rows, and T5 show-curation search/filter/sort verified rather than rebuilt. Remaining refinements were re-filed as discrete passes (H2–H9, D2, D3, E2, E3, O2, O3, Y2, Y3, G3, G4, T6, T7, J3) rather than kept inside this pass.

### Pass Y2 — Rating minimum + maximum range — shipped 2026-08-29

Filters now carry `minRating` alongside `maxRating`. One dual-handle slider (`RatingRange`) spans the normalised ladder TV-Y → NC-17 with the allowed band filled, ladder tick labels highlighted inside the band, and a readable "PG – R" summary. "Any rating" resets the band; "Include unrated (NR)" stays a separate opt-in. `applyFilters` excludes titles below the floor as well as above the ceiling.

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

### Pass I — Listening history — shipped 2026-08-31

Lists & History gained a third tab, "Listened (N)": every episode you rated, graded or moved off "not started", newest first, with show artwork, episode date, linked movie titles and status/rating chips, linking through to the show page. Built from the existing local prefs + catalogue join (`useListened` in `src/lib/lists.ts`) — no new tables.

### Match review rows show episode date + duration — shipped 2026-08-31

Every Match review row (Flagged / Proposed / Existing) now prints the release date and runtime next to the show name, so 90-second ads and trailers are obvious at a glance and an ambiguous title's year can be sanity-checked. `duration_seconds` was added to the episode fetch, `listEpisodeLinks` and the flagged-links query.
