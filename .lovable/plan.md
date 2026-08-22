# Match review hardening + matcher accuracy (Passes T1–T6, U, V)

Full roadmap: `.lovable/plan/movie-afterparty-consolidated-roadmap-passes-a-r-2026-08-20.md` (this plan gets appended there on approval).

## What I verified in your data first

- **"Not about a movie" IS saved** — both "Big Flop" ad episodes have `disposition = not_about_a_movie`. But the action does **not delete the existing link row and does not record a rejection**, so those episodes keep coming back forever in the **Existing links** tab (which filters on links, not disposition). Same pattern for 20+ rows I sampled (e.g. an episode titled "Girls" retired but still linked to 11 different "…Girls…" movies).
- **Existing links does include parked shows** — 1,727 of 5,097 links belong to parked shows. Proposed correctly excludes them. Confirmed bug.
- **"us" → Bad Request** — the search builds one `or(episode_id.in.(…))` clause from up to 1,000 episode ids; the resulting URL exceeds the server's request-line limit and returns 400. Any short/common term hits this.
- **Conflicting counts** — Existing links reports the database's `exact` count for the pre-filter query while showing a client-side-filtered, locally-decremented list, so "Showing 41 of 0" / "Showing 1 of 0" are two different numbers being subtracted from each other.
- **Unmatched-episodes lag** — one shared mutation drives every row (so every row greys out) and its success handler invalidates `match-suggestions`, which re-runs the whole matcher over ~7k episodes × ~840 movies on the server. That is the multi-second stall.
- **"The Hottie and the Nottie" at 55%** — scoring uses Jaccard over token sets. Episode `{ep,43,the,hottie,and,nottie}` vs movie `{the,hottie,nottie}` = 3 shared / 6 union = 0.50 → "moderate token overlap 55". Episode-number prefixes, `&` vs "and", and stopwords all dilute the score, so many near-identical titles score in the weak band. Systemic, not one-off.

## Pass T1 — Correctness fixes (Priority 1, ~25k)

- `markEpisodeNotAboutMovie` also deletes that episode's links and writes an `episode_match_rejections` row per removed pair, logged and undoable.
- Bulk actions gain **"Not about a movie (selected)"** for multi-select.
- `listEpisodeLinks` scopes to `curation_status = 'active'` (matching Proposed), with an explicit "include parked" toggle so nothing is silently hidden.
- Existing links excludes episodes already retired as `not_about_a_movie`.
- Button labels: "Confirm selected" / "Unlink selected" / "Approve selected" / "Reject selected".

## Pass T2 — Search and counts that don't lie (Priority 2, ~20k)

- Replace the id-list `or(...)` search with a server-side join filter (`podcast_episodes.title.ilike`, `podcasts.name.ilike`, `movies.title.ilike`) so no ids travel in the URL — fixes the 400 on "us".
- Count comes from the same filtered query that produces the rows; locally-decided rows are removed from both numerator and denominator. One number, always consistent.
- Empty-state text distinguishes "no matches for this search" from "queue clear".

## Pass T3 — Unmatched episodes responsiveness (Priority 3, ~12k)

- Per-row pending state (only the tapped row shows a spinner), optimistic removal, and invalidation narrowed to the unmatched list; heavy queries refresh lazily on next open instead of synchronously.

## Pass T4 — Matcher accuracy (Priority 4, ~35k)

Deterministic only, no AI, no extra API calls.

- **Coverage scoring** replaces raw Jaccard: score on the share of *movie* tokens present in the episode title, so extra episode noise no longer penalises a full title match. Fixes the Hottie & Nottie band and its many siblings.
- **Normalisation**: `&` → "and", strip `Ep 43 -` / `#123` / `Episode 12:` prefixes, strip stopwords (the, a, an, and, of) before comparison.
- **Short titles**: cap at 15 confidence for titles ≤ 4 characters (up from < 4) unless the whole episode title matches exactly — covers Us, Men, Host, Lost.
- **Common-word titles** (After, Girls, Speed, Genius): a curated high-frequency word list plus a data-driven rule — any single-word title whose word appears in more than ~1% of episode titles requires corroboration (year agreement, or the title named in the description with a matching year) before scoring above the suggestion threshold.
- **Keyword context rules**: "interview", "Q&A", "mailbag", "listener", "announcement", "trailer", "introducing", "listen now", "bonus", "patreon", "live show", "awards" in the episode title suppress weak/description-only matches and auto-suggest `not_about_a_movie`.
- **Description scoping**: ignore promo/ad boilerplate — skip the description signal when the sentence containing the hit also contains promo markers ("Introducing", "Wondery", "subscribe", "new podcast", host-plug patterns). This is what made "The Big Flop" ads look like film mentions.
- New signals (`coverage`, `commonWord`, `keywordSuppressed`, `descPromo`) stored on links for Pass R3 scoring.

