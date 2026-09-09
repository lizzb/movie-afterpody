# PLAN (backlog only) — eight filings, reconciled

Created: 2026-09-09
Mode: PLAN. No code, schema, or UI changes this turn. Approving this plan files these items into `.lovable/roadmap.md` and stops.

Highest ID currently in use: U63. New IDs below start at U64. Existing owners referenced: U40 (podcast show details admin workflow), U53 (review confirms links), U38 (relationship action cleanup), U42 (shared UX consistency), U52 (large-result browsing), Pass L (scheduled refresh), Pass X (leaving-soon windows), J2 (dedicated episode pages — stays out of scope).

## Facts checked before filing

- `logMatchAction` writes to `match_actions` for: approve/link, reject, unlink, relink, confirm, and `not_about_a_movie`. `setEpisodeReviewed` (mark reviewed / reopen) writes only `episode_reviews` and logs nothing. Undo of retirement also does not log a distinct event. So the user's suspicion is correct: "not about a movie" appears in Recent match decisions; review/reopen does not.
- Availability today is bulk-only: `refreshAvailability` takes a `limit` plus optional `staleBefore`, drains a staleness-ordered queue of movies with a TMDB id, writes providers/genres and stamps `availability_checked_at`. There is no single-movie entry point and no Tonight-side freshness gate.
- `/podcasts/$slug` renders movie-focused and episode-focused sections with client-side search/filter/sort and "Show more" caps (150 episodes, 70 movies), so cross-section jumps can target rows that are filtered out or not yet rendered.
- Episode retirement removes all links and undo restores them; nothing currently prevents retiring an episode whose links are confirmed.

---

## Pass U64 — Episode card status truth: "Not about a movie" badge and retirement guards — M (~3–5)

Owner: extends U38 (relationship action cleanup) on the Podcast Show Details episode card. Not a duplicate of U53.

Scope
- Show a lightweight "Not about a movie" icon+badge (non-interactive), floated right on the "No movie linked yet" line, whenever the episode disposition is `not_about_a_movie` — including when the episode is also reviewed and only "Reopen" is offered.
- Episode with no links: keep the "Reopen"/"Mark episode reviewed" and "Not about a movie" action buttons in the lower-right; add an "Add movie" action reusing the existing "Pick another movie" picker from Unmatched episodes / Match review (no new picker).
- Retirement guard: if any current link is confirmed, block turning "Not about a movie" on and explain that links must be unconfirmed first. Unconfirmed/flagged/proposed links continue to be removed on retire and restored on undo.
- Confirm/Flag icon buttons on link rows stay visible regardless of reviewed state (already true; verify).

Reuse: `EpisodeAdminActions`, `ConfirmMatchButton`/`FlagMatchButton` styling tokens, `retireEpisode`/`undoEpisodeRetirement`, existing movie-picker control.
Dependencies: none hard; sequence after U53 to avoid conflicting edits in the same card.
Acceptance: badge appears for every retired episode in all four states listed by the user; retire is refused with a visible message when any link is confirmed and succeeds otherwise; undo restores exactly the removed links; "Add movie" links a movie from the card; no change to admin Active/Parked semantics.
Verification: signed-in admin on `/podcasts/$slug` at mobile and desktop widths, each of the four episode states.

## Pass U65 — Link related episodes (multi-part / re-release) — M (~3–5)

Scope: a symmetric episode↔episode relation (no relationship type in V1), admin-created, surfaced on the Podcast Show Details episode card as a short "Related: <episode title>" line. Example: "Blank Check (1994) — Re:Issue" ↔ "Blank Check (1994)".
Data: one new join table with an ordered-pair uniqueness rule and admin-only write policy; canonical catalogue data, not user data.
Dependencies: benefits from U40's episode admin surface; can ship standalone.
Acceptance: an admin can link and unlink two episodes of the same show; both cards show the relation; deleting one side removes both directions; no effect on matcher, coverage counts, or review queues.
Risks: keep it out of Commentary Score for now — dedupe/weighting is a later question.

## Pass U66 — "Relationship set incomplete" signal — M (~3–5) — BLOCKED on U40; NEEDS DESIGN

Scope: an episode-level marker meaning "I know a movie is missing here", so review effort is not repeated. Explicitly NOT reuse of `FlagMatchButton`, which requires a movie id and means "this pairing is wrong".
Pre-work required before building: evaluate whether existing tools already cover it (leaving the episode unreviewed, U27 goal-directed review, notes) and whether the marker should be a state on `episode_reviews` rather than a new queue.
Acceptance (pre-build): a written decision on whether this earns a new state at all; if yes, one admin-visible filter, no second review queue, and a defined way the marker clears when a link is added.

## Pass U67 — Single-title streaming availability recheck — S (~1–2)

