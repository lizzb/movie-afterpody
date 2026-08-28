# Pass H8 build + roadmap rename + new backlog filings

## 1. Build: Pass H8 — Holiday exclusion (crude first pass)

- Add an `excludeHoliday` filter flag to the stored filter prefs (`src/lib/prefs.ts`), defaulting by date: on from Jan 8 – Nov 2, off from Nov 3 – Jan 7 (evaluated at first load, stored thereafter so the user's choice sticks).
- Add the keyword rule to `applyFilters` in `src/lib/discovery.ts`: drop a movie when its title or synopsis contains a standalone `Santa` or `Christmas` (word-boundary match, case-insensitive, so "Santana"/"Christmastown"-style false hits are avoided).
- Add the control as a toggle inside the expanded Filters & Sort panel in `src/components/FilterBar.tsx`, writing to the draft filter object like the other toggles so it only commits on **Apply filters**. Label: "Exclude holiday movies", with short helper copy noting it is a keyword rule.
- Applies to both Tonight and the Movies variant of the panel.
- Verify at 390px: toggling on then applying reduces the result count and no console errors; toggling off restores it.

## 2. Rename the roadmap file

Move `.lovable/plan/current-consolidated-roadmap.md` to `.lovable/roadmap.md`, and update the memory rule that names the active roadmap path so future sessions look in the right place.

## 3. Backlog only — desktop trackpad scrolling regression

- **Pass G6 — Restore normal desktop scrolling — S (~1-2 credits).** Suspected cause is the Pass G2 layout lock: the non-passive `touchmove`/`gesture*` handlers and the `.layout-locked` rules on `<html>`/`<body>` are applied on every viewport, including desktop. Cause is unconfirmed — step one is to reproduce a trackpad scroll on desktop and confirm which of `overscroll-behavior: none`, `touch-action: pan-y`, or the gesture handlers is swallowing wheel/pinch events. Likely fix: scope the lock to touch-primary/narrow viewports only (pointer: coarse / below the `md` breakpoint), never bind gesture handlers on desktop, and leave `touch-action` untouched where a pointing device is present. Acceptance: two-finger trackpad scroll and pinch zoom behave normally on desktop while the mobile lock still blocks sideways drag.

## 4. Backlog only — matcher improvement passes

Each filed as its own pass so they can be built independently.

- **Pass X1 — Review-state model — M (~3-5 credits).** Explicit per-episode completeness state and per-link review state (unreviewed / reviewed-correct / reviewed-wrong / resolved-not-a-movie), replacing the current inference from link presence. Foundation for the rest; supersedes the informal notes in `.lovable/notes/episode-match-rejection-flow.md`.
- **Pass X2 — Multi-movie episode editor — M (~3-5 credits).** Edit several movies per episode with primary-subject vs mentioned-in-passing roles; handles double features, trilogies and franchise retrospectives. Depends on X1.
- **Pass X3 — Curated blocklist / allowlist — S (~1-2 credits).** Admin-maintained lists of high-noise titles and ad/promo phrases the extractor must skip or always trust, replacing hardcoded keyword rules in the matcher.
- **Pass X4 — Per-podcast matcher tuning — M (~3-5 credits).** Per-show matcher profile (clean "Title (Year)" formats vs joke/chatter titles) that adjusts extraction strictness and confidence thresholds per podcast.
- **Pass X5 — Training / evaluation dashboard — L (~6-10 credits).** Turns scorecard output into concrete recommended rule/weight changes with before/after precision and recall, so rule edits are measured rather than guessed. Depends on X1 for clean labels.
- **Pass X6 — Guarded low-confidence cleanup and rerun — M (~3-5 credits).** Maintenance action that previews (dry-run) which low-confidence auto links would be cleared, then reruns the current engine over them; never touches manual, confirmed or rejected pairs, and reports a diff.

## Technical notes

- H8 keeps everything in existing files: `prefs.ts` (flag + date-based default), `discovery.ts` (keyword filter inside `applyFilters`), `FilterBar.tsx` (draft toggle). No schema change, no server work.
- The date-based default is computed client-side from the local date; it only chooses the initial value, so an explicit user choice is never overwritten.
- G6 and the X-series are filed to the roadmap only; nothing in them is implemented in this pass.
