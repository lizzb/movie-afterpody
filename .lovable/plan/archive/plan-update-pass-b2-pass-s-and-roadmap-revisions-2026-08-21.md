# Plan update — Pass B2, Pass S, and roadmap revisions

Priorities below are relative to the existing roadmap (`.lovable/plan/movie-afterparty-consolidated-roadmap-passes-a-r-2026-08-20.md`), where Pass R is Priority 1.

---

## Pass B2 — "Wrong movie?" flagging from the app — ~40k — Priority 2

You are right that this never shipped. Pass B/Q built the admin review surface at `/admin/ingest`; the episode rows on movie detail and podcast detail pages have no control at all.

### End-user side (deliberately minimal, revised later)

- Every episode row on a movie detail page and a podcast detail page gets one small, low-contrast control: a flag icon with the accessible label "Wrong movie?".
- Tapping it records a flag for that exact episode + movie link and immediately shows an undo snackbar (`sonner`, ~8 seconds): "Flagged as wrong match — Undo". Undo deletes the flag.
- The row then shows a persistent quiet state: a small "Flagged" chip, and the flag control becomes "Flagged — undo" while the row is still on screen. Reload keeps the chip.
- Nothing is unlinked and nothing disappears from the app. Flagging is a signal, not a mutation of the catalogue, so browsing never breaks under you.
- Available to any signed-in user; anonymous visitors don't see the control (there is no identity to attribute the flag to and no anonymous writes).

### Admin side

- Flags become the highest-priority queue in Match review: a new **Flagged** tab, first, with its own count, plus a "Flagged by a human" badge on any row that also appears in Proposed or Existing links.
- Ordering rule: human-flagged pairs always sort above algorithmic confidence bands. One human has already detected incorrectness, so it outranks any score.
- Resolving a flagged row uses the actions that already exist (reject, unlink, relink, not about a movie, confirm correct). Any of those clears the flag and writes to `match_actions`, so undo still works.
- A "Dismiss flag (link is correct)" action for when the flag was wrong, which confirms the link and clears the flag in one step.

### Deferred to a later pass (design noted now, not built)

Inline correction for end users: tapping "Wrong movie?" would open a sheet with the next-best candidates plus a TMDB search box so a non-admin can propose the right movie, with proposals landing in the same Flagged queue as suggestions rather than direct writes. Out of scope for B2 — flagging plus visible flagged state is sufficient for now.

### Technical notes

- Migration: `episode_link_flags` (episode_id, movie_id, flagged_by, note nullable, created_at, resolved_at nullable, resolution). GRANTs in the same migration; RLS lets a user insert and delete their own unresolved flag and read their own flags, and lets admins read and resolve all.
- Catalogue reads in `src/lib/data.ts` return a per-link `flaggedByMe` boolean so rows render the chip without a second round trip.
- `listEpisodeLinks` / `suggestEpisodeMatches` gain a `flaggedFirst` ordering and a flag count; the Flagged tab is a third mode in `MatchReviewCard`.

---

## Pass S — Admin surface responsiveness and honest counts — ~55k — Priority 3

Split into two clearly separable halves; both are small enough to land in one pass.

### S1 — Perceived speed and touch targets (~30k)

- **Instant optimistic feedback** on per-row approve / reject / not-about-a-movie / confirm: the row transitions immediately (dims, shows its outcome, disappears from the queue) while the server call runs, and rolls back with a toast if the call fails. Today every one of those buttons waits for a full round trip plus three query invalidations before anything moves.
- **Targeted invalidation instead of blanket refetch**: a single-row decision updates that row's cache entry and the counts, rather than re-running the whole suggestion query (which pages every episode) plus links plus history plus stats.
- **Search feedback**: the search button enters a pending state on submit, the results region shows a skeleton/"Searching…" line, and the button is disabled while in flight so a second tap can't queue another scan.
- **Bulk actions**: a progress line ("12 of 40 processed"), disabled controls while running, per-row outcome as each completes, and one summary toast at the end.
- **Bigger touch targets**: the whole card header (artwork, episode title, show name, movie title) becomes the selection target for multi-select, with the checkbox kept as a visible affordance and enlarged to a 44px hit area. This is standard practice and not weird — the requirement is that the action buttons live in their own row at the card footer and stop click propagation, so tapping Approve never toggles selection.

