# Apply-filters button, roadmap credit bands, two backlog passes

## 1. Build now — "Apply filters" button (Tonight + Movies)

Filter changes currently write straight into global prefs, so every slider tick re-derives and re-renders the whole result list — which is why the sliders feel smooth before movies load and jerky afterwards.

Change: the filter panel edits a local draft, and nothing reaches the live results until you press **Apply filters**.

- `FilterBar` holds a local draft copy of the filter values, seeded from the saved filters.
- Every control inside the bar (runtime slider, era range, sort, rating steps, service/genre chips, toggles) updates the draft only.
- A sticky action row at the bottom of the panel: **Apply filters** (primary, shows the pending-change count) and **Cancel** (discards the draft). Reset still resets to app defaults, into the draft.
- Applying commits the draft with one `setFilters` call, so results re-rank once.
- While a draft differs from what's applied, the Filters button carries a small "unapplied changes" marker so it's obvious the list is stale.
- Result count above the list keeps describing the *applied* filters, not the draft.
- Works identically on Tonight and the Movies variant of the bar; the Movies text search stays live (it is not part of the filter object).

Verified at 390px and desktop: dragging both sliders end to end stays smooth with movies on screen, and the list only changes on Apply.

## 2. Build now — relabel roadmap estimates as credit bands

Replace every `~NNk` token estimate in `.lovable/plan/current-consolidated-roadmap.md` with a credit band, keeping priorities and text otherwise unchanged:

- **S ≈ 1-2 credits** (≤15k)
- **M ≈ 3-5 credits** (20-35k)
- **L ≈ 6-10 credits** (40-60k)
- **XL ≈ 10+ credits** (70k+)

A short legend goes at the top of the roadmap explaining the bands are build-cost ballparks that grow with verification loops and debugging, not fixed prices.

## 3. Backlog only — Pass D4: make live filtering fast enough that Apply isn't needed

Root cause is unconfirmed; step one is measurement, not a rewrite.

- Profile a slider drag on Tonight with movies rendered and record where the time goes (derive step in `useDiscovery`/`buildEntries`, `applyFilters` sort, or card re-render count).
- Likely candidates to address once measured: `buildEntries` re-running on every prefs write; the per-movie `catalog.*.filter(...)` scans being O(movies x rows); the full list re-rendering instead of the visible page; slider writes not being deferred.
- Expected fixes: index catalog rows once into maps, memoise entries independent of filter values, keep slider drags in local state and commit on release, memoise `MovieCard`, and cap rendered rows.
- Acceptance: sustained 60fps-feeling drag at 390px with the full catalogue loaded; then the Apply button becomes optional (kept as a preference or removed).
- Band: M ≈ 3-5 credits.

## 4. Backlog only — fold "dim watched" into Pass O3 (account-synced state)

`dimWatched` lives in local device prefs today alongside lists, watches and not-interested. Add it to the Pass O3 scope so display preferences sync with the account rather than the device:

- Extend O3's user-settings sync to cover `dimWatched` (and leave room for other display prefs) with the same one-time local→account migration and signed-out fallback.
- No separate pass; O3's band moves from L to L-upper within the same range.

## Technical notes

- Files touched now: `src/components/FilterBar.tsx` (draft state + action row), small copy/marker tweaks where the Filters button renders, and `.lovable/plan/current-consolidated-roadmap.md` (bands + the two new backlog entries).
- No schema, backend or scoring changes in this build.