Parent concept: availability freshness (with U68). Owner: existing availability architecture; no second system.
Scope: a targeted server function that refreshes providers for one movie by id, reusing `refreshAvailability`'s provider fetch, service mapping, availability write path and `availability_checked_at` stamp. On Movie Details, next to the existing "Availability checked X ago" text, a small icon button / text link "Recheck streaming status" that refreshes that movie and updates displayed availability and freshness.
Open decision to settle at build time: who may trigger it (admin-only vs any signed-in user) and the per-user rate limit; default proposal is any signed-in user, one recheck per movie per 10 minutes, admin exempt.
Provider implications: one TMDB watch-providers call per press; negligible against the bulk job.
Failure semantics: on provider error or missing TMDB id, keep existing availability, leave `availability_checked_at` unchanged, show a plain error.
Acceptance: pressing the control updates providers and the freshness label for that movie only; repeat presses inside the window are refused politely; no change to the bulk job's queue behaviour.
Verification: Movie Details on mobile and desktop, before/after freshness label, plus a database check that only that row's timestamp moved.

## Pass U68 — Tonight availability freshness — M (~3–5) — depends on U67

Scope: Tonight must not knowingly present materially stale availability. Recommended architecture, smallest sound version: rank as today → take the bounded candidate pool that feeds the final short list → refresh only candidates whose `availability_checked_at` is older than the freshness window (proposed 24h for the final pool, with a hard cap of N provider calls per request, proposed N=10) → finalise the list from refreshed data. Candidates that cannot be refreshed within the cap are either shown with an explicit "availability last checked X ago" note or dropped — pick one at build time, do not silently show them as fresh.
Reconcile with: Pass L (scheduled refresh) — if L lands first, the on-request refresh shrinks to a small top-up; Pass X (leaving-soon) shares the same freshness data; L2b server-ranked Tonight owns the candidate pool.
Provider/rate-limit implications: bounded per request; add a server-side short-lived cache so repeated Tonight loads in the same window make no new calls.
Failure semantics: provider outage degrades to today's behaviour plus an honest freshness note; Tonight never fails to render because of availability refresh.
Acceptance: every title in the final Tonight list either has availability checked within the window or carries a visible freshness note; provider calls per Tonight load stay at or under the cap; Tonight warm load stays within the current stability target.
Verification: instrumented count of provider calls per load, a forced-stale fixture, and a provider-failure path.

## Pass U69 — Episode-title jump from movie-focused cards — S (~1–2)

Scope: on `/podcasts/$slug`, selecting the episode title inside a covered-movie card's relationship row scrolls to and briefly highlights that episode's card in the "All episodes" section. Movie title and poster keep navigating to Movie Details. No dedicated episode page (J2 stays out).
V1 behaviour for hard cases: the jump first clears the episode filter/search, forces the episode-focused section open, expands "Show more" until the target index is rendered, then scrolls with a short highlight. If the episode still cannot be located, do nothing visible except a brief "couldn't find that episode in the list" note.
Dependencies: interacts with U52 (pagination UX) — if U52 replaces "Show more", the jump must move with it.
Acceptance: jump works from a movie card with the filter active, with the target beyond the initial cap, and under each sort order; existing movie-title and poster navigation unchanged.
Verification: signed-out user on mobile and desktop.

## Pass U70 — Audit "Recent match decisions" coverage and naming — S (~1–2)

Scope: audit only, then the smallest V1 change. Findings already established above: relationship actions (approve, reject, unlink, relink, confirm) and `not_about_a_movie` are logged; mark reviewed, reopen, and undo-retirement are not. Bulk paths log per row where they go through the same helpers — confirm this per path during the pass.
Deliverable: a short written statement of what the section represents, plus a recommendation on renaming (only if the audit shows the content is genuinely broader than match decisions) and on whether episode review/reopen events belong in `match_actions` or should stay as current-state in `episode_reviews`.
Architectural line to hold: `episode_reviews` = current state; `match_actions` = historical decisions. No second audit system.
Acceptance: the audit lists each action with logged/not-logged status and where its timestamp comes from; a recommendation exists for undo events, reopen events, bulk actions, and relationship vs episode-level grouping; any rename is justified by content, not wording taste.

## Pass U71 — Episode review events in the activity history — M (~3–5) — depends on U70

Scope (only if U70 recommends it): log mark-reviewed, reopen, and undo-retirement as historical events in the existing `match_actions` model, and render them in the same chronological list with episode-level styling distinct from relationship rows. Undo entries stay as they are today (an action marked undone), not as new synthetic events.
Acceptance: performing each of the six episode/relationship actions produces exactly one correctly labelled, correctly timestamped entry; bulk actions produce one entry per affected episode; existing undo of relationship decisions still works; no duplicate entries for a single action.
Verification: signed-in admin performing each action once and reading the list.
