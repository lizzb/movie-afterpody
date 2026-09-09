# Pass U63 — Stop admin server functions from loading whole tables (502 fix)

Created: 2026-09-09
Mode: BUILD requested; plan first because the change spans several handlers and touches matcher inputs.

## Confirmed problem

Published server logs show repeated `Worker exceeded CPU time limit.` and `Worker exceeded memory limit.` returning HTTP 502 on `/_serverFn/*`. The cited code still exists:

- `suggestEpisodeMatches` pages all `movies` (2,606), all `episode_movies` (9,399), all `episode_match_rejections`, plus every active episode (11k+) with descriptions, then matches in memory.
- `rescanEpisodeMatches` does the same, plus a per-episode link map.
- `listPodcastCoverage` pages all `podcast_episodes`, all `episode_reviews`, all `episode_movies` and counts per show in JS.
- `listIngestionStats` fires ~12 parallel aggregate queries in one isolate.

One Cloudflare isolate holds all of that at once, which matches the observed failure mode. Consumer pages are already bounded (L2a/L2b), so this is admin-only.

## Approach

Move counting and candidate narrowing into the database; keep decision logic (matching, thresholds, protections) unchanged.

1. **Coverage card → SQL aggregate.** Add a security-definer function `admin_podcast_coverage()` returning one row per show: stored episodes, retired count, linked count, episodes with unconfirmed links, current-review count (review row against the show's `sync_generation`, not reopened). `listPodcastCoverage` reads that plus the existing `podcasts` row. No client-visible change to the card's numbers.
2. **Suggestions → bounded episode window.** Keep the existing full-scope candidate movie set (needed for matching), but stop fetching every episode: page episodes with the existing search/limit applied server-side and drop `description` for rows outside the returned window. Reviewed/rejected/linked sets become targeted `in (...)` reads keyed to the episode window instead of full-table reads.
3. **Rescan → chunked runs.** Process a bounded batch per invocation (existing "Run until done" chaining already drives repeat calls), so a single request never holds all episodes plus all links.
4. **Stats → two calls.** Split `listIngestionStats` into fast counts and slow aggregates so neither request exceeds the budget; the UI renders each as it lands. (This is the short-term half of the existing roadmap note at roadmap line ~188; fold it in rather than duplicating.)

## Protections kept

- Confirmed / rejected / reviewed records are read-only in this pass; no migration deletes or rewrites history.
- Matcher scoring, thresholds and strategy selection unchanged — only how inputs are fetched.
- Movie candidate set stays full-scope so match quality does not regress.

## Technical notes

- New SQL: one `SECURITY DEFINER` function in `public`, granted to `authenticated`, with an admin check via `has_role`.
- Touched files: `src/lib/ingestion.functions.ts`, `src/lib/ingestion-helpers.server.ts`, `src/routes/admin.ingest.tsx`.
- Estimate: M–L (~5–8 credits).

## Acceptance checklist

- Coverage card numbers identical to current values for at least three shows, checked against SQL.
- Suggestions and rescan complete without 502 on the published site.
- Stats tiles render without a failed request.
- No change to confirmed/rejected/reviewed rows.
- Items not verified in the signed-in admin UI are reported as IMPLEMENTED, NOT VERIFIED.
