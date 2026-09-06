# PopNPods / Movie Afterparty — product principles

Created: 2026-09-02. Standing document: these principles apply to every pass, plan and design decision. The roadmap (`.lovable/roadmap.md`) says _what_ to build; this file says _what makes a build correct_.

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
9. **Completeness and relevance are both required.** Review reporting must answer "these 11 episodes are unreviewed" _and_ "these 4 are the only ones likely to help tonight" (Pass U8 as infrastructure).

## The review flywheel

better review UX → more human decisions → better evaluation data → better matcher → less review needed → better recommendations.

Corollary: **automating volume before matching is accurate just multiplies review work.** Large-scale ingestion and scheduled refresh stay backlogged until the engine is trustworthy.

## Administrative work and automation (Added manually 2026-09-06)

### Human effort is a product cost

Administrative review time is part of the product's cost, even when the work is performed by the creator rather than by an end user.

Do not optimize for:

- number of episodes processed;
- number of links created;
- number of rows traversed;
- amount of automation performed.

Optimize for:

- trustworthy coverage gained;
- uncertainty removed;
- useful relationships confirmed;
- human decisions avoided.

### Never recreate work the user has already deliberately settled

A manual rejection, confirmation, retirement, review-complete decision, or other explicit human decision is product knowledge.

Automated ingestion, matching, recheck, enrichment, and maintenance workflows must preserve those decisions unless an explicit, separately authorized maintenance action is designed to revise them.

A system that repeatedly recreates rejected or reviewed work is not merely inefficient; it destroys trust in the curation process.

### Safe automation beats aggressive automation

When there is a choice between:

- processing more records automatically, or
- processing fewer records while respecting existing human decisions,

prefer the second unless the additional automation has a clearly demonstrated net benefit.

Automation should reduce future review burden rather than repeatedly generating new review work.

### Administrative scope is not the same thing as consumer value

An item being excluded from an admin queue does not necessarily mean it should disappear from the consumer product.

Likewise, increasing the size of an admin queue is not evidence of improved product quality.

Admin workflows should be scoped to the smallest useful unit of work that produces an identifiable payoff.

### Prefer reversible, auditable operations

When an operation can alter existing curation decisions, prefer:

- explicit scope;
- clear before/after semantics;
- preservation of human decisions;
- predictable undo/recovery behavior;
- visible reporting of what changed.

Avoid destructive “cleanup” operations as routine maintenance.

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

  # Operational safety / admin workflow

  Administrative actions must be understood by consequence, not label. Actions such as Sync, Build, Recheck, Unlink, Confirm, Review and Reopen may operate at different scopes and may have downstream effects on review eligibility. Documentation must describe actual data effects, not merely the UI label. Workflows must avoid sequences where one action silently invalidates the assumptions required by the next.