## Pass T5 — Show list search / filter / sort (Priority 5, ~15k)

Episode coverage & show curation gets a name search, active/parked/behind-feed filters (existing), and sort by **name (A–Z)**, **stored episodes**, **unmatched count**, **missing vs feed**. *Someday:* sort by highest external rating once Pass M lands the per-show ratings cache — noted there as a dependency.

## Pass T6 — Higher-volume review sessions (Priority 6, ~18k)

Existing links today caps at 50–200 rows per fetch and needs manual refresh between batches. Options, in order of preference:

1. **Keyset pagination + prefetch** (recommended): stable cursor on `(match_confidence, episode_id)`, page size 100, next page prefetched while you work. No repeated full-table reads, no drift when rows are decided.
2. **"Load more" appending** into the same list, so a session accumulates without refetching earlier rows.
3. **Server-side "review batch" endpoint** returning 200 rows plus counts in one call, with decided rows excluded server-side by the same cursor.

All three avoid extra third-party API calls entirely — this is database-only work. No TMDB traffic is involved in review.

## Pass U — Rebuild all links from scratch (Priority 7, ~30k) — assessment only, not scheduled yet

**Importance: high.** Most current links were written by an engine with no rejection history, no description signal and no short/common-word guards. They are the least trustworthy data in the app.

**Feasibility: straightforward, with one hard constraint** — human decisions must survive. Best practice:

- Never delete `match_method = 'manual'` links or anything with a `confirm`/`approve` in `match_actions`; rebuild only `deterministic`/`heuristic`/`ai` links.
- Run it as a **dry run first**: report how many links would be dropped, kept, re-created identically, or changed, before writing anything.
- Write a `rebuild_batch_id` on every affected row so the whole run can be rolled back as a unit.
- Keep `episode_match_rejections` intact so previously rejected pairs are never re-proposed.
- Chunk it (500 episodes per press) with resumable offset, like availability sync.

## Pass V — TV shows and miniseries (Priority 8, ~90k)

The schema already carries `media_type: movie | tv`, so this is additive rather than a migration.

Design decisions to think about now:

- **Runtime**: a series has no single runtime. Needs episode count / season count / average episode length, which changes the "Tonight" runtime filter and the Commentary Score inputs.
- **Granularity**: does a podcast episode link to a *series*, a *season*, or a *TV episode*? Recommendation: series-level first, optional season number on the link.
- **Matching**: TMDB `/search/tv` plus `/search/multi`, and titles collide badly across media types ("Fargo", "Watchmen"). Media type becomes a matching signal, and recap-podcast titles ("S3E4", "Season 2 finale") need their own extraction rules.
- **Availability**: TV providers are per-season on TMDB — the availability table gains a season dimension or accepts series-level approximation.
- **UI**: "Movies" tab naming, cards showing "6 episodes · 2019" instead of runtime, and filters needing a movie/TV/both switch.

Suggested split: V1 schema + TMDB TV provider + admin add-by-title (~35k), V2 matching and extraction rules for recap shows (~30k), V3 app surfaces, filters and Commentary Score adjustments (~25k).

## Where the "learning" stands today

Real, but narrow and non-adaptive: recorded rejections penalise a movie everywhere (−6 per rejection, capped −25), rejected pairs are never re-proposed, generic one-word and very short titles are penalised, `disposition` retires episodes, and every link stores its `signals` for later evaluation. Nothing tunes its own weights yet — the rules are hand-set. Pass R3 (score the matcher) is what turns the labelled approve/reject history into measured precision/recall and evidence for weight changes; Pass T4 above is the last big hand-tuning round before that.

## Technical notes

Touched: `src/lib/providers/matching.server.ts`, `src/lib/providers/episode-title.server.ts`, `src/lib/ingestion.functions.ts` (`listEpisodeLinks`, `markEpisodeNotAboutMovie`, `bulkMatchDecision`, `listPodcastCoverage`), `src/lib/ingestion-helpers.server.ts`, `src/components/admin/MatchReviewCard.tsx`, `src/routes/admin.ingest.tsx`. One migration only if Pass U's `rebuild_batch_id` is approved.
