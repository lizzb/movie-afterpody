# Movie Afterparty admin workflow

## Pass acceptance workflow

Before building a multi-item pass, write a testable acceptance checklist plus the minimum
verification steps per criterion, and flag anything the spec does not actually cover instead
of quietly deciding it.

Every pass summary labels each promised item:

- **Verified** — checked in code and in the running app, naming route and device/environment.
- **Implemented, not verified** — code exists, runtime verification not done.
- **Deferred** — intentionally not built.
- **Needs follow-up** — present but not at the requested UX quality.

A pass is not treated as verified unless all required acceptance items are verified or explicitly
deferred. Verification is mandatory for mobile/PWA layout, popovers, filters and stateful controls.

## Trigger keywords

- `ACCEPT: <PASS_ID>` (also `ACCEPTANCE: <PASS_ID>`) — write or refresh the acceptance-criteria
  checklist plus minimum verification steps for that pass into a dated plan file. No product-code
  changes and no scope change. Accepts multiple IDs.

- `BUILD: <PASS_ID>` — implement only the named pass. Use the pass ID as the primary anchor and
  read only the roadmap entry and linked plan/acceptance material needed for that pass. If no
  acceptance checklist exists yet, derive the minimum checklist from those targeted sources.
  Do not broadly audit unrelated roadmap history or plan files. Build against the requested scope,
  then verify in the running app as required.

- `PLAN: <PASS_ID>` / `PLAN (backlog only)` — planning, scoping, estimation, and requested
  roadmap/plan documentation only. A PLAN turn may create or update the requested roadmap entry
  and/or detailed plan documentation. It must make zero product-code changes and must not initiate
  or perform a secondary BUILD.

  If the requested deliverable is a roadmap/backlog entry, file that entry directly. Do not stop
  after creating a detached plan artifact unless the user explicitly requested a separate plan
  artifact.

Current acceptance-criteria set:
`.lovable/plan/acceptance-criteria-u8-u24-u4-p-u23-2026-09-02.md`
(U8, U24, U4, P, U23).

## Triage workflow

### Workflow keyword: TRIAGE

When a user message begins with `TRIAGE:`:

1. Investigate the reported problem using the current implementation and targeted searches of the
   roadmap and relevant plan files.
2. Use supplied pass IDs, routes, components, functions, or other concrete anchors first.
3. Identify the root cause or strongest supported diagnosis.
4. Check whether an existing pass already owns the problem before creating anything new.
5. Do not implement a fix during TRIAGE, even when the cause and smallest safe fix are clear.
6. Report:
   - root cause or strongest supported diagnosis;
   - smallest plausible fix;
   - important verification considerations;
   - existing roadmap ownership, if any;
   - remaining uncertainty.
7. If deeper work is genuinely required, estimate the scope and add or update the appropriate
   backlog pass rather than implementing it.
8. Do not turn TRIAGE into unrelated cleanup, refactoring, redesign, or opportunistic improvement.

Clearly state which branch was taken:

`TRIAGE COMPLETE — RECOMMENDED FIX`

or

`NEEDS DEEPER WORK — BACKLOGGED`

## Verification workflow

### Workflow keyword: VERIFY SWEEP

Documentation/planning only.

1. List roadmap items currently labelled IMPLEMENTED, NOT VERIFIED or NEEDS FOLLOW-UP.
2. For each, write the concrete test that would settle it: route, viewport, data precondition,
   and expected observation.
3. Separate them into:
   - verifiable now;
   - verifiable only with a forced-failure harness;
   - blocked on an environmental dependency;
   - no realistic path to verification.
4. For the last group, state why and recommend accept-as-is / retire / re-scope.
5. File testable verification work as scoped `V*` passes with estimates.
6. No product-code changes and no status promotions during VERIFY SWEEP.

This is low priority hygiene, not a release gate.

### Workflow keyword: VERIFY: <PASS_ID>

Execute one filed verification pass against the running app.

Use the named pass ID as the primary retrieval anchor. Read only the relevant roadmap entry and
verification/plan material needed for that pass.

Promote the pass to VERIFIED with date and evidence when all required verification succeeds.
Otherwise leave it labelled with the blocker named.

A small defect discovered during verification follows TRIAGE; it does not expand the verification
pass.

Do not move or reorder pass entries merely because their verification status changed.

## Admin verification identity

