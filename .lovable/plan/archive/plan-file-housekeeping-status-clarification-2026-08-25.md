# Plan file housekeeping + status clarification

## Your status questions, answered from the code

- **Pass R1 (Active / Parked curation) — DONE.** `podcast_curation` enum, `curation_status` on podcasts, Active/Parked tabs, `activeOnly` scoping in `ingestion-helpers.server.ts`. Shipped 2026-08-21.
- **Pass R2 (Episode-level noise handling) — STILL PENDING.** No bulk "Retire remaining unmatched" and no "Delete episodes, keep the show" exists yet. This is the only R item left.
- **Pass R3 (Score the matcher) — DONE.** `src/lib/matcher-eval.server.ts`, the `scoreMatcher` server function, and the "Score the matcher" admin card are all in place and were exercised live. Shipped 2026-08-23.
- **Pass T4 (Matcher accuracy) — DONE.** Verified in `src/lib/providers/matching.server.ts` right now: coverage scoring, `&`/prefix/stopword normalisation, `shortTitle` cap for titles ≤4 chars, `commonWord` corroboration, non-film keyword suppression, promo-scoped description signal, and all signals persisted on links. My earlier header omitted it, but the work was there — that was a reporting miss, not a build miss. Shipped 2026-08-23.

**What "measurable with Pass R3" means for Pass W:** R3 replays the current scoring rules over your own approve/confirm/reject decisions and reports precision per confidence band. So before touching sequel logic you run "Score the matcher" and save the numbers; after the Pass W changes you run it again on the same labels. If franchise disambiguation works, precision in the 25–60 bands rises without recall dropping. R3 is fully implemented, so that baseline is available today — no dependency work needed.

## File reorganisation

1. Rename `.lovable/plan/movie-afterparty-consolidated-roadmap-passes-a-r-2026-08-20.md` to `.lovable/plan/current-consolidated-roadmap.md` (no date in the name, since it is a living document).
2. Create `.lovable/plan/archive/` and move every superseded plan into it:
   - `getting-real-data-in-sign-in-become-admin-run-ingestion-2026-08-17.md`
   - `match-review-hardening-matcher-accuracy-passes-t1-t6-u-v-2026-08-22.md`
   - `movie-afterparty-mvp-plan-2026-08-14.md`
   - `movie-afterparty-staged-build-plan-passes-a-n-2026-08-19.md`
   - `movie-afterparty-ui-overhaul-cinema-neon-theme-2026-08-16.md`
   - `pass-q-match-review-consolidated-2026-08-20.md`
   - `plan-update-pass-b2-pass-s-and-roadmap-revisions-2026-08-21.md`
   - `readability-controls-and-getting-to-real-data-2026-08-16.md`
   - `pass-r-shrink-working-set-2026-08-20.md` — stays out of the archive only if you want its R2 detail handy; the plan is to archive it and inline the R2 detail into the roadmap so one file is enough.
   After the move, `.lovable/plan/` contains exactly one file at the top level: `current-consolidated-roadmap.md`.
3. Add a short header to the roadmap stating that this is the only active plan file and everything in `archive/` is historical.

## Roadmap content changes

- Add a "Shipped" date-time stamp convention: each entry in the done section ends with `— shipped YYYY-MM-DD`. Backfill the dates already known (R1 2026-08-21, R3 2026-08-23, T4 2026-08-23, C2 2026-08-21, K 2026-08-21, C/T2 remnants 2026-08-23).
- Move Pass T4 and Pass R3 out of the "Do next" block into "Already done" with their dates, leaving **R2 as the only remaining R item** at the top.
- Under Pass W, replace the one-line "Measurable with Pass R3" note with the explicit baseline/after procedure described above, and mark W as ready to start (no blockers).
- Update the internal cross-reference to `pass-r-shrink-working-set-2026-08-20.md` so it points at the archive path.

## Standing rule going forward

Every time a pass ships, I move its entry into the done section of `current-consolidated-roadmap.md` and append the shipped date in the same edit — not as a later cleanup. Saved to project memory so it applies in future sessions.

## Technical notes

Renames and moves use `mv`; no source code is touched by this pass. Pass R2 itself is not built here — it stays queued as Priority 1.
