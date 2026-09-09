# PLAN (backlog only) — MatcherImprovementInitiative extensions + admin verification architecture

Created: 2026-09-09
Mode: PLAN. No code, schema, authorization, RLS, or UI changes this turn. Approving this plan files these items into `.lovable/roadmap.md` and stops.

Highest ID currently in use: U71. New IDs start at U72. The existing matcher initiative (U55–U62) is **not rewritten**: three findings below extend U60 and U61 in place, the rest are new passes joining the same initiative and inheriting its cross-cutting rules (one matcher, one scoring path; explainable signals; no writes to confirmed links / rejections / review states; rejected pairs never resurrected; no broad replay; accepted only when own regressions pass **and** `scoreMatcher` shows precision up with recall not materially down — recall drop >2 points at threshold 25 blocks the pass).

---

## Part 1 — Consolidations into existing passes (no new IDs)

### U60 extension — additional contextual content-type cues

Same sentence-scoped, overridable rule; only the cue vocabulary and one title-shape cue grow:

- `game show` — strong non-movie evidence, and a strong `not_about_a_movie` candidate signal (e.g. The Confused Breakfast "BRUNCH: Nickelodeon GUTS" — "Nickelodeon's most competitive game show").
- `album` — additional regression case: "One of the most popular albums of all-time, 'Hybrid Theory' by Linkin Park".
- `television series` / `documentary series` (already covered) plus **episode-designator titles**: an episode title containing `Season 2 Episode 18`, `Episode 5`, `S02E18` indicates a TV episode, not a film (e.g. `Gilmore Girls - Season 2 Episode 18 - Back in the Saddle Again` → no link; `Paris is Always a Good Idea - Episode 5 (Hallmark+ - 2026)` must not reach `Always (1989)`).
- Compilation/list episodes: a title that is a plural/superlative list rather than a title (`BRUNCH: The Greatest Drinks in Movie History`, `Bill's 50 Most Rewatchable Movies of the 21st Century`, `FH Mini #150 - Best Stephen King Movies`, `The Definitive Action Hero Ranking Pt. 2`, `A 2026 Rewatchables Mailbag`) is strong non-movie evidence.

Unchanged: cue must describe the candidate/content, not merely appear somewhere; an exact title or a title+year mention overrides. Not a keyword ban. Band impact: U60 stays S, list-episode detection may push it to M — report rather than expand.

### U61 extension — recurring confusion clusters

U61 already derives show-scoped confusion from `episode_match_rejections` + `match_actions` and already separates Case A (confirmed somewhere in the show) from Case B (repeatedly rejected, never confirmed). This extension adds explicit **cluster** treatment: when several catalogue titles are mutually near-identical (`The Wiz` / `The Wizard` / `The Wizard of Oz`; numbered franchise entries), the demotion applies at the cluster level — a rejection of one member is evidence about the confusable neighbourhood, not only that pair — while confirmed membership inside the cluster is never demoted. Clusters are derived at scoring time from title containment/edit distance plus U58 base-title decomposition; no cluster table, no curated list. Strong episode-specific evidence (exact title, or title+year in the description) still overrides. Regression: repeatedly rejected `Don't Look Now` / `Re-Animator` demoted for The Rom Complex; Wiz-cluster cross-links suppressed while each show's confirmed member survives.

---

## Part 2 — New passes in MatcherImprovementInitiative

### Pass U72 — Podcast-profile priors: genre, rating, era — M (~3–5 credits) — depends on U56; do after U57

Soft, explainable priors derived per show from **confirmed links only** (`review_state = 'confirmed'` or `match_method = 'manual'`), never from auto-links. Profile = genre distribution, certification distribution, release-era distribution. Requires a minimum confirmed sample (proposal: 8 confirmed movies, and per-dimension coverage of at least 60% of them) or the prior is not constructed at all. Candidate adjustment is a small bounded demotion (proposal: cap the total profile term at −8 points, never a boost above the neutral baseline, never an exclusion), and is overridden entirely by strong episode-specific evidence (exact title match or description title+year). Every applied prior surfaces a readable signal such as "unusual genre for this show" / "outside this show's usual era".

Acceptance: horror-heavy show + rom-com candidate demoted but still linkable; throwback-only show + 2025 candidate demoted unless the episode names it exactly; a show with too few confirmed links gets no prior; no confirmed link's stored confidence is rewritten; precision/recall gate met.

Non-goals: hard genre/rating filters, profiles from auto-links, per-show manual configuration (that stays U4), ML.

### Pass U73 — Temporal consistency: episode date vs movie release — S (~1–2 credits) — no dependencies

