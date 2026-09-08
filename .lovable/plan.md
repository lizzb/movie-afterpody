# PLAN (backlog only) — Matcher evidence hierarchy & false-positive reduction

Created: 2026-09-08
Mode: PLAN. No code changes. Approving this plan files the passes below into `.lovable/roadmap.md` and stops.

## A. Current behaviour relevant to these failures

`src/lib/providers/matching.server.ts` is a single deterministic scorer. Today it: strips episode-number prefixes, canonicalises `&`, removes stopwords, scores by *movie-title coverage* (exact 100 / contained 90 / all-words 88 / 0.75 → 74 / 0.5 → 56 / jaccard 0.4 → 50 / else coverage×45), then applies additive adjustments: year bonus/near/mismatch, generic-one-word −12, verbatim description mention (+bonus or a description-only floor), promo-scoped description suppression, global rejection-count penalty, ≤4-char cap 15, common-word corroboration cap 20, "live" cap 15, non-film keyword cap 15, distinguisher penalty −12, low episode-coverage −5, then Pass W's family/collection post-pass. U4 (`matcher-strategies.ts`) only tunes these numbers per show.

Root causes of every reported failure, in the code as it stands:

1. **No parsing stage.** The whole episode title is one bag of tokens, so guest names, post-colon chatter and subtitles are indistinguishable from title words (families 1, 2, 7, 11).
2. **Coverage is one-directional and unweighted.** A one-token overlap on a common word can reach 56–90 because the *candidate* is short; no token is worth more than another (families 2, 3, 6).
3. **Year is additive, not conditional.** `+10` lands on candidates with effectively no lexical evidence (family 5).
4. **Description evidence is a flat verbatim test.** `<title> (2007)` and a stray "2000" are worth the same (family 4); no content-type reading (family 9).
5. **Negative evidence is only global.** `rejectionCountByMovie` has no show scope and no "ever confirmed here" notion (family 10).
6. **One title per episode.** No multi-title extraction (family 8).

## B/C. Recommended architecture — one foundation, then focused rules

Keep one matcher, one scoring path, W as the owner of family collapse, U4 as configuration only. Insert two shared stages and make evidence categories explicit signals:

```text
episode title ─▶ [S1 PARSE]  segments with roles:
                  prefix | primary-title | extra-title | subtitle | guest | chatter
             ─▶ [S2 EVIDENCE] token IDF from catalogue titles; description
                  sentence-scoped title+year mentions; content-type cues
             ─▶ [S3 POSITIVE]  existing rules, scored against title-bearing
                  segments only, weighted by token distinctiveness
             ─▶ [S4 NEGATIVE]  missing-distinctive-token, content-type
                  contradiction, subtitle-only, show-scoped confusion
             ─▶ [S5 GATE]      year/sequel-marker may corroborate, never carry
             ─▶ [W post-pass]  unchanged
             ─▶ [U4 config]    thresholds & sensitivities only
```

Evidence classes, each surfaced as a signal on the link so review stays explainable: **positive identifying** (exact title, distinctive component, description title+year), **corroborating** (year, near-year, description context, future cast), **negative** (missing distinctive candidate word, non-movie content type, unrelated sequel marker, generic-only overlap, guest leakage, subtitle-only, show confusion), **non-signal** (episode number, bare `II`/`2`, common words, show-format language).

Distinctiveness is derived, not hand-listed: inverse document frequency of each token across catalogue movie titles plus the existing `computeCommonEpisodeWords` across episode titles. This replaces "add more points" with "weight by information".

## D. Show-scoped confusion memory — smallest representation

Derive it; no migration. `episode_match_rejections` and `match_actions` already carry episode → show and movie. One aggregate query per resolve batch yields, per `(show, movie)`: rejection count, confirmed-here count, confirmed-elsewhere-in-show count. Rules:

- **Case B** (rejected ≥2 in show, never confirmed there): progressive demotion — cap at 20 at 2 rejections, 10 at 4+ — overridable only by exact title or description title+year.
- **Case A** (confirmed somewhere in the show): no show-level suppression; a small demotion applies **only** when this episode's evidence is weak (rule `weak`/`description` or coverage < 0.75).
- Never a global blocklist, never deletes history, never touches confirmed links; the global `rejectedBefore` penalty stays and the show-scoped term is applied as a separate, explainable signal, taking the stronger of the two rather than stacking.

## E/F/G. Pattern families → ownership

