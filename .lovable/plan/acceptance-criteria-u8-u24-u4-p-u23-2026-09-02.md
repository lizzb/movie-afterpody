# Acceptance criteria — Passes U8, U24, U4, P, U23

Created: 2026-09-02

Scope: acceptance criteria and verification steps only. No code changes, no scope
expansion. Labels used at build time: **Verified** / **Implemented, not verified** /
**Deferred** / **Needs follow-up**. A pass is not stamped shipped in
`.lovable/roadmap.md` until every item is Verified or explicitly Deferred.

Verification device shorthand: **M** = mobile viewport (390x844, coarse pointer),
**D** = desktop (1280 wide). Admin routes are `/admin/ingest`.

---

## Pass U8 — Episode-level "review complete"

### Acceptance criteria

Database / schema
1. One migration adds a per-episode review record: episode id, `reviewed_at`,
   `reviewed_by`, and the feed `sync_generation` the decision was made against.
   Table is in `public`, has GRANTs for `authenticated` + `service_role`, RLS enabled,
   and admin-scoped policies.
2. Re-marking an episode reviewed updates the existing row (no duplicate rows per episode).

Review-state behavior
3. Episode review completeness is independent of link `review_state`: an episode with
   zero links can be marked reviewed, and an episode with a confirmed link is not
   automatically "reviewed" unless marked.
4. An episode marked reviewed against sync generation N is reported as reviewed while the
   show's generation is still N.

Row-level controls
5. Every match-review row exposes Mark reviewed / Reopen, reflecting current state, with the
   existing U11 per-row pending behavior (only that row dims/spins).
6. The control writes through and survives a page reload (server truth, not local state).

Bulk review behavior
7. Multi-select supports bulk Mark reviewed / Reopen, using U12-style per-episode
   verification: reported successes are confirmed in the database, failures are surfaced
   and the affected rows return.

Auto-reopen triggers
8. An episode auto-reopens (review record cleared or marked stale) when: a new proposal is
   created for it, it is flagged as a wrong match, or one of its links is removed.
9. A new feed sync that raises the show's generation marks prior review records stale
   rather than deleting them (history preserved).

Coverage / progress reporting
10. Show curation/coverage rows read `Reviewed X of Y episodes as of sync D`, where Y is
    stored episodes for the show and X counts only current-generation review records.
11. Counts reconcile with the queue: `Y - X` equals the number of episodes still reachable
    in the unreviewed queue for that show (no phantom or hidden rows — the U7/U12 lesson).

Persistence / reversibility
12. Reopen restores the episode to the unreviewed queue immediately and after reload.
13. Marking reviewed never deletes links or alters link `review_state`.

Queryability (U27 infrastructure)
14. Review state is queryable by episode, by show, and by linked movie, so a later pass can
    ask "unreviewed episodes for this movie" without schema change.

Regression risks to check
15. Existing tabs, per-tab pagination offsets (U10), honest counts (U13) and coverage
    numbers (U7) still behave; parked shows stay out of admin queues.

### Minimum verification steps
- SQL: inspect the new table definition, GRANTs, RLS policies; mark an episode reviewed
  twice and confirm one row (`supabase--read_query`).
- Browser (D + M): `/admin/ingest` → Match review → Mark reviewed on one row → reload →
  state persists; Reopen → row returns.
- Browser: select 3 rows → bulk Mark reviewed → confirm all three in SQL.
- Trigger auto-reopen: flag a reviewed episode's match, then unlink another's; confirm each
  returns to the unreviewed queue.
- Run a per-show sync and confirm prior records read as stale and the coverage line's
  "as of sync D" advances.
- Arithmetic check: coverage `Y - X` vs. queue count for one show.

### Not specified (flag before building)
- Whether "reviewed" is per-episode only or also per-episode-per-movie-pair.
- Whether a stale (post-sync) record shows as unreviewed or as a third "re-check" state.
- Who may mark reviewed in a future multi-user setup (admin-only assumed).

---

## Pass U24 — Episode description in match review

### Acceptance criteria
1. Each review row has a collapsed-by-default description control; nothing about row height
   changes until expanded.
2. Expanding renders the stored `podcast_episodes.description` in place (no navigation, no
   new window), HTML stripped or safely rendered — no raw tags, no injected markup.
3. The candidate movie title is visibly highlighted within the description text where present.
4. A link out to the episode's primary source is present and opens in a new tab.
5. Episodes with no stored description show an honest empty line, not a blank panel.
6. Expansion state is per row, independent of other rows, and does not interfere with
   multi-select, pending states or pagination.
7. Long descriptions stay inside the layout on mobile — no horizontal overflow (respects the
   G2 `layout-locked` rule).

