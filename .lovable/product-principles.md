# PopNPods / Movie Afterparty — product principles

Created: 2026-09-02. Standing document: these principles apply to every pass, plan and design decision. The roadmap (`.lovable/roadmap.md`) says *what* to build; this file says *what makes a build correct*.

## Purpose

PopNPods exists to reduce the effort of deciding what to watch by turning movie knowledge buried in podcasts into trustworthy, personalised, actionable recommendations — then connecting the chosen movie back to the commentary that inspired it.

Fundamental success criterion:
- NOT: "How much data have I ingested?"
- YES: "How much decision-making effort have I eliminated?"

## Core principles

1. **The app absorbs choice burden.** More data must make choosing easier, not produce a longer list to browse. "I shouldn't need to browse" is the target feeling for Tonight.
2. **Administrative scope ≠ consumer visibility.** Scoping down admin work must never delete validated content from the app. Parked means "don't make me maintain this feed", not "erase what I already validated" (Pass U25).
3. **Information is only valuable if it reduces uncertainty.** A number, badge or stat that does not change a decision is clutter. Prefer "3 possible episodes → review them" over "843 items in queue".
4. **Bite-sized admin work with an immediate, visible reward.** Curation should be just-in-time and goal-directed: work scoped to the movie or night the user actually cares about, ending in a stated unlock ("2 movies now have confirmed commentary"). Human curation should produce personal value, not feel like database maintenance (Pass U27).
5. **Explain recommendations at two levels.** A short user-facing "Why this?" line, and a full admin score decomposition where the listed terms sum to the displayed score. Never show a rationale the code does not actually compute (Pass U28).
6. **Coverage has quality, not just quantity.** Distinguish deep-dive coverage from possible matches and brief mentions; count is the weakest signal (Pass U30).
7. **Extensible strategies over one giant matcher.** Matching accuracy comes from named, independently testable per-podcast strategies (clean-title, year-aware, noisy-title + description, actor corroboration, special-word suppression, stricter thresholds), not from an ever-growing universal scorer (Pass U4).
8. **Determinism first.** Scores, filters and recommendations are rule-based and reproducible; no model calls on page loads, filtering, scoring or ranking. The app must work with AI enrichment unavailable.
9. **Completeness and relevance are both required.** Review reporting must answer "these 11 episodes are unreviewed" *and* "these 4 are the only ones likely to help tonight" (Pass U8 as infrastructure).

## The review flywheel

better review UX → more human decisions → better evaluation data → better matcher → less review needed → better recommendations.

Corollary: **automating volume before matching is accurate just multiplies review work.** Large-scale ingestion and scheduled refresh stay backlogged until the engine is trustworthy.

## Primary product metric

Never improve matching in a way that increases the number of human decisions faster than it increases useful confirmed coverage.

- NOT: "We matched 15,000 more episodes."
- YES: "We unlocked 800 additional trustworthy movie↔commentary relationships while creating only 120 additional review decisions."

Instrumentation for this metric is Pass U31.

## Design principles (existing, restated)

- "Cinema Neon": soft blue-gray slate base, electric cyan accent, sparing glow. All colours are oklch tokens in `src/styles.css` — never hardcoded.
- Outfit for headings, Hind for body.
- Compact controls: one dual-handle slider per range, small chips for services, bare icons over filled circle buttons.
- Lists never re-sort mid-interaction: snapshot order, re-rank on next load.
- No fake or seeded catalogue data; movies originate from real podcast episode titles via TMDB.
- No podcast episode is silently unmatched — unmatched episodes stay visible to admins.
