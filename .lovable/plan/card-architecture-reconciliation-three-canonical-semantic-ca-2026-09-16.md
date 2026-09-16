# Card architecture reconciliation — three canonical semantic cards (Passes K7–K12)

Created: 2026-09-16
Mode: PLAN only. No code changes until you approve and say BUILD.

## What exists today (inspected)

Shared primitives from K2 are in `src/components/card/Card.tsx` (`CardShell`, `CardControls`, `CardHeader`, `CardBadges`, `CardBody`, `CardBodyRow`, `CardFooter`, `CardExpand`) plus `Artwork`, `ScorePill`, `BrandBadge`, `PlatformBadges`, `AddToListButton`, `ListenLaterButton`, `MarkListenedButton`, `FlagMatchButton`, `ConfirmMatchButton`, `EpisodeAdminActions`, `EpisodeReviewButton`, `EpisodeNotesFooter`, `ExpandableText`.

The gap is exactly the one you named: **six route-local card bodies** re-implement three semantic cards on top of those primitives.

| Semantic type | Canonical today                                                             | Route-local duplicates                                                                                                                     |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Movie         | `src/components/MovieCard.tsx` (`MovieRow` + `MovieTile`) — Tonight, Movies | `CoveredMovie`/`CoveredList` in `podcasts.$slug.tsx`; watchlist entry rows and watched-history rows in `lists.index.tsx`                   |
| Episode       | none                                                                        | `EpisodeRow` in `movies.$slug.tsx`; `PodcastEpisodeCard` in `podcasts.$slug.tsx`; Listen Later rows and Listened rows in `lists.index.tsx` |
| Show          | none                                                                        | `PodcastCard` in `podcasts.index.tsx` (single consumer, but not a shared component)                                                        |

U81 (one shared podcast-episode card) is a subset of the proposed K9/K10 work. Because K7–K12 were not authorized for implementation, U81 remains an open roadmap pass pending an explicit user decision about whether the proposed K9/K10 architecture should replace or incorporate it. K1–K6 primitives and Cinema Neon styling are preserved; nothing is redesigned.

## Target architecture

```text
src/components/card/
  Card.tsx            existing K2 primitives (unchanged API, small additions)
  MediaCardFrame.tsx  media / header / actions / metadata / body /
                      relationships / external / user-footer / admin slots
  MovieCard.tsx       variants: browse | compact | relationship  (+ tile density)
  EpisodeCard.tsx     variants: detail  | compact | relationship
  ShowCard.tsx        variants: browse  | compact               (+ tile density)
  parts/              RelationshipRow, StatusActions, ConsumedDate,
                      AvailabilityFooter, RatingFooter, AdminSlot
```

Rules this enforces: one semantic component per type; every surface imports it; `row`/`tile`/`compact`/`detail`/`relationship` are props, not files; the component always owns a feature's interaction and state semantics, and the variant decides only whether the control is visible, compact or progressively disclosed.

### Consumer map (final state)

| #   | Surface                                      | Component     | Variant                  | Density    |
| --- | -------------------------------------------- | ------------- | ------------------------ | ---------- |
| 1   | Tonight (`routes/index.tsx`)                 | `MovieCard`   | browse                   | row / tile |
| 2   | Movies (`routes/movies.index.tsx`)           | `MovieCard`   | browse                   | row / tile |
| 3   | Shows (`routes/podcasts.index.tsx`)          | `ShowCard`    | browse                   | row / tile |
| 4   | Show Details → Movies (`podcasts.$slug.tsx`) | `MovieCard`   | relationship             | row / tile |
| 5   | Watchlists (`lists.index.tsx`)               | `MovieCard`   | compact                  | row        |
| 6   | Listen Later                                 | `EpisodeCard` | compact                  | row        |
| 7   | Watched history                              | `MovieCard`   | compact + `consumedDate` | row        |
| 8   | Listened history                             | `EpisodeCard` | compact + `consumedDate` | row        |
| 9   | Movie Details → Episodes                     | `EpisodeCard` | detail                   | row        |
| 10  | Show Details → Episodes                      | `EpisodeCard` | detail (`media={false}`) | row        |

