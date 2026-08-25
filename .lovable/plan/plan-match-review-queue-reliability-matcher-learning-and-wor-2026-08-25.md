# Plan: Match review queue reliability, matcher learning, and workflow documentation

## Goals

- Fix blank episode titles appearing in Match Review for **I Hate It But I Love It** and **The Villain Was Right**.
- Reduce false matches from short/common title words, especially **girls**, **big**, **go**, and **it**.
- Make flagged items actually disappear after bulk unlink/reject/retire decisions.
- Add optional year input to the **Pick another movie** control everywhere it appears.
- Make queue counts and refresh behavior feel finite, predictable, and explainable.
- Document the current admin ingestion/match-review workflows in a separate project file.
- Improve match-review responsiveness and misclick recovery.
- Explain and troubleshoot the persistent **Your Inner Child Is An Idiot** `254 stored / 255 in feed / 1 missing` state.
- Backlog, but do not implement, additional matcher-engine improvements.

## Confirmed findings from the current data/code

- There are blank-title episode rows for the two affected shows:
  - `I Hate It But I Love It`: 1 blank-title episode, currently with 21 links.
  - `The Villain Was Right`: 1 blank-title episode, currently with 35 links.
- Those blank-title rows are linked to many unrelated movies because description matching can still produce high-confidence links when the title is empty.
- The movie **Big (1988)** is especially noisy: it currently has 176 links and 22 recorded rejections.
- There are 68 unresolved wrong-match flags; 4 of those no longer have a matching `episode_movies` link, so they can still show up as flagged even after the underlying link was removed.
- `Your Inner Child Is An Idiot` currently reports 255 in feed and 254 stored. The UI stores only the summarized failure count/message, not enough per-episode detail to identify the missing item.
- Existing links are listed by confidence band, not by a “review completed” flag. Confirming a link changes it to manual/100%, which drops it out of lower-confidence bands; unlink/reject removes the current link; but broader bands can reveal additional links that were already present.

## Implementation plan

### 1. Repair and guard blank episode titles

- Update ingestion so an episode with a blank or whitespace-only title is not used for matching.
- If the feed provides no title, store a safe fallback title from available metadata when possible, otherwise mark it as a clear ingest error rather than silently creating a blank review row.
- Add a cleanup step for the two existing blank-title rows:
  - remove their current auto-created links,
  - record those removed pairs as rejected/noisy labels where appropriate,
  - leave the episode rows visible with enough detail for admin review, or mark them not-about-a-movie if no reliable title can be recovered from the feed.
- Ensure Match Review displays an explicit placeholder such as “Untitled episode” only for genuinely untitled rows, never an empty line.

### 2. Tighten short/common-word matching

- Expand the common-word logic for one-word titles to include `big`, `go`, and `it`, while preserving already-listed words like `girls`.
- Add a stronger rule: one-word/common-word movie titles should not be suggested unless there is corroboration, such as:
  - exact whole-title match,
  - matching release year in title/description,
  - description names the title in a subject sentence, not promo/ad copy,
  - or the episode title has strong enough surrounding title evidence.
- Treat stopword-only titles like **It** more conservatively; stopword fallback currently lets them behave like content words.
- Re-run local scoring checks for examples around `Girls`, `Big`, `Go`, and `It` before claiming this is fixed.

### 3. Fix flagged-link queue cleanup

- Change `listFlaggedLinks` so it only lists unresolved flags that still correspond to a live episode-movie link, unless a separate “orphaned flags” maintenance view is intentionally added later.
- Change unlink/reject/retire paths so flags on affected pairs are resolved in the same server-side operation, including bulk actions.
- Add a one-time cleanup for existing orphaned unresolved flags, marking them resolved as `fixed` because the flagged link is already gone.

### 4. Add optional year to Pick another movie

- Extend the shared `RelinkPicker` UI with an optional year field, matching the **Add movie from TMDB** pattern.
- Update the picker search flow so title + optional year can create/find a movie through TMDB when it is not already in the catalog.
- Keep IMDb ID lookup working as a fast exact path.
- Reuse this same picker in both Match Review rows and Unmatched Episodes rows.

### 5. Make queue size and refresh behavior honest