Global signal: an episode published clearly before a candidate's release is strong negative evidence. Use exact dates when both are known, fall back to years. Bands (proposal): episode after release → neutral; episode within ~60 days before release (press/preview) → neutral-to-slightly-negative; episode more than ~6 months before release → strong negative, effectively blocking unless the episode's own text names that year. Missing episode date or missing release date → no signal, never a penalty.

Acceptance: a 2019 episode titled `Mean Girls` prefers the 2004 film over the 2024 one; legitimate pre-release/festival coverage is not destroyed; episodes with no stored date are unaffected; precision/recall gate met.

### Pass U74 — Episode lineage: reissue / re-release inheritance — M (~3–5 credits) — pairs with U65

General lineage detection, never per-show rules. Two cue families:

1. Title markers: `Re:Issue`, `ReIssue`, `Re-Release`, `(Re-Release)`, `(Classic)`, `Redux:`, `DTH Classic:`, `Matinee Monday:`, `Micro Queers:`, `BRUNCH:` — treated as **format prefixes/suffixes stripped before matching** (U55 owns the stripping), and as lineage cues here.
2. Description markers: "originally released", "originally aired", "first published" and near variants.

When a cue fires, look for an earlier episode **in the same show** whose parsed core title is equivalent, and inherit that episode's **confirmed/manual** links as strong positive evidence for the same candidates. Auto-links are never inherited. Inheritance produces a proposal with an explainable signal ("re-issue of an earlier confirmed episode"), never a silent confirmed link.

Three date concepts stay strictly distinct and must not be conflated: podcast episode publication date, movie release date, and original source-program air date (e.g. "Originally aired on March 3, 2021" — a TV air date, which must not be read as a movie release date and must not feed U73). Where the source-program air date is the only date present, it is lineage evidence, not release evidence.

Acceptance: `Blank Check (1994) - Re:Issue` (2024) inherits the confirmed link of `Blank Check (1994)` (2021); `Little Italy (Re-Release)` and `Green Lantern w/ Paul Rust (Classic)` resolve to their base films; an "Originally aired" TV date never satisfies or violates U73; no inherited link is auto-confirmed. Relation to U65: U65 owns the admin-visible related-episode link on the card; U74 owns the matcher signal. Either can ship first; if both ship, U74 may propose the relation U65 stores.

### Pass U75 — Show-format regression corpus and format-prefix coverage — M (~3–5 credits) — depends on U55; gates U55–U62 acceptance

Turns the supplied show observations into the initiative's standing regression corpus, stored as a fixture consumed by `scoreMatcher`, so every later matcher pass is measured against the same cases. Also extends U55's parse vocabulary with the observed formats: guest markers `w.`, `w/`, `with`, `feat.`, `With <name>, <name>, and <name>`; bracketed years `[1999]`; parenthetical suffixes `LIVE!`, `(Patreon Clip)`, `(Classic)`, `(Re-Release)`, `[Jason Edition]`, `(LIVE from …)`, `(Hallmark+ - 2026)`, `(Lifetime - 2026)`; prefixes `BRUNCH:`, `Redux:`, `Micro Queers:`, `Matinee Monday:`, `Last Looks:`, `DTH Classic:`, `Interview:`, `Feed Drop -`, `Ep. #441 -`, `FH Mini 117 –`; and `Interview: <guest> on <movieTitle>` where the title follows ` on `.

Corpus seeds (all currently wrong, each must stop being produced): You Are Good — `Magnolia (Dads Can Be Very a Lot)…` → `Can of Worms`, `10 Things I Hate About You…` → `I, Robot`, `Rosemary's Baby w. Sarah Archer!` → `She's Having a Baby`, `A Beautiful Mind…` → `Beautiful Disaster`; plus the correct-link expectations for `The Mummy [1999]`, `Clueless`, `My Neighbor Totoro`. Horror Queers — `The Mummy (1932)` → `The Mummy (1999)`, `Ready or Not 2: Here I Come (Patreon Clip)` → `Ready or Not (2019)`, both `Interview:` cases. How Did This Get Made? — `Samurai Cop LIVE!` → `Kindergarten Cop`, `Last Looks: Samurai Cop…` → `The Last Song`, `Sky Captain…` → `Ghost World`, `Sharknado 3` → `Terrifier 3`, `Monkeybone` → `Last Holiday`/`The Last Song`, and the missing `xXx` in `Last Looks: xXx & The Legend of Billie Jean` (U59). Darren and Matt's 80s Adventure — `Miracle on 34th Street (1994)` → 1947 version (U57 year gate), `Super Snooper (1980)` → `The Super Snooper (1937)`, `License to Drive (1988)` → spurious `Drive (2011)`, plus the missing links for `Evil Dead 2 (1987)`, `Critters (1986)`, `A Nightmare on Elm Street 3`. Deck the Hallmark — the Gilmore Girls and `Episode 5` cases (U60), `DTH Classic: Falling for You` → `Falling for Figaro`, `Niall Matter Interview (Much About Love)` → `The Interview`. The Rewatchables — every `Van Lathan` → `Van Helsing` case, `Friday Night Lights` → `Friday`, `Basic Instinct … Live From SF` → `Maternal Instinct`, mailbag and list episodes. The Flop House — `Harold and the Purple Crayon` → `Purple Rain`, `Trap` → `The Parent Trap`, `Return to Silent Hill` → `Return of the Jedi`, `SmartLess Presents ClueLess…` → `Drop Zone`, `Casters on Casters…` → `John Q.`, `FH Mini` list episodes.

