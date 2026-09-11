# Pass U45 — Podcast coverage as a Movies filter

Created: 2026-09-11
Mode: PLAN/ACCEPT. Acceptance criteria included. No code changes until BUILD is authorized.
Estimate: M (~3–5 credits)

## Goal

Let the Movies surface answer questions like: "movies ≤85 min, on Netflix, covered by How Did This Get Made?, and covered by at least one other show." Podcast coverage becomes another dimension inside the existing filter panel — not a second search system.

## What the user gets

In Advanced Filters, a new **Podcast coverage** group:

- A small searchable show picker; chosen shows appear as removable chips (reuses the existing chip look).
- A toggle for how multiple chosen shows combine: **Any of these** (default) / **All of these**.
- A checkbox: **Also covered by at least one other show** (only enabled once at least one show is chosen).
- The existing "Has commentary" and "My podcasts" chips stay exactly as they are; the new group refines them rather than replacing them.

Coverage criteria combine with runtime, year, services, rating, genre and sort the same way today's filters do, on both Movies and Tonight, and are applied on the existing Apply-filters press.

## Technical approach

- `Filters` (src/lib/prefs.ts) gains three fields with wide-open defaults, added to `NO_FILTERS` and the Tonight defaults: `coveredByPodcastSlugs: string[]`, `coverageMode: "any" | "all"`, `plusOtherPodcast: boolean`. Existing stored prefs are migrated by the usual default-merge so old localStorage state stays valid.
- Filtering happens once, in `applyFilters` (src/lib/entries.ts), beside `commentaryOnly`/`preferredOnly`. `MovieEntry.episodes` already carries each episode's podcast, so the distinct-show set per movie is derived in memory with no new query: selected-set match for any/all, plus a check that the movie has ≥1 distinct show outside the selected set for `plusOtherPodcast`.
- Because `applyFilters` runs inside `rankMovies` on the server, Movies and Tonight both get the filter with no per-surface logic and no change to bounded loading, page sizes, totals, or the L2b contract.
- The show list for the picker comes from the existing facets/show-page data already fetched for the filter panel; no new server function.
- Filter state remains per-surface (`filters` vs `movieFilters`), so Tonight and Movies cannot conflict.

## Acceptance criteria

Verified in the running app at mobile and desktop widths.

1. Choosing one show narrows Movies to only titles that show covers; the result count is truthful against the show's covered-movie count.
2. Two shows with **Any of these** returns the union; **All of these** returns only movies both shows cover.
3. **Also covered by at least one other show** removes movies whose only coverage is the selected show(s), and is unavailable when no show is selected.
4. Coverage combines correctly with runtime, service, year, rating and genre filters — the roadmap's example query (≤85 min, Netflix, HDTGM, ≥1 other show) returns a plausible, verifiable list.
5. Clearing the coverage selection restores the previous unfiltered result count exactly.
6. Sorting, "Show more", totals and Tonight behaviour are unchanged when coverage is unset.
7. No new server function, no new full-table read, and no measurable regression in Movies warm load.
8. Existing saved preferences load without error after the new fields are added.

Anything not verified in-app is reported as IMPLEMENTED, NOT VERIFIED rather than shipped.

## Out of scope

Coverage facet counts next to each show name, saved filter presets, coverage filters on the Shows surface, episode-rating or listening-status criteria, and any change to matcher or review behaviour.
