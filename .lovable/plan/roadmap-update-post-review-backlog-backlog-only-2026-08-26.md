# Roadmap update — post-review backlog (backlog only)

A/B/C/D/E/F/G/H/I from the last review are confirmed at base level, so the open "Repair pass" entry closes and stamps as shipped 2026-08-25. Everything below becomes discrete, individually stampable passes with new IDs. Nothing here gets implemented on approval — this is a roadmap edit only.

Design-first items are marked NEEDS DESIGN: those passes start with 2-4 visual/copy options presented for selection, and no code lands before a direction is picked.

---

## Group 1 — Tonight as a recommendation surface

**Pass H2 — Tonight result volume and shape — ~25k — NEEDS DESIGN**
The Tonight page should behave like a recommendation surface, not another catalogue page. Tonight stops behaving like a catalogue. Top 10 by default, "Load more suggestions" below the list, count reads `Showing 10 of 121 matches`. Movies stays the catalogue surface. Design pass on the simplified result list before build.

**Pass H3 — Surface sorting on Tonight — ~15k — NEEDS DESIGN**
Sort moves out of the expanded panel. Options to present: (1) sort chip row above results, (2) single sort button beside the result count, (3) mode segmented control (Best match / Short / New / Most covered), (4) right-aligned results-toolbar dropdown.

**Pass H4 — Best-only / minimum Commentary Score — ~12k**
No hard default minimum until score distribution is measured; ship as a "Best only" toggle with a visible match count, then decide whether a numeric threshold slider is warranted.

## Group 2 — Movies gets its own filter surface

**Pass H5 — Separate Movies filters from Tonight — ~35k — NEEDS DESIGN**
Today both pages share one `FilterBar` and one global filter preference object, so a Tonight change silently re-filters Movies (Tonight only adds its always-hide-not-interested rule). Split into per-surface filter state with a Movies-specific search/filter layout that stays visually consistent with Tonight and keeps equivalent capability. Design the Movies layout before building.

## Group 3 — Ratings and audience controls

**Pass Y2 — Rating minimum + maximum range — ~25k — NEEDS DESIGN**
Ratings currently expose only an upper bound. Options to present: (1) dual-handle rating ladder TV-Y → NC-17 with highlighted allowed band, (2) segmented rating band with the allowed steps filled, (3) two compact Minimum / Maximum chip pickers.

**Pass Y3 — Audience-focus tuning — ~15k**
Investigate kids/family-heavy suggestions using ratings plus genre signals. Likely mostly resolved by Y2; scope confirmed only after Y2 ships.

## Group 4 — Sliders and touch feel

**Pass D2 — Slider treatment and touch responsiveness — ~25k — NEEDS DESIGN**
Handles still do not feel grabbable on mobile and dragging feels slow and jerky. Options to present: (1) thick rail, floating handles (wider fill, 32px visible handle, 48px hit area), (2) inset rail with high-contrast grab knobs and larger touch rings, (3) stepper-assisted slider with minus/plus for precision, (4) compact numeric value chips beside labels plus a larger grab zone. Build includes fixing drag responsiveness, not just visuals.

## Group 5 — Not interested and iconography

**Pass H6 — Not interested copy, icons and recovery — ~20k — NEEDS DESIGN**
Clearer copy, softer snackbar language, and icon options presented for both "Unwatched" and "Not interested" before any metaphor changes.

**Pass H7 — Hidden / Not interested management screen — ~20k**
A dedicated review-and-restore list for hidden titles, since the action currently feels permanent. Depends on H6 for final copy and icons.

## Group 6 — Lists, watched state and sync

**Pass O2 — Watchlist interaction reliability — ~25k**
Debug in-browser: laggy/finicky add-to-list, unreliable list creation from movie cards, and status not refreshing after an action. Acceptance is a recorded browser run of add, create-from-card, and remove on both Movies and movie detail.

**Pass O3 — Account-synced lists and history — ~55k**
Migrate local-first list/watch/not-interested state to signed-in backend tables with RLS, one-time local→account migration on first sign-in, and a documented fallback for signed-out use.

## Group 7 — Consistency and copy

**Pass E2 — Commentary Score formatting consistency — ~12k**
One score component everywhere. Tonight shows icon + label + accent badge; Lists shows a bare shaded numeric badge. Pick one canonical treatment (with an explicit compact variant) and apply it to every surface.

**Pass E3 — Commentary Score explanation copy — ~8k — NEEDS COPY**
Rewrite the "same inputs always give the same score" text so it distinguishes deterministic scoring from user preference changes that intentionally change the inputs.

**Pass D3 — Per-page info sheets — ~20k — NEEDS COPY**
The info icon opens the same sheet on every screen. Give each surface its own content (Tonight, Movies, Shows, Lists, Setup), with shared sections factored out.

## Group 8 — Seasonal

**Pass H8 — Holiday exclusion (crude first pass) — ~15k**
Exclude titles with standalone `Santa` or `Christmas` in title or description. Control lives in the expanded Filters & Sort panel. Default checked (exclude) Jan 8 – Nov 2; default unchecked Nov 3 – Jan 7.

**Pass H9 — Full seasonal include/exclude UX — ~35k**
Robust seasonal tagging and opt-in/opt-out beyond the single keyword rule. Follows H8.

## Group 9 — Setup and stability of ordering

**Pass G3 — Setup: stop rows re-sorting on toggle — ~12k**
Following/preferred toggles must not move a podcast row until the next page load; matches the existing "lists must not re-sort mid-interaction" rule and makes the action easy to undo.

**Pass G4 — Saveable Tonight defaults in Setup — ~20k**
User saves preferred default Tonight parameters; Reset restores those instead of app defaults.

## Group 10 — Admin and podcast pages

**Pass T6 — Show curation sort direction toggle — ~10k**
Ascending/descending toggle on every sort property in "Episode coverage and show curation".

**Pass T7 — Sort shows by highest external rating — ~10k — blocked on Pass M**
Unblocks only once Pass M lands a per-show ratings cache.

**Pass J3 — Podcast page episode sort and filter — ~25k**
Document the current default order, then add newest/oldest, matched/unmatched, duration, and title search controls.

## Already in the roadmap, unchanged

**Pass G2 — Truly lock the layout — ~15k** — already filed 2026-08-26, left as-is.

---

## Technical notes

- Roadmap file edited: `.lovable/plan/current-consolidated-roadmap.md`. The "Repair pass" entry moves to "Already done" with a shipped stamp and its backlog-only sentence is replaced by pointers to the new pass IDs.
- ID scheme: extensions of a partially-shipped pass keep the letter (`D2`, `H5`, `O2`, `Y2`, `T6`, `E2`, `G3`, `J3`); no existing IDs are reused.
- Priority slotting: Group 1, 2, 4 and 6 (O2) ahead of the current Priority 5 items; sync (O3), seasonal (H9) and audience (Y3) sit in the lower backlog.
- Total added estimate: ~460k across 19 passes.
