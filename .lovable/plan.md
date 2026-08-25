# Pass W — Franchise and sequel disambiguation

Goal: stop sequels and franchise entries from all matching the base film. "Halloweentown" should not win on an episode about "Halloweentown High", and "Toy Story" should not win over "Toy Story 3".

All changes are deterministic — no AI, and no new TMDB calls beyond one field on the enrich call already made.

## Measurement (before and after)

1. Before touching any rule: open Match review → "Score the matcher", record precision/recall at the 25 threshold and precision per confidence band.
2. Build the changes below.
3. Run "Score the matcher" again — it replays the new rules over the same recorded approve/confirm/reject labels, so the runs compare directly.

Success: precision rises in the 25–60 bands (where sequel confusion clusters) with recall at 25 unchanged or better.

## What changes in the matcher

1. **Longest-title-wins within a family.** Group candidate movies that share a normalised title stem. Within a family, keep only the longest title whose entire token set is covered by the episode title; suppress shorter family members to a sub-threshold score. So "Halloweentown High" beats "Halloweentown" whenever "high" is present, and the base film still wins when no distinguisher appears.
2. **Distinguisher tokens become a penalty, not noise.** Roman numerals (II, III), digits (2, 3), "return to", "part", "chapter", "revenge", and a subtitle after a colon in the episode title count as evidence *against* a base title that has none of them. Today they simply fail to help.
3. **Symmetric coverage.** Also require coverage of the episode's film-name span, not just the movie's tokens, so a base title covering half the named film scores below the sequel that covers all of it.
4. **Franchise grouping via TMDB collections.** Store the TMDB `belongs_to_collection` id on movies during enrichment; when two candidates share a collection, only the best-scoring one is ever proposed.
5. **Year corroboration inside a family** settles most remaining ties.

## Technical notes

- `src/lib/providers/matching.server.ts`: the per-movie scoring loop stays; a new post-pass groups candidates by title stem and by `collection_id`, applies the suppression, then re-sorts. Two new signals (`familySuppressed`, `distinguisherPenalty`) are added to `MatchSignals` and persisted onto links so the scorecard can report their lift.
- `src/lib/providers/tmdb.server.ts`: the existing `/movie/{id}?append_to_response=external_ids` detail call already returns `belongs_to_collection`; read it and pass it through enrichment.
- Migration: `collection_id integer` (nullable, indexed) on `public.movies`. No new table, no policy change. Backfilled by re-running "Enrich movies from TMDB"; movies without a collection stay null and fall back to stem grouping.
- Candidate fetch in `ingestion-helpers.server.ts` selects `collection_id` alongside title/year so suggest, rescan and first-ingest matching all benefit.
- `src/lib/matcher-eval.server.ts` needs no change — it replays live scoring, so the new rules are measured automatically.

## Not in scope

TV/miniseries handling (Pass V), and any change to review UI or bulk actions.
