# Match Review UX, list-jump diagnosis, filter feedback (backlog only)

Created: 2026-09-02

No application code changes in this pass. Everything below is filed as backlog.

## Pass U32 — Verify single-row unlink like bulk unlink — S (~1-2 credits)

Adjacent observation recorded during U12 verification, not a U12 gap: bulk unlink now reads
back the database per pair and reports which deletions actually landed, while the single-row
path in `relinkEpisodeMovie` deletes and assumes success. Scope: apply the same
delete-then-verify pattern to the single-row unlink/relink path, return per-pair ok/failed,
and restore the row plus show an error toast when the delete did not persist. Acceptance: a
forced failing delete leaves the row visible with an explicit error instead of silently
disappearing and returning on refresh.

## Pass U33 — Bulk action button visual states — S (~1-2 credits)

Bulk buttons must read as the same control family as row actions, with the same
"which one did I press?" honesty.

Intended states (bulk buttons, same icons/shape/type scale as today):

| Action | Idle | Hover / focus | Pressed + saving | Disabled |
| --- | --- | --- | --- | --- |
| Approve / Confirm selected | green text, muted grey fill | green text, slightly stronger grey fill | white text, green fill (held for the whole operation) | greyed text, muted fill |
| Unlink / Reject selected | red text, muted grey fill | red text, stronger grey fill | white text, red fill | greyed text, muted fill |
| Not about a movie (selected) | amber text, muted grey fill | amber text, stronger grey fill | white text, amber fill | greyed text, muted fill |

Rules: only the pressed action may show a filled colour; unpressed siblings stay
text-on-grey and become disabled (never filled) during the operation; the filled state
carries the spinner and persists until the operation resolves, then returns to idle.
All colours come from existing semantic tokens — no new hardcoded colours.
Acceptance: with a bulk approve in flight, a screenshot shows exactly one filled button and
it is the one that was pressed; the same holds for reject and not-about-a-movie.

## Pass U34 — Mobile action-button sizing — S (~1-2 credits) — NEEDS DESIGN APPROVAL

Grow Match Review row and bulk action buttons roughly 20-30% on mobile (coarse pointer /
under 768px) without changing desktop. Before implementation, present 2-3 rendered options
for approval, e.g. (a) same layout, larger padding and icon, ~44px tall; (b) icon-forward
buttons with the label under the icon; (c) full-width stacked action rows with generous
separation. Each option is shown at 390px against a real row. No unilateral final choice.

## Pass U35 — Mobile Match Review scanning flow — M (~3-5 credits) — NEEDS DESIGN EXPLORATION

Problem: each row is tall, so reviewing many matches becomes scroll → select → scroll →
select. Goal is fewer gestures per decision while keeping the evidence legible and
accidental actions unlikely. Exploration only (visual options first, no committed
solution). Directions worth prototyping: a compact/dense row mode that hides secondary
metadata until tapped; a one-at-a-time focus/triage view (one match, big Correct / Unlink /
Not-about-a-movie, auto-advance); grouping by episode so one scroll position resolves all of
an episode's links; sticky per-episode header with actions; pinned action bar that always
stays under the thumb. Constraints for any option: the movie title, year, episode title,
date/duration and confidence must stay visible at decision time; destructive actions keep a
one-tap undo; no drag/swipe-only interaction without a visible button equivalent.

## Pass U36 — Match Review lag and list-jump under the finger — M (~3-5 credits)

**Symptom.** After tapping a row action the row stays busy briefly, then the list changes —
the processed row disappears or reorders — and content shifts under the finger, so the next
tap can hit a different link row. Undo exists but is expensive: remember what was hit,
scroll to Match History, find it, undo.

**Root causes (from the current implementation).**
1. Rows are derived by `rows = useMemo(...)` and filtered with
   `out.filter((r) => !done[r.key] || pending[r.key])`, so the moment a row's pending flag
   clears, the row is removed from the array and everything below moves up. Removal happens
   on completion, i.e. exactly when the user is likely mid-next-tap.
2. The completion also triggers `client.invalidateQueries` on the active key plus a deferred
   fan-out, so a refetched page can insert/reorder rows independent of the local `done` set.
3. Nothing preserves scroll anchoring or reserves the removed row's height, and there is no
   post-action input lockout, so a tap landing 100-300ms after completion is accepted by
   whichever row now occupies that pixel.

**Candidate fixes, smallest first.**
- *Keep decided rows in place* (S ≈ 1-2 credits): on success, leave the row mounted in a
  settled "Confirmed / Unlinked · Undo" state instead of removing it; only drop decided rows
  when the user changes page/tab/filter or presses Refresh. Removes the jump entirely for the
  common case and puts Undo where the mistake happened.
- *Brief post-action input guard* (S ≈ 1-2 credits): ignore pointer events on action buttons
  for ~250-300ms after any list mutation, with no visual "dead" styling beyond the existing
  pending state.
- *Anchor scroll on list change* (S ≈ 1-2 credits): record the top visible row key before a
  mutation and restore its offset afterwards.
- *Generalisable fix* (M ≈ 3-5 credits): a single "review list is stable while you work"
  rule — server refetches never reorder or reflow the visible page mid-session; new data
  lands behind an explicit "N new items — refresh" affordance (already the established
  pattern in the roadmap's list-stability principle).

**Tradeoffs / risks.** Keeping decided rows visible makes queue length feel static and needs
clear settled styling plus an accurate "decided here" count (U13 already tracks this). An
input guard can feel unresponsive to fast reviewers if set too long. Scroll anchoring
interacts with the auto-advance behaviour shipped in U10, so pagination must be re-verified.

**Recommendation.** The architecture points clearly at fix 1 plus fix 2 as the first
increment; anchoring and the general stability rule only if the jump persists.
Acceptance: at 390px, ten consecutive row actions produce zero content shift under a fixed
finger position, and no action is registered on a row the user did not intend.

## Pass U37 — Filter interaction and feedback — M (~3-5 credits) — NEEDS DESIGN

Follow-up from Y2 (Y2's rating range itself is accepted; no behaviour change requested).
Three problems, one theme — the user cannot see cause and effect while filtering:
1. **Delayed cause/effect** — changes are staged behind "Apply filters", so a filter change
   shows no immediate result change. Overlaps Pass D4 (make live filtering fast enough that
   Apply is unnecessary); see the D4 entry, which now carries this context.
2. **Poor visibility of filter impact** — the result count and the list live outside the
   filter panel, so judging a filter's effect requires navigating away. Candidate: a live
   "N movies match" readout inside the panel that updates on the draft (a count-only
   recompute is far cheaper than re-ranking and re-rendering the list), plus a per-control
   hint where cheap (e.g. how many titles the current runtime band keeps).
3. **Advanced filter discoverability** — opening the expanded controls is not obvious.
   Candidate: a clearer labelled entry point with the active-filter summary on it, and
   visible chips for currently applied filters that can be removed in one tap.

Scope this as a design pass first (visual options for the panel entry point, the live count
placement and the applied-filter chips), then implement the chosen direction. The live-count
work depends on D4's measurement, so D4 should be measured before or with U37.
