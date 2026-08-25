# Roadmap update — Passes D, O, T5, G, H, Y (backlog only)

Approving this files these specs into `.lovable/plan/current-consolidated-roadmap.md` with the revised estimates and priorities below. Nothing is built now.

---

## Pass D — Header/title consistency + info sheet + home-screen icon — ~35k — Priority 4

- Adopt the Tonight header template (icon + small-caps eyebrow, then title) on Movies, Shows, Lists and Setup, using identical font sizes/spacing so all five pages read as one family.
- Popcorn icon to the left of the "Movie Afterparty" wordmark in both the desktop header and the mobile strip in `AppShell`.
- Info icon opens a real explanation sheet: what the app is, how Commentary Score is computed, what Match score means and what the confidence bands imply. The per-page description paragraphs move into that sheet to reclaim vertical space on mobile.
- Tagline options to choose from at build time (no em-dash): (1) "What to watch, and what to play after." (2) "Pick a movie. Get the afterparty." (3) "Tonight's movie plus its best commentary episode."
- iPhone home-screen icon: add a 180x180 PNG plus `apple-touch-icon` link and a web app manifest (name, short_name, theme/background colour, standalone display, 192/512 icons) in the root route head. Without `apple-touch-icon` iOS falls back to a page screenshot. "Add to Home Screen" in Safari stays the correct route; anything else is just a bookmark.
- Touch targets on the Tonight parameters: 44px minimum invisible hit padding around each `YearRange` handle and the runtime slider handle, a slightly larger visible handle and a wider track.

## Pass O — Watchlist controls: layering and instant feedback — ~20k — Priority 5 (build after Pass S1's optimistic work)

- Add-to-list popover currently overlaps the card below it: move it to a portalled, edge-aware placement with a correct stacking context so it never sits under or across a neighbouring card, and so it flips upward near the bottom of the viewport and above the fixed bottom nav.
- Checkmark feedback on Tonight, Movies and movie detail becomes optimistic: the control flips state on tap and reconciles after the write, with an undo snackbar (`sonner`) on add/remove.
- Same treatment for the watched/eye control so all card-level toggles behave identically.

## Pass T5 — Show list search / filter / sort — ~15k — Priority 5b

Episode coverage & show curation gains: name search, Active / Parked / Behind-feed filters (search + A-Z + missing-count sort already exist, so this completes the set), and sort by stored episode count, unmatched count, and missing-vs-feed. Deferred: sort by external rating, which depends on Pass M landing a per-show ratings cache (recorded as a dependency in Pass M).

## Pass G — App settings block — ~15k — Priority 10

- New "App settings" block on Setup: viewport lock (default on) and a dim-watched/listened-items toggle.
- Accessibility opt-out that re-enables pinch zoom, remembered in `prefs`.

### On "professional apps ship zoom enabled" — the honest version

What standard apps actually do, and why your experience differs:

- Native iOS/Android apps have no pinch-to-zoom at all unless a screen opts in. So "professional app" behaviour you're comparing against is usually native, where the gesture simply doesn't exist.
- Real websites and web apps keep zoom enabled (WCAG 1.4.4 requires up to 200% scaling; iOS Safari ignores `user-scalable=no` anyway) but avoid accidental zoom by construction: no horizontal overflow, 16px+ input font sizes to stop iOS's focus auto-zoom, `touch-action` set on interactive/scrolling regions so a two-finger or fast drag doesn't become a page gesture, and no nested scroll containers competing with the page scroll.
- The accidental zoom/pan you hit in Lovable-style apps is usually one of: an element wider than the viewport creating pannable overflow, inputs under 16px triggering auto-zoom on focus, or a scroll container without `overscroll-behavior`/`touch-action`, which makes drags leak into browser gestures.

So the plan is two-part: fix the causes (overflow audit, 16px inputs, `touch-action`/`overscroll-behavior` on scrollers) and still give you the lock as an explicit setting, since this is a personal tool and iOS Safari will honour a locked scale only inside an installed home-screen app. That combination is what makes the lock actually effective rather than cosmetic.

## Pass H — Movies and Shows discovery controls (absorbs Pass Y) — ~55k — Priority 7

Extends the existing compact `FilterBar` rather than replacing it.

- Filter/sort panel behind a single button, rendered as a bottom sheet on mobile and a popover on desktop.
- Sort: episode count, runtime, year, title, availability.
- Filter: genre, runtime band, streaming service, watched/unwatched, hide "Not interested".
- New "Not interested" action on movie cards and on Tonight, stored in `prefs`, excluded from Tonight and optionally hidden in Movies.
- Same panel shape reused on Shows for episode count / missing count / A-Z.
- Includes the Pass Y rating filters below so the sheet is built once.

### Pass Y (inside Pass H) — MPA / TV content-rating filters — ~25k of the 55k

- Data: `/movie/{id}/release_dates` for the US `certification`, `/tv/{id}/content_ratings` for TV ratings (used by Pass V). Folded into the existing enrichment call path, no new provider.
- Migration: `certification text` + `certification_system text` on `movies`, plus a "Backfill content ratings" admin action that is chunked and resumable, same shape as availability sync (staleness-first queue, per-run progress reporting).
- Normalised ladder so movie and TV ratings sort together: TV-Y < TV-Y7 < G/TV-G < PG/TV-PG < PG-13/TV-14 < R/TV-MA < NC-17. Unrated is explicit: its own opt-in toggle, never silently included or excluded, with a small "NR" marker on cards.
- Filters: max-rating chip row in the Movies filter sheet, same allowance applied to Tonight, stored in `prefs` beside services and year range.

---

## Resulting priority order in the roadmap

1. Pass R2 (unchanged, Priority 1)
2. Pass D — ~35k
3. Pass O — ~20k (after Pass S1)
4. Pass T5 — ~15k
5. Pass E, F (unchanged)
6. Pass H including Pass Y — ~55k
7. Pass Z, I, J (unchanged)
8. Pass G — ~15k, stays in the wider-audience backlog
9. Pass L, M, N, P, V (unchanged); Pass M gains the T5 ratings-sort dependency note

Pass Y's standalone entry is removed and its content lives inside Pass H.