| # | Family | Owner | Rule |
|---|--------|-------|------|
| 1 | Guest leakage (`with`, `w/`, `feat.`) | new **U55** parse stage (global) | tokens in a guest segment are not title evidence; conservative — split only when the separator is surrounded by spaces and the trailing segment looks like person names; `with` mid-title stays intact when the whole string matches a catalogue title |
| 2 | Distinctive beats generic | **U56** (global) | IDF-weighted coverage; post-colon chatter demoted |
| 3 | Missing distinctive candidate word | **U56** (global) | absent high-IDF candidate token = penalty, scaled by IDF; stopwords and subtitle omissions exempt |
| 4 | Description title + year | **U57** (global) | sentence-scoped exact/near-exact mention adjacent to a year outranks generic overlap; strictly stronger than today's flat bonus |
| 5 | Year pathology (`π (1998)`) | **U57** gate (global) | year may only add once a candidate has non-generic lexical or description evidence; no lexical evidence ⇒ year contributes 0 |
| 6 | Sequel numerals | **U58**, reconciled with W (pre-pass, not a second system) | a bare `II`/`2` is a distinguisher requiring base-title identity; it never functions as shared positive evidence |
| 7 | Franchise/subtitle | **U58** | base-title vs subtitle decomposition; subtitle-only overlap insufficient unless independently distinctive |
| 8 | Multi-title extraction | **U59** | split on ` & ` / ` and ` only when both sides independently resolve to plausible catalogue titles; evaluate each candidate independently; per-relationship confirm/reject unchanged. Extraction only — U2 still owns editing/coverage roles |
| 9 | Non-movie content type (`documentary series`, `album`) | **U60** | sentence-scoped: cue must sit in the same sentence as the candidate title; strong negative, overridable by exact title or title+year |
| 10 | Show-scoped confusion | **U61** | as section D |
| 11 | Structural parsing | folded into **U55** (not a separate pass) | |
| 12 | Director/people | **deferred** — extend U23's `castMention` to director on top of Pass P's cached credits, consumed by U4A's strategy. No new subsystem, no matcher-time network calls | |

Not matcher work: high-noise phrase/allowlist curation stays **U3**. Per-show sensitivity stays **U4** — a later `strict_evidence` strategy may raise U55–U58 sensitivities, but none of these fixes ship as a strategy, because every pattern above is general. Truncated Rom Complex descriptions are a **separate UI/data triage (U62)**, not matcher work.

## Acceptance & evaluation

Each pass adds a table-driven regression suite over the exact examples in the request (guest leakage ×5, description/context ×2, distinctive-token ×2, missing-distinctive ×2, sequel ×4, franchise ×2, multi-title ×2, content-type ×2 plus one positive control where "series"/"album" must *not* suppress, `π (1998)`, and both show-confusion cases including "confirmed in show must not be blocked"). A pass is accepted only when its cases pass **and** `scoreMatcher` shows precision up with recall not materially down (recall drop > 2 points at threshold 25 blocks the pass). Protections: no writes to confirmed links, rejection records or review states; rejected pairs never resurrected; no broad replay or Build/Recheck run as part of any pass — replay is a separate, later, explicitly guarded operation with a stated consumer-facing benefit.

## H/J. Decomposition, estimates, sequence

Parent initiative: **Matcher evidence hierarchy (U55–U61)**.

1. **U55 — Episode-title parsing stage — M (3–5).** Foundation; no dependencies. Families 1, 11.
2. **U56 — Token distinctiveness + missing-token penalty — M (3–5).** Depends on U55. Families 2, 3.
3. **U57 — Description title+year evidence and the year gate — M (3–5).** Depends on U56 (needs distinctiveness to define "no lexical evidence"). Families 4, 5.
4. **U58 — Sequel/subtitle identity, reconciled with W — S (1–2).** Depends on U55.
5. **U59 — Multi-title extraction — M (3–5).** Depends on U55. Flagged: could reach L if independent per-candidate linking touches the write path more than expected — stop and report rather than expand.
6. **U60 — Contextual content-type exclusion — S (1–2).** Independent of the above.
7. **U61 — Show-scoped confusion memory (derived) — M (3–5).** Independent; do last so its demotions are measured against an already-improved baseline.
8. **U62 — TRIAGE: truncated episode descriptions in "Show more" — S (1–2).**

Total if all built: ~20–30 credits across seven passes. Safest sequence: U55 → U56 → U57 → U58 → U60 → U59 → U61, scoring the matcher after each. Non-goals throughout: a second matcher, ML/embeddings/new APIs, per-show one-off exceptions, more suggestions for their own sake, and any interpretation of rising match counts as success.
