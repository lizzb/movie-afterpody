# Movie Afterparty — UI overhaul + Cinema Neon theme

## Answer first: signing in

There is no sign-in screen in the app today — that's why you can't find one. Every
feature you use now (services, filters, lists, watched history, ratings) is stored
locally in your browser, so nothing needs an account. The only gated surface is the
ingestion admin page. This pass adds a minimal `/auth` screen (Google + email) purely
so you can reach that page, plus a sign-in/account item in the nav. Cloud sync of
lists and history stays a later pass.

## 1. Visual system: Cinema Neon (light + dark)

Replace the beige palette with a soft blue-gray slate system. Poster and cover art
supply the color; the UI stays quiet.

- Dark: base `#161c26`, raised surface `#212a38`, text `#e8edf5`, accent electric cyan
  `#4cc9f0`. Glow is used sparingly — only active nav tab, selected chips, primary CTA.
- Light: cool off-white canvas with the same cyan accent, no glow, hairline borders.
- Secondary accents (used for scores/badges only): warm amber and magenta, kept low
  saturation so posters dominate.
- A theme toggle (system / light / dark) in the header-less top row and in Setup,
  persisted with the other local prefs. Dark is default.
- All values as `oklch` tokens in `src/styles.css` with `.dark` overrides; no hardcoded
  colors in components.

## 2. Chrome: kill the redundant top bar

- Remove the sticky title header on mobile. The page's own H1 carries identity.
- Bottom nav becomes the only chrome on mobile and gets a real selected state: filled
  icon, accent label, and a soft accent pill/glow behind the active item.
- Desktop keeps a single slim top bar (brand + tabs + theme toggle + account) and drops
  the bottom nav.
- Detail pages get a compact back row instead of the global header.

## 3. Tonight page: get results above the fold

- Collapse the hero to one line of eyebrow text plus a tighter two-line H1; the long
  intro paragraph moves into an info tooltip on "Commentary Score".
- Runtime and era become one compact two-up row: runtime as a small slider with inline
  value, era as a single dual-value row (`1985 – 2004`) rather than two boxed inputs.
- Genres/vibes collapse to a summary chip (`Comedy, Romance +2`) that opens a bottom
  sheet with a search field and grouped sections (Genres / Eras / Vibes), so the vibe
  vocabulary can grow without cluttering the page.
- Toggles (only what I can stream, has commentary, my podcasts only, unwatched only)
  become a single compact wrapped row under the summary.
- Net effect: the first result card is visible without scrolling on a 400x850 viewport.

## 4. Brand badges

- New `ServiceBadge` and `PodcastAppBadge` components backed by a bundled set of
  monochrome inline SVG glyphs (Netflix, Prime Video, Disney+, Max, Hulu, Apple TV+,
  Paramount+, Peacock, Shudder, Tubi; Spotify, Apple Podcasts, Overcast, Pocket Casts,
  YouTube).
- Rendered as self-contained pill badges: glyph + optional short label, monochrome by
  default, accent-tinted when it's one of your services. No plain-text service names
  anywhere.
- Unknown services fall back to an initial-glyph badge.

## 5. Tile / list view toggle on every results page

- Shared `ViewToggle` (rows / tiles) with the choice persisted per page in prefs.
- Rows: poster or cover thumbnail on the left, title + meta + badges on the right.
- Tiles: 2-up on mobile / 3-4-up on desktop, poster-forward with the score badge
  overlaid on the artwork corner and title beneath.
- Applies to Tonight, Movies, Shows, and list detail views.
- Movies always identified by poster art, podcasts by cover art, with a typographic
  accent placeholder when artwork is missing.

## 6. Movie detail page layout

```text
┌──────────────────────────────────────────────┐
│ [poster]   Title (Year)        [Commentary 92]│
│            97m · IMDb 7.3 · RT 71%            │
├──────────────────────────────────────────────┤
│ Short synopsis, full width                    │
├──────────────────────────────────────────────┤
│ [Netflix][Disney+]      [✓ Watched][🔖 List]  │
├──────────────────────────────────────────────┤
│ Podcast Episodes (3)                          │
│ [cover] Show · Episode title · date · length  │
└──────────────────────────────────────────────┘
```

- Poster floats left; runtime, year, IMDb star, Rotten Tomatoes sit right; the app's own
  Commentary Score is visually distinct (accent-filled, labelled) in the upper-right so
  it reads as ours, not a third-party number.
- Mark Watched / Watched toggle plus Add to List float right of the service badges.
- Watched control gets a small chevron affordance that opens a lightweight sheet stub
  for future tags/notes ("so bad it's good", "good girls night") — the stub is one line
  of copy plus a disabled tag input, occupying no space until opened.
- Episode rows use podcast cover art and the badge components for listen links.

Note: IMDb and Rotten Tomatoes values are not in the database today. This pass renders
those slots from optional fields and hides them when absent; populating them is part of
the ingestion pass below.

## 7. Podcast detail page

- Mirror the movie header: cover art left, meta right (episode count, match score,
  rating), description full width.
- Add a "Listen on" badge row using the podcast-app badges, mirroring the movie page's
  streaming row.
- Covered movies keep the "Watchable tonight" / "Also covered" split, now with poster
  thumbnails and the row/tile toggle.

## 8. Next incremental passes after this one

1. **Ratings & tags system** (~45k) — the tag/notes vocabulary behind Mark Watched, per
   movie and per episode, feeding the Commentary Score.
2. **Real ingestion at scale + ratings data** (~70k) — run TMDB/Podcast Index ingestion
   across the seeded catalog, pull posters, cover art, IMDb/RT numbers, and real
   provider availability.
3. **Cloud sync of user data** (~50k) — move lists, watched history, prefs and ratings
   into your account with RLS, with a one-time local-to-cloud migration.
4. **Episode playback + queue** (~40k) — "play after" queue, deep links, progress.

## Technical notes

- `src/styles.css`: new token set plus `.dark` block; theme stored in prefs and applied
  via a class on `<html>` from a small client-side theme provider.
- New components: `ServiceBadge`, `PodcastAppBadge`, `Artwork` (poster/cover with
  fallback), `ViewToggle`, `FilterSheet`, `ScorePill`, `MetaRow`.
- `src/lib/prefs.ts` gains `theme` and `viewMode` fields (versioned merge keeps existing
  stored prefs valid).
- `FilterPanel` splits into a compact `FilterBar` plus the sheet; filter state and
  `applyFilters` logic in `src/lib/discovery.ts` are unchanged.
- `AppShell` becomes responsive-aware: bottom nav only under `md`, slim top bar at `md+`.
- `/auth` route: Google via the Lovable broker plus email/password, redirecting back to
  the intended path; `/admin/ingest` links from Setup as it does now.
- No schema changes required for the layout work; optional `imdb_rating` /
  `rt_score` columns get added when the ingestion pass populates them.
