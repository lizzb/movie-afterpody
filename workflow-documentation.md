# Movie Afterparty admin workflow

## Data population flow

1. **Ingest podcast** stores the show and up to 1000 feed episodes.
2. **Build movies from episodes** reads unmatched active-show episodes, extracts likely movie titles from episode titles, looks them up in TMDB, creates/refreshes movie rows, and links the episode.
3. **Recheck every episode against existing movies** does not call TMDB. It only rescans active-show episodes against movies already in the catalogue, skips rejected pairs, preserves manual/confirmed links, replaces weak links only when a better match wins clearly, and can add strong secondary links.
4. **Enrich movies from TMDB** fills metadata, posters, backdrops, runtime, IMDb id, and collection id for existing movies.
5. **Streaming availability + genres** refreshes current provider data and genres. Availability is a snapshot, not a guarantee that a title will remain available.

## What the matcher learns today

- Every rejected pair is stored and never suggested again for that same episode/movie pair.
- Rejection counts by movie act as negative evidence, so repeatedly noisy movies lose confidence in future scoring.
- Confirmed/manual links are preserved during rescans.
- The scorecard replays the current matcher over approved/rejected labels and reports which signals correlate with good or bad matches.

## What it does not learn yet

- It does not train an AI model.
- It does not automatically rewrite scoring weights from the scorecard.
- It does not infer that an entire phrase like an ad campaign is invalid unless the title rules identify it as non-movie noise or an admin marks episodes as not about a movie.

## Practical review loop

1. Keep a small set of shows active; park the rest.
2. Build movies from episodes for one active show.
3. Review Flagged, then Proposed, then Existing links.
4. Use **Not about a movie** for ads, interviews, mailbags, trailers, and non-film episodes.
5. Run **Score the matcher** before and after matcher-rule changes.
6. When the queue looks stale after a major rule change, use a future guarded replay tool rather than manually refreshing the same weak historical links.
## Pass acceptance workflow (added 2026-09-02)

Before building a multi-item pass, write a testable acceptance checklist plus the minimum
verification steps per criterion, and flag anything the spec does not actually cover instead
of quietly deciding it.

Every pass summary labels each promised item:

- **Verified** — checked in code and in the running app, naming route and device.
- **Implemented, not verified** — code exists, runtime verification not done.
- **Deferred** — intentionally not built.
- **Needs follow-up** — present but not at the requested UX quality.

A pass is never called "built" or moved to *Already done* in `.lovable/roadmap.md` unless every
item is Verified or explicitly Deferred. Verification is run proactively — no prompting needed —
and is mandatory for mobile/PWA layout, popovers, filters and stateful controls.

Current acceptance-criteria sets: `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`
(U8, U24, U4, P, U23).
