# Match review tab counts as circular badges

Show a count on all three Match review tabs — Flagged, Proposed, Existing links — rendered as a small circle badge instead of the current parenthetical text.

## Behaviour

- Each tab shows the unfiltered queue size for that tab (the total ignoring the current search box), so the number stays stable while you type a filter. The "Showing X of Y" line below continues to report the filtered subset.
- Badge is hidden when the count is zero, so an empty queue reads clean.
- While a tab's query is still loading, the badge shows the last known number rather than flickering to zero.
- Styling: circular pill using existing tokens — on the active tab it sits on the primary background with primary-foreground text; on inactive tabs it uses muted/secondary. No new colors, no hardcoded hex.

## Technical notes

- `src/components/admin/MatchReviewCard.tsx`: replace the Flagged-only `(N)` suffix in the tab loop with a shared `<span>` badge; the tab list becomes `[value, label, count]` and the counts come from the three existing queries.
- Flagged already returns `unfilteredTotal` from `listFlaggedLinks`; add the same field to `suggestEpisodeMatches` and `listEpisodeLinks` in `src/lib/ingestion.functions.ts` — the count of rows matching the current band/podcast/parked filters but before the search term is applied. When no search term is active it equals `total`.