Admin-only surfaces must be verified through the real path — JWT → `requireSupabaseAuth` → RLS →
`has_role` — never by weakening a policy or a client guard.

Standing procedure:

1. `lovable auth-session --json` mints a short-lived real session for the project's sole auth user.
2. `python3 scripts/verify-admin-session.py [/admin/ingest]` restores that session into Playwright
   and reports whether the admin surface loads.
3. Run the pass's own assertion in the restored context.
4. Use a fresh signed-out context as the negative control where appropriate.

Do not create a second verification identity merely to simplify testing when the existing procedure
already provides the required authenticated path.

An admin-only item must not be labelled VERIFIED when required authenticated UI remains untested.

## Plan-section completeness

Every new or re-scoped pass plan section must contain these labelled fields:

- **Effort**
- **Confidence (in estimate)** — High / Medium / Low. Low confidence means the estimate is a placeholder and
  the first step is measurement, not implementation.
- **Scope** — files/areas affected.
- **Major steps** — the ordered work, not a single sentence.
- **Dependencies** — other passes, data, deployment, or admin-session prerequisites.
- **Unknowns** — what is not yet understood, and what would have to be measured first.
- **Complexity drivers** — what makes this harder than its size suggests (shared code paths,
  migrations, admin-only verification, matcher scoring, performance measurement, external APIs).
- **Acceptance criteria**
- **Filed date**

All fields must be present even when the value is:

`none`, `not applicable`, `missing`, or equivalent explicit wording.

Grouped plan files are allowed and preferred for closely related passes. Each pass still gets its own
clearly labelled section keyed by its pass ID.

## Plan-file retrieval

When a roadmap entry contains a `Plan:` reference:

- use that file/pass section as the detailed specification when needed;
- search by pass ID or the specified file path;
- do not read unrelated plan files merely because they exist;
- do not create a new plan file when a suitable active grouped plan already exists.

## Roadmap documentation conventions

The roadmap is the current source of truth for pass ownership, current status, and current backlog
scope.

Pass ordering is not priority, authorization, or an implied "next task".

Do not:

- reorder passes merely because status changes;
- move completed passes between sections merely because they are completed;
- infer what should be built next from document position;
- infer BUILD authorization from roadmap status or plan detail.

When a roadmap/status update names exact pass IDs, edit those entries directly and use the evidence
already supplied by the user/request. Do not inspect product code or rerun verification merely to
support a documentation update unless the request explicitly requires that investigation.

If a named documentation target is missing, duplicated, or materially contradictory, report the
discrepancy rather than broadening the task into a general audit.

## Credit reporting and estimates

Credit values reported in chat are estimates, not billed-cost readings.

Use the project's S/M/L/XL bands. A new or re-scoped pass must record effort, confidence, scope,
major steps, dependencies, unknowns, complexity drivers, and acceptance criteria.

## Credit ceiling

`CREDITLIMIT=N` in a request sets a hard ceiling of roughly N credits for that request.

When approaching the ceiling:

1. preserve completed work and leave the project coherent;
2. stop optional exploration;
3. report evidence, completed changes, verification, remaining uncertainty, and estimated
   remaining scope;
4. wait for the user's decision before continuing.

TRIAGE and debugging default to CREDITLIMIT=3 unless the request says otherwise.
`CREDITLIMIT=none` removes the ceiling for that request only.

## Roadmap timestamp rule

All dates written into `.lovable/roadmap.md`, pass history, verification stamps and plan `Filed date`
fields use **America/Los_Angeles** calendar dates.

Convert UTC timestamps before writing. If conversion crosses midnight, the Pacific calendar date wins.

Do not rewrite existing dates unless the user asks for an audit.

## Execution-mode invariant

PLAN never implements product code.

BUILD is the only mode that authorizes product-code changes, and only from explicit user
authorization.

Detailed implementation specifications, acceptance criteria, implementation-ready passes, or a
previous plan do not override PLAN mode.

A PLAN turn ends with planning/documentation only. It never launches a secondary BUILD.

When a message contains a PLAN trigger, treat PLAN as authoritative.

If a message contains no valid trigger and is genuinely ambiguous between planning and implementation,
ask whether the user wants PLAN or BUILD before changing product code.

If PLAN is violated:

1. stop immediately;
2. do not revert automatically;
3. freeze the unapproved implementation;
4. record it as **UNAPPROVED IMPLEMENTATION, FROZEN**;
5. report the exact files/changes/verification;
6. await explicit user direction.
