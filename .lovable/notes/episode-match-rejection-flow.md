# Note: rejected episode matches need a better flow (future work)

Current lightweight behaviour (Aug 2026):

- Rejecting a suggested episode -> movie match records the rejection and deletes the link.
- The episode then has zero movie links, so it is invisible in the app.
- Safety net: `/admin/ingest` shows an "Unmatched episodes" card plus an "Unmatched episodes"
  stat, so nothing hides silently, and "Build movies from episodes" / "Rescan against existing
  movies" can re-attempt a link (rejected pairs are excluded).

Wanted later:

- On reject, immediately offer the next-best candidates plus a free-text "search TMDB for the
  right movie" box so the episode is re-matched in the same interaction.
- Support multi-movie episodes and an explicit "not about a movie" flag so genuinely
  non-movie episodes are marked resolved instead of sitting in the unmatched list.