Acceptance: the corpus runs as one command, reports per-case pass/fail with the winning candidate and its signals, and is required evidence in every U55–U62 pass report. Truth labels come from existing confirmed links and admin decisions; no new labelling UI. Non-goal: per-show hardcoded exceptions — a format only enters the parser when it is a recognisable general pattern.

**Sequence for the initiative, revised:** U75 (corpus) alongside U55 → U56 → U57 → U73 → U58 → U60(+ext) → U59 → U72 → U74 → U61(+ext). Total if all built ≈ 32–46 credits.

---

## Part 3 — Admin verification architecture (investigation, no code)

### What controls admin access today

One model, three layers, all real: `user_roles` + the `has_role` security-definer function in the database; RLS policies that call `has_role` for admin-only writes; server functions that re-check the role server-side (`Forbidden: admin required`) after `requireSupabaseAuth` validates the request's bearer token; and `useIsAdmin` in the client, which only decides whether a control renders. There is no client-side bypass and no dev flag. So an unauthenticated verification browser genuinely cannot see or exercise admin controls — the failures on U8, U32, U33, U38, U39, L2b and U63 are an environment gap, not an app defect.

### Option 1 — temporarily remove admin-only restrictions

Rejected. It would require edits to RLS policies, server-function guards and client gating, then a second pass to restore them, and every verification run in between would exercise a permission model that does not match production — so the verification would not prove the shipped behaviour anyway. Real structural debt for no gain.

### Option 2 — dedicated test admin identity

Sound in principle: create a disposable auth user, grant it `admin` in `user_roles`, and have the verification browser sign in as that user. Downside if done with a password: the credential has to live somewhere reusable, which the user explicitly ruled out.

### Option 3 — recommended: mint a short-lived session for a dedicated admin user, no stored credential

The verification environment already exposes `lovable auth-session`, which mints a real Supabase session for an existing auth user on request (`--self`, or `--user <uuid>` with user approval). The browser then restores that session's cookies/localStorage before navigating. That session travels the production path exactly: real JWT → `requireSupabaseAuth` → RLS → `has_role`. Nothing is stored in source, Project Knowledge, or `.env`; no personal credentials; no bypass. Current environment reports `signed_out`, meaning a session must be minted per verification turn — which is fine, because it is a per-turn command, not infrastructure.

The only durable piece needed is a **dedicated non-personal admin identity** so verification never runs as the real account: one auth user (e.g. `verify-admin@…`) with an `admin` row in `user_roles`, created once by migration/console, no password shared. Everything else is per-turn tooling that already exists.

### Pass U76 — Repeatable admin verification identity — S (~1–2 credits)

Scope: create the dedicated verification admin user and its `user_roles` row; record its user id in `workflow-documentation.md` (an id is not a secret) together with the standing verification procedure — mint a session for that id, restore cookies + localStorage, then exercise the admin control. Add one line to the acceptance-checklist rules: an admin-only item may only be labelled "IMPLEMENTED, NOT VERIFIED" for session reasons after this procedure has actually failed, with the failure quoted.

Acceptance: with a minted session, `/admin/ingest` loads, `useIsAdmin` returns true, and one admin-only write (Confirm on a link) succeeds through the real RLS path; signed out, the same control is absent and the server function still refuses. No change to policies, guards, or client gating.

Ownership: no existing roadmap item owns this — it is a cross-cutting verification blocker referenced by U8, U32, U33, U38, U39, L2b and U63, so it is filed as its own small pass and should be built before the next admin-only pass is verified. Estimate S (~1–2 credits). No production authorization is weakened.
