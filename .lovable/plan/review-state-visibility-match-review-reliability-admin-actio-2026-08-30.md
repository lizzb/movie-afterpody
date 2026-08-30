# Review-state visibility, match review reliability, admin action queueing (backlog only)

## Part 1 — Where "confirmed" lives today, and why you can't see it

Verified in the current code:

- Every link row does carry `review_state` (`proposed` / `auto_linked` / `confirmed`) plus `reviewed_at` / `reviewed_by`. Approve, confirm and relink all write `confirmed`.
- The stat tile **Links awaiting review** counts links whose state is not `confirmed`.
- The coverage list prints `N reviewed · M awaiting review` per show, and "All episodes reviewed" when a show has none awaiting.
- Match review rows in the **Existing links** tab print the state label (`Confirmed · manual · 100%`).

Why it looks like nothing changed:

- The **Existing links** query explicitly excludes `review_state = 'confirmed'`, so a link disappears the moment you confirm it. The label exists but you can practically never see a "Confirmed" row — there is no view of confirmed work anywhere.
- There is **no confirmed count** in the stat tiles — only the awaiting-review number. Progress is visible as a shrinking number, never as a growing one.
- The awaiting-review figures are **not split by active vs parked**, so your target sentence ("A links from active shows, B from parked") cannot be read off the screen today.
- **"Reviewed" is per link, not per episode.** Nothing records "I looked at this episode and it needs no further links." An episode with one confirmed link and no other links looks identical to an episode nobody has examined for missing second links.
- Nothing stamps a review against a **feed sync date**, so "all of X and Y are reviewed as of date D" isn't expressible; a later sync adds episodes and silently dilutes the claim without telling you.
- Evidence of learning exists only in **Score the matcher** (precision/recall/signal lift replayed over your approve/reject labels). It is a manual, on-demand run with no history, so you cannot see a trend line proving the matcher improved after a review session.

## Part 2 — Proposed target workflow (what the passes below deliver)

1. Park everything you are not actively working. Active set stays small.
2. Sync episodes for an active show; the show records its last feed sync date.
3. Work the show's queue: Flagged → Proposed → Existing links (unconfirmed only).
4. For each episode, either confirm its link(s) or mark the episode **review complete** ("links look right, no more needed") — reversible at any time, and automatically reopened if a new link is proposed or a flag is raised later.
5. Show reads `Reviewed 254 / 255 episodes as of sync 2026-08-28`, and flips to fully reviewed only when the reviewed set covers the synced set.
6. After a session, run Score the matcher; the run is stored, so the scorecard shows this run vs the previous one — that delta is your evidence of learning.

## Part 3 — Backlog passes

### Pass U7 — Make review progress visible — M (~3-5 credits) — Priority 1
Add a **Confirmed links** count tile next to "Links awaiting review", split awaiting-review into **active shows** vs **parked shows**, and add an explicit **Review state** filter to the Existing links tab (Unconfirmed / Auto-linked / Proposed / Confirmed / All) so confirmed work is inspectable instead of invisible. Coverage rows gain the same active/parked framing.

### Pass U8 — Episode-level "review complete" — L (~6-10 credits) — Priority 2
New per-episode review record (episode id, reviewed_at, reviewed_by, the feed sync generation it was reviewed against), a **Mark reviewed / Reopen** control on every episode row in match review and unmatched episodes, and a bulk "mark selected episodes reviewed". Auto-reopen on: new link proposed for that episode, flag raised, or link removed. Coverage reads `Reviewed X of Y episodes as of sync D`. Requires one migration.

### Pass U9 — Learning evidence over time — M (~3-5 credits) — Priority 3
Persist each Score the matcher run (timestamp, label counts, precision/recall per band, signal lift) and show the current run against the previous one with deltas, plus a short history list. Turns "the system is learning" into a number you can watch move.

### Pass U10 — Match review empty-state and pagination honesty — S (~1-2 credits) — Priority 1
When all visible rows have been decided but the unfiltered total is larger than the page size, load the next page automatically (page size = the dropdown selection) instead of printing "Nothing flagged as wrong". Empty-state copy distinguishes: page exhausted / queue clear / no search matches / filtered out by review state.

### Pass U11 — "Updating results…" and busy-state conditions — S (~1-2 credits) — Priority 1
The spinner is driven by `isFetching` on the active query, so it also fires for background refetches, window refocus and unrelated invalidations. Scope busy indicators to user-initiated fetches (search submit, filter change, explicit Refresh) and give row actions their own per-row pending state, so nothing spins when nothing is changing.

### Pass U12 — Bulk unlink that actually sticks — M (~3-5 credits) — Priority 1
Reproduce in-browser: select all shown → unlink selected → rows vanish → refresh restores the same count. Suspected cause is optimistic `done` state hiding rows whose server-side delete either failed silently or was applied to a stale key set (`episodeId:movieId` pairs from a previous page). Fix: report per-pair success/failure from the bulk server function, only mark actually-deleted pairs done, surface partial failures, and clear stale `done` keys when the query key changes. Also fixes the follow-on symptom where the bulk bar stays greyed out with a spinner after the next "select all".

### Pass U13 — Match review reliability sweep — L (~6-10 credits) — Priority 2
Broader investigation pass over the whole match review surface: total/`unfilteredTotal` vs locally-decremented counts (the `Math.max(rows.length, rawTotal - done)` fudge), when queues auto-refresh vs require a manual Refresh, persistence of tab/band/page-size/search across reloads, stale informational copy, invalidation fan-out cost, and render cost on 200-row pages. Deliverable is a recorded browser pass demonstrating consistent counts and behaviour before/after. Depends on U10–U12 landing first.

### Pass U14 — Serialised admin actions — M (~3-5 credits) — Priority 2
Park/re-activate and per-show sync actions currently share one `busyId`, so a second click abandons the first. Short term: disable other actions while one is in flight. Target: a small client-side action queue that runs requests in click order, shows each row's pending state, and reports per-action success/failure — applied to park, sync and per-show tools.

### Pass U15 — Summary stats for backfill and enrichment tools — S (~1-2 credits) — Priority 3
Give **Backfill content ratings** and **Enrich movies from TMDB** the same shape of readout the coverage card has: how many rows never checked, how many checked, oldest check date, last run timestamp and last run result — so you can tell whether a tool has more work left without pressing it.

### Pass U16 — Treat "live" as a special word in the matcher — S (~1-2 credits) — Priority 2
`live` standing alone (live show, live episode, "live at …", live from a venue) is show-format language, not a title token. Add it to the special/common-word handling: suppress single-word or weak matches that hinge on `live`, require corroboration (year, exact whole-title match, subject-sentence description hit), and keep genuine titles containing "Live" (e.g. *Live Free or Die Hard*) unaffected. Verify with local scoring checks before claiming a fix.

## Technical notes

Touched by the above: `src/lib/ingestion.functions.ts` (stats, `listEpisodeLinks`, `listPodcastCoverage`, bulk decision path), `src/components/admin/MatchReviewCard.tsx`, `src/components/admin/MatcherScoreCard.tsx`, `src/routes/admin.ingest.tsx`, `src/lib/providers/matching.server.ts`, `src/lib/matcher-eval.server.ts`. Migrations needed for U8 (episode review records) and U9 (scorecard run history) only.
