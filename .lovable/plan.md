# PLAN (backlog only) — three filings

Created: 2026-09-07
Mode: PLAN. No code changes. Approving this plan files these items into `.lovable/roadmap.md` and stops.

---

## A. Pass U53 — "Mark episode reviewed" confirms the episode's current links — M (~3–5)

### 1. Is the behaviour logically safe?

Yes in principle — with one hard condition. Episode review already means "I certify this episode's coverage", and link confirmation means "this pairing is correct". Those are the same human judgement, so folding them together removes a real double-entry burden. It is only safe where the surface the button sits on actually shows the episode's whole link set, and where the write re-reads the database instead of trusting the rendered page.

### 2. Edge cases that make automatic confirmation unsafe

1. **Partial-context surfaces.** A movie-detail episode card shows one movie, not the episode's full link set. U38 already removed the episode review button there (`includeReview={false}`) — that decision becomes a load-bearing safety rule, not a cosmetic one, and any future placement must satisfy it.
2. **Bulk "mark reviewed"** in Match review can cover many episodes at once. Mass-confirming links the admin never looked at is the biggest danger in this proposal.
3. **Open flags.** An unresolved flag on one of the episode's links is an explicit "this is wrong" — silently confirming it would overwrite a wrong-match state.
4. **Concurrency / staleness.** A sync, rescan or another admin can add a `proposed` link between page load and the click; that link was never on screen.
5. **Retired episodes** ("not about a movie") have no links to confirm; the operation must be a clean no-op.
6. **Already-confirmed links** must keep their original `reviewed_at` / `reviewed_by`, not be rewritten.
7. **Reopen must not un-confirm.** Reopening an episode returns it to the queue; it must not touch link state.

### 3. Recommended exact semantics

`setEpisodeReviewed({ reviewed: true })` becomes, per episode, one server-side transactional step:

1. Read the episode's **current** `episode_movies` rows from the database at click time (never from client input).
2. Read open (`resolved_at is null`) `episode_link_flags` for that episode.
3. **Refuse** with an actionable message when any current link carries an open flag: "Resolve the flagged link first." No review record, no confirmations.
4. Otherwise set every non-`confirmed` current link to `confirmed`, stamping `reviewed_at`/`reviewed_by`; leave already-confirmed links byte-identical.
5. Write/upsert the episode review record exactly as today.
6. Zero links → review record only, always allowed.
7. Client passes an optional `expectedLinkIds` snapshot of what it rendered. A mismatch aborts with "This episode changed — reload before signing off." (Confirms only what was seen; covers concurrency.)
8. `reviewed: false` (Reopen) is unchanged — it never alters link state.
9. **Bulk path:** confirm-on-review applies only to single-episode sign-off. Bulk mark-reviewed keeps today's review-only behaviour, or gains a separate explicit "…and confirm their links" opt-in. It never mass-confirms by default.
10. Never creates links, never touches `episode_match_rejections`, never runs matching, never writes movie rows.

Note the existing trigger `episode_review_stale_on_flag` already reopens a review when a link is later flagged, so the reverse direction stays consistent.

### 4. Estimate

**M (~3–5 credits).** One server function, one flag pre-check, a snapshot guard, a toast/refusal path, plus targeted cache invalidation. No migration needed.

### 5. Acceptance criteria / verification

- Single-episode sign-off confirms all current non-confirmed links, in DB, verified by query.
- Already-confirmed links keep original reviewer/timestamp.
- Episode with an open flag: refused, nothing written (review record absent, links unchanged).
- Zero-link episode: becomes reviewed.
- Retired episode: no-op on links.
- Stale snapshot: aborts with a reload message; DB untouched.
- Rejections table row count unchanged before/after; no new `episode_movies` rows; no `movies` writes.
- Reopen leaves confirmed links confirmed.
- Bulk mark-reviewed does not confirm links unless explicitly opted in.
- Verified in a signed-in admin session on the podcast-detail episode list and the Unmatched/Match review episode cards; classify each item Verified / Implemented, not verified / Deferred.

---

## B. Pass U54 — Show curation card: sync-status clarity, "Current" filter, mobile layout — M (~3–5)

