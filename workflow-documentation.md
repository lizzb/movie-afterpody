# Movie Afterparty admin workflow

## Pass acceptance workflow (added 2026-09-02)

Before building a multi-item pass, write a testable acceptance checklist plus the minimum
verification steps per criterion, and flag anything the spec does not actually cover instead
of quietly deciding it.

Every pass summary labels each promised item:

- **Verified** — checked in code and in the running app, naming route and device.
- **Implemented, not verified** — code exists, runtime verification not done.
- **Deferred** — intentionally not built.
- **Needs follow-up** — present but not at the requested UX quality.

A pass is never called "built" or moved to _Already done_ in `.lovable/roadmap.md` unless every
item is Verified or explicitly Deferred. Verification is run proactively — no prompting needed —
and is mandatory for mobile/PWA layout, popovers, filters and stateful controls.

### Trigger keywords

- `ACCEPT: <PASS_ID>` (also `ACCEPTANCE: <PASS_ID>`) — write/refresh the acceptance-criteria
  checklist plus minimum verification steps for that pass into a dated plan file. No code,
  no scope change. Accepts multiple IDs.
- `BUILD: <PASS_ID>` — if no acceptance checklist exists yet for that pass, derive one first
  from the roadmap entry and plan context, then build against it, then verify in the running
  app, then report with labels. Building always ends in a labeled checklist.
- `PLAN: <PASS_ID>` / `PLAN (backlog only)` — scoping and estimates only. A full testable
  acceptance checklist is written only when the pass is nontrivial/multi-item or when
  `ACCEPT:` is used; backlog entries carry a one-line acceptance sentence, not a full set.

Current acceptance-criteria sets: `.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`
(U8, U24, U4, P, U23).

## Triage workflow (added manually 2026-09-03)

TRIAGE: Create a keyword for this workflow

The meaning should be:

Investigate first. TRIAGE diagnoses the reported problem and determines the likely root cause, scope, and appropriate next step. TRIAGE does not authorize implementation: even when the cause and smallest safe fix are clear and low-risk, explain the diagnosis and recommended fix rather than implementing it. If implementation would require meaningful investigation, architectural changes, broad refactoring, multiple screens, migrations, or substantial work, explain the likely scope and add or update a backlog pass.

### Workflow keyword: TRIAGE

When a user message begins with `TRIAGE:`:

1. Investigate the reported bug/problem using the current roadmap, relevant pass/plan files, and current implementation.
2. Identify the root cause or most likely cause.
3. Check whether the issue is already covered by an existing pass/backlog item before creating anything new.
4. Do NOT implement a fix during TRIAGE, even when the cause and smallest safe fix are clear, localized, low-risk, and reasonably small:
   - explain the root cause or strongest diagnosis;
   - describe the smallest plausible fix;
   - identify any important verification considerations;
   - determine whether an existing roadmap pass already owns the work.

5. If the issue requires substantial investigation, architectural work, a migration, broad refactoring, multiple independent changes, or otherwise substantial implementation:
   - do NOT implement it;
   - explain the root cause/uncertainty;
   - describe the likely scope, smallest plausible fix, and broader alternatives where useful
   - estimate the effort using the project's S/M/L/XL complexity plus work drivers;
   - add or update an appropriately scoped backlog pass.
6. Do not create a new pass when an existing pass already covers the problem; update/reframe the existing pass instead.
7. Do not turn a TRIAGE request into unrelated cleanup or opportunistic improvements.
8. Clearly state which branch was taken:
   TRIAGE COMPLETE — RECOMMENDED FIX
   or
   NEEDS DEEPER WORK — BACKLOGGED

# Ingest data admin workflow (outdated? NEEDS REVIEW as of 2026-09-03)

## Data population flow

1. **Ingest podcast** stores the show and up to 1000 feed episodes.
2. **Build movies from episodes** reads unmatched active-show episodes, extracts likely movie titles from episode titles, looks them up in TMDB, creates/refreshes movie rows, and links the episode.
3. **Recheck every episode against existing movies** does not call TMDB. It only rescans active-show episodes against movies already in the catalogue, skips rejected pairs, preserves manual/confirmed links, replaces weak links only when a better match wins clearly, and can add strong secondary links.
4. **Enrich movies from TMDB** fills metadata, posters, backdrops, runtime, IMDb id, and collection id for existing movies.
5. **Streaming availability + genres** refreshes current provider data and genres. Availability is a snapshot, not a guarantee that a title will remain available.

## What the matcher learns today

- Every rejected pair is stored and never suggested again for that same episode/movie pair.
- Rejection counts by movie act as negative evidence, so repeatedly noisy movies lose confidence in future scoring.
- Confirmed/manual links are preserved during rescans.
- The scorecard replays the current matcher over approved/rejected labels and reports which signals correlate with good or bad matches.

## What it does not learn yet

- It does not train an AI model.
- It does not automatically rewrite scoring weights from the scorecard.
- It does not infer that an entire phrase like an ad campaign is invalid unless the title rules identify it as non-movie noise or an admin marks episodes as not about a movie.

## Practical review loop

1. Keep a small set of shows active; park the rest.
2. Build movies from episodes for one active show.
3. Review Flagged, then Proposed, then Existing links.
4. Use **Not about a movie** for ads, interviews, mailbags, trailers, and non-film episodes.
5. Run **Score the matcher** before and after matcher-rule changes.
6. When the queue looks stale after a major rule change, use a future guarded replay tool rather than manually refreshing the same weak historical links.

## Verification sweep workflow (added 2026-09-09)

Two keywords, separate from `BUILD` because neither starts by writing product code.

### Workflow keyword: VERIFY SWEEP

