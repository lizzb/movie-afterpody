# PLAN (backlog only) — four Project monitoring findings

Created: 2026-09-11
Mode: PLAN. No code changes. Approving this files these items into `.lovable/roadmap.md` and stops.

Reconciliation first: two of the four findings are already filed. Only two new items are needed.

---

## 1. Catalogue timeouts for visitors (high) — split between existing L2c-1 and new **Pass U79**

What monitoring saw: bursts of cancelled database statements (statement timeout), after which the whole catalogue read fails and the page comes up empty.

Confirmed cause: the old full-catalogue browser reader (`src/lib/data.ts` → `useDiscovery`) is still live on movie detail, Lists & History, Settings and the legacy podcast helper. It pages every table six requests at a time, and the "holiday movies" lookup runs an un-indexable regex over every synopsis. One timed-out page rethrows and kills the entire read.

- Retiring those four remaining consumers is **already Pass L2c item 1** (L2c-1, M ~3-5). No duplicate filing.
- New: **Pass U79 — Catalogue read resilience — S (~1-2 credits).** Two narrow fixes that stand alone and do not wait on L2c:
  - Replace the regex holiday scan with an indexed/bounded lookup (the same `holidayMovieIds` approach already used server-side).
  - Stop one failed page from failing the whole read: retry a timed-out page once with a smaller page size, and surface a partial-load state instead of a blank page.

## 2. "Recheck every episode" only rechecks the newest episodes (high) — already filed as **Pass U77** — S (~1-2)

Already on the roadmap from the 2026-09-10 triage; the finding matches it exactly. Action: no new item; add the finding ID to U77 and keep the estimate.

## 3. Admin stats / unmatched / coverage fail with "permission denied" (high) — already filed as **Pass U78** — S (~1-2)

Already filed. The published site calls three admin database helpers with a role that lacks execute rights, most likely because the deployed service-role secret is not a true service-role key. Preferred fix stays: repair the deployment secret, not loosen the grants. Action: no new item; attach the finding ID to U78.

## 4. Catalogue downloads parked shows' episodes too (medium) — new **Pass U80** — S (~1-2 credits)

The server catalogue read switched the episode query to keyset paging and lost its `podcast_id` predicate, so parked shows' episodes now come over the wire and are filtered out in memory. Fix: keep keyset paging but reapply the active-podcast filter in SQL (chunk the id list if it is large), and drop the in-memory filter. The related truncation risk the finding mentions (page size above the PostgREST row cap) was already fixed on 2026-09-10 — record it as resolved, not open.

---

## Recommended priority

1. **Now — Pass U78** (S). Admin ingestion, unmatched and coverage panels are broken on the published site; every review workflow depends on them, and the likely fix is a secret repair.
2. **Now — Pass U79** (S). Ordinary visitors can get a blank browse page. Small, independent of L2c, and it removes the worst single query.
3. **Next — Pass U77** (S). Correctness of a tool you actively use, and its counter is currently untruthful. Not user-facing breakage.
4. **Next — Pass U80** (S). Real but gradual slowdown; grows only as parked archives grow.
5. **Then — L2c-1** (M). The durable fix that ends the full-catalogue reads for good. Schedule after the three S items rather than instead of them.

No item here needs to interrupt in-flight matcher work beyond U78 and U79.
