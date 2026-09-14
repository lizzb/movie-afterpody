# PLAN (backlog only) — 11 filings

Created: 2026-09-14 (Pacific)

Backlog filing only. No code, schema or UI changes this turn. Each item names its existing
owner, dependencies, acceptance, and a complexity/effort band (S 1-2, M 3-5, L 6-10, XL 10+).
Two items are answered as recommendations (5, 6) as requested.

---

## 1. Filter entry clarity — extends **Pass U37**, no new pass — M, confidence Medium

Inspection: `src/components/FilterBar.tsx` uses the switchboard icon in three places (panel
header, genre badge, inline chip) and the persistent button is dual-purpose: it reads
"Apply filters (N changes)" or "Filters applied" and commits rather than opens.

Filed as **U37-A "Filter entry point"**, a build-ready sub-item of U37 (U37's live-count half
stays blocked on D4 measurement; this half is not blocked):
- Outer persistent control always opens Filters & Sort. Labels: `Filters` / `Filters · N active`,
  where N counts applied filters, not pending edits. Icon: switchboard.
- Panel primary control commits: `Show N matches` when a count is available, otherwise
  `Apply filters`; disabled/neutral when nothing is pending.
- Remove the switchboard icon beside "Tonight's Parameters" and "Movie Filters".
- Genre badge icon becomes drama/comedy masks (`Theater` in lucide).
- Remove the trailing "NNN matches" readout from the on-page Tonight parameter block.
- Pre-build check (required): Tonight exposes several controls inline; confirm those still have a
  reachable commit affordance after the outer button becomes open-only. If not, the inline block
  keeps its own `Show N matches` commit button and only the outer control changes.

Dependencies: none hard. Overlaps D4 (Apply removal) — D4 may later delete the commit step
entirely; U37-A must not pre-empt that decision. Acceptance: single obvious entry point on
Tonight and Movies at 390px; outer label reflects applied state only; icons as specified; no
duplicate match count on the filter block; staged/commit behaviour unchanged inside the panel.

## 2. Minimum commentary score filter — **Pass H4** absorbs it, no new pass — S, Medium

H4 already owns "best-only / minimum Commentary Score" and deliberately deferred a default
minimum pending score-distribution measurement. Update H4 rather than filing a new item:
compact popover `Min score: Any ▾` with Any / 25 / 50 / 75 / 90 only — no finer granularity.
Movies default Any; Tonight default 50. Dependency: confirm from live data that 50 leaves a
useful Tonight result set before shipping the Tonight default; if it starves results, ship Any
on both and revisit. Acceptance: control appears in advanced filters on both surfaces, persists
with other prefs, counts toward the `Filters · N active` total from item 1.

## 3. Episode-card reuse (Listen Later) — new **Pass U81**, owner of episode-card reuse — M, Medium

Fact: `/podcasts/$slug` renders a shared episode card with listened state, rating, quality,
Listen, platform badges and `EpisodeNotesFooter`. `src/routes/lists.index.tsx` (~lines 205-280)
renders Listen Later with its own bespoke row. K5/K6 established shared card primitives but
never migrated Lists.

U81: extract the podcast-page episode card into one exported shared component and render it in
Listen Later and on movie detail, with a documented compact variant for dense contexts. No
second episode-card system; no card redesign. Remove-from-Listen-Later stays as an
upper-right control on the shared card. Acceptance: one component file is the only definition;
Listen Later shows listened + rating controls and they write through `prefsActions`; a styling
change made once is visible on all three surfaces; podcast page visually unchanged.
Dependencies: none. Complexity driver: three call sites with different available data (movie
context vs podcast context) — the variant contract is the real work.

## 4. Watchlist movie card consistency — extends **Pass U42**, no new pass — Effort: S; Confidence in estimate: High

Inspection (`lists.index.tsx` ~lines 160-190): the watchlist row prints `{title} · watched`
inside the same bold title span, and omits the release year, while Watched history prints
`Title (Year)` with the year muted. Filed as **U42-E**: year adjacent to title in the muted
convention used elsewhere; watched becomes a separate muted marker or badge, not title text.
Acceptance: watchlist rows match the history/movies-card year convention; watched is visually
subordinate; no new styling convention introduced. Note: if U81 lands first, these rows should
inherit the shared movie-card grammar instead of being patched locally.

## 5. Listening History badge grammar — recommendation, then **U42-F** — S, High

Inspection: the listened badge is fixed neutral (`bg-secondary`, muted text, headphones icon);
the rating badge is tinted with the **podcast's accent colour** via `accentSoft(podcast.accent)`.
So today's colour difference carries no rating semantics at all — a loved episode and a disliked
one on the same show are the same colour, and the same rating on two shows differs. That is
arbitrary, and it is misleading because tinted badges elsewhere read as meaningful.