### Differences expressed as props/slots, not new components

- `variant`, `density` (`row` \| `tile`), `media` on/off.
- Data props all optional: `score`, `certification`, `runtime`, `genres`, `services`, `coverage`, `explanation`, `description`, `episodeLinks`, `movieLinks`, `consumedDate`, `episodeNumber`, `externalRating`.
- Capability props: `showBookmark`, `showConsumed`, `showNotInterested`, `showRatingFooter` (`hidden|compact|expandable`), `relationshipModeration`, `adminSlot`.
- `EpisodeCard` offers episode-level review/reopen **only when it is given the complete current context** — description plus the full current movie-link set — via one explicit `episodeContext="complete"` prop, so placement follows information completeness rather than which route renders it.

### Proposed new components and why they cannot be variants

- `MediaCardFrame` — a layout frame, not a semantic card; it exists so the three semantic cards share slot order and spacing. Not a variant of anything.
- `EpisodeCard`, `ShowCard` — no canonical component exists for these types yet.
- `parts/RelationshipRow`, `parts/StatusActions`, `parts/RatingFooter`, `parts/ConsumedDate`, `parts/AvailabilityFooter` — repeated internals used by more than one semantic card; they are primitives, not cards.
- No admin card is created. Match Review cards and admin curation rows stay where they are: different information priorities, deliberately outside the consumer card system.

## Passes

**K7 — `MediaCardFrame` + shared parts — S**
Frame plus the five `parts/`. No visible change; the Movies card is re-expressed through the frame as proof.

**K8 — Canonical `MovieCard` (browse + compact + relationship) — M**
Move `MovieCard.tsx` under `card/`, add variants and a view-model adapter. Migrate consumers 1, 2, 4, 5, 7. Deletes `CoveredMovie`/`CoveredList` and both `lists` movie row bodies. Watchlist/history compact cards gain the bookmark/consumed/not-interested controls they lack today; #4 gains episode-link relationship rows and the collapsed user-footer slot.

**K9 — Canonical `EpisodeCard` (detail variant) — M**
Build from the richer of the two existing bodies; migrate consumers 9 and 10 (10 with `media={false}`, date+number eyebrow, poster-art movie links). Absorbs U81's core and K5/K6 remaining row work.

**K10 — `EpisodeCard` compact variant — S/M**
Migrate 6 and 8; both gain listened + rating controls writing through `prefsActions`; Listen Later keeps its remove control as an upper-right action. Absorbs the rest of U81.

**K11 — Canonical `ShowCard` — S**
Extract `PodcastCard` into `card/ShowCard.tsx` with browse + compact variants and tile density; drop the 2-line description preview per spec.

**K12 — Structural acceptance report + roadmap reconciliation — S**
Grep-backed evidence that each semantic card has exactly one definition and every listed consumer imports it; one spacing change demonstrated across all ten surfaces at 390px and 1280px; roadmap reconciliation of U81 and cross-references to U83.

Order K7 → K8 → K9 → K10 → K11 → K12. Total effort band **L–XL (~10–16 credits)**; confidence Medium (the variant contract per surface is the real work, not the markup). Recommend approving K7+K8 first, then re-checking scope.

## Data/feature boundary

No new provider, table, ingestion or external feed. Fields not currently available get an **optional slot** and render nothing until data exists: user movie reactions (U83 — this pass only reserves the slot on compact Watchlist/history cards, it does not implement reactions), external movie ratings, podcast external rating (used where the existing metric is present), external listen count, podcast genres, episode number. A closing report will list every reserved-but-empty slot.

## Acceptance (per pass)

Labelled checklist — Verified / Implemented, not verified / Deferred / Needs follow-up — checked in the running app at 390px and 1280px, with no horizontal overflow and no regression to watched, not-interested, watchlist, Listen Later, listened, rating, confirm, flag, reviewed or not-about-a-movie actions.
