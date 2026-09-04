# Card system reconciliation — four card layouts + flag consistency

Created: 2026-09-04
Mode: PLAN / RECONCILE ONLY. No application code changes, no UI changes in this pass.

## What the four specs are, in one line

One shared card grammar — thumbnail / header (h1 + h2 + upper-right controls) / subheader badges / body rows / footer (left float + trailing text) / optional expand-collapse footer — applied to: movie card (Movies list), episode card (movie detail), movie card (podcast show page), episode card (podcast show page). The Gemini mockup is layout reference only; Cinema Neon styling stays authoritative.

## Reconciliation against existing work

Already covered — do not duplicate:
- Watched / not-interested / watchlist controls in the header upper-right, commentary + rating + duration badges, podcast cover strip, service badges, genres: all exist on the Movies card today. The spec's only genuine delta there is dropping the redundant "Watched" badge and shrinking the commentary badge — that is exactly **Pass E — Card cleanup**. Fold the Movies-card items into E rather than a new pass.
- Truncated episode description with expand, consistent title/date/duration/controls across movie and podcast surfaces: **Pass J1**, still open on those exact items (only the admin "Mark episode reviewed" part shipped 2026-09-03). The spec's "body row 1/2 = description truncated to 2 lines with expand" is J1, not new.
- In-row description in admin Match review: **Pass U24** (built 2026-09-03) — separate surface, no overlap; keep the same expand component so the two stay consistent.
- Cover art as a left thumbnail with a link to the show: pattern already shipped in **Pass U18** (admin curation rows). Reuse its `Artwork` usage; circular variant is the only addition.
- "Movie-focused vs episode-focused view" on the podcast page: J1's segmented control, and the sort/filter controls above it are **J3** (shipped). The spec's two podcast-page card types are the two halves of that same toggle — reconcile as J1, not a new concept.
- Heart / "prefer this show": exists on the podcast show header today. Spec moves a copy of it under the cover art on the movie-detail episode card. Follow-up undo/labelling of that heart is already **Pass F**.
- Podcast platform badges + "Listen ↗": exist on the podcast show header and on movie-detail episode rows. Spec asks for them in the episode-card footer on both surfaces.
- Rate / listened / audio-quality controls: exist on movie-detail episode cards only. Spec asks for the same expand-collapse footer on podcast-page episode cards.
- Genuinely new: (a) one shared card shell/primitives instead of four hand-written layouts, (b) episode-movie link rows *inside* movie cards on the podcast page and movie link rows inside episode cards, (c) circular flag control everywhere, (d) small-caps eyebrow h1 above the title on episode cards, (e) rating controls on the podcast-page episode card.

## Proposed passes (smallest independently testable units)

**Pass K1 — Shared flag control, circular everywhere — S (~1-2 credits)**
`FlagMatchButton` keeps one circular shape; the `inline` pill variant is retired and its call sites (podcast show page, any list-style usage) adopt the circular treatment already used on movie-page episode rows. Acceptance: every flag control in the app is the same circular size/hit area at 390px; changing the component changes all surfaces.

**Pass K2 — Card shell primitives — S (~1-2 credits) — NEEDS DESIGN**
Extract `CardShell` / `CardHeader` (h1, muted inline or eyebrow h2, upper-right control slot) / `CardBadges` / `CardBody` / `CardFooter` (left float + trailing text) / `CardExpand`, plus a `circle` shape on `Artwork`. No visible change beyond the Movies card re-expressed through them, so it is verifiable by diffing the current card against the new one. Design exploration: one option set for eyebrow-vs-inline h2, footer density, and circular vs rounded-square cover art.

**Pass K3 — Movies list card to spec — S (~1-2 credits)** (absorbs Pass E)
Drop the "Watched" badge, shrink the commentary badge, split body into "cover art + total episode count" and "unique podcast coverage" rows, footer = service badges (icon + name) then bullet genres. Retire Pass E as a separate entry.

**Pass K4 — Podcast-page movie card — M (~3-5 credits)**
Poster, title + muted year, header controls, one body row per episode link (episode title + date, truncated, circular flag right), footer = icon-only service badges then genres. Depends on K1/K2.

**Pass K5 — Movie-detail episode card — M (~3-5 credits)** (absorbs the open half of J1 for this surface)
Circular cover with heart beneath, small-caps show name over episode title, upper-right flag + mark-listened, date/duration subheader, 2-line description with expand, footer = Listen ↗ then platform badges, trailing admin actions, expand-collapse rate/listened/quality footer.

**Pass K6 — Podcast-page episode card — M (~3-5 credits)** (absorbs the rest of open J1)
No thumbnail, small-caps date over episode title, mark-listened upper-right, duration subheader, one body row per linked movie (title + year, circular flag right), same footer and expand-collapse rating footer as K5 — which finally makes the two episode cards behave identically. Retire J1's remaining items once K5+K6 land; J1's segmented movie/episode view stays open as its own small follow-up.

Suggested order: K1 → K2 → K3 → K5 → K6 → K4. Total ~14-20 credits.

## Acceptance approach (per pass)

Each pass ends with a labelled checklist (Verified / Implemented, not verified / Deferred / Needs follow-up), verified in the running app at 390px and 1280px, with zero horizontal overflow and no regression to watched / not-interested / watchlist / flag / review actions.

## Roadmap edits this plan will make on approval

Add K1-K6 to `.lovable/roadmap.md`; mark Pass E superseded by K3; narrow Pass J1 to the segmented view only, noting K5/K6 carry its row work; cross-reference U18 (thumbnail pattern), U24 (shared description expander) and F (heart undo). No implementation.