### Minimum verification steps
- Browser M: expand a long description → screenshot → confirm no horizontal drag/overflow and
  the title highlight is visible.
- Browser D: expand two rows, select one via multi-select, run an action → expansion does not
  block the action, other rows unaffected.
- Find an episode with a null/empty description and confirm the empty state.
- Confirm the source link's `target="_blank"` and correct URL for one row.

### Not specified
- Whether the description is truncated with a "show more" at some character count.
- Whether highlight covers only the exact title or also alternate/normalised forms.

---

## Pass U4 — Per-podcast matcher tuning

### Acceptance criteria
1. Named strategies exist as separately selectable units (clean-title, year-aware,
   noisy-title + description, actor/name corroboration, special-word suppression, stricter
   threshold), not new branches folded into one universal scorer.
2. Each show has an assigned strategy with an explicit default; assignment is stored and
   editable from the show curation UI.
3. Resolution/rescan uses the assigned strategy for that show's episodes.
4. "Score the matcher" can score per strategy (and per show) against existing approved and
   rejected labels, showing precision/recall-style output per strategy.
5. Changing a show's strategy does not alter existing `confirmed` links, and never
   resurrects rejected pairs.
6. Default assignment reproduces today's matcher output on a sample of episodes (no silent
   global behavior change).
7. Adding a future strategy requires no edits to the other strategies' scoring code.

### Minimum verification steps
- Score the matcher before the change; re-score after with all shows on default; confirm the
  headline numbers are unchanged.
- Assign a noisy-title show (e.g. How Did This Get Made) to the description strategy;
  re-resolve that show only; compare its proposals before/after.
- SQL: confirm confirmed links and rejection records untouched for that show.
- Browser D + M: strategy selector visible and persists across reload on the show row.

### Not specified
- Whether strategy assignment is manual only or suggested automatically from label data.
- Whether a show can stack multiple strategies or exactly one.

---

## Pass P — Richer movie detail (cast)

### Acceptance criteria
1. Migration adds a cast cache (movie id, person id, name, character, billing order,
   department/role for director) with GRANTs, RLS and public read policy as needed by the
   consumer app.
2. Enrichment fetches TMDB credits and stores top-billed cast plus director; re-running is
   idempotent (no duplicate people per movie).
3. Movie detail shows top-billed cast and director, with an external link out for deeper info.
4. Movies with no cached credits render the page unchanged — no empty section, no error.
5. Cast fetch failures do not fail the whole enrichment batch; skip reasons are reported like
   other ingest buckets.
6. Layout holds on mobile: names wrap, no horizontal overflow.
7. Cast data is queryable by movie for U23 (top 3 billing order retrievable).

### Minimum verification steps
- Enrich a small batch; SQL-count cast rows per movie; re-run and confirm counts are stable.
- Browser M + D: `/movies/<slug>` for an enriched movie shows cast + director; a
  non-enriched movie renders cleanly.
- Screenshot mobile detail page for overflow.
- Confirm the ingest summary reports credit-fetch skips/failures honestly.

### Not specified
- How many cast members to display (assume top 3-8, confirm before building).
- Whether cast is clickable (Pass N covers person pages) — assumed plain text + external link.

---

## Pass U23 — Cast-mention signal in the matcher

**Blocked on Pass P.** Do not start until cast data is cached and P is verified.

### Acceptance criteria
1. Matching adds a deterministic `castMention` signal: a top-3 billed actor name found in
   the episode title or description (word-boundary match, accent/case normalised).
2. No AI and no network calls in the matcher path; cast names come from the cache.
3. The bump is modest and cannot alone push a weak/common-word/short title above the
   review threshold without other corroboration.
4. A cast mention counts as corroboration for common-word and short-title suppression rules
   (equivalent standing to a year match), by explicit rule rather than by score inflation.
5. `castMention` is stored on the link's signals and appears in the match reason text.
6. Single-name collisions (common surnames, actor names that are also words) do not create
   false positives — full-name match required, or corroboration.
7. Score the matcher shows the signal's correlation with approved vs rejected labels; overall
   precision does not drop versus the pre-change run.
8. Rejected pairs stay rejected; confirmed links unchanged.

### Minimum verification steps
- Direct matcher run (node/bun script) over crafted cases: actor named in title, actor named
  in description, surname-only mention, actor name that is also a common word.
- Score the matcher before and after; compare precision/recall on existing labels.
- SQL: spot-check that new links carry the `castMention` signal and readable reason text.
- Confirm a common-word title with only a cast mention still lands below auto-link threshold.

### Not specified
- Whether directors also count as a mention signal (assumed no for this pass).
- Exact bump size — to be chosen from the scorecard, not guessed, and recorded when built.