Documentation only. When a message begins with `VERIFY SWEEP`:

1. List every roadmap item currently labelled **IMPLEMENTED, NOT VERIFIED** or **NEEDS FOLLOW-UP**.
2. For each, write the concrete test that would settle it: route, viewport, data precondition, expected observation.
3. Sort them into: verifiable now; verifiable only with a forced-failure harness; blocked on an environmental dependency (e.g. admin identity — Pass U76); no realistic path to verification. For the last group, state why and recommend accept-as-is / retire / re-scope.
4. File the testable ones as scoped `V*` verification passes with credit estimates in `.lovable/roadmap.md`.
5. No code, no status promotions, no new product scope.

This is low priority by design — expect it to run only when credits are in surplus.

### Workflow keyword: VERIFY: <PASS_ID>

Execute one filed verification pass against the running app, then update the roadmap: promote to **VERIFIED** with date and evidence, or leave the label and name the blocker. Move the entry to its correct section in the same edit. A small defect found mid-run follows the `TRIAGE` rules; it does not expand the verification pass.

Use `BUILD` only when product code is expected to change.

## Admin verification identity (Pass U76, added 2026-09-11)

Admin-only surfaces must be verified through the real path — JWT → `requireSupabaseAuth` → RLS → `has_role` — never by weakening a policy or a client guard.

Standing procedure (credential-free; nothing stored in source):

1. `lovable auth-session --json` mints a short-lived real session for the project's sole auth user (`x.lizzb@gmail.com`, id `176b1ada-673a-426e-a40e-946fb9e2420a`, which holds the `admin` row in `user_roles`). With several auth users use `--self`, or `--user <uuid>` for a named account.
2. `python3 scripts/verify-admin-session.py [/admin/ingest]` restores that session (SSR cookies + supabase-js localStorage key) into Playwright and reports whether the admin surface loads. Exit 0 = usable admin session.
3. Run the pass's own assertion in the same restored context. Confirm/Flag pattern: open a show detail, click **Confirm this link is correct**, expect the "Link confirmed" toast, then click the undo state so no data is left changed.
4. Signed-out control: the same route in a fresh context must show zero Confirm controls and the server function must refuse (HTTP 403).

A no-second-identity decision was taken deliberately: creating an extra `verify-admin@…` auth user would make every mint require `--user <uuid>` with per-run user approval, adding friction without adding safety. The existing sole admin account is already non-shared and its tokens are short-lived.

**Labelling rule:** an admin-only item may only be labelled "IMPLEMENTED, NOT VERIFIED" _for session reasons_ after this procedure has actually been run and failed, with the failure output quoted on the roadmap entry.

Verified 2026-09-11: `/admin/ingest` loads with the full ingest dashboard and no console errors; 6 Confirm controls present on a show detail; Confirm wrote and undid successfully; signed out, 0 controls and `confirmEpisodeMatch` returned 403.

## Credit reporting, estimate content, and scope guards (added 2026-09-14, Pacific)

### Credit numbers in chat

The agent has no access to the billed cost of a message. Any "About X credits" line is a
model-generated guess. Therefore:

- Never report a bare "About X credits" figure as if it were actual spend.
- Only state credits when (a) giving a forward-looking estimate, explicitly labelled
  `Estimated remaining: <band>`, or (b) the user asks for a retrospective sense of cost, in which
  case it is labelled `Rough estimate of work done (not billed cost)`.
- Bands only (S ~1-2, M ~3-5, L ~6-10, XL ~10+); no invented precise numbers.

### Every roadmap/plan estimate must carry scope, complexity and uncertainty

A credit band alone is not an estimate. Each roadmap item and each planned pass records:

- **Scope** — files/areas affected.
- **Major steps** — the ordered work, not a single sentence.
- **Dependencies** — other passes, data, deployment, or admin-session prerequisites.
- **Unknowns** — what is not yet understood, and what would have to be measured first.
- **Complexity drivers** — what makes this harder than its size suggests (shared code paths,
  migrations, admin-only verification, matcher scoring, performance measurement, external APIs).
- **Confidence** — High / Medium / Low. Low confidence means the estimate is a placeholder and
  the first step is measurement, not implementation.

New roadmap entries without these fields are incomplete. Existing entries are not rewritten
retroactively unless the user asks for an audit.

### Workflow keyword: CREDITLIMIT=N

`CREDITLIMIT=N` anywhere in a request sets a hard ceiling of roughly N credits of work on that
request. On approaching the ceiling, the agent must:

1. Preserve completed code changes; leave the project coherent and buildable.
2. Stop exploring further hypotheses merely because they are possible.
3. Report: root-cause evidence so far, changes made, verification completed, remaining uncertainty,
   and the estimated band for the remainder.
4. Wait for a decision before continuing.

Never spend ceiling budget on architectural cleanup, refactoring, redesign, or unrelated fixes.
Absent an explicit `CREDITLIMIT=`, the default ceiling for TRIAGE and debugging requests is
`CREDITLIMIT=3`. `CREDITLIMIT=none` removes the ceiling for that request only.

## Roadmap timestamp rule — Pacific Time (added 2026-09-14, Pacific)

All dates and times written into `.lovable/roadmap.md`, pass history, verification stamps and plan
file `Created:` lines use **America/Los_Angeles** (PDT UTC-7 / PST UTC-8, DST handled automatically).
Convert before writing; never copy a UTC tool timestamp through. If conversion crosses midnight, the
Pacific calendar date wins. Date-only entries are Pacific calendar dates. Existing dates are not
rewritten unless the user asks for an audit. This is a documentation convention only — no runtime
timezone behaviour changes.
