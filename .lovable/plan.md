# Parked shows should still surface confirmed content (backlog only)

Created: 2026-09-01

## What happens today

Parking a show is a single switch that does two unrelated jobs at once: it removes the show from admin review queues *and* deletes it from the user-facing app. The catalogue loader filters out parked podcasts, then filters out their episodes, their platform metrics, their episode sources and every episode→movie link belonging to them — with no regard for review state. A hand-confirmed link on a parked show is stored, correct, and unreachable.

That is why How Did This Get Made ↔ Doppelgänger disappeared: the link is confirmed, the show is parked, and the parked filter runs before anything looks at review state.

## Approaches considered

**A. Keep parking as-is, don't park shows you want to see.** No work, but it makes parking useless for exactly the case you have: a huge backlog show with odd naming where you want to stop reviewing but keep the handful of good links. Rejected.

**B. Split into two independent switches: "in admin queue" and "visible in app".** Most precise, but adds a second column, a second toggle, and a four-state mental model per show. More control than the problem needs.

**C. Parked means "confirmed only" in the app (recommended).** Parking keeps its current admin meaning — the show leaves every review queue, every stat scope, and stops being synced. On the app side, a parked show stays visible but contributes *only* links whose `review_state` is `confirmed`, and only the episodes carrying those links. A show with zero confirmed links effectively vanishes, which matches today's behaviour for the shows you park early. Nothing new to configure: the two things you already care about — reviewed work is trustworthy, unreviewed noise stays out — map straight onto the review state you're already recording.

Trade-off to accept: for a parked show, the app shows a curated slice rather than the show's full feed. That is the point, but it must be labelled so it never looks like data loss.

## Recommendation: approach C

### App behaviour when a show is parked

- The podcast appears in Podcasts and in movie-detail episode lists as normal.
- Only its confirmed episode links count. Episodes with no confirmed link are omitted, including from the show's own episode feed.
- The show's card and detail page carry a quiet "Reviewed picks only" marker plus a line such as `Showing 12 reviewed episodes — the rest of this feed is still being sorted`, so a short list reads as intentional scoping rather than a bug.
- Tonight, filters and Commentary Score treat the surviving confirmed links exactly like any other link; no scoring changes.
- Parked shows sort after active shows in the podcast list when scores tie, so active work stays on top.
- Auto-linked and proposed links on parked shows stay hidden — that's the noise you parked to avoid.

### Admin behaviour

Unchanged: parked shows stay out of match review, unmatched episodes, rescan, build-movies, stat scopes, and episode sync. One addition to the show curation card: each parked row shows `N confirmed links live in the app`, so parking a show tells you what remains visible instead of leaving you guessing.

### Consequence worth knowing

Confirming a link on a parked show becomes a publishing action — it's the only way content from that show reaches the app. That reinforces the workflow you described: park HDTGM, confirm the handful of episodes you care about now, let U4 and U24 land before working the rest of the backlog.

## Technical notes

- `fetchCatalog` in `src/lib/data.ts` currently selects `episode_movies` without `review_state`; the query gains that column. The parked filter changes from "drop everything parked" to: keep parked podcasts; for parked shows keep only links with `review_state = 'confirmed'`; derive the visible episode set for those shows from the surviving links (active shows keep their full episode feed as today). Episode sources and metrics follow the resulting episode/podcast sets.
- `Podcast` in `src/lib/types.ts` already carries `curation_status`, so `usePodcasts` in `src/lib/podcasts.ts` can read it directly for the badge, the reviewed-only copy line and the tie-break ordering; `episodeCount` for a parked show becomes the count of visible (confirmed) episodes.
- `src/routes/podcasts.index.tsx` and `podcasts.$slug.tsx` render the badge and explanatory line.
- `listPodcastCoverage` in `src/lib/ingestion.functions.ts` adds the per-show confirmed-links-live figure; no other admin query changes.
- No migration required — this reuses `review_state` and `curation_status`.
- Size: M (~3-5 credits). Files as an entry in `.lovable/roadmap.md`; nothing built until you say BUILD.