### 1. What "never synced here" means (determined from code)

- **"here" = this app's database.** The string renders only when `podcasts.last_synced_at` is null (`admin.ingest.tsx` line ~1301, fed by `lastSyncedAt` in `listPodcastCoverage`).
- `last_synced_at` is written in exactly one place — the feed sync path (`ingestion.functions.ts` line ~442). Any other route to stored episodes (earlier imports/backfills predating that write) leaves it null, which is how a show can hold episodes and still read "never synced here".
- It says **nothing** about the provider updating its feed.
- Three independent concepts, currently rendered close together and easy to conflate:
  - **stored** = episode rows we hold (`own.length`).
  - **feed total** = `podcasts.episode_count`, the provider's reported count from the last metadata read.
  - **last synced** = when *we* last ran a feed sync.
- Recommended wording: "Feed not synced in this app yet" instead of "never synced here".

### 2. Inline placement

Move the sync date / not-yet-synced phrase onto the `XXX stored / XXX in feed · complete` line, since it is feed-sync status. Leave the episode-review line as "Reviewed N of M episodes". No wider card redesign.

### 3. New status word + pill filter

Recommended word: **Current** (alternatives: "Caught up", "Settled"). It does not collide with episode-level "reviewed".

A show is **Current** when all three hold:
1. `stored >= feedTotal` (the existing `complete` condition, `incomplete === false`);
2. `episodesUnreviewed === 0 && stored > 0` (the episode-level count, not `fullyReviewed`);
3. `last_synced_at` is non-null and `now - last_synced_at < 7 * 24 h` (rolling 168 hours, UTC, computed server-side and returned as a boolean so the client never re-derives it).

Null `last_synced_at` can never qualify.

**Documented discrepancy:** `fullyReviewed` (line 1733) does **not** mean this. It is link-level — `stored > 0 && awaitingReview === 0 && unmatched === 0` — and ignores episode review records and sync recency entirely. The filter must not reuse it, and this pass must not redefine it.

Pill filter: All / Current / Needs attention (the complement), alongside the existing curation controls.

### 4. Mobile layout

Current row is one `flex-wrap` line with a five-line text block and four pill buttons in a second wrap group, so on narrow screens the buttons wrap awkwardly and the text squeezes. Proposed restructure, which the current markup supports without a redesign:

- Header row: artwork, title, **Park/Re-activate** floated right.
- Status block, full width: `stored / feed · complete` with the sync phrase inline and **Sync episodes** right-aligned on that line.
- Matcher label + select directly beneath the status line.
- Footer row: **Recheck episodes** and **Build movies**, `flex-wrap`, stacking full-width under ~360 px.

Constraint to respect: the buttons carry live status text ("Queued…", "Rechecking…"), so widths change during runs — use `min-w-0`/`flex-wrap` rather than fixed columns. Verify at 390 px and 320 px.

### Split rule
Ship as one pass; only split if item 4 alone exceeds its band (then U54a = wording + inline + filter, U54b = layout).

### Acceptance
Wording changed and inline; `Current` computed server-side per the three conditions with the 168-hour boundary; pill filters the list deterministically; "never synced" shows never qualify; `fullyReviewed` semantics unchanged; no card content clipped or overflowing at 320/390/desktop; no changes to matching, review, or curation behaviour.

---

## C. Pass U4A — Cast-based actor-name corroboration strategy — M (~3–5) — BLOCKED on Pass P + U23

Filed as written in the request: after P and U23 are verified, point U4's `actor_corroboration` strategy at U23's existing `castMention` signal, reusing that logic and cached cast data only (no matcher-time network calls). Preserve existing strategy assignments and the `clean_title` default; changing a show's strategy must not modify confirmed links or resurrect rejected pairs; effect limited to future resolve/recheck through the existing U4 path; evidence via "Score the matcher" before wider assignment. Non-goals: cast ingestion (P), `castMention` implementation (U23), automatic assignment, broad replay.

Also update the U4 roadmap entry so "actor/name corroboration" is described as year/description corroboration only today, with true cast-based behaviour arriving in U4A.
