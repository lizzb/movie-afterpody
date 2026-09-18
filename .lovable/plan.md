# PLAN (backlog only) — Pass U89: Catalogue read fan-out and payload weight

Created: 2026-09-17 (America/Los_Angeles)

Mode: PLAN, backlog only. Approving this plan means filing it into `.lovable/roadmap.md` as Pass U89 and stopping. No product code changes.

## Problem

The episode read behind the catalogue is called very often (66k+ recorded calls) and each call transfers full episode descriptions. The index fix on 2026-09-17 removed the whole-table sort that made these reads time out, so the immediate visitor-facing failure is gone. What remains is app-level: too many identical large requests fired at once, each heavier than the page needs.

Two separate causes, both unaddressed:

1. **Fan-out** — a single page load can trigger several overlapping catalogue reads (six large page-requests at once was the observed pattern), and repeat loads re-request the same rows.
2. **Payload weight** — the read selects full episode descriptions even on surfaces that only render title, date and links. Description text is needed by the matcher path, not by browse/list rendering.

## Scope of the pass

- Measure first: instrument or log actual call counts and bytes per page load for `/`, `/movies`, `/podcasts`, a show page and a movie page, warm and cold. Record the numbers in the roadmap entry before changing anything.
- Collapse duplicate concurrent reads into one shared in-flight request per key.
- Split the episode read into a lightweight projection (no description) for browse/list/detail rendering, keeping the full projection only for matcher and admin review paths.
- Confirm existing cache TTL behaviour still holds after the split; do not introduce a second caching layer.

### Out of scope

- Cold-read latency reduction and retiring the legacy `src/lib/data.ts` reader — stays with L2c-1.
- Availability freshness work — U67/U68.
- Any schema change, new index, or change to matcher scoring behaviour.
- Any change to what users see. This pass is behaviour-preserving.

## Dependencies and interactions

- Builds on U79 (catalogue read resilience) and U80 (source-side active-show filter); must not regress either.
- Overlaps L2c-1 on the same reader; if L2c-1 runs first, re-measure before starting.
- Matcher and admin review paths must keep full descriptions — verify against the U75 corpus runner so precision/recall are unchanged.

## Unknowns

- Whether the 66k call count comes from real visitor traffic, from the ingestion/rescan loops, or from repeated dev/preview loads. This changes the fix entirely and must be resolved by the measurement step.
- How many surfaces actually consume `description`.
- Whether request collapsing alone is enough, making the projection split unnecessary.

## Estimate

Band: **M (~3-5 credits)**. Could land at S if measurement shows one caller dominates and collapsing it is sufficient; could reach L if description is consumed in many places and each consumer needs its own projection.

Complexity drivers: shared reader used by many routes; two plausible root causes; behaviour-preservation requirement across matcher and admin paths.

Confidence: **Low** — measure first, then re-estimate before building.

## Acceptance criteria (pre-build)

- Before/after call counts and transferred bytes recorded per measured page.
- Concurrent duplicate reads for the same key reduced to one request.
- Browse/list/detail pages no longer transfer episode descriptions.
- Matcher precision/recall unchanged on the U75 corpus.
- No visible change to any page; no console errors at 390px and 1280px.

Labels on completion: Verified / Implemented, not verified / Deferred / Needs follow-up.
