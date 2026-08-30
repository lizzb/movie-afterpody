# Fix the invisible "11 awaiting review" links

Created: 2026-08-30

## What's actually going on

Verified against the live data for **Your Inner Child Is An Idiot**:

| Link state | Count | Episodes | Confidence |
|---|---|---|---|
| confirmed | 215 | 214 | 0.95 – 1.00 |
| auto_linked | 3 | 3 | 0.90 – 1.00 |
| proposed | 8 | 8 | 0.51 – 0.74 |

The 11 unconfirmed links (3 auto-linked + 8 proposed) all sit on episodes whose
disposition is **`not_about_a_movie`** — episodes you already retired (e.g.
"Episode 5 - Saved By The Bell", "Episode 63 - Super Mario Bros 2",
"Episode 127 - Star Trek: The Next Generation - PART I").

Match review deliberately excludes retired episodes from every queue
(`.neq("podcast_episodes.disposition", "not_about_a_movie")`), so those 11 links
can never appear in Flagged / Proposed / Existing links, no matter what band,
review-state or search term you pick. The coverage line, by contrast, counts any
episode with a non-confirmed link as "awaiting review" regardless of
disposition. That mismatch is the bug: the counter advertises work the UI is
designed never to show.

So nothing is wrong with your links or with the search — the show is effectively
fully reviewed, and the number is lying.

## The fix

1. **Coverage counts respect disposition.** In `listPodcastCoverage`, build the
   open-link set only from links whose episode is not `not_about_a_movie`, so
   `awaiting review` and `fully reviewed` match exactly what match review can
   surface. Your Inner Child then reads `225 reviewed · 0 awaiting review`.
2. **Retiring an episode settles its links.** When an episode is marked "Not
   about a movie", stop leaving stale `proposed` / `auto_linked` rows behind:
   remove those links (that is what "not about a movie" means) so the data
   itself is consistent, not just the counter. Existing retired episodes get the
   same treatment via a one-off cleanup on the same code path.
3. **One-off reconciliation** for the current data: clear the 11 leftover links
   on retired episodes across all shows, not just this one (other podcasts have
   the same pattern).
4. **Verify** by re-reading the coverage card for both active shows and
   confirming awaiting-review is 0 where every non-retired link is confirmed.

Note the separate `1 missing` (254 stored / 255 in feed) is unrelated — that is
the slug-collision issue already filed as **Pass U17** and is not touched here.

## Technical notes

Touched: `src/lib/ingestion.functions.ts` — `listPodcastCoverage` (join
disposition into the open-link set), the `not_about_a_movie` disposition handler
(delete the episode's remaining unconfirmed links), and a small admin action /
cleanup for pre-existing retired episodes. No schema migration required.
