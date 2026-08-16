# Readability, controls, and getting to real data

## Answers first

**Is this real data yet?** No. The catalogue is still the hand-seeded demo set: 40 movies, 37 podcasts, 111 episodes, 62 streaming-availability rows. Zero movies have a poster URL, zero podcasts have cover art, and zero movies have a TMDB id — that is exactly why every card falls back to the letter tile. The ingestion layer (TMDB + Podcast Index providers, matching, admin screen) is built but has never been run, so nothing has been backfilled.

**Why does searching "blank check" on the Movies tab return nothing?** That search only matches movie titles. "Blank Check" is a podcast (it exists in the catalogue as a show), so it can never appear there. Search needs to look across podcasts too, or the expectation needs to be that shows are found on the Shows tab.

**What is needed before you can really use the app?** One run of ingestion, in this order: sign in at `/auth`, bootstrap yourself as admin, then run TMDB metadata + posters + watch providers, then Podcast Index episode pull and episode-to-movie matching. After that, posters and cover art appear everywhere with no UI change, and availability reflects real Netflix / Prime / Disney+ data instead of seeded guesses.

## Part 1 — Typography

Switch to Outfit (headings) + Hind (body), loaded via `<link>` in the root route and wired into the `--font-heading` / `--font-body` tokens. Hind at body sizes is a plain, high-legibility sans, which fixes the current cramped Space Grotesk reading feel. Also bump body text from 11–12px to 12–13px where it is currently smallest (card metadata rows) so the new font actually pays off.

## Part 2 — Tonight controls slimming

- Replace the two stacked year sliders with a single dual-handle range track: one label reading `1985–2009`, one compact control.
- Runtime and era sit on one row as two small inline controls rather than two full-width blocks; both shrink in height (thinner track, smaller labels).
- Net effect: the parameters card loses roughly a third of its height, keeping results above the fold.

## Part 3 — Streaming service buttons on Settings

Shrink the service pickers to compact logo chips: icon plus short name in a single small pill, wrapped in a dense row, selected state = tinted background and accent border. No large cards or oversized touch blocks.

## Part 4 — Shows list follow control

- **Visual:** drop the circular bordered button and the solid fill. It becomes a bare heart icon — outline when not followed, solid accent heart when followed — with an invisible padded tap area so it stays easy to hit on mobile.
- **Behavior:** following no longer re-sorts the list mid-interaction. The order is snapshotted when the list renders; the card stays exactly where it is, flips to the followed state, and re-ranking only applies on the next load or filter change. Nothing appears to vanish under your finger.

## Part 5 — Search that finds shows

On the Movies tab, when a query matches no movies but does match podcast names, show a small "Shows matching 'blank check'" result group linking to the show pages, so a search like that stops being a dead end.

## Technical notes

- Fonts: root-route `links` entries for Outfit + Hind; update `--font-heading`, `--font-body` in `src/styles.css`. No remote `@import` in CSS.
- Era control: single dual-thumb slider component in `src/components/FilterBar.tsx`, still writing `yearMin`/`yearMax` through `prefsActions.setFilters`, clamped so the handles cannot cross.
- Follow stability: the podcasts list keeps a render-time ordered id array and sorts against it, so `togglePreferredPodcast` no longer reorders in place.
- All changes are presentation-layer only, except Part 5 which adds a client-side podcast name match on the existing already-loaded catalogue.
- Ingestion is intentionally not part of this pass — it is a separate run once you are signed in, and I can walk it with you right after.