### S2 — Collapsible sections and consistent, live counts (~25k)

- **Every card on `/admin/ingest` becomes collapsible**, with an open/closed state remembered locally per card. Defaults: Match review and Unmatched episodes open; Recent match decisions and every maintenance card (bulk enrich, artwork, ingest, enrich, availability) collapsed. Collapsed headers still show their key number so nothing is hidden.
- **Stat tiles rewritten to match the sections they jump to.** "Weak links to review" is replaced by **Links to review — X (Y proposed / Z existing)**, where the numbers are exactly what the Match review tabs list. Today that tile counts links stamped `heuristic` (214 right now, 13 when you looked), which is a different population from anything the review section shows — that is the whole source of the confusion.
- **Unmatched count bug fixed.** Confirmed root cause: the stats query reads `episode_movies` with an unpaged `select("episode_id")`, so it only ever sees the first 1,000 link rows and overstates unmatched episodes; the section itself pages every row via `pageAll`. Both sides move to one shared counting helper, and the tile additionally reports retired ("not about a movie") episodes separately so the tile total and the section total can never disagree again.
- **Counts stay live**: every mutation that changes a count invalidates the shared count query, and the stats block refetches on focus.

### Also inside Pass S: "Recent match decisions — data is undefined"

There are 177 rows in the match action log right now, so it is not an empty-data case. This was most likely the FK-ambiguity error fixed earlier in the same session, showing before that fix landed. First step of S2 is to reload the card and confirm; if it still fails, the error text gets rendered in the card instead of an undefined read, and the query gets a real `errorComponent`-style fallback.

---

## Roadmap edits

### Pass D — Header consistency + info sheet — ~30k → ~35k — Priority 5
Adds: enlarge the `YearRange` and runtime slider hit areas on the Tonight parameters — bigger invisible touch padding around each handle (44px minimum), a slightly larger visible handle, and a wider track — so handles are easy to grab on mobile.

### Pass O — Watchlist controls: layering and instant feedback — ~25k — Priority 6
Restored to the roadmap (it was dropped from the consolidated file). Fixes the add-to-list popover overlapping the card below it (proper layering/portal and edge-aware placement) and the missing or slow checkmark feedback across Tonight, Movies and movie detail (optimistic toggle plus an undo snackbar). Overlaps with the optimistic-update work in Pass S1, so it is cheaper if built after it.

### Pass N split — N1 and N2
They are independent and should be separate passes; nothing about either requires the other. Tags are a new shared taxonomy plus filter UI, people-based discovery is a TMDB person lookup plus a filtered listing. The only shared piece is the discovery filter shell, which already exists.

- **Pass N1 — Tags / vibes — ~40k — Priority 13.** Shared tag system for movies and shows: curated starter tags, user-proposed tags, emoji allowed, character cap, tag filtering in discovery.
- **Pass N2 — People-based discovery — ~35k — Priority 15.** TMDB person search leading to an actor/director page filtered to titles with commentary coverage. Pairs naturally with Pass P (cast on movie detail), since both need the credits fetch and cache.

### Pass M — External ratings — now also covers "currently active" (~60k → ~70k) — Priority 12
Adds a user-controlled activity threshold: define "currently active" as a new episode within the last 1 / 3 / 6 / 12 months (user setting, default 6), replacing the fixed `activity_status` label for display purposes. Plus a Tonight-page preference for how activity is weighted: active shows only / prefer active / don't care. Grouped here because both are per-user, opinion-shaped signals over podcast metadata; it is a small tack-on to M rather than its own pass.

---

## Technical notes (Pass S)

- New `src/lib/admin-counts.functions.ts` exposing one `getReviewCounts` server function used by the tiles, the tabs and the unmatched card; it pages `episode_movies` with `pageAll` and returns `{ episodes, linkedEpisodes, unmatched, retired, proposed, existing, flagged }`.
- `MatchReviewCard` gets an optimistic mutation layer (`onMutate` cache patch + rollback) and a `pendingRows` set; the bulk path reports per-row results as they stream back.
- A small `CollapsibleCard` wrapper in `src/components/admin/` built on the existing `collapsible` primitive, with state in `localStorage`.
- `admin.ingest.tsx` keeps shrinking: each card moves into `src/components/admin/` as it is touched.