Ownership: **U42** (badge grammar), not E2 — E2 is specifically Commentary Score formatting and
these badges are not scores. Recommendation for U42-F: status stays neutral+icon; rating maps to
sentiment (negative / neutral / positive tokens) so colour means the same thing everywhere;
podcast accent is used only for podcast identity, never for user judgements. Acceptance: a
written badge-grammar rule plus both badges conforming. No code this turn.

## 6. Watchlist filtering — recommendation + new **Pass U82** — S, Medium

Recommendation: keep it local to the watchlist. Two segmented toggles on each watchlist —
"On my services" and "Unwatched" — both derivable from data already loaded there
(`watchableCount`, `watched`), so no server or schema work. Reject exposing watchlist membership
as a general catalogue filter: it adds a choice to every browse surface to solve a problem that
only exists inside a list, against the choice-absorption principle. Acceptance: toggles filter
in place, show a truthful count, persist for the session, and do not re-sort the list mid-tap.

## 7. User movie ratings — new **Pass U83** (NEEDS DESIGN resolved) — M, Medium

Existing model: episodes use three-way `EpisodeRating` (`disliked` / `meh` / `loved`) plus
`ListeningStatus`, stored per-slug in prefs. Recommendation: reuse exactly that shape for movies
— 😞 / 😐 / 😊 as `MovieReaction = disliked | meh | loved`, one tap, reversible, placed beside
the existing watched control on movie detail and in Watched history. Rejected: stars (false
precision, higher decision burden, no analogue in the app), two-thumb variants (novel grammar
for the same three-way signal).

V1 is local-first in `prefsActions` alongside existing prefs, keyed by movie slug, with an
optional watch-date association. Future extension points to record now: per-rewatch reactions,
free-text notes, and account sync (rides on L2c-2's account taste store). Acceptance: rate and
clear from movie detail and history, survives reload, appears nowhere as a hard filter.

## 8. Ratings in Tonight ranking — new **Pass U84**, depends on U83 — M, Low

Bounded deterministic V1: derive a small taste vector from rated + watched movies (genre
affinity and decade affinity only), then apply it as a capped multiplicative nudge to the
existing Tonight ordering — not to the Commentary Score itself, and never as a filter. Ceiling
must be small enough that a strongly-liked genre can move a movie past a slightly better-covered
one but cannot outrank coverage by preferred podcasts. Confidence Low: the exact cap has to be
measured against the real distribution before implementation, so step one is measurement.
Acceptance: with ratings cleared, Tonight order is byte-identical to today; with ratings present,
order changes but every result still satisfies the active filters; the reason string names the
taste contribution when it applied.

## 9. Search "Recent match decisions" — extends **Pass U70/U71**, no new pass — S, High

`MatchHistoryCard` fetches a fixed window (`limit: 40`) with no search, which is exactly the
reported failure: older decisions fall out of the window. Filed as **U70-B** (build item under
the existing history ownership, executed after U70's audit so naming/coverage is settled first):
server-side search over movie title, podcast name and episode title, plus a date filter, over
the whole `match_actions` history rather than the loaded page. No second history system; U71
stays the owner of which event types appear. Acceptance: searching "blue" returns matching
decisions older than the current window; results keep undo working; empty-result and
searching states are explicit; the unfiltered default view is unchanged.

## 10. Remove show-card descriptions on Podcasts index — extends **U42** — S, High

`src/routes/podcasts.index.tsx` (~line 228) renders a description preview per card. Filed as
**U42-G**: remove it, do not backfill the space, let cards get shorter so more fit per screen.
Full description stays on show detail. Acceptance: no description text on index cards at 390px;
more cards visible above the fold; show detail unchanged.

## 11. Streaming sync control labels — new **Pass U85** — S, High

Inspection: the three run buttons are `disabled={action.pending}`, so during "Syncing…" only
"Stop after this batch" is actionable. That is intended behaviour, not a bug — the labels just
don't say so. Relabel: `Sync up to 400 stale movies` (already correct) / `Sync 80 stale movies`
(was "Just 80") / `Sync all stale movies` (was "Run until done"); while running, disabled
buttons should read as unavailable rather than merely dimmed, and Stop stays the only live
control. Add a definition of "stale" to the info copy — but verify the real threshold in the
freshness query first; the panel currently shows "Never checked" and "Older than 7 days", so the
copy must state the actual rule rather than assume 7 days. Acceptance: every label describes its
scope; a first-time reader can predict each button; the stale definition matches the code.

---

## Roadmap edits this filing implies

New: U81 (episode-card reuse), U82 (watchlist filtering), U83 (movie ratings), U84 (ratings in
Tonight), U85 (sync labels). Extended, not duplicated: U37 (+U37-A), H4 (min score),
U42 (+E watchlist card, +F badge grammar, +G show-card description), U70 (+B search).
No item creates a competing filter, card, history or preference system.
