# U40 — Podcast Show details admin workflow: reconcile, split, accept

Created: 2026-09-20 (America/Los_Angeles)
Mode: PLAN / RECONCILE / ACCEPT — no product code in this turn. Approving this plan means the
roadmap is rewritten as described below (docs only); each sub-pass is built later on explicit BUILD.

## 1. What U40 already delivered (close these out of the open scope)

| Already shipped | Evidence |
| --- | --- |
| Movies / Episodes segmented toggle, defaulting to Episodes | U40D, shipped 2026-09-14, VERIFIED |
| Header "Active" replaced by "Last episode: …" with the <6mo / ≥6mo formats | shipped 2026-09-07, VERIFIED 2026-09-09 |
| Episode → link a specific existing movie, reusing the one picker (catalogue search + IMDb bring-in) | U64 "Add movie" on link-less episode cards, shipped 2026-09-17 |
| Confirm / Flag inline on each relationship row; reviewed / not-about-a-movie with undo | U38 + U53 + U64 |
| Keeping your place across list → detail → list (search, match, review, sort, loaded count, tab in the URL) | U90, shipped/VERIFIED 2026-09-19 |

So U40's items A (partially), the header reconcile, and a large part of "don't lose my place" are done.
U40 must stop being one L-sized open blob; the remainder is four small, independent pieces.

## 2. What is genuinely still missing

1. **Add another movie.** The picker only appears when an episode has zero links. An episode that already
   has one or more links offers no way to append a second — exactly the double-feature/franchise case.
2. **Relationship row typography.** A movie card's episode row still renders `2024-09-01: Title (42m)` —
   raw ISO date, colon, parenthesised duration. This is the "wall of punctuation" complaint (with U51B).
3. **Context while deep in the list.** Once the show header scrolls away there is no Back or show name;
   the only way back is scrolling to the top. No jump links, no floating button — user already ruled those out.
4. **Conditional loading for the toggle.** The toggle switches views over one payload; the episode-heavy
   data is fetched even in Movies mode. This is a fan-out/payload concern, already owned by U89.

## 3. Recommended split

### U40E — Add another movie (append) — S
Surface the existing picker on episodes that already have links, labelled **Add another movie**, placed on
the same row group as the links rather than replacing the link-less empty state. Append only: never deletes,
replaces, or reorders existing links; existing Confirm/Flag/reviewed semantics untouched. `is_primary_subject`
and coverage roles stay with U2 — U40E writes the same default relationship shape the current path writes.
Boundaries: one picker component only (`RelinkPicker`), no second relationship subsystem, no bulk add.
Depends on: U64 (done). Acceptance: on an episode with one link, adding a second leaves the first intact and
both render without refresh; snackbar names the movie; label reads "Add another movie" when links exist and
"Add movie" when none; no change for non-admins. Confidence: High.

### U40F — Relationship row information hierarchy — S
Recommended treatment (one of the roadmap's listed alternatives): episode title on the primary line, date and
duration as small muted metadata on a secondary line, date formatted `2024 Sep 1`. Keeps the date (titles often
equal the movie title, so title-only reads as duplicated data) without the `YYYY-MM-DD: … ( … )` punctuation.
Applies to the episode rows inside movie cards and the equivalent rows on movie detail — one shared part, not
per-route copies. Absorbs the U51B date-format note. Boundaries: presentation only, no data or query changes.
Acceptance: no ISO dates or parenthesised duration in relationship rows; row height unchanged or lower at 390px;
one component definition. Confidence: High.

### U40G — Sticky show context while scrolling the episode list — S/M
A compact contextual bar (Back + show name only) that appears **after** the main show header scrolls out of
view and disappears at the top of the page, so the normal hierarchy is preserved on arrival. Reuses the existing
`BackLink` history behaviour — no second navigation system, no jump-to-top links, no floating action button.
Boundaries: show detail only; not applied to other routes in this pass. Acceptance: bar absent at scroll top,
present deep in the list, Back behaves exactly as today, no layout shift or overlap at 390px and 1280px.
Confidence: Medium (the appear/disappear threshold needs one design pass in-app).

### U40H — Conditional data loading for the Movies / Episodes toggle — merge into U89
Do not build this under U40. The episode payload weight and read fan-out are U89's measured scope; splitting it
here would create a second owner for the same reader. U40 records the dependency and defers.

### Explicitly NOT built yet
Bulk episode selection and bulk actions (the URL list state from U90 plus these four pieces should be measured
first — bulk select is the largest change and may be unnecessary once scroll-loss is gone); coverage roles and
ordering (U2); "relationship set incomplete" signal (U66 — unblock it once U40E ships, since the answer depends
on the append flow existing); any change to the consumer-facing show experience.

## 4. Roadmap edits this approval authorises (docs only)

- Rewrite the U40 entry as a short parent that lists what shipped, then the four children above with effort and
  confidence; remove the now-satisfied "deliver a UX exploration" instructions.
- Mark the U40 exploration itself CLOSED — this plan is that deliverable.
- Change U66 from "BLOCKED on U40" to "BLOCKED on U40E".
- Note under U89 that U40's conditional-loading question is folded into it.
- Add the U51B cross-reference to U40F.
- Touch nothing else in the roadmap.

## 5. Effort summary

U40E S, U40F S, U40G S/M, U40H none (merged). Total M (~3-5 credits) if all three are built together,
versus the old L (~6-10) blob. Recommend building U40E + U40F first — they are the repeated-work wins.
