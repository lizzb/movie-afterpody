# Awaiting-review explained + fix for the phantom "1 missing" episode

Created: 2026-08-30

## Part 1 — What "94 / 222 awaiting review" actually means

Verified against the live data:

| Show | Confirmed links | Auto-linked (awaiting) | Proposed (awaiting) | Confidence range of awaiting links |
|---|---|---|---|---|
| Mom Can't Cook! | 11 | 98 | 0 | 0.90 – 1.00 |
| Your Inner Child Is An Idiot | 16 | 233 | 24 | 0.88 – 1.00 (auto), 0.51 – 0.78 (proposed) |

So the counts are **links, not episodes**, and they are counted per episode: an episode is "awaiting review" while any of its links is still `proposed` or `auto_linked` rather than `confirmed`.

**Why Match Review looked empty:** the Existing links tab defaults to the confidence band **"Weakest first (≤ 80%)"**. Almost all of your awaiting links scored 0.88–1.00, so they sit above that band and are filtered out. Nothing is broken — the queue is hidden by the default filter.

### What to do right now (no code changes needed)

1. Open Match review → **Existing links** tab.
2. Set the band dropdown to **"All unconfirmed links"** (and Review state = Unconfirmed, the default).
3. Optionally set the show filter to one podcast and page size to 100.
4. Work the rows: **Confirm** correct links, **Unlink/Reject** wrong ones, **Not about a movie** for non-film episodes.
5. Each confirm flips a link to `confirmed`; the coverage line's "reviewed" number rises and "awaiting review" falls.

A show reaches the coverage card's fully-reviewed state when: stored == feed total, unmatched == 0, and every link on every episode is `confirmed`. For Mom Can't Cook that means confirming/deciding 98 links; for Your Inner Child, 257 links (233 auto + 24 proposed).

### What you can't do yet in the app

- No **episode-level** "reviewed, no more links needed" mark — review completion is inferred purely from link states (roadmap Pass U8).
- No "as of sync date" stamping, so a later sync silently dilutes a fully-reviewed claim (Pass U8).
- No bulk "confirm everything above X% for this show" — confirming is per row or per current selection.
- No stored history of matcher scorecard runs to prove improvement over time (Pass U9).

### Related open roadmap items

- **U8** — episode-level review-complete + sync-generation stamping (the real fix for "all of X reviewed as of date D").
- **U11** — busy/spinner state scoping.
- **U12** — bulk unlink that sticks.
- **U13** — match review reliability sweep (counts, paging, persistence of tab/band/search).
- **U14** — serialised admin actions (park/sync race conditions).
- New pass below (U17) for the missing-episode counter.

## Part 2 — Backlog pass for the phantom "1 missing"

### Pass U17 — Reconcile feed count vs stored episodes — S (~1-2 credits) — Priority 2

Confirmed cause: **Your Inner Child Is An Idiot** stores 254 rows and 254 distinct slugs while the feed reports 255 items. Episodes are upserted with `onConflict: "slug"`, so two feed items whose titles normalise to the same slug overwrite each other — one feed item is real but unstorable as a separate row. The sync toast says "stored 255 of 255 fetched" because it counts fetched items sent to the upsert, not rows actually created, so it can never surface this collapse.

Scope of the fix:

- Make episode slugs collision-safe (e.g. suffix with episode number or feed GUID hash) so two same-titled episodes both persist.
- Have the sync result report **rows inserted / rows updated / feed items collapsed**, derived from actual row counts, not from the fetched array length.
- Add a per-show diagnostic listing feed items that did not produce a distinct stored row, with their titles and dates, so a mismatch always explains itself.
- Treat a show as complete when stored rows account for every feed item, and when they can't, show the reason inline instead of a bare "1 missing".
- Verify by re-syncing that show and seeing either 255/255 or an explicit collapsed-item explanation.

### Technical notes

Touched: `src/lib/ingestion.functions.ts` (episode sync/ingest upsert path, `listPodcastCoverage`), `src/lib/providers/podcastindex.server.ts` (feed item identity), `src/routes/admin.ingest.tsx` (coverage card readout). Slug change is data-affecting: new slugs only for colliding items; do not rewrite existing slugs that already have links.
