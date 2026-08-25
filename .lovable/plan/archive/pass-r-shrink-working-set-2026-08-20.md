# Pass R — Shrink the working set without losing work

Approved 2026-08-20. Backlogged, not yet implemented.

State when written: 23 podcasts, ~7,050 episodes, 1,376 links (1,341 strong, 13 weak, 22 confirmed by hand), 573 movies. Coverage varies wildly — Zetus Lepetus 182/191 linked, Mom Can't Cook 103/109, while Crime Writers On... is 19/299 and I Love A Lifetime Movie 1/131.

The problem isn't the amount of data, it's that every episode of every show sits in the same queue. The fix is scoping, not deleting.

## The approach: park, don't purge

Each podcast gets a curation status controlled from `/admin/ingest`:

- **Active** — in the review queue, in Tonight, in the app.
- **Parked** — episodes stay in the database exactly as ingested, but disappear from every review queue, every stat tile, and the whole user-facing app. Flip back to Active any time and nothing needs re-ingesting.

Nothing is deleted. No movie data is touched. Blank Check, We Hate Movies, The Rewatchables and Crime Writers On... get parked and come back untouched when the matcher can handle them. A parked show also stops being synced by "Sync episodes", so its backlog doesn't grow while out of scope.

## Suggested starting scope

Start where the matcher already performs: Zetus Lepetus (95%), Mom Can't Cook (94%), Ruined (27%), I Hate It But I Love It (19%), Your Inner Child Is An Idiot (30%). Park the rest. Final list is picked in the UI; this is only a default suggestion. Everything already reviewed stays reviewed, so re-activating a show resumes rather than restarts.

## What gets built

1. **Curation status per podcast** (Active / Parked) with a toggle in the Podcast coverage card, plus an "Active shows only" default across the admin surface.
2. **Every queue and stat becomes scope-aware**: match review (both tabs), unmatched episodes, rescan, build-movies-from-episodes, and the stat tiles count and act on active shows only. A "N shows parked" line with a one-tap reveal keeps the parked set visible rather than secretly dropped, honouring the rule that no episode is silently invisible.
3. **App-side filtering**: parked shows and their episodes drop out of Tonight, Podcasts, and movie-detail episode lists.
4. **Per-show progress line** in the coverage card: linked / reviewed / unmatched, so it's obvious whether a show is worth activating.
5. **Episode-level noise handling for mixed shows** (the Crime Writers problem): bulk **"Retire remaining unmatched"** on one show marks every still-unmatched episode `not_about_a_movie` in one action, undoable from the match history. That clears ~280 Crime Writers episodes out of the queue without deleting them.
6. **Optional per-show purge** as a separate, explicitly-labelled destructive action ("Delete episodes, keep the show") for feeds added by mistake. Movies are never removed.

## Refining the matcher without redundant work

- Approve / reject / confirm decisions are already logged in `match_actions`. Those become a **labelled evaluation set**.
- A **"Score the matcher" admin action** re-runs current scoring rules over every labelled pair and reports precision, recall, and the confidence band where mistakes cluster — so a weight change can be judged without re-reviewing by hand.
- Because labels persist independently of links, tuning weights never invalidates review work already done.

Loop: small active scope → review → labels accumulate → measure → widen scope.

## Technical notes

- Migration: `podcast_curation` enum (`active`, `parked`) + `curation_status` column on `podcasts` defaulting to `active`, with an index. Public SELECT policies unchanged; filtering happens in queries so re-activation is instant.
- `fetchAllEpisodes` / `fetchUnlinkedEpisodes` in `ingestion-helpers.server.ts` gain an `activeOnly` option (default true), which automatically scopes suggest / rescan / resolve / unmatched / stats.
- `listPodcastCoverage` returns `curationStatus` plus linked / retired / unmatched counts; new `setPodcastCuration` and `retireUnmatchedEpisodes` server functions, both admin-gated, both writing to `match_actions` where they change link state.
- Catalogue reads in `src/lib/data.ts` filter podcasts to `curation_status = 'active'` and drop their episodes and episode links from the returned catalogue.
- Matcher evaluation lives in a new `src/lib/matcher-eval.server.ts` reading `match_actions` + `episode_match_rejections`, surfaced by a `scoreMatcher` server function and a small results card; no TMDB calls, no tokens.
