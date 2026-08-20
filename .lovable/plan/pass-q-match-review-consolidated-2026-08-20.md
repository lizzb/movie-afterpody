# Pass Q — Match review, consolidated

Everything below lives on `/admin/ingest`. I verified the current behaviour before writing this: 7,053 episodes, 1,360 links, 193 recorded rejections, 13 links stored as `heuristic`.

## Answers to your questions first

**Why two review sections?** They act on different states, but you're right that they're the same job:

- **Review episode matches** shows *proposed* links the matcher computed on the fly plus links it already wrote with low confidence — approve or reject.
- **Fix wrong matches** shows links that already exist in the database — unlink or relink.

They will be merged into one **Match review** section with two tabs: **Proposed** and **Existing links**, sharing one search box, one confidence filter, and one selection model.

**deterministic vs heuristic** are just labels the matcher stamps on a link: `deterministic` = exact/near-exact title agreement (≥80–85% score), `heuristic` = weaker token overlap, `manual` = you approved or relinked it, `seed` = legacy. They will be relabelled in the UI to "Strong title match", "Weak title match", "Confirmed by you".

**"Rescan against existing movies"** takes every episode with *zero* movie links, scores its title against every movie already in the catalogue, skips pairs you rejected, and writes a link when the score ≥50. It never calls TMDB and never creates movies. So it is exactly the "force the unmatched list to check the current movie database" button you were looking for — it's just placed in the wrong card. It moves next to **Unmatched episodes**.

**Does the matcher learn?** No. Rejections are only used as a blocklist for that exact episode+movie pair. Realistic, no-AI learning is described in "Learning signals" below.

**Undoing "don't look under the bed"** — there is no history log today, so that action can't be undone. This pass adds one.

## Root causes found

- **Search finds nothing for "I Hate It But I Love It"**: the server searches movie titles and episode titles only. Show names are never queried, so a show-name search returns zero rows before the podcast-name filter runs. Fix: include a podcast-name lookup in the same query.
- **Rejected matches reappearing**: two causes. (1) The suggestion query loads episodes with no paging, so it only ever sees the newest 1,000 of 7,053 and re-derives the same list. (2) Rejecting the top candidate blocks that *pair*, so next load the episode returns with the *second* candidate — same episode, different movie, which reads as "I already rejected this". Fix: page the query, and add a per-episode "not about a movie / stop suggesting" disposition so an episode can be retired from the queue entirely.
- **"Pending review" tile** counts only links stamped `heuristic` (13), which is not what the review card lists. Tiles get renamed and recomputed to match the section headings exactly.

## What gets built

1. **One "Match review" section**, tabs Proposed / Existing links, directly under the stats. Shared search (episode, show, movie), confidence band, and podcast filter. Both tabs show "Showing X of Y".
2. **Multi-select with bulk actions**: checkbox per row, select-all-visible, then **Approve all** / **Reject all** (Proposed) or **Confirm all** / **Unlink all** (Existing). One confirmation before a bulk destructive run, and a result summary.
3. **"Confirm correct" action** on existing links: stamps the link `manual` at full confidence so it leaves the review queue and is never re-flagged.
4. **Action history + undo**: new `match_actions` log table recording who did what (approve, reject, unlink, relink, confirm), with the previous link state. A "Recent match actions" card lists your last ~50 actions with an **Undo** button that restores the prior state and clears any rejection it created. This is the balance point — a real log, no soft-delete machinery.
5. **Search by IMDb id**: paste `tt0110989` into the movie search / relink picker and the app resolves it via TMDB's external-id lookup, creating or updating the movie with full metadata, then links it. Also accepted in the "Enrich movie from TMDB" form.
6. **Stat tiles become anchors**: tapping a tile scrolls to its section, with labels matched one-to-one to the section headings ("Needs review", "Unmatched episodes", "Movies", …).
7. **Rescan moves**: "Rescan against existing movies" relocates into the **Unmatched episodes** card with copy that says what it does, plus a per-podcast scoping option. "Build movies from episodes" keeps only the TMDB-creating action.
8. **Learning signals** (cheap, deterministic, no tokens): store the winning signals on each link (exact title, token overlap, year match, generic single-word title), then use the 193 rejections and every confirmed link as counted evidence to (a) auto-suppress candidate patterns that were rejected repeatedly for the same movie, (b) penalise generic short titles that historically produce rejections, (c) show a "this pattern has been rejected N times" hint in review. Weight tuning stays a manual read of real counts, not a model.

## Backlog (not this pass)

- **Pass R — Richer movie detail**: top-billed cast (TMDB credits) shown on the movie page without leaving the app, plus director, plus an external link out for anything deeper. Needs a cast cache table and a credits fetch on enrich.

## Technical notes

- Migration: `match_actions` (id, actor, action, episode_id, movie_id, previous_method, previous_confidence, created_at) and a `signals` jsonb plus `disposition` on the episode side; GRANTs and admin-only RLS in the same migration.
- `listEpisodeLinks` gains a podcast-name id lookup, `total` reflecting the filtered count, and select-all support; `suggestEpisodeMatches` gains paging and returns a total.
- Bulk actions get dedicated server functions that take arrays and return per-row outcomes, so one failure doesn't abort the batch.
- IMDb lookup uses TMDB `/find/{id}?external_source=imdb_id` inside the existing `tmdb.server.ts` provider.
- Admin UI splits out of `admin.ingest.tsx` into `src/components/admin/MatchReview*` files; that route file is already 729 lines.