- Add clearer queue definitions near Match Review:
  - **Flagged**: live links someone marked wrong.
  - **Proposed**: suggestions computed on demand from current unmatched/unconfirmed active episodes; these are not saved until approved.
  - **Existing links**: saved links in the chosen confidence/review band.
- Add visible counts per tab/band so the user can see the size of the current queue before working it down.
- Stop subtracting stale optimistic “done” rows from totals after unrelated refreshes; totals should reflect server truth for the current tab/filter.
- Add an explicit “Reviewed / confirmed” concept for existing links if needed, so an existing link can be marked complete without relying only on confidence/method side effects.
- Document current multiple-movie behavior: rescans can attach extra non-primary links for strong secondary candidates; manual review can add one replacement at a time; there is not yet a polished multi-movie editor.

### 6. Improve match-review UI responsiveness and misclick recovery

- Reduce lag by avoiding full invalidation of every admin section after each row action; update only the active queue immediately and refresh stats/history in the background.
- Keep per-row pending state so one action cannot gray out or block the whole list.
- Add a compact recent-action/undo strip near Match Review so misclicks can be seen and undone without scrolling to the bottom.
- Make the selected row/action feedback more obvious after a click.

### 7. Make “Score the matcher” actionable

- Add a short interpretation panel above the detailed scorecard:
  - primary metric: precision in suggested bands, especially the current review threshold,
  - secondary metric: recall at threshold,
  - watchlist metric: mean approved score should stay meaningfully above mean rejected score,
  - regression warning: any rule change that improves one band but worsens another should be judged by where actual review workload is concentrated.
- Highlight the worst band and the most negative-lift signals as “next tuning targets.”
- Keep the detailed numbers available for diagnosis, but make the top-level verdict readable.

### 8. Diagnose the 254/255 podcast coverage case

- Enhance per-podcast sync logging to show:
  - feed total,
  - fetched count,
  - inserted/updated count,
  - exact per-episode failures,
  - and likely duplicate/slug conflicts.
- For **Your Inner Child Is An Idiot**, add a targeted diagnostic path in the coverage card so repeated sync attempts explain which item is missing or why the feed count cannot be reconciled.
- Avoid claiming the missing episode is fixed until the coverage row either reaches 255/255 or displays the exact reason it cannot.

### 9. Workflow documentation deliverable

Create a separate documentation file in the project covering:

- Ingest podcast.
- Sync episodes / sync all incomplete.
- Build movies from episodes.
- Add movie from TMDB.
- Enrich movies from TMDB.
- Streaming availability + genres.
- Recheck/rescan against existing movies.
- Match Review: Flagged, Proposed, Existing links.
- Unmatched Episodes.
- Recent decisions and undo.
- How manual decisions feed learning today:
  - rejects/unlinks create pair-level negative evidence,
  - repeated movie rejections penalize that movie,
  - confirmations/approvals create positive labels for Score the matcher,
  - not-about-a-movie removes an episode from queues,
  - no trained model exists yet; this is deterministic rules plus labelled evaluation.
- Current limitations and best-practice admin workflow for working queues down.

### 10. Backlog-only matcher improvement suggestions

Update the consolidated roadmap, but do not implement these now:

- A stronger “review state” model for episode completeness and per-link review completion.
- A training/evaluation dashboard that turns scorecard output into recommended rule changes.
- Per-podcast matcher tuning, since some shows use very clean title formats and others use joke/chatter titles.
- A curated blocklist/allowlist for high-noise titles and ad/promo phrases.
- A multi-movie episode editor for double features, trilogies, franchises, and “covered in passing” vs “primary subject”.
- A safe “clear low-confidence auto links and rerun current engine” maintenance pass with preview/dry-run.

## Validation

- Check database rows for the two blank-title episodes before and after cleanup.
- Verify unresolved orphan flags count goes to zero or is intentionally hidden from the active flagged queue.
- Verify Match Review counts decrease predictably after confirm/unlink/reject/not-about-a-movie actions.
- Verify `Girls`, `Big`, `Go`, and `It` examples no longer produce broad false positives without corroboration.
- Verify the Pick another movie control supports title, year, and IMDb ID from both Match Review and Unmatched Episodes.
- Verify the coverage card explains the `Your Inner Child Is An Idiot` missing episode case.
- Verify the workflow documentation file is present and linked from the admin page or roadmap.
