<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Agent operating rules

### Scope

Honor the requested mode exactly:

- BUILD = implementation authorized.
- PLAN = planning only.
- AUDIT = inspection/diagnosis only.
- RECONCILE / DOCS = documentation changes only.

Never implement code during PLAN, AUDIT, or documentation-only work unless the user explicitly changes the authorization.

### Scope checkpoints

When implementation materially exceeds the approved estimate or crosses an effort band:

- preserve completed work;
- stop before materially expanding scope;
- report completed work, remaining work, reason for increase, and revised estimate;
- await a user decision before continuing.

Do not revert useful completed work merely to stay within the original estimate.

### Status truth

Do not mark work SHIPPED unless its acceptance criteria are verified.

Use IMPLEMENTED, NOT VERIFIED when code exists but verification is blocked or incomplete.

Record environmental verification blockers explicitly.

### Reconciliation

Before creating a new pass:

- inspect `.lovable/roadmap.md`;
- inspect relevant `.lovable/plan/` files;
- identify overlap, supersession, dependencies, and existing components;
- prefer extending an existing pass over creating a duplicate.

### Documentation ownership

- Project Knowledge = durable agent workflow rules and project context.
- `.lovable/product-principles.md` = product principles and decision criteria.
- `.lovable/roadmap.md` = current status, backlog, dependencies, and pass ownership.
- `.lovable/plan/` = detailed pass-specific specifications and historical planning.

Do not duplicate large bodies of information between these locations.
